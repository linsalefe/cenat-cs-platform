import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass
class WhatsAppChannel:
    name: str
    slug: str
    token: str
    phone_number_id: str
    waba_id: str

    @property
    def is_configured(self) -> bool:
        return bool(self.token and self.phone_number_id)


# Registro de todos os canais
CHANNELS: dict[str, WhatsAppChannel] = {
    "cs": WhatsAppChannel(
        name="CS",
        slug="cs",
        token=os.getenv("WA_CS_TOKEN", ""),
        phone_number_id=os.getenv("WA_CS_PHONE_NUMBER_ID", ""),
        waba_id=os.getenv("WA_CS_WABA_ID", ""),
    ),
    "pedagogico": WhatsAppChannel(
        name="Pedagógico",
        slug="pedagogico",
        token=os.getenv("WA_PEDAGOGICO_TOKEN", ""),
        phone_number_id=os.getenv("WA_PEDAGOGICO_PHONE_NUMBER_ID", ""),
        waba_id=os.getenv("WA_PEDAGOGICO_WABA_ID", ""),
    ),
    "atendimento": WhatsAppChannel(
        name="Atendimento",
        slug="atendimento",
        token=os.getenv("WA_ATENDIMENTO_TOKEN", ""),
        phone_number_id=os.getenv("WA_ATENDIMENTO_PHONE_NUMBER_ID", ""),
        waba_id=os.getenv("WA_ATENDIMENTO_WABA_ID", ""),
    ),
    "financeiro": WhatsAppChannel(
        name="Financeiro",
        slug="financeiro",
        token=os.getenv("WA_FINANCEIRO_TOKEN", ""),
        phone_number_id=os.getenv("WA_FINANCEIRO_PHONE_NUMBER_ID", ""),
        waba_id=os.getenv("WA_FINANCEIRO_WABA_ID", ""),
    ),
}

# Canal padrão
DEFAULT_CHANNEL = "cs"


def get_channel(slug: str) -> WhatsAppChannel | None:
    """Retorna canal pelo slug"""
    return CHANNELS.get(slug)


def get_channel_by_phone_id(phone_number_id: str) -> WhatsAppChannel | None:
    """Encontra canal pelo phone_number_id (usado no webhook)"""
    for channel in CHANNELS.values():
        if channel.phone_number_id == phone_number_id:
            return channel
    return None


def get_configured_channels() -> list[WhatsAppChannel]:
    """Retorna apenas canais com credenciais configuradas"""
    return [ch for ch in CHANNELS.values() if ch.is_configured]
