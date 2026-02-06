"""FastAPI app — sirve datos del dashboard."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="BTC Intelligence Hub",
    description="API para el centro de inteligencia Bitcoin",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """Health check."""
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/prices")
def get_prices():
    """Placeholder — Fase 1."""
    return {"message": "Not implemented yet — Fase 1"}


@app.get("/api/technical")
def get_technical():
    """Placeholder — Fase 2."""
    return {"message": "Not implemented yet — Fase 2"}


@app.get("/api/onchain")
def get_onchain():
    """Placeholder — Fase 2."""
    return {"message": "Not implemented yet — Fase 2"}


@app.get("/api/macro")
def get_macro():
    """Placeholder — Fase 2."""
    return {"message": "Not implemented yet — Fase 2"}


@app.get("/api/sentiment")
def get_sentiment():
    """Placeholder — Fase 2."""
    return {"message": "Not implemented yet — Fase 2"}


@app.get("/api/cycles")
def get_cycles():
    """Placeholder — Fase 2."""
    return {"message": "Not implemented yet — Fase 2"}


@app.get("/api/conclusions")
def get_conclusions():
    """Placeholder — Fase 3."""
    return {"message": "Not implemented yet — Fase 3"}


@app.get("/api/alerts")
def get_alerts():
    """Placeholder — Fase 2."""
    return {"message": "Not implemented yet — Fase 2"}


@app.get("/api/reports")
def get_reports():
    """Placeholder — Fase 3."""
    return {"message": "Not implemented yet — Fase 3"}


@app.get("/api/cycle-score")
def get_cycle_score():
    """Placeholder — Fase 2."""
    return {"message": "Not implemented yet — Fase 2"}
