from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.db.session import engine
from app.api.routes.auth import router as auth_router
from app.api.routes.tickets import router as tickets_router
from app.api.routes.webhooks import router as webhooks_router
from app.api.routes.moodle import router as moodle_router
from app.api.routes.students import router as students_router
from app.api.routes.risk import router as risk_router
from app.api.routes.playbooks import router as playbooks_router
from app.api.routes.triggers import router as triggers_router
from app.api.routes.feedback import router as feedback_router
from app.api.routes.metrics import router as metrics_router
from app.api.routes.courses import router as courses_router
from app.api.routes.automations import router as automations_router
from app.api.routes.conversations import router as conversations_router
from app.api.routes.asaas import router as asaas_router
from app.jobs.scheduler import start_scheduler, shutdown_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_scheduler()
    yield
    # Shutdown
    shutdown_scheduler()


app = FastAPI(title="CENAT CS Platform", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(tickets_router, prefix="/api")
app.include_router(webhooks_router, prefix="/api")
app.include_router(moodle_router, prefix="/api")
app.include_router(students_router, prefix="/api")
app.include_router(risk_router, prefix="/api")
app.include_router(playbooks_router, prefix="/api")
app.include_router(triggers_router, prefix="/api")
app.include_router(feedback_router, prefix="/api")
app.include_router(metrics_router, prefix="/api")
app.include_router(courses_router, prefix="/api")
app.include_router(automations_router, prefix="/api")
app.include_router(asaas_router, prefix="/api")
app.include_router(conversations_router, prefix="/api")


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

# Importado separadamente pois é rota pública
from app.api.routes.onboarding import router as onboarding_router
app.include_router(onboarding_router, prefix="/api")
