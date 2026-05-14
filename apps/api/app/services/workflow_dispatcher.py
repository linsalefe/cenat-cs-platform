"""
Workflow Dispatcher — B.3

Ponto central que decide quando um workflow deve ser disparado
automaticamente (scheduler ou evento em tempo real).

Responsabilidades:
  1. Dado um evento (ex: "ticket_opened"), buscar workflows ativos com o
     trigger correspondente.
  2. Para cada workflow, verificar se o aluno satisfaz a config do trigger.
  3. Aplicar dedup — mesmo workflow + mesmo aluno não dispara 2x em 24h
     (disparos manuais são sempre permitidos).
  4. Chamar workflow_engine.execute_workflow().

Além disso, expõe "scans" periódicos que o scheduler chama em intervalos
para avaliar triggers temporais (risk, payment, nps, moodle_inactive) e
retomar delays.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.workflow import Workflow
from app.models.workflow_run import WorkflowRun
from app.models.student import Student
from app.models.feedback import Feedback, FeedbackType
from app.services import workflow_engine


DEDUP_WINDOW_HOURS = 24

# Tradução evento → tipo de trigger que procuramos nos workflows
EVENT_TO_TRIGGER: dict[str, str] = {
    "risk_updated": "trigger.risk_critical",
    "moodle_inactive": "trigger.inactive_moodle",
    "payment_overdue": "trigger.payment_overdue",
    "nps_low": "trigger.nps_low",
    "ticket_opened": "trigger.ticket_opened",
    "onboarding_entered": "trigger.onboarding_entered",
}

# Ordem das prioridades de ticket (pra trigger.ticket_opened)
TICKET_PRIORITY_ORDER = {
    "baixa": 1,
    "media": 2,
    "alta": 3,
    "urgente": 4,
    # Aliases do enum do backend (low/medium/high/urgent)
    "low": 1,
    "medium": 2,
    "high": 3,
    "urgent": 4,
}


# ============================================================
# Dedup
# ============================================================

def _has_recent_auto_run(
    db: Session,
    workflow_id: int,
    student_id: int,
    hours: int = DEDUP_WINDOW_HOURS,
) -> bool:
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    existing = (
        db.query(WorkflowRun.id)
        .filter(
            WorkflowRun.workflow_id == workflow_id,
            WorkflowRun.student_id == student_id,
            WorkflowRun.triggered_by != "manual",
            WorkflowRun.started_at >= cutoff,
        )
        .first()
    )
    return existing is not None


# ============================================================
# Match config de trigger
# ============================================================

def _trigger_matches(
    trigger_node: dict, student: Student, db: Session, context: dict
) -> bool:
    """Avalia se o aluno+contexto satisfaz a config do trigger node."""
    t_type = trigger_node.get("type") or ""
    data = trigger_node.get("data") or {}

    if t_type == "trigger.risk_critical":
        min_level = data.get("min_level") or "alto"
        if min_level not in workflow_engine.RISK_ORDER:
            return False
        current = workflow_engine._get_student_current_risk_level(db, student.id)
        if current is None:
            return False
        return workflow_engine.RISK_ORDER.get(current, 0) >= workflow_engine.RISK_ORDER[
            min_level
        ]

    if t_type == "trigger.payment_overdue":
        if student.financial_status != "inadimplente":
            return False
        if not (student.overdue_value and student.overdue_value > 0):
            return False
        return True

    if t_type == "trigger.ticket_opened":
        min_priority = (data.get("min_priority") or "baixa").lower()
        ctx_priority = str(context.get("priority") or "baixa").lower()
        return TICKET_PRIORITY_ORDER.get(
            ctx_priority, 0
        ) >= TICKET_PRIORITY_ORDER.get(min_priority, 1)

    if t_type == "trigger.nps_low":
        score = context.get("score")
        if score is None:
            return False
        try:
            max_score = int(data.get("max_score") or 6)
        except (TypeError, ValueError):
            max_score = 6
        return int(score) <= max_score

    if t_type == "trigger.onboarding_entered":
        # Dispara sempre que o aluno entra no onboarding com status "novo".
        # O filtro de status é feito pelo próprio evento (só emitido em "novo").
        return True

    if t_type == "trigger.inactive_moodle":
        # Best-effort: o model Student não tem 'last_moodle_access'.
        # Usamos abandonment_status como proxy. O campo 'days' é informativo,
        # não é avaliado exatamente.
        return student.abandonment_status in ("at_risk", "abandoned")

    return False


# ============================================================
# Dispatch principal
# ============================================================

def dispatch(
    db: Session,
    event_type: str,
    student: Student,
    context: Optional[dict] = None,
) -> list[dict[str, Any]]:
    """Dispara workflows ativos que combinam com o evento.

    Retorna lista de outcomes: {workflow_id, run_id, status, reason}.
    Nunca levanta exceção — erros viram entries no retorno.
    """
    context = context or {}
    trigger_type = EVENT_TO_TRIGGER.get(event_type)
    if not trigger_type:
        return []

    active_workflows = (
        db.query(Workflow).filter(Workflow.status == "active").all()
    )

    outcomes: list[dict[str, Any]] = []

    for wf in active_workflows:
        nodes = wf.nodes or []
        for node in nodes:
            if node.get("type") != trigger_type:
                continue

            # Match config
            try:
                matched = _trigger_matches(node, student, db, context)
            except Exception as exc:  # noqa: BLE001
                outcomes.append(
                    {
                        "workflow_id": wf.id,
                        "run_id": None,
                        "status": "error",
                        "reason": f"match_error: {type(exc).__name__}: {exc}",
                    }
                )
                continue
            if not matched:
                continue

            # Dedup
            if _has_recent_auto_run(db, wf.id, student.id):
                outcomes.append(
                    {
                        "workflow_id": wf.id,
                        "run_id": None,
                        "status": "skipped",
                        "reason": "dedup_window",
                    }
                )
                # Não tenta outros triggers do mesmo workflow
                break

            # Executa
            try:
                run = workflow_engine.execute_workflow(
                    db=db,
                    workflow=wf,
                    student=student,
                    trigger_node_id=node.get("id"),
                    triggered_by=event_type,
                    triggered_by_user=None,
                )
                outcomes.append(
                    {
                        "workflow_id": wf.id,
                        "run_id": run.id,
                        "status": run.status,
                        "reason": None,
                    }
                )
                # Um disparo por workflow por evento
                break
            except Exception as exc:  # noqa: BLE001
                outcomes.append(
                    {
                        "workflow_id": wf.id,
                        "run_id": None,
                        "status": "error",
                        "reason": f"execute_error: {type(exc).__name__}: {exc}",
                    }
                )
                break

    return outcomes


# ============================================================
# Scans periódicos (scheduler)
# ============================================================

def scan_risk(db: Session) -> dict:
    """Varre alunos com RiskScore e dispara workflows de risco."""
    dispatched = 0
    students = db.query(Student).all()
    for s in students:
        outs = dispatch(db, "risk_updated", s)
        dispatched += sum(1 for o in outs if o.get("run_id"))
    return {"scanned": len(students), "dispatched": dispatched}


def scan_payment_overdue(db: Session) -> dict:
    dispatched = 0
    students = (
        db.query(Student)
        .filter(Student.financial_status == "inadimplente")
        .filter(Student.overdue_value > 0)
        .all()
    )
    for s in students:
        outs = dispatch(db, "payment_overdue", s)
        dispatched += sum(1 for o in outs if o.get("run_id"))
    return {"scanned": len(students), "dispatched": dispatched}


def scan_moodle_inactive(db: Session) -> dict:
    dispatched = 0
    students = (
        db.query(Student)
        .filter(Student.abandonment_status.in_(["at_risk", "abandoned"]))
        .all()
    )
    for s in students:
        outs = dispatch(db, "moodle_inactive", s)
        dispatched += sum(1 for o in outs if o.get("run_id"))
    return {"scanned": len(students), "dispatched": dispatched}


def scan_nps_feedbacks(db: Session, window_minutes: int = 30) -> dict:
    """Busca feedbacks NPS criados nos últimos N minutos e tenta disparar."""
    cutoff = datetime.utcnow() - timedelta(minutes=window_minutes)
    feedbacks = (
        db.query(Feedback)
        .filter(
            Feedback.feedback_type == FeedbackType.NPS,
            Feedback.score.isnot(None),
            Feedback.created_at >= cutoff,
        )
        .all()
    )
    dispatched = 0
    for fb in feedbacks:
        student = db.query(Student).filter(Student.id == fb.student_id).first()
        if not student:
            continue
        outs = dispatch(db, "nps_low", student, {"score": fb.score})
        dispatched += sum(1 for o in outs if o.get("run_id"))
    return {"scanned": len(feedbacks), "dispatched": dispatched}


def resume_delayed_runs(db: Session, limit: int = 50) -> dict:
    """Retoma runs parqueadas em waiting_delay com resume_at <= agora."""
    now = datetime.utcnow()
    runs = (
        db.query(WorkflowRun)
        .filter(
            WorkflowRun.status == "waiting_delay",
            WorkflowRun.resume_at.isnot(None),
            WorkflowRun.resume_at <= now,
        )
        .limit(limit)
        .all()
    )
    resumed = 0
    errors = 0
    for run in runs:
        try:
            workflow_engine.resume_workflow(db, run)
            resumed += 1
        except Exception as exc:  # noqa: BLE001
            errors += 1
            print(f"❌ Erro ao retomar run {run.id}: {exc}")
    return {"eligible": len(runs), "resumed": resumed, "errors": errors}


# ============================================================
# E3 — Wait-for-reply dispatchers (usado pelo webhook + scheduler)
# ============================================================

def handle_student_replied(db: Session, student_id: int) -> int:
    """Chamado pelo webhook do WhatsApp quando entra mensagem inbound.
    Retoma runs waiting_reply do aluno pela branch 'yes'.
    Retorna quantas runs foram retomadas."""
    return workflow_engine.resume_on_reply(db, student_id)


def handle_student_button_click(
    db: Session, student_id: int, button_slug: str, clicked_text: str = ""
) -> int:
    """Webhook: retoma runs waiting_button quando o aluno clica num botão.

    button_slug deve estar normalizado (slugify) — o engine compara contra
    sourceHandle das edges, que o frontend grava como slug.
    """
    return workflow_engine.resume_on_button_click(
        db, student_id, button_slug, clicked_text=clicked_text
    )


def timeout_waiting_replies(db: Session, limit: int = 50) -> dict:
    """Chamado pelo scheduler periódico.
    Retoma runs waiting_reply com deadline estourado pela branch 'no'."""
    return workflow_engine.timeout_wait_for_reply(db, limit=limit)


def timeout_waiting_buttons(db: Session, limit: int = 50) -> dict:
    """Scheduler: dá timeout em runs waiting_button com deadline expirado."""
    return workflow_engine.timeout_wait_for_button(db, limit=limit)
