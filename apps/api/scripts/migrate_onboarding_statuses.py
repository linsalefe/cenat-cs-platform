"""
Migração manual: reclassificar onboarding_status dos alunos para o novo
conjunto unificado (backend + workflow).

Mapeamento:
  boas_vindas_enviada → em_contato
  docs_pendentes      → aguardando_doc
  docs_ok             → em_andamento
  acesso_moodle       → em_andamento
  (os demais já alinhados: novo, em_contato, em_andamento, aguardando_doc,
   follow_up, concluido — ficam inalterados.)

Uso:
    cd ~/cenat-cs-platform/apps/api
    python3 scripts/migrate_onboarding_statuses.py

Idempotente: pode ser rodado mais de uma vez.
"""

from sqlalchemy import text
from app.db.session import engine


MIGRATIONS = [
    ("boas_vindas_enviada", "em_contato"),
    ("docs_pendentes", "aguardando_doc"),
    ("docs_ok", "em_andamento"),
    ("acesso_moodle", "em_andamento"),
]


def main() -> None:
    with engine.begin() as conn:
        # Contagem antes
        before = conn.execute(
            text(
                "SELECT onboarding_status, COUNT(*) AS n "
                "FROM students WHERE onboarding_status IS NOT NULL "
                "GROUP BY onboarding_status ORDER BY onboarding_status"
            )
        ).fetchall()
        print("=== Antes da migração ===")
        for row in before:
            print(f"  {row[0]!r:24s} {row[1]}")

        # Aplica
        total_changed = 0
        for old, new in MIGRATIONS:
            result = conn.execute(
                text(
                    "UPDATE students SET onboarding_status = :new "
                    "WHERE onboarding_status = :old"
                ),
                {"old": old, "new": new},
            )
            changed = result.rowcount or 0
            total_changed += changed
            if changed:
                print(f"✅ {old} → {new}: {changed} aluno(s)")
            else:
                print(f"ℹ️  {old} → {new}: 0")

        # Contagem depois
        after = conn.execute(
            text(
                "SELECT onboarding_status, COUNT(*) AS n "
                "FROM students WHERE onboarding_status IS NOT NULL "
                "GROUP BY onboarding_status ORDER BY onboarding_status"
            )
        ).fetchall()
        print("\n=== Depois da migração ===")
        for row in after:
            print(f"  {row[0]!r:24s} {row[1]}")

        print(f"\n🎉 Total migrado: {total_changed} aluno(s)")


if __name__ == "__main__":
    main()
