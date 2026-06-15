"""add tags and notes to conversations

Revision ID: e2f3a4b5c6d7
Revises: f1a2b3c4d5e6
Create Date: 2026-06-15 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("conversations", sa.Column("tags", sa.JSON(), server_default=sa.text("'[]'::json"), nullable=True))
    op.add_column("conversations", sa.Column("notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("conversations", "notes")
    op.drop_column("conversations", "tags")
