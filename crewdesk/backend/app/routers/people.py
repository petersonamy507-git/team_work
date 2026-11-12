from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..helpers import get_or_404, apply
from ..security import current_user, hash_password
from .auth import COLORS

router = APIRouter(prefix="/api", tags=["people"])


@router.get("/people")
def list_people(db: Session = Depends(get_db), user=Depends(current_user)):
    people = db.scalars(select(models.User).order_by(models.User.name)).all()
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    out = []
    for p in people:
        open_tasks = db.scalar(select(func.count(models.Task.id)).where(
            models.Task.assignee_id == p.id, models.Task.status != "completed")) or 0
        late = db.scalar(select(func.count(models.Task.id)).where(
            models.Task.assignee_id == p.id, models.Task.status != "completed",
            models.Task.due_date < today)) or 0
        week_minutes = db.scalar(select(func.coalesce(func.sum(models.TimeEntry.minutes), 0)).where(
            models.TimeEntry.user_id == p.id, models.TimeEntry.date >= week_start)) or 0
        projects = db.scalar(select(func.count(models.ProjectMember.id)).where(
            models.ProjectMember.user_id == p.id)) or 0
        out.append({**schemas.user_out(p), "open_tasks": open_tasks, "late_tasks": late,
                    "week_minutes": int(week_minutes), "project_count": projects})
    return out


@router.post("/people")
def add_person(body: schemas.UserIn, db: Session = Depends(get_db), user=Depends(current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Only admins can add people")
    email = body.email.strip().lower()
    if db.scalar(select(models.User).where(models.User.email == email)):
        raise HTTPException(400, "Email already in use")
    count = db.scalar(select(func.count(models.User.id))) or 0
    p = models.User(name=body.name, email=email, password_hash=hash_password(body.password),
                    title=body.title, role=body.role, color=COLORS[count % len(COLORS)])
    db.add(p)
    db.commit()
    return schemas.user_out(p)


@router.get("/people/{pid}")
def get_person(pid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    p = get_or_404(db, models.User, pid, "Person")
    tasks = db.scalars(select(models.Task).where(models.Task.assignee_id == pid,
                                                 models.Task.status != "completed")
                       .order_by(models.Task.due_date.is_(None), models.Task.due_date)).all()
    project_ids = db.scalars(select(models.ProjectMember.project_id).where(models.ProjectMember.user_id == pid)).all()
    projects = db.scalars(select(models.Project).where(models.Project.id.in_(project_ids))).all() if project_ids else []
    time = db.scalars(select(models.TimeEntry).where(models.TimeEntry.user_id == pid)
                      .order_by(models.TimeEntry.date.desc()).limit(30)).all()
    return {**schemas.user_out(p), "tasks": [schemas.task_out(t) for t in tasks],
            "projects": [schemas.project_out(x) for x in projects],
            "time": [schemas.time_out(e) for e in time]}


@router.patch("/people/{pid}")
def update_person(pid: int, body: schemas.UserUpdate, db: Session = Depends(get_db), user=Depends(current_user)):
    if user.id != pid and user.role != "admin":
        raise HTTPException(403, "Not allowed")
    p = get_or_404(db, models.User, pid, "Person")
    data = body.model_dump(exclude_unset=True)
    if "password" in data:
        pw = data.pop("password")
        if pw:
            p.password_hash = hash_password(pw)
    if user.role != "admin":
        data.pop("role", None)
        data.pop("is_active", None)
    apply(p, data)
    db.commit()
    return schemas.user_out(p)


# ---------- clients ----------
@router.get("/clients")
def list_clients(db: Session = Depends(get_db), user=Depends(current_user)):
    clients = db.scalars(select(models.Client).order_by(models.Client.name)).all()
    out = []
    for c in clients:
        n = db.scalar(select(func.count(models.Project.id)).where(models.Project.client_id == c.id)) or 0
        out.append({**schemas.client_out(c), "project_count": n})
    return out


@router.post("/clients")
def create_client(body: schemas.ClientIn, db: Session = Depends(get_db), user=Depends(current_user)):
    c = models.Client(**body.model_dump())
    db.add(c)
    db.commit()
    return schemas.client_out(c)


@router.patch("/clients/{cid}")
def update_client(cid: int, body: schemas.ClientIn, db: Session = Depends(get_db), user=Depends(current_user)):
    c = get_or_404(db, models.Client, cid, "Client")
    apply(c, body.model_dump(exclude_unset=True))
    db.commit()
    return schemas.client_out(c)


@router.delete("/clients/{cid}")
def delete_client(cid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    c = get_or_404(db, models.Client, cid, "Client")
    db.delete(c)
    db.commit()
    return {"ok": True}
