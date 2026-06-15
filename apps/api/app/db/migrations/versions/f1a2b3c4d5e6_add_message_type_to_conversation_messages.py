"""add message_type to conversation_messages

Revision ID: f1a2b3c4d5e6
Revises: 09a20b153f41
Create Date: 2026-06-14 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "09a20b153f41"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "conversation_messages",
        sa.Column("message_type", sa.String(length=20), server_default="text", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("conversation_messages", "message_type")
