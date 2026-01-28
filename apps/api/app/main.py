import os

from dotenv import load_dotenv
from fastapi import FastAPI
from sqlalchemy import text

from app.db.session import engine

# Carrega .env local (se existir)
load_dotenv()

app = FastAPI(title="CENAT CS Platform")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/db/ping")
def db_ping():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"db": "ok"}
    except Exception as e:
        return {"db": "error", "detail": str(e)}
