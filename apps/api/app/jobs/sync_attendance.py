import asyncio
import httpx
import os
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.session import SessionLocal
from app.models.student import Student
from app.models.attendance import AttendanceRecord


MOODLE_URL = os.getenv("MOODLE_URL", "")
MOODLE_TOKEN = os.getenv("MOODLE_TOKEN", "")


async def get_all_attendance_ids(client: httpx.AsyncClient) -> list[tuple]:
    """Retorna lista de (attendance_id, course_id, name) de todos os cursos"""
    r = await client.get(f"{MOODLE_URL}/webservice/rest/server.php", params={
        "wstoken": MOODLE_TOKEN,
        "wsfunction": "core_course_get_courses",
        "moodlewsrestformat": "json"
    })
    courses = r.json()

    att_ids = []
    for course in courses:
        r2 = await client.get(f"{MOODLE_URL}/webservice/rest/server.php", params={
            "wstoken": MOODLE_TOKEN,
            "wsfunction": "core_course_get_contents",
            "moodlewsrestformat": "json",
            "courseid": course["id"]
        })
        sections = r2.json()
        if isinstance(sections, list):
            for section in sections:
                for module in section.get("modules", []):
                    if module.get("modname") == "attendance":
                        att_ids.append((module["instance"], course["id"], module["name"]))

    return att_ids


async def sync_attendance_data(db: Session) -> dict:
    """Puxa todas as presenças do Moodle e salva no banco"""

    # Mapa moodle_user_id -> student
    students = db.query(Student).filter(Student.moodle_user_id.isnot(None)).all()
    student_map = {s.moodle_user_id: s for s in students}

    stats = {"sessions": 0, "records": 0, "new": 0, "students_updated": 0, "errors": 0}

    # Estrutura pra calcular consecutivas: {moodle_user_id: {course_id: [(session_date, status)]}}
    all_records = {}

    async with httpx.AsyncClient(timeout=60) as client:
        att_ids = await get_all_attendance_ids(client)
        print(f"📋 Total attendances encontrados: {len(att_ids)}")

        for att_id, course_id, att_name in att_ids:
            try:
                r = await client.get(f"{MOODLE_URL}/webservice/rest/server.php", params={
                    "wstoken": MOODLE_TOKEN,
                    "wsfunction": "mod_attendance_get_sessions",
                    "moodlewsrestformat": "json",
                    "attendanceid": att_id
                })
                sessions = r.json()
                if not isinstance(sessions, list):
                    continue

                # Mapa de status pra este attendance
                status_map = {}
                for s in sessions:
                    for st in s.get("statuses", []):
                        status_map[str(st["id"])] = st["acronym"]

                for session in sessions:
                    stats["sessions"] += 1
                    session_date = datetime.fromtimestamp(session["sessdate"])

                    for log in session.get("attendance_log", []):
                        moodle_uid = log["studentid"]
                        status = status_map.get(str(log["statusid"]), "?")
                        session_id = session["id"]

                        # Só processa alunos que existem no sistema
                        if moodle_uid not in student_map:
                            continue

                        student = student_map[moodle_uid]
                        stats["records"] += 1

                        # Salva registro individual (upsert)
                        existing = db.query(AttendanceRecord).filter(
                            AttendanceRecord.moodle_user_id == moodle_uid,
                            AttendanceRecord.session_id == session_id,
                        ).first()

                        if not existing:
                            record = AttendanceRecord(
                                student_id=student.id,
                                moodle_user_id=moodle_uid,
                                course_id=course_id,
                                attendance_id=att_id,
                                session_id=session_id,
                                session_date=session_date,
                                status=status,
                            )
                            db.add(record)
                            stats["new"] += 1

                        # Acumula pra calcular consecutivas depois
                        if moodle_uid not in all_records:
                            all_records[moodle_uid] = {}
                        if course_id not in all_records[moodle_uid]:
                            all_records[moodle_uid][course_id] = []
                        all_records[moodle_uid][course_id].append((session_date, status))

            except Exception as e:
                print(f"   ❌ Erro no attendance {att_id}: {e}")
                stats["errors"] += 1

    db.flush()

    # Calcula resumos por aluno
    for moodle_uid, courses_data in all_records.items():
        if moodle_uid not in student_map:
            continue

        student = student_map[moodle_uid]
        total_sessions = 0
        total_absences = 0
        max_consecutive = 0

        for cid, records in courses_data.items():
            # Ordena por data
            records.sort(key=lambda x: x[0])
            statuses = [r[1] for r in records]

            total_sessions += len(statuses)
            total_absences += statuses.count("Au")

            # Consecutivas recentes (do fim pro início)
            consec = 0
            for s in reversed(statuses):
                if s == "Au":
                    consec += 1
                else:
                    break
            if consec > max_consecutive:
                max_consecutive = consec

        student.attendance_total = total_sessions
        student.attendance_absences = total_absences
        student.attendance_consecutive_absences = max_consecutive

        # Detecção de abandono: inadimplente + 8 faltas consecutivas
        is_inadimplente = student.financial_status == "inadimplente"
        has_8_absences = max_consecutive >= 8

        if is_inadimplente and has_8_absences:
            if student.abandonment_status != "abandoned":
                print(f"   🔴 ABANDONO detectado: {student.name} | {max_consecutive} faltas + inadimplente")
            student.abandonment_status = "abandoned"
        elif has_8_absences:
            student.abandonment_status = "at_risk"
        elif is_inadimplente:
            student.abandonment_status = "at_risk"
        else:
            if student.abandonment_status not in (None, "active"):
                pass  # Não reverte abandono automaticamente
            elif student.abandonment_status is None:
                student.abandonment_status = "active"

        stats["students_updated"] += 1

    db.commit()
    return stats


def run_sync():
    """Entry point síncrono"""
    db = SessionLocal()
    try:
        stats = asyncio.run(sync_attendance_data(db))
        return stats
    finally:
        db.close()
