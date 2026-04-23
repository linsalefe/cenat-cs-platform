"""
Migração: adiciona colunas reply_deadline e reply_received_at a workflow_runs.

Ambas são nullable. Usadas pela action.wait_for_reply (Entrega 3).

Uso:
    cd ~/cenat-cs-platform/apps/api
    python3 scripts/migrate_add_workflow_reply_columns.py

Idempotente.
"""

from sqlalchemy import text
from app.db.session import engine


def column_exists(conn, column_name: str) -> bool:
    row = conn.execute(
        text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'workflow_runs' AND column_name = :col"
        ),
        {"col": column_name},
    ).first()
    return row is not None


def main() -> None:
    with engine.begin() as conn:
        if column_exists(conn, "reply_deadline"):
            print("ℹ️  reply_deadline já existe")
        else:
            print("➕ Adicionando reply_deadline ...")
            conn.execute(
                text(
                    "ALTER TABLE workflow_runs "
                    "ADD COLUMN reply_deadline TIMESTAMP WITH TIME ZONE NULL;"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_workflow_runs_reply_deadline "
                    "ON workflow_runs (reply_deadline) "
                    "WHERE status = 'waiting_reply';"
                )
            )
            print("✅ reply_deadline criado (+ índice parcial)")

        if column_exists(conn, "reply_received_at"):
            print("ℹ️  reply_received_at já existe")
        else:
            print("➕ Adicionando reply_received_at ...")
            conn.execute(
                text(
                    "ALTER TABLE workflow_runs "
                    "ADD COLUMN reply_received_at TIMESTAMP WITH TIME ZONE NULL;"
                )
            )
            print("✅ reply_received_at criado")

    print("🎉 Migração concluída.")


if __name__ == "__main__":
    main()
