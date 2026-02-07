import asyncio
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


def run_triggers():
    """Job que executa todos os triggers ativos"""
    print("🎯 Iniciando execução de triggers...")
    
    from app.services import trigger_service
    
    db = SessionLocal()
    try:
        results = asyncio.run(trigger_service.run_all_triggers(db))
        print(f"✅ Triggers executados: {results['actions_executed']} ações, {results['actions_skipped']} ignorados")
    except Exception as e:
        print(f"❌ Erro no job de triggers: {e}")
    finally:
        db.close()


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
    
    # Executa triggers todos os dias às 7h (depois do recálculo de risco)
    scheduler.add_job(
        run_triggers,
        trigger=CronTrigger(hour=7, minute=0),
        id="run_triggers_daily",
        name="Execução diária de triggers automáticos",
        replace_existing=True,
    )
    
    # Processa steps das réguas a cada 5 minutos
    scheduler.add_job(
        process_journey_steps,
        trigger="interval",
        minutes=5,
        id="process_journey_steps",
        name="Processamento de steps das réguas",
        replace_existing=True,
    )

    scheduler.start()
    print("⏰ Scheduler iniciado:")
    print("   - Sync Moodle: 5h diariamente")
    print("   - Recálculo de riscos: 6h diariamente")
    print("   - Execução de triggers: 7h diariamente")
    print("   - Réguas de jornada: a cada 5 minutos")


def shutdown_scheduler():
    """Para o scheduler"""
    scheduler.shutdown()


def process_journey_steps():
    """Job que processa steps pendentes das réguas"""
    from app.services.journey_service import process_pending_steps
    
    db = SessionLocal()
    try:
        processed = process_pending_steps(db)
        if processed > 0:
            print(f"📋 Réguas: {processed} steps processados")
    except Exception as e:
        print(f"❌ Erro no job de réguas: {e}")
    finally:
        db.close()
