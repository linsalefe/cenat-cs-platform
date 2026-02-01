"""
Serviço para buscar dados de cursos do Moodle.
"""
import os
from dotenv import load_dotenv
import httpx
from datetime import datetime

load_dotenv()

MOODLE_URL = os.getenv("MOODLE_URL", "")
MOODLE_TOKEN = os.getenv("MOODLE_TOKEN", "")


async def call_moodle(function: str, params: dict = None) -> dict | list:
    """Chamada genérica ao Moodle Web Service."""
    url = f"{MOODLE_URL}/webservice/rest/server.php"
    data = {
        "wstoken": MOODLE_TOKEN,
        "wsfunction": function,
        "moodlewsrestformat": "json",
        **(params or {})
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, data=data)
        return resp.json()


async def get_all_courses():
    """Retorna todos os cursos com info básica."""
    courses = await call_moodle("core_course_get_courses")

    if not isinstance(courses, list):
        return []

    result = []
    for c in courses:
        if c["id"] == 1:
            continue
        result.append({
            "id": c["id"],
            "fullname": c["fullname"],
            "shortname": c["shortname"],
            "startdate": c.get("startdate"),
            "enddate": c.get("enddate"),
            "visible": c.get("visible", 1),
        })

    return result


async def get_course_enrollments(course_id: int):
    """Retorna alunos e professores matriculados no curso."""
    users = await call_moodle("core_enrol_get_enrolled_users", {"courseid": course_id})

    if not isinstance(users, list):
        return {"students": [], "teachers": []}

    students = []
    teachers = []

    for u in users:
        roles = [r["shortname"] for r in u.get("roles", [])]
        user_data = {
            "id": u["id"],
            "fullname": u.get("fullname", ""),
            "email": u.get("email", ""),
            "lastaccess": u.get("lastaccess"),
            "lastcourseaccess": u.get("lastcourseaccess"),
            "roles": roles,
        }

        if "editingteacher" in roles or "teacher" in roles:
            teachers.append(user_data)
        elif "student" in roles:
            students.append(user_data)

    return {"students": students, "teachers": teachers}


async def get_course_contents(course_id: int):
    """Retorna conteúdo/seções do curso."""
    data = await call_moodle("core_course_get_contents", {"courseid": course_id})

    if not isinstance(data, list):
        return []

    sections = []
    for s in data:
        modules = []
        for m in s.get("modules", []):
            modules.append({
                "id": m["id"],
                "name": m.get("name", ""),
                "modname": m.get("modname", ""),
                "modplural": m.get("modplural", ""),
                "completion": m.get("completion", 0),
            })

        sections.append({
            "id": s["id"],
            "name": s.get("name", ""),
            "summary": s.get("summary", ""),
            "modules": modules,
        })

    return sections


async def get_course_assignments(course_id: int):
    """Retorna atividades avaliativas do curso com prazos."""
    data = await call_moodle("mod_assign_get_assignments", {
        "courseids[0]": course_id,
    })

    if not isinstance(data, dict) or "courses" not in data:
        return []

    assignments = []
    for course in data["courses"]:
        for a in course.get("assignments", []):
            duedate = None
            if a.get("duedate"):
                duedate = datetime.fromtimestamp(a["duedate"]).isoformat()

            assignments.append({
                "id": a["id"],
                "name": a["name"],
                "duedate": duedate,
                "course_id": course_id,
                "course_name": course.get("fullname", ""),
            })

    return sorted(assignments, key=lambda x: x["duedate"] or "9999")


async def get_all_upcoming_assignments():
    """Retorna todas as atividades futuras de todos os cursos."""
    courses = await get_all_courses()
    now = datetime.now()
    all_assignments = []

    for course in courses:
        try:
            assigns = await get_course_assignments(course["id"])
            for a in assigns:
                if a["duedate"]:
                    due = datetime.fromisoformat(a["duedate"])
                    a["course_name"] = course["fullname"]
                    a["days_remaining"] = (due - now).days
                    all_assignments.append(a)
        except Exception:
            continue

    return sorted(all_assignments, key=lambda x: x["duedate"])
