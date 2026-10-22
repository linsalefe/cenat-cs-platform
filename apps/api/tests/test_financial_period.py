"""Testes da função pura de períodos do financeiro (escrever, não rodar aqui)."""
from datetime import datetime

from app.api.routes.asaas import _period_range


def test_month_mid():
    now = datetime(2026, 10, 15)
    assert _period_range("month", now) == ("2026-10-01", "2026-10-31")


def test_month_february_leap():
    now = datetime(2028, 2, 10)  # 2028 é bissexto
    assert _period_range("month", now) == ("2028-02-01", "2028-02-29")


def test_last_month_from_january():
    now = datetime(2026, 1, 20)
    assert _period_range("last_month", now) == ("2025-12-01", "2025-12-31")


def test_last_month_from_march():
    now = datetime(2026, 3, 15)
    assert _period_range("last_month", now) == ("2026-02-01", "2026-02-28")


def test_today():
    now = datetime(2026, 10, 15)
    assert _period_range("today", now) == ("2026-10-15", "2026-10-15")
