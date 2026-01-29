"""create_playbook_tables
Revision ID: 944b3eda5990
Revises: b3b82f0f9851
Create Date: 2026-01-29 00:06:31.144001
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '944b3eda5990'
down_revision: Union[str, None] = 'b3b82f0f9851'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Cria enum actiontype se não existir
    op.execute("CREATE TYPE actiontype AS ENUM ('WHATSAPP', 'EMAIL', 'TICKET', 'NOTIFY_TEAM')")
    
    # Cria tabela playbooks usando o enum risklevel existente
    op.execute("""
        CREATE TABLE playbooks (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            trigger_risk_level risklevel NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.create_index('ix_playbooks_id', 'playbooks', ['id'])
    
    # Cria tabela playbook_actions
    op.execute("""
        CREATE TABLE playbook_actions (
            id SERIAL PRIMARY KEY,
            playbook_id INTEGER NOT NULL REFERENCES playbooks(id),
            "order" INTEGER DEFAULT 1,
            action_type actiontype NOT NULL,
            template TEXT,
            config TEXT,
            delay_hours INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.create_index('ix_playbook_actions_id', 'playbook_actions', ['id'])
    
    # Cria tabela playbook_executions
    op.execute("""
        CREATE TABLE playbook_executions (
            id SERIAL PRIMARY KEY,
            playbook_id INTEGER NOT NULL REFERENCES playbooks(id),
            student_id INTEGER NOT NULL REFERENCES students(id),
            status VARCHAR(20) DEFAULT 'pending',
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            result TEXT
        )
    """)
    op.create_index('ix_playbook_executions_id', 'playbook_executions', ['id'])

def downgrade() -> None:
    op.drop_index('ix_playbook_executions_id', table_name='playbook_executions')
    op.drop_table('playbook_executions')
    op.drop_index('ix_playbook_actions_id', table_name='playbook_actions')
    op.drop_table('playbook_actions')
    op.drop_index('ix_playbooks_id', table_name='playbooks')
    op.drop_table('playbooks')
    op.execute("DROP TYPE actiontype")
