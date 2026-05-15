"""add_workflow_dispatch_batches

Revision ID: 09a20b153f41
Revises: 9c6ad6e2cca4
Create Date: 2026-05-15 14:45:53.118089

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '09a20b153f41'
down_revision: Union[str, None] = '9c6ad6e2cca4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "workflow_dispatch_batches",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workflow_id", sa.Integer(), nullable=False),
        sa.Column("total_recipients", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("dispatched", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_active", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_no_student", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_no_phone", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="queued"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["workflow_id"], ["workflows.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_workflow_dispatch_batches_workflow_id",
        "workflow_dispatch_batches", ["workflow_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_workflow_dispatch_batches_workflow_id",
                  table_name="workflow_dispatch_batches")
    op.drop_table("workflow_dispatch_batches")
