from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base


class Workflow(Base):
    """Workflow visual — grafo de nodes (triggers, actions, conditions, delays)
    editável via React Flow. Coexiste com Automation e JourneyRule."""

    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Status: draft | active | paused
    status = Column(String(20), nullable=False, default="draft", index=True)

    # Grafo (formato React Flow)
    # nodes: [{id, type, position: {x,y}, data: {...}}]
    # edges: [{id, source, target, sourceHandle?, targetHandle?, label?}]
    nodes = Column(JSON, nullable=False, default=list)
    edges = Column(JSON, nullable=False, default=list)

    # Stats (preenchidos pelo motor de execução — Prompt B)
    runs_count = Column(Integer, default=0)
    last_run_at = Column(DateTime(timezone=True), nullable=True)

    # Meta
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
