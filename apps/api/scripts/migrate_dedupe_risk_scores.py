"""
Migração: remove linhas duplicadas de risk_scores e cria índice único
em risk_scores.student_id.

Por aluno, mantém a linha com calculated_at mais recente (desempate pelo
maior id) e apaga as demais. risk_history não é tocado.

O dedupe e o CREATE UNIQUE INDEX rodam na mesma transação, com a tabela
travada contra escrita (SHARE ROW EXCLUSIVE), pra nenhum recálculo
concorrente inserir uma duplicata entre um passo e outro.

Uso:
    cd ~/cenat-cs-platform/apps/api
    python3 scripts/migrate_dedupe_risk_scores.py --dry-run
    python3 scripts/migrate_dedupe_risk_scores.py

Idempotente.
"""

import argparse
import os
import sys

# Permite rodar como `python scripts/...` a partir de apps/api
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.db.session import engine


INDEX_NAME = "uq_risk_scores_student_id"

# Linhas a remover: todas exceto a primeira por aluno na ordem
# (calculated_at DESC NULLS LAST, id DESC).
RANKED_CTE = """
WITH ranked AS (
    SELECT id, student_id,
           ROW_NUMBER() OVER (
               PARTITION BY student_id
               ORDER BY calculated_at DESC NULLS LAST, id DESC
           ) AS rn
    FROM risk_scores
)
"""


def index_exists(conn) -> bool:
    return conn.execute(
        text("SELECT 1 FROM pg_indexes WHERE tablename = 'risk_scores' AND indexname = :name"),
        {"name": INDEX_NAME},
    ).first() is not None


def dedupe(conn) -> tuple[int, int]:
    """Retorna (alunos_duplicados, linhas_removidas). Não commita."""
    dup_students = conn.execute(
        text(
            "SELECT COUNT(*) FROM ("
            "SELECT student_id FROM risk_scores GROUP BY student_id HAVING COUNT(*) > 1"
            ") t"
        )
    ).scalar()
    to_delete = conn.execute(
        text(RANKED_CTE + "SELECT COUNT(*) FROM ranked WHERE rn > 1")
    ).scalar()

    print(f"📊 Alunos com risk_scores duplicado: {dup_students}")
    print(f"📊 Linhas a remover: {to_delete}")

    if to_delete:
        deleted = conn.execute(
            text(
                RANKED_CTE
                + "DELETE FROM risk_scores WHERE id IN (SELECT id FROM ranked WHERE rn > 1)"
            )
        ).rowcount
        print(f"🗑️  {deleted} linha(s) removida(s)")

    return dup_students, to_delete


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="mostra o que seria feito e faz rollback")
    args = parser.parse_args()

    conn = engine.connect()
    trans = conn.begin()
    try:
        # Bloqueia INSERT/UPDATE/DELETE concorrentes até o fim da transação
        conn.execute(text("LOCK TABLE risk_scores IN SHARE ROW EXCLUSIVE MODE"))

        dedupe(conn)

        if index_exists(conn):
            print(f"ℹ️  {INDEX_NAME} já existe")
        else:
            print(f"➕ Criando {INDEX_NAME} ...")
            conn.execute(
                text(
                    f"CREATE UNIQUE INDEX IF NOT EXISTS {INDEX_NAME} "
                    "ON risk_scores (student_id);"
                )
            )
            print(f"✅ {INDEX_NAME} criado")

        remaining = conn.execute(
            text(
                "SELECT COUNT(*) FROM ("
                "SELECT student_id FROM risk_scores GROUP BY student_id HAVING COUNT(*) > 1"
                ") t"
            )
        ).scalar()
        total = conn.execute(text("SELECT COUNT(*) FROM risk_scores")).scalar()
        print(f"\n📊 Estado final: {total} linhas, {remaining} aluno(s) duplicado(s)")

        if args.dry_run:
            trans.rollback()
            print("\n🧪 --dry-run: rollback feito, nada foi alterado.")
        else:
            trans.commit()
            print("\n🎉 Migração concluída.")
    except Exception:
        trans.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
