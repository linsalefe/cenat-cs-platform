"""add_csv_support_to_broadcasts

Revision ID: 9c6ad6e2cca4
Revises: 9d7b7afbef50
Create Date: 2026-05-14 14:41:26.544334

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9c6ad6e2cca4'
down_revision: Union[str, None] = '9d7b7afbef50'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Broadcast: novos campos
    op.add_column(
        'broadcasts',
        sa.Column('source_type', sa.String(length=20), nullable=False, server_default='filters')
    )
    op.add_column(
        'broadcasts',
        sa.Column('csv_recipients', sa.JSON(), nullable=False, server_default='[]')
    )

    # BroadcastLog: student_id agora opcional + extra_data
    op.alter_column('broadcast_logs', 'student_id', existing_type=sa.Integer(), nullable=True)
    op.add_column(
        'broadcast_logs',
        sa.Column('extra_data', sa.JSON(), nullable=False, server_default='{}')
    )


def downgrade() -> None:
    op.drop_column('broadcast_logs', 'extra_data')
    op.alter_column('broadcast_logs', 'student_id', existing_type=sa.Integer(), nullable=False)
    op.drop_column('broadcasts', 'csv_recipients')
    op.drop_column('broadcasts', 'source_type')
