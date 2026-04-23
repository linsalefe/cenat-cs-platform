"""
Migração manual: adicionar coluna students.custom_fields (JSONB).

A coluna armazena as respostas do formulário dinâmico de onboarding, como
{"cpf": "123.456.789-00", "area_atuacao": "Psicologia"}.

A tabela onboarding_form_fields é criada automaticamente pelo
Base.metadata.create_all() no startup do cenat-api.

Uso:
    cd ~/cenat-cs-platform/apps/api
    python3 scripts/migrate_add_student_custom_fields.py

Idempotente.
"""

from sqlalchemy import text
from app.db.session import engine


SQL_CHECK = """
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'students' AND column_name = 'custom_fields';
"""

SQL_ADD_COLUMN = """
ALTER TABLE students
ADD COLUMN custom_fields JSONB NULL DEFAULT '{}'::jsonb;
"""


def main() -> None:
    with engine.begin() as conn:
        existing = conn.execute(text(SQL_CHECK)).first()
        if existing:
            print("ℹ️  Coluna students.custom_fields já existe — nada a fazer.")
        else:
            print("➕ Adicionando coluna students.custom_fields ...")
            conn.execute(text(SQL_ADD_COLUMN))
            print("✅ Coluna criada.")

    print("🎉 Migração concluída.")


if __name__ == "__main__":
    main()
