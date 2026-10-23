"""Testes do dedupe de risk_scores e do at-risk sem repetição (escrever, não rodar aqui)."""
import importlib.util
import os
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import text

from app.api.routes.risk import get_students_at_risk
from app.models.risk_score import RiskLevel


def _load_migration():
    path = os.path.join(os.path.dirname(__file__), "..", "scripts", "migrate_dedupe_risk_scores.py")
    spec = importlib.util.spec_from_file_location("migrate_dedupe_risk_scores", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ── (a) script mantém só a linha de calculated_at mais recente ──

def test_dedupe_keeps_most_recent_calculated_at():
    from app.db.session import engine

    try:
        conn = engine.connect()
    except Exception:
        pytest.skip("Postgres indisponível")

    migration = _load_migration()
    trans = conn.begin()
    try:
        # Tabela temporária com o mesmo nome: pg_temp vem antes de public no
        # search_path, então o script opera nela e a real não é tocada.
        conn.execute(text(
            "CREATE TEMP TABLE risk_scores ("
            "id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, calculated_at TIMESTAMP"
            ") ON COMMIT DROP"
        ))
        now = datetime(2026, 10, 23, 12, 0, 0)
        conn.execute(
            text("INSERT INTO risk_scores (id, student_id, calculated_at) VALUES (:id, :sid, :at)"),
            [
                {"id": 10, "sid": 1, "at": now - timedelta(days=30)},
                {"id": 11, "sid": 1, "at": now},                      # mais recente → fica
                {"id": 12, "sid": 1, "at": now - timedelta(minutes=5)},
                {"id": 20, "sid": 2, "at": now},                      # sem duplicata
            ],
        )

        dup_students, removed = migration.dedupe(conn)

        assert dup_students == 1
        assert removed == 2
        rows = conn.execute(
            text("SELECT student_id, id FROM risk_scores ORDER BY student_id")
        ).all()
        assert [tuple(r) for r in rows] == [(1, 11), (2, 20)]
    finally:
        trans.rollback()
        conn.close()


def test_dedupe_tiebreak_by_highest_id():
    from app.db.session import engine

    try:
        conn = engine.connect()
    except Exception:
        pytest.skip("Postgres indisponível")

    migration = _load_migration()
    trans = conn.begin()
    try:
        conn.execute(text(
            "CREATE TEMP TABLE risk_scores ("
            "id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, calculated_at TIMESTAMP"
            ") ON COMMIT DROP"
        ))
        at = datetime(2026, 10, 23, 12, 0, 0)
        conn.execute(
            text("INSERT INTO risk_scores (id, student_id, calculated_at) VALUES (:id, 1, :at)"),
            [{"id": 1, "at": at}, {"id": 2, "at": at}, {"id": 3, "at": None}],
        )

        migration.dedupe(conn)

        ids = conn.execute(text("SELECT id FROM risk_scores")).scalars().all()
        assert ids == [2]
    finally:
        trans.rollback()
        conn.close()


# ── (b) at-risk não repete student_id ──

class _FakeQuery:
    """Query encadeável que devolve linhas fixas."""

    def __init__(self, rows):
        self._rows = rows

    def join(self, *a, **k):
        return self

    outerjoin = filter = order_by = offset = limit = join

    def count(self):
        return len(self._rows)

    def all(self):
        return self._rows


class _FakeDB:
    def __init__(self, rows):
        self._rows = rows

    def query(self, *entities):
        return _FakeQuery(self._rows)


def _student(sid, name):
    return SimpleNamespace(
        id=sid, name=name, email=None, phone=None,
        attendance_total=10, attendance_absences=2, attendance_consecutive_absences=1,
        abandonment_status=None,
    )


def _risk(sid, score, level):
    return SimpleNamespace(
        student_id=sid, score=score, level=level,
        trend="stable", trend_delta=0,
        attendance_trend=None, financial_trend=None, engagement_trend=None,
        engagement_score=0, progress_score=0, grade_score=0,
        financial_score=0, ticket_score=0, nps_score=0,
        factors=None, calculated_at=datetime(2026, 10, 23),
    )


def _call(db, **kw):
    params = dict(level=None, trend=None, search=None, page=1, per_page=30)
    params.update(kw)
    return get_students_at_risk(db=db, current_user=None, **params)


def test_at_risk_by_level_no_repeated_student():
    marilucia = _student(1263, "MARILUCIA DE SOUSA FERNANDES")
    outro = _student(1, "Outro Aluno")
    rows = [
        (_risk(1263, 71.6, RiskLevel.HIGH), marilucia),
        (_risk(1263, 71.6, RiskLevel.HIGH), marilucia),
        (_risk(1, 60.0, RiskLevel.HIGH), outro),
    ]

    res = _call(_FakeDB(rows), level="high")

    ids = [s["student_id"] for s in res["data"]]
    assert ids == [1263, 1]
    assert len(ids) == len(set(ids))
    assert all(s["level"] == "high" for s in res["data"])


def test_at_risk_response_uses_row_from_query():
    # Resposta vem da mesma linha que o filtro trouxe, nunca de outra do aluno
    marilucia = _student(1263, "MARILUCIA DE SOUSA FERNANDES")
    res = _call(_FakeDB([(_risk(1263, 71.6, RiskLevel.HIGH), marilucia)]), level="high")
    assert res["data"][0]["score"] == 71.6
    assert res["data"][0]["level"] == "high"


def test_at_risk_search_no_repeated_student():
    marilucia = _student(1263, "MARILUCIA DE SOUSA FERNANDES")
    rows = [
        (marilucia, _risk(1263, 71.6, RiskLevel.HIGH)),
        (marilucia, _risk(1263, 30.0, RiskLevel.MEDIUM)),
    ]

    res = _call(_FakeDB(rows), search="marilucia")

    ids = [s["student_id"] for s in res["data"]]
    assert ids == [1263]
    assert res["data"][0]["level"] == "high"
