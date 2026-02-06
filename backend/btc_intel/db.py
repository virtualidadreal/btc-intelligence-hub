"""Supabase client singleton."""

from supabase import create_client, Client
from supabase.lib.client_options import SyncClientOptions

from btc_intel.config import settings

_client: Client | None = None

# Schema independiente para BTC Intelligence Hub
SCHEMA = "btc_hub"


def get_supabase() -> Client:
    """Retorna el cliente Supabase (singleton) configurado para schema btc_hub."""
    global _client
    if _client is None:
        if not settings.supabase_url or not settings.supabase_key:
            raise RuntimeError(
                "Faltan SUPABASE_URL y/o SUPABASE_KEY en .env. "
                "Revisa el archivo .env en la raíz del proyecto."
            )
        _client = create_client(
            settings.supabase_url,
            settings.supabase_key,
            options=SyncClientOptions(schema=SCHEMA),
        )
    return _client
