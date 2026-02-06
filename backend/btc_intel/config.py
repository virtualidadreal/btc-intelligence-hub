"""Configuración del sistema — carga variables de entorno."""

from pathlib import Path

from pydantic_settings import BaseSettings

# Buscar .env en la raíz del proyecto (un nivel arriba de backend/)
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""  # service_role key
    supabase_anon_key: str = ""
    fred_api_key: str = ""
    anthropic_api_key: str = ""

    # FastAPI
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # Data
    data_dir: Path = Path(__file__).resolve().parent.parent / "data"

    model_config = {
        "env_file": str(_env_path),
        "env_file_encoding": "utf-8",
    }


settings = Settings()
