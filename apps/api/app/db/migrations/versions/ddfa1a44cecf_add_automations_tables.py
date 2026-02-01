"""add automations tables

Revision ID: ddfa1a44cecf
Revises: 231b91b40cde
Create Date: 2026-02-01 00:58:15.682655
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'ddfa1a44cecf'
down_revision: Union[str, None] = '231b91b40cde'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'automations',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('trigger_type', sa.String(100), nullable=False),
        sa.Column('trigger_config', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('conditions', sa.JSON(), nullable=True, server_default='{}'),
        sa.Column('action_type', sa.String(100), nullable=False),
        sa.Column('action_config', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('journey_phase', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'automation_logs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('automation_id', sa.Integer(), sa.ForeignKey('automations.id'), nullable=False),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('students.id'), nullable=True),
        sa.Column('student_name', sa.String(255), nullable=True),
        sa.Column('action_type', sa.String(100), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='success'),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('executed_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('automation_logs')
    op.drop_table('automations')
