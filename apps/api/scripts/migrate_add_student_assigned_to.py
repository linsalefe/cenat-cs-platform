"""
Migração manual: adicionar coluna students.assigned_to_id (FK -> users.id).

Uso:
    cd ~/cenat-cs-platform/apps/api
    python3 scripts/migrate_add_student_assigned_to.py

Idempotente: se a coluna já existir, apenas loga e sai.
"""

from sqlalchemy import text
from app.db.session import engine


SQL_CHECK = """
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'students' AND column_name = 'assigned_to_id';
"""

SQL_ADD_COLUMN = """
ALTER TABLE students
ADD COLUMN assigned_to_id INTEGER NULL
REFERENCES users(id) ON DELETE SET NULL;
"""

SQL_ADD_INDEX = """
CREATE INDEX IF NOT EXISTS ix_students_assigned_to_id
ON students (assigned_to_id);
"""


def main() -> None:
    with engine.begin() as conn:
        existing = conn.execute(text(SQL_CHECK)).first()
        if existing:
            print("ℹ️  Coluna students.assigned_to_id já existe — nada a fazer.")
        else:
            print("➕ Adicionando coluna students.assigned_to_id ...")
            conn.execute(text(SQL_ADD_COLUMN))
            print("✅ Coluna criada.")

        print("➕ Garantindo índice ...")
        conn.execute(text(SQL_ADD_INDEX))
        print("✅ Índice OK.")

    print("🎉 Migração concluída.")


if __name__ == "__main__":
    main()
