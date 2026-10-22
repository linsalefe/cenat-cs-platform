"""Testes do helper de busca (escrever, não rodar aqui)."""
from app.core.search import (
    _ACCENT_FROM,
    _ACCENT_TO,
    _escape_like,
    normalize_text,
    only_digits,
)


def test_normalize_text_removes_accents():
    assert normalize_text("ANDRÉA") == "andrea"
    assert normalize_text("Conceição") == "conceicao"
    assert normalize_text("José da Silva") == "jose da silva"
    assert normalize_text("") == ""


def test_only_digits_any_phone_format():
    assert only_digits("+55 (83) 9 9999-8888") == "5583999998888"
    assert only_digits("123.456.789-00") == "12345678900"
    assert only_digits("") == ""
    assert only_digits(None) == ""


def test_translate_from_to_same_length():
    # As strings FROM/TO do translate() precisam ter o mesmo tamanho.
    assert len(_ACCENT_FROM) == len(_ACCENT_TO)
    # Cobre minúsculas (24) + maiúsculas (24) acentuadas.
    assert len(_ACCENT_FROM) == 48


def test_translate_covers_upper_and_lower():
    # Maiúsculas e minúsculas acentuadas estão mapeadas (translate roda antes do lower).
    assert "Á" in _ACCENT_FROM and "á" in _ACCENT_FROM
    assert "Ç" in _ACCENT_FROM and "ç" in _ACCENT_FROM
    # Cada acento maiúsculo mapeia pro ASCII maiúsculo correspondente.
    assert _ACCENT_TO[_ACCENT_FROM.index("Á")] == "A"
    assert _ACCENT_TO[_ACCENT_FROM.index("Ç")] == "C"


def test_escape_like_wildcards():
    assert _escape_like("50%") == "50\\%"
    assert _escape_like("a_b") == "a\\_b"
    # backslash também é escapado (vira dois)
    assert _escape_like("a\\b") == "a\\\\b"
