from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base


class WorkflowRun(Base):
    """Execução de um workflow para um aluno específico.

    Estados:
      - pending: criado, ainda não começou
      - running: em execução
      - completed: terminou com sucesso (chegou em um nó folha ou sem continuação)
      - failed: erro durante execução (detalhes em error_message)
      - skipped: não executou (ex: sem trigger ou grafo inválido)
      - waiting_delay: parou em um delay.wait. resume_at diz quando retomar.
    """

    __tablename__ = "workflow_runs"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(
        Integer,
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Estado
    status = Column(
        String(20), nullable=False, default="pending", index=True
    )

    # Contexto do disparo
    trigger_node_id = Column(String(100), nullable=True)
    triggered_by = Column(String(50), nullable=False, default="manual")
    # manual | scheduled | event
    triggered_by_user = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Progresso
    current_node_id = Column(String(100), nullable=True)
    executed_nodes = Column(JSON, nullable=False, default=list)

    # Resultado
    # result: {node_id: {status, output, error?}}
    result = Column(JSON, nullable=False, default=dict)
    error_message = Column(Text, nullable=True)

    # Delay
    resume_at = Column(DateTime(timezone=True), nullable=True, index=True)

    # Timestamps
    started_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finished_at = Column(DateTime(timezone=True), nullable=True)
