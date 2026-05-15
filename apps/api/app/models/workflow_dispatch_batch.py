from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class WorkflowDispatchBatch(Base):
    """Lote de disparo manual de um workflow pra uma lista de alunos (via CSV).

    Cada batch agrupa N runs criadas por upload de planilha. Contagens são
    atualizadas pelo worker em background conforme cada recipient é processado.
    """
    __tablename__ = "workflow_dispatch_batches"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False, index=True)

    # Contagens
    total_recipients = Column(Integer, nullable=False, default=0)
    dispatched = Column(Integer, nullable=False, default=0)
    skipped_active = Column(Integer, nullable=False, default=0)       # já tem run ativa
    skipped_no_student = Column(Integer, nullable=False, default=0)   # phone não bateu
    skipped_no_phone = Column(Integer, nullable=False, default=0)     # linha sem phone
    failed = Column(Integer, nullable=False, default=0)               # execute_workflow lançou

    # Status: queued, running, completed, failed
    status = Column(String(20), nullable=False, default="queued")
    error_message = Column(Text, nullable=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    finished_at = Column(DateTime, nullable=True)

    workflow = relationship("Workflow")
    created_by_user = relationship("User")
