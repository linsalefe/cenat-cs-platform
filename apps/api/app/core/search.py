"""Helper único de busca de alunos.

Normaliza o termo (minúsculo, sem acento) e monta a cláusula SQLAlchemy usada
em /students, /broadcasts e /risk. A normalização de acento no banco usa
`translate()` nativo do Postgres (sem depender da extensão `unaccent`, que
exige superuser).
"""
import re
import unicodedata

from sqlalchemy import and_, func, literal, or_

# Mapa de acentos pro translate() do Postgres. Cobre minúsculas E maiúsculas
# acentuadas, porque o translate() é aplicado ANTES do lower() — assim a busca
# não depende do lower() do Postgres entender acento (que varia com o locale).
# FROM e TO PRECISAM ter o mesmo tamanho.
_ACCENT_FROM = "áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ"
_ACCENT_TO = "aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN"
assert len(_ACCENT_FROM) == len(_ACCENT_TO), (
    "FROM/TO do translate precisam ter o mesmo tamanho "
    f"({len(_ACCENT_FROM)} != {len(_ACCENT_TO)})"
)


def normalize_text(s: str) -> str:
    """Minúsculo e sem acento (ex.: 'ANDRÉA' -> 'andrea', 'Conceição' -> 'conceicao')."""
    if not s:
        return ""
    s = s.lower()
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c))


def only_digits(s: str) -> str:
    """Mantém só os dígitos (ex.: '+55 (83) 9 9999-8888' -> '5583999998888')."""
    if not s:
        return ""
    return re.sub(r"\D", "", str(s))


def _escape_like(tok: str) -> str:
    """Escapa os curingas de LIKE (\\, %, _) para busca literal."""
    return tok.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def student_search_clause(term: str):
    """Monta a cláusula de busca de aluno.

    Regras (ver Decisão 3 do plano):
      - termo normalizado (minúsculo, sem acento) quebrado em tokens; AND entre
        tokens, e cada token casa nome_normalizado LIKE %tok% OU lower(email) LIKE %tok%;
      - se o termo tiver >= 8 dígitos: OR por telefone (últimos 8 dígitos, sem máscara);
      - se tiver exatamente 11 dígitos: OR por CPF (igualdade exata, sem máscara).
    """
    from app.models.student import Student

    # translate ANTES do lower: independe do locale do Postgres pra tirar acento
    norm_name = func.lower(func.translate(Student.name, _ACCENT_FROM, _ACCENT_TO))
    norm_email = func.lower(Student.email)

    conditions = []

    tokens = normalize_text(term).split()
    if tokens:
        token_clauses = []
        for tok in tokens:
            pattern = f"%{_escape_like(tok)}%"
            token_clauses.append(
                or_(
                    norm_name.like(pattern, escape="\\"),
                    norm_email.like(pattern, escape="\\"),
                )
            )
        conditions.append(and_(*token_clauses))

    digits = only_digits(term)
    if len(digits) >= 8:
        phone_digits = func.regexp_replace(Student.phone, r"\D", "", "g")
        conditions.append(phone_digits.like(f"%{digits[-8:]}%"))
    if len(digits) == 11:
        cpf_digits = func.regexp_replace(Student.cpf, r"\D", "", "g")
        conditions.append(cpf_digits == digits)

    if not conditions:
        # Termo vazio/sem conteúdo útil: não filtra nada.
        return literal(True)

    return or_(*conditions)
