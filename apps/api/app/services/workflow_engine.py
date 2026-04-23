"""
Workflow Engine — B.3

Mudanças em relação ao B.2:
  - Loop iterativo foi extraído em `_run_loop()` para permitir retomada.
  - Novo `resume_workflow(db, run)`: retoma run parqueada em waiting_delay,
    continuando a partir da próxima edge após o delay. Chamado pelo
    scheduler (workflow_dispatcher.resume_delayed_runs).

Demais comportamentos (triggers, conditions, actions, WhatsApp dry-run)
são idênticos ao B.2.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.workflow import Workflow
from app.models.workflow_run import WorkflowRun
from app.models.student import Student
from app.models.risk_score import RiskScore, RiskLevel
from app.models.ticket import Ticket, TicketStatus, TicketCategory, TicketPriority


# ============================================================
# Constants
# ============================================================

MAX_NODE_EXECUTIONS = 50

PRIORITY_MAP = {
    "baixa": TicketPriority.LOW,
    "media": TicketPriority.MEDIUM,
    "alta": TicketPriority.HIGH,
    "urgente": TicketPriority.URGENT,
}

RISK_ORDER = {
    "baixo": 1,
    "medio": 2,
    "alto": 3,
    "critico": 4,
}
RISK_LEVEL_TO_STR = {
    RiskLevel.LOW: "baixo",
    RiskLevel.MEDIUM: "medio",
    RiskLevel.HIGH: "alto",
    RiskLevel.CRITICAL: "critico",
}

DELAY_UNIT_TO_TIMEDELTA_KW = {
    "minutes": "minutes",
    "hours": "hours",
    "days": "days",
}

WHATSAPP_COURSE_FALLBACK = "sua pós-graduação no CENAT"


def _is_dry_run() -> bool:
    return (
        os.environ.get("WORKFLOWS_WHATSAPP_DRY_RUN", "true").strip().lower()
        != "false"
    )


# ============================================================
# Helpers: grafo
# ============================================================

def _find_node(nodes: list[dict], node_id: str) -> Optional[dict]:
    for n in nodes:
        if n.get("id") == node_id:
            return n
    return None


def _find_next_edge(
    edges: list[dict], source_id: str, source_handle: Optional[str] = None
) -> Optional[dict]:
    for e in edges:
        if e.get("source") != source_id:
            continue
        if source_handle is not None:
            if e.get("sourceHandle") != source_handle:
                continue
        return e
    return None


def _first_trigger_node_id(nodes: list[dict]) -> Optional[str]:
    for n in nodes:
        if (n.get("type") or "").startswith("trigger."):
            return n.get("id")
    return None


# ============================================================
# Student context helpers
# ============================================================

def _get_student_current_risk_level(db: Session, student_id: int) -> Optional[str]:
    rs = (
        db.query(RiskScore)
        .filter(RiskScore.student_id == student_id)
        .order_by(RiskScore.calculated_at.desc())
        .first()
    )
    if not rs or not rs.level:
        return None
    return RISK_LEVEL_TO_STR.get(rs.level)


def _gen_ticket_protocol() -> str:
    now = datetime.utcnow()
    return f"WF-{now.strftime('%Y%m%d%H%M%S%f')[:-3]}"


def _first_name(full_name: Optional[str]) -> str:
    if not full_name:
        return "aluno(a)"
    parts = full_name.strip().split()
    return parts[0] if parts else "aluno(a)"


def _course_name_or_fallback(student: Student) -> str:
    return student.primary_course_name or WHATSAPP_COURSE_FALLBACK


# ============================================================
# Condition evaluators
# ============================================================

def _evaluate_condition(
    db: Session, node: dict, student: Student
) -> tuple[bool, dict[str, Any]]:
    node_type = node.get("type") or ""
    data = node.get("data") or {}

    if node_type == "condition.course_is":
        course_ids = data.get("course_ids") or []
        try:
            course_ids_int = [int(c) for c in course_ids]
        except (ValueError, TypeError):
            course_ids_int = []
        student_course = student.primary_course_id
        matched = (
            student_course is not None and int(student_course) in course_ids_int
        )
        return matched, {
            "student_course_id": student_course,
            "expected_courses": course_ids_int,
        }

    if node_type == "condition.risk_level":
        min_level = data.get("min_level")
        current = _get_student_current_risk_level(db, student.id)
        if current is None or min_level not in RISK_ORDER:
            return False, {
                "student_risk": current,
                "expected_min_level": min_level,
                "reason": "sem_risk_score_ou_level_invalido",
            }
        matched = RISK_ORDER.get(current, 0) >= RISK_ORDER[min_level]
        return matched, {
            "student_risk": current,
            "expected_min_level": min_level,
        }

    return False, {"reason": f"condition_type_desconhecido: {node_type}"}


# ============================================================
# Action handlers
# ============================================================

def _action_send_whatsapp(
    db: Session, node: dict, student: Student, user_id: Optional[int]
) -> dict[str, Any]:
    data = node.get("data") or {}
    template = (data.get("template_name") or "").strip()
    channel = (data.get("channel") or "cs").strip() or "cs"

    dry_run = _is_dry_run()
    first_name = _first_name(student.name)
    course_name = _course_name_or_fallback(student)

    would_send = {
        "to_phone": student.phone,
        "to_name": student.name,
        "template": template or "(não informado)",
        "language": "pt_BR",
        "channel": channel,
        "params": {"1": first_name, "2": course_name},
    }

    if not template:
        return {
            "status": "error",
            "action": "send_whatsapp",
            "dry_run": dry_run,
            "error": "template_name não configurado no node",
            "would_send": would_send,
        }

    if not student.phone:
        return {
            "status": "error",
            "action": "send_whatsapp",
            "dry_run": dry_run,
            "error": f"aluno {student.id} sem telefone cadastrado",
            "would_send": would_send,
        }

    if dry_run:
        return {
            "status": "dry_run",
            "action": "send_whatsapp",
            "dry_run": True,
            "would_send": would_send,
            "note": (
                "WORKFLOWS_WHATSAPP_DRY_RUN ativo. "
                "Defina WORKFLOWS_WHATSAPP_DRY_RUN=false no .env da API "
                "e reinicie o cenat-api para enviar de verdade."
            ),
        }

    components = [
        {
            "type": "body",
            "parameters": [
                {"type": "text", "text": first_name},
                {"type": "text", "text": course_name},
            ],
        }
    ]

    try:
        from app.integrations.whatsapp_meta import send_template

        meta_result = asyncio.run(
            send_template(
                phone=student.phone,
                template_name=template,
                language="pt_BR",
                components=components,
                channel_slug=channel,
            )
        )
    except Exception as exc:  # noqa: BLE001
        return {
            "status": "error",
            "action": "send_whatsapp",
            "dry_run": False,
            "error": f"{type(exc).__name__}: {exc}",
            "would_send": would_send,
        }

    merged: dict[str, Any] = {
        "action": "send_whatsapp",
        "dry_run": False,
        "would_send": would_send,
    }
    merged.update(meta_result)
    return merged


def _action_create_ticket(
    db: Session, node: dict, student: Student, user_id: Optional[int]
) -> dict[str, Any]:
    data = node.get("data") or {}
    title = (data.get("title") or "").strip() or "Ticket criado por workflow"
    priority_key = data.get("priority") or "media"
    priority = PRIORITY_MAP.get(priority_key, TicketPriority.MEDIUM)

    assigned_to = data.get("assigned_to")
    try:
        assigned_to_id = int(assigned_to) if assigned_to else None
    except (TypeError, ValueError):
        assigned_to_id = None

    ticket = Ticket(
        protocol=_gen_ticket_protocol(),
        student_id=student.id,
        assigned_to_id=assigned_to_id,
        status=TicketStatus.OPEN,
        category=TicketCategory.OTHER,
        priority=priority,
        subject=title,
    )
    db.add(ticket)
    db.flush()

    return {
        "status": "ok",
        "action": "create_ticket",
        "ticket_id": ticket.id,
        "protocol": ticket.protocol,
        "priority": priority.value,
        "assigned_to_id": assigned_to_id,
    }


def _action_assign_user(
    db: Session, node: dict, student: Student, user_id: Optional[int]
) -> dict[str, Any]:
    data = node.get("data") or {}
    target = data.get("user_id")
    try:
        target_id = int(target) if target else None
    except (TypeError, ValueError):
        target_id = None

    if target_id is None:
        return {
            "status": "skipped",
            "action": "assign_user",
            "reason": "user_id_nao_informado",
        }

    student.assigned_to_id = target_id  # type: ignore[attr-defined]
    db.flush()

    return {
        "status": "ok",
        "action": "assign_user",
        "assigned_to_id": target_id,
    }


def _action_set_onboarding_status(
    db: Session, node: dict, student: Student, user_id: Optional[int]
) -> dict[str, Any]:
    data = node.get("data") or {}
    new_status = data.get("status")
    if not new_status:
        return {
            "status": "skipped",
            "action": "set_onboarding_status",
            "reason": "status_nao_informado",
        }

    previous = student.onboarding_status
    student.onboarding_status = new_status
    db.flush()

    return {
        "status": "ok",
        "action": "set_onboarding_status",
        "previous": previous,
        "new": new_status,
    }


ACTION_HANDLERS = {
    "action.send_whatsapp": _action_send_whatsapp,
    "action.create_ticket": _action_create_ticket,
    "action.assign_user": _action_assign_user,
    "action.set_onboarding_status": _action_set_onboarding_status,
}


# ============================================================
# Delay
# ============================================================

def _handle_delay(node: dict) -> datetime:
    data = node.get("data") or {}
    try:
        amount = int(data.get("amount") or 1)
    except (TypeError, ValueError):
        amount = 1
    unit = data.get("unit") or "days"
    kw = DELAY_UNIT_TO_TIMEDELTA_KW.get(unit, "days")
    return datetime.utcnow() + timedelta(**{kw: amount})


# ============================================================
# Loop central (reusado por execute + resume)
# ============================================================

def _run_loop(
    db: Session,
    workflow: Workflow,
    student: Student,
    run: WorkflowRun,
    start_id: str,
    triggered_by_user: Optional[int],
    initial_executed: Optional[list[str]] = None,
    initial_result: Optional[dict[str, Any]] = None,
    count_as_new_run: bool = True,
) -> WorkflowRun:
    """Percorre o grafo a partir de start_id. Atualiza run.executed_nodes,
    run.result, run.status, run.resume_at, run.finished_at no próprio objeto
    (persistido ao final). Retorna o run com dados atualizados."""

    nodes = workflow.nodes or []
    edges = workflow.edges or []

    executed_nodes: list[str] = list(initial_executed or [])
    result: dict[str, Any] = dict(initial_result or {})
    waiting_delay = False

    run.status = "running"
    db.flush()

    current_id: Optional[str] = start_id

    try:
        while current_id is not None:
            if len(executed_nodes) >= MAX_NODE_EXECUTIONS:
                raise RuntimeError(
                    f"Limite de {MAX_NODE_EXECUTIONS} nós atingido — possível loop."
                )

            node = _find_node(nodes, current_id)
            if node is None:
                raise RuntimeError(f"Nó '{current_id}' não existe no grafo.")

            node_type = node.get("type") or ""
            executed_nodes.append(current_id)
            run.current_node_id = current_id

            if node_type.startswith("trigger."):
                result[current_id] = {
                    "status": "ok",
                    "kind": "trigger",
                    "type": node_type,
                }
                nxt = _find_next_edge(edges, current_id, source_handle=None)
                current_id = nxt.get("target") if nxt else None
                continue

            if node_type.startswith("condition."):
                matched, debug = _evaluate_condition(db, node, student)
                result[current_id] = {
                    "status": "ok",
                    "kind": "condition",
                    "type": node_type,
                    "matched": matched,
                    "debug": debug,
                }
                handle = "yes" if matched else "no"
                nxt = _find_next_edge(edges, current_id, source_handle=handle)
                current_id = nxt.get("target") if nxt else None
                continue

            if node_type.startswith("delay."):
                resume_at = _handle_delay(node)
                result[current_id] = {
                    "status": "waiting",
                    "kind": "delay",
                    "type": node_type,
                    "resume_at": resume_at.isoformat(),
                }
                run.resume_at = resume_at
                waiting_delay = True
                current_id = None
                continue

            if node_type.startswith("action."):
                handler = ACTION_HANDLERS.get(node_type)
                if not handler:
                    result[current_id] = {
                        "status": "error",
                        "kind": "action",
                        "type": node_type,
                        "error": f"Handler para '{node_type}' não implementado.",
                    }
                    raise RuntimeError(
                        f"Handler não implementado para action '{node_type}'."
                    )
                action_result = handler(db, node, student, triggered_by_user)
                result[current_id] = {
                    "kind": "action",
                    "type": node_type,
                    **action_result,
                }
                nxt = _find_next_edge(edges, current_id, source_handle=None)
                current_id = nxt.get("target") if nxt else None
                continue

            result[current_id] = {
                "status": "skipped",
                "type": node_type,
                "reason": "tipo_desconhecido",
            }
            current_id = None

        run.executed_nodes = executed_nodes
        run.result = result
        if waiting_delay:
            run.status = "waiting_delay"
        else:
            run.status = "completed"
            run.finished_at = datetime.utcnow()
            run.resume_at = None  # limpa para runs que retornaram do delay

        if count_as_new_run:
            workflow.runs_count = (workflow.runs_count or 0) + 1
            workflow.last_run_at = datetime.utcnow()

        db.commit()
        db.refresh(run)
        return run

    except Exception as exc:  # noqa: BLE001
        db.rollback()
        run_fresh = (
            db.query(WorkflowRun).filter(WorkflowRun.id == run.id).first()
        )
        if run_fresh is None:
            run_fresh = WorkflowRun(
                workflow_id=workflow.id,
                student_id=student.id,
                status="failed",
                trigger_node_id=run.trigger_node_id,
                triggered_by=run.triggered_by,
                triggered_by_user=triggered_by_user,
                executed_nodes=executed_nodes,
                result=result,
                error_message=str(exc),
                finished_at=datetime.utcnow(),
            )
            db.add(run_fresh)
        else:
            run_fresh.status = "failed"
            run_fresh.executed_nodes = executed_nodes
            run_fresh.result = result
            run_fresh.error_message = str(exc)
            run_fresh.finished_at = datetime.utcnow()

        db.commit()
        db.refresh(run_fresh)
        return run_fresh


# ============================================================
# API pública do engine
# ============================================================

def execute_workflow(
    db: Session,
    workflow: Workflow,
    student: Student,
    trigger_node_id: Optional[str] = None,
    triggered_by: str = "manual",
    triggered_by_user: Optional[int] = None,
) -> WorkflowRun:
    """Executa um workflow desde o início (a partir de um trigger node)."""

    nodes = workflow.nodes or []
    start_id = trigger_node_id or _first_trigger_node_id(nodes)

    run = WorkflowRun(
        workflow_id=workflow.id,
        student_id=student.id,
        status="pending",
        trigger_node_id=start_id,
        triggered_by=triggered_by,
        triggered_by_user=triggered_by_user,
        executed_nodes=[],
        result={},
    )
    db.add(run)
    db.flush()

    if not nodes:
        run.status = "skipped"
        run.error_message = "Workflow vazio."
        run.finished_at = datetime.utcnow()
        db.commit()
        return run

    if not start_id:
        run.status = "skipped"
        run.error_message = "Nenhum gatilho encontrado no workflow."
        run.finished_at = datetime.utcnow()
        db.commit()
        return run

    if _find_node(nodes, start_id) is None:
        run.status = "skipped"
        run.error_message = f"Trigger node '{start_id}' não existe no grafo."
        run.finished_at = datetime.utcnow()
        db.commit()
        return run

    return _run_loop(
        db=db,
        workflow=workflow,
        student=student,
        run=run,
        start_id=start_id,
        triggered_by_user=triggered_by_user,
        initial_executed=[],
        initial_result={},
        count_as_new_run=True,
    )


def resume_workflow(db: Session, run: WorkflowRun) -> WorkflowRun:
    """Retoma uma run parqueada em waiting_delay a partir da edge seguinte
    ao último delay node. Retorna o run atualizado."""

    workflow = (
        db.query(Workflow).filter(Workflow.id == run.workflow_id).first()
    )
    if workflow is None:
        run.status = "failed"
        run.error_message = "Workflow não existe mais."
        run.finished_at = datetime.utcnow()
        db.commit()
        return run

    student = (
        db.query(Student).filter(Student.id == run.student_id).first()
        if run.student_id
        else None
    )
    if student is None:
        run.status = "failed"
        run.error_message = "Aluno não existe mais."
        run.finished_at = datetime.utcnow()
        db.commit()
        return run

    nodes = workflow.nodes or []
    edges = workflow.edges or []
    executed_nodes = list(run.executed_nodes or [])
    result = dict(run.result or {})

    # Último nó executado deve ser o delay.
    if not executed_nodes:
        run.status = "failed"
        run.error_message = "Não há nó para retomar (executed_nodes vazio)."
        run.finished_at = datetime.utcnow()
        db.commit()
        return run

    last_id = executed_nodes[-1]
    nxt = _find_next_edge(edges, last_id, source_handle=None)
    next_id = nxt.get("target") if nxt else None

    if next_id is None:
        # Delay sem saída → conclui
        run.status = "completed"
        run.resume_at = None
        run.finished_at = datetime.utcnow()
        db.commit()
        return run

    # Atualiza o result do delay pra marcar como "completed"
    if last_id in result:
        result[last_id]["status"] = "completed"
        run.result = result

    run.resume_at = None
    db.commit()
    db.refresh(run)

    return _run_loop(
        db=db,
        workflow=workflow,
        student=student,
        run=run,
        start_id=next_id,
        triggered_by_user=run.triggered_by_user,
        initial_executed=executed_nodes,
        initial_result=result,
        count_as_new_run=False,  # não incrementa runs_count de novo
    )
