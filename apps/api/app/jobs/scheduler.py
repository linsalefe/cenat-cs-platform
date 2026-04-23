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
    """Job que executa todos os triggers ativos (sistema legacy)"""
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


# ============================================================
# B.3 — Workflow dispatcher jobs
# ============================================================

def evaluate_workflow_triggers():
    """Varredura periódica: dispara workflows com triggers temporais.

    Cobre: trigger.risk_critical, trigger.payment_overdue,
    trigger.moodle_inactive, trigger.nps_low (via feedbacks recentes).
    Respeita dedup de 24h — mesmo aluno não é disparado 2x no mesmo workflow.
    """
    from app.services import workflow_dispatcher

    db = SessionLocal()
    try:
        r_risk = workflow_dispatcher.scan_risk(db)
        r_payment = workflow_dispatcher.scan_payment_overdue(db)
        r_moodle = workflow_dispatcher.scan_moodle_inactive(db)
        r_nps = workflow_dispatcher.scan_nps_feedbacks(db, window_minutes=30)
        total = (
            r_risk["dispatched"]
            + r_payment["dispatched"]
            + r_moodle["dispatched"]
            + r_nps["dispatched"]
        )
        if total > 0:
            print(
                f"🎯 Workflows disparados: risk={r_risk['dispatched']} "
                f"payment={r_payment['dispatched']} "
                f"moodle={r_moodle['dispatched']} "
                f"nps={r_nps['dispatched']}"
            )
    except Exception as e:
        print(f"❌ Erro no job de workflows: {e}")
    finally:
        db.close()


def resume_delayed_workflow_runs():
    """Retoma runs parqueadas em waiting_delay com resume_at <= agora."""
    from app.services import workflow_dispatcher

    db = SessionLocal()
    try:
        out = workflow_dispatcher.resume_delayed_runs(db)
        if out["resumed"] > 0 or out["errors"] > 0:
            print(
                f"⏱️  Delays retomados: {out['resumed']}/{out['eligible']} "
                f"(erros: {out['errors']})"
            )
    except Exception as e:
        print(f"❌ Erro no job de delays: {e}")
    finally:
        db.close()


def start_scheduler():
    """Inicia o scheduler com os jobs configurados"""

    # --- Jobs pré-existentes ---
    scheduler.add_job(
        sync_moodle_students,
        trigger=CronTrigger(hour=5, minute=0),
        id="sync_moodle_students_daily",
        name="Sincronização diária de alunos do Moodle",
        replace_existing=True,
    )

    scheduler.add_job(
        recalculate_all_risks,
        trigger=CronTrigger(hour=6, minute=0),
        id="recalculate_risks_daily",
        name="Recálculo diário de scores de risco",
        replace_existing=True,
    )

    scheduler.add_job(
        run_triggers,
        trigger=CronTrigger(hour=7, minute=0),
        id="run_triggers_daily",
        name="Execução diária de triggers automáticos (legacy)",
        replace_existing=True,
    )

    scheduler.add_job(
        process_journey_steps,
        trigger="interval",
        minutes=5,
        id="process_journey_steps",
        name="Processamento de steps das réguas",
        replace_existing=True,
    )

    # --- B.3: Workflow jobs ---
    scheduler.add_job(
        evaluate_workflow_triggers,
        trigger="interval",
        minutes=15,
        id="evaluate_workflow_triggers",
        name="Avaliação de gatilhos de workflows (B.3)",
        replace_existing=True,
    )

    scheduler.add_job(
        resume_delayed_workflow_runs,
        trigger="interval",
        minutes=5,
        id="resume_delayed_workflow_runs",
        name="Retomada de delays de workflows (B.3)",
        replace_existing=True,
    )

    scheduler.start()
    print("⏰ Scheduler iniciado:")
    print("   - Sync Moodle: 5h diariamente")
    print("   - Recálculo de riscos: 6h diariamente")
    print("   - Execução de triggers legacy: 7h diariamente")
    print("   - Réguas de jornada: a cada 5 minutos")
    print("   - Workflows — avaliação de triggers: a cada 15 minutos")
    print("   - Workflows — retomada de delays: a cada 5 minutos")


def shutdown_scheduler():
    """Para o scheduler"""
    scheduler.shutdown()
