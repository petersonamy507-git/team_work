from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import CORS_ORIGINS
from .database import Base, engine, add_missing_columns
from . import models  # noqa: F401  (registers tables)
from . import client_scope  # noqa: F401  (client view: scopes queries for client users)
from .routers import auth, people, projects, tasks, time, milestones, messages, files, home, mywork, parity, taskextras, invites

Base.metadata.create_all(bind=engine)
add_missing_columns()

app = FastAPI(title="Crewdesk API", version="1.0.0")
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

for r in (parity, auth, people, projects, tasks, time, milestones, messages, files, home, mywork, taskextras, invites):
    app.include_router(r.router)


@app.on_event("startup")
def _automations_scheduler():
    from .automation_engine import start_scheduler
    from .database import SessionLocal
    start_scheduler(SessionLocal)


@app.get("/api/health")
def health():
    return {"ok": True}


# Serve the built frontend (frontend/dist) when it exists, so production is one process.
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        target = DIST / path
        if path and target.is_file():
            return FileResponse(target)
        return FileResponse(DIST / "index.html")
