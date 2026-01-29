from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.db.session import SessionLocal
from app.models.student import Student
from app.services.risk_service import calculate_student_risk

scheduler = AsyncIOScheduler()


def recalculate_all_risks():
    """Job que recalcula o score de risco de todos os alunos"""
    print("🔄 Iniciando recálculo de scores de risco...")
    
    db = SessionLocal()
    try:
        students = db.query(Student).all()
        
        results = {"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}
        
        for student in students:
            try:
                risk_score = calculate_student_risk(db, student)
                results["total"] += 1
                results[risk_score.level.value] += 1
            except Exception as e:
                print(f"❌ Erro ao calcular risco do aluno {student.id}: {e}")
        
        print(f"✅ Recálculo concluído: {results}")
        
    except Exception as e:
        print(f"❌ Erro no job de recálculo: {e}")
    finally:
        db.close()


def sync_moodle_students():
    """Job que sincroniza alunos do Moodle"""
    from app.jobs.sync_students import sync_students_from_moodle
    sync_students_from_moodle()


def start_scheduler():
    """Inicia o scheduler com os jobs configurados"""
    
    # Sincroniza alunos do Moodle todos os dias às 5h
    scheduler.add_job(
        sync_moodle_students,
        trigger=CronTrigger(hour=5, minute=0),
        id="sync_moodle_students_daily",
        name="Sincronização diária de alunos do Moodle",
        replace_existing=True,
    )
    
    # Recalcula scores todos os dias às 6h (depois da sincronização)
    scheduler.add_job(
        recalculate_all_risks,
        trigger=CronTrigger(hour=6, minute=0),
        id="recalculate_risks_daily",
        name="Recálculo diário de scores de risco",
        replace_existing=True,
    )
    
    scheduler.start()
    print("⏰ Scheduler iniciado:")
    print("   - Sync Moodle: 5h diariamente")
    print("   - Recálculo de riscos: 6h diariamente")


def shutdown_scheduler():
    """Para o scheduler"""
    scheduler.shutdown()
