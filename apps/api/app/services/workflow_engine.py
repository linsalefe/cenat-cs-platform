"""
Workflow Engine — B.1

Executa um Workflow a partir de um trigger node, percorrendo o grafo
linearmente. Suporta nodes do tipo trigger/condition/action/delay.

Para B.1 (MVP):
  - `action.send_whatsapp` é STUB — apenas loga o que enviaria
  - Delays não são agendados (run fica em `waiting_delay`)
  - Triggers não executam lógica própria — são pontos de entrada
  - Conditions avaliam contra o Student atual
"""

from __future__ import annotations

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

MAX_NODE_EXECUTIONS = 50  # safety net contra loops infinitos

# Frontend priority labels → backend enum
PRIORITY_MAP = {
    "baixa": TicketPriority.LOW,
    "media": TicketPriority.MEDIUM,
    "alta": TicketPriority.HIGH,
    "urgente": TicketPriority.URGENT,
}

# Risk level order para comparação (min_level)
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
    """Retorna a primeira edge que sai de source_id.
    Se source_handle for passado, filtra por ele (usado em conditions).
    """
    for e in edges:
        if e.get("source") != source_id:
            continue
        if source_handle is not None:
            # A edge precisa ter sourceHandle igual ao solicitado
            if e.get("sourceHandle") != source_handle:
                continue
        else:
            # Nó sem handles (trigger/action/delay) — pega qualquer edge
            pass
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


# ============================================================
# Condition evaluators
# ============================================================

def _evaluate_condition(
    db: Session, node: dict, student: Student
) -> tuple[bool, dict[str, Any]]:
    """Retorna (matched, debug_info)."""
    node_type = node.get("type") or ""
    data = node.get("data") or {}

    if node_type == "condition.course_is":
        course_ids = data.get("course_ids") or []
        # Aceita tanto ids quanto strings
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

    # Condition desconhecida — não casa
    return False, {"reason": f"condition_type_desconhecido: {node_type}"}


# ============================================================
# Action handlers
# ============================================================

def _action_send_whatsapp_stub(
    db: Session, node: dict, student: Student, user_id: Optional[int]
) -> dict[str, Any]:
    """STUB do WhatsApp. Não envia mensagem — apenas loga o que enviaria."""
    data = node.get("data") or {}
    template = data.get("template_name") or "(não informado)"
    channel = data.get("channel") or "cs"
    return {
        "status": "stubbed",
        "action": "send_whatsapp",
        "would_send": {
            "to_phone": student.phone,
            "to_name": student.name,
            "template": template,
            "channel": channel,
        },
        "note": "Integração real será ligada no Prompt B.2.",
    }


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
    db.flush()  # garante ID

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

    # Assume que a coluna students.assigned_to_id existe
    # (criada via scripts/migrate_add_student_assigned_to.py).
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
    "action.send_whatsapp": _action_send_whatsapp_stub,
    "action.create_ticket": _action_create_ticket,
    "action.assign_user": _action_assign_user,
    "action.set_onboarding_status": _action_set_onboarding_status,
}


# ============================================================
# Delay handler
# ============================================================

def _handle_delay(node: dict) -> datetime:
    """Retorna o resume_at absoluto baseado na config do delay."""
    data = node.get("data") or {}
    try:
        amount = int(data.get("amount") or 1)
    except (TypeError, ValueError):
        amount = 1
    unit = data.get("unit") or "days"
    kw = DELAY_UNIT_TO_TIMEDELTA_KW.get(unit, "days")
    return datetime.utcnow() + timedelta(**{kw: amount})


# ============================================================
# Executor principal
# ============================================================

def execute_workflow(
    db: Session,
    workflow: Workflow,
    student: Student,
    trigger_node_id: Optional[str] = None,
    triggered_by: str = "manual",
    triggered_by_user: Optional[int] = None,
) -> WorkflowRun:
    """Executa um workflow a partir de um trigger node. Retorna o WorkflowRun
    persistido (commit feito)."""

    nodes = workflow.nodes or []
    edges = workflow.edges or []

    # Se nenhum trigger_node_id foi informado, usa o primeiro trigger encontrado
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

    # Validações básicas
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

    run.status = "running"
    db.flush()

    # Loop iterativo (evita profundidade de recursão)
    current_id: Optional[str] = start_id
    executed_nodes: list[str] = []
    result: dict[str, Any] = {}
    waiting_delay = False

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
                # Triggers são pontos de entrada. Seguem para o próximo.
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
                # Para B.1: marca waiting_delay e encerra a execução.
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

            # Tipo desconhecido — pula
            result[current_id] = {
                "status": "skipped",
                "type": node_type,
                "reason": "tipo_desconhecido",
            }
            current_id = None

        # Fim do loop
        run.executed_nodes = executed_nodes
        run.result = result
        if waiting_delay:
            run.status = "waiting_delay"
        else:
            run.status = "completed"
            run.finished_at = datetime.utcnow()

        # Atualiza counters no workflow
        workflow.runs_count = (workflow.runs_count or 0) + 1
        workflow.last_run_at = datetime.utcnow()

        db.commit()
        db.refresh(run)
        return run

    except Exception as exc:
        # Salvar estado parcial em caso de erro
        db.rollback()
        # Recarrega o run (rollback pode ter limpado o commit inicial)
        run = (
            db.query(WorkflowRun)
            .filter(WorkflowRun.id == run.id)
            .first()
        )
        if run is None:
            # Se sumiu no rollback, cria um novo finalizado
            run = WorkflowRun(
                workflow_id=workflow.id,
                student_id=student.id,
                status="failed",
                trigger_node_id=start_id,
                triggered_by=triggered_by,
                triggered_by_user=triggered_by_user,
                executed_nodes=executed_nodes,
                result=result,
                error_message=str(exc),
                finished_at=datetime.utcnow(),
            )
            db.add(run)
        else:
            run.status = "failed"
            run.executed_nodes = executed_nodes
            run.result = result
            run.error_message = str(exc)
            run.finished_at = datetime.utcnow()

        db.commit()
        db.refresh(run)
        return run
