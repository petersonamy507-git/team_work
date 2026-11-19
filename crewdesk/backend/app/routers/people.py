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
    from ..client_scope import visible_user_ids
    people = db.scalars(select(models.User).order_by(models.User.name)).all()
    vis = visible_user_ids(db)
    if vis is not None:
        people = [p for p in people if p.id in vis]
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    T = models.Task
    open_ = dict(db.execute(select(T.assignee_id, func.count(T.id)).where(T.status != "completed").group_by(T.assignee_id)).all())
    late = dict(db.execute(select(T.assignee_id, func.count(T.id)).where(T.status != "completed", T.due_date < today)
                           .group_by(T.assignee_id)).all())
    week = dict(db.execute(select(models.TimeEntry.user_id, func.coalesce(func.sum(models.TimeEntry.minutes), 0))
                           .where(models.TimeEntry.date >= week_start).group_by(models.TimeEntry.user_id)).all())
    projs = dict(db.execute(select(models.ProjectMember.user_id, func.count(models.ProjectMember.id))
                            .group_by(models.ProjectMember.user_id)).all())
    return [{**schemas.user_out(p), "open_tasks": open_.get(p.id, 0), "late_tasks": late.get(p.id, 0),
             "week_minutes": int(week.get(p.id, 0)), "project_count": projs.get(p.id, 0)} for p in people]


@router.post("/people")
def add_person(body: schemas.UserIn, db: Session = Depends(get_db), user=Depends(current_user)):
    if user.role != "admin" and not getattr(user, "can_add_users", False):
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


def client_login(db: Session, c: models.Client):
    """The client-user account that lets this client sign in, if one exists."""
    return db.scalar(select(models.User).where(models.User.role == "client", models.User.client_id == c.id)
                     .order_by(models.User.id))


def _set_client_login(db: Session, c: models.Client, password: str | None):
    """Create or update the client's login (email + password) as a 'client' user tied to this client."""
    login = client_login(db, c)
    email = (c.email or "").strip().lower()
    if password:
        if len(password) < 6:
            raise HTTPException(400, "Password must be at least 6 characters")
        if not email:
            raise HTTPException(400, "Add the client's email so they can sign in with this password")
    if not email or (not password and not login):
        return
    other = db.scalar(select(models.User).where(models.User.email == email))
    if other and (not login or other.id != login.id):
        if other.role != "client" or (other.client_id and other.client_id != c.id):
            raise HTTPException(400, f"{email} is already used by another sign-in")
        login = other  # an existing client user with this email: link it to this client
    if not login:
        count = db.scalar(select(func.count(models.User.id))) or 0
        login = models.User(name=c.name, email=email, role="client", color=COLORS[count % len(COLORS)],
                            password_hash=hash_password(password))
        db.add(login)
    login.client_id = c.id
    login.email = email
    if password:
        login.password_hash = hash_password(password)


@router.post("/clients")
def create_client(body: schemas.ClientIn, db: Session = Depends(get_db), user=Depends(current_user)):
    data = body.model_dump()
    password = data.pop("password", None)
    c = models.Client(**data)
    db.add(c)
    db.flush()
    _set_client_login(db, c, password)
    db.commit()
    return schemas.client_out(c)


@router.patch("/clients/{cid}")
def update_client(cid: int, body: schemas.ClientIn, db: Session = Depends(get_db), user=Depends(current_user)):
    c = get_or_404(db, models.Client, cid, "Client")
    data = body.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    apply(c, data)
    db.flush()
    _set_client_login(db, c, password)
    db.commit()
    return schemas.client_out(c)


@router.delete("/clients/{cid}")
def delete_client(cid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    c = get_or_404(db, models.Client, cid, "Client")
    # the client's login goes with it, so it can no longer sign in
    for login in db.scalars(select(models.User).where(models.User.role == "client", models.User.client_id == c.id)).all():
        try:
            with db.begin_nested():
                db.delete(login)
        except Exception:
            login.is_active = False
            login.client_id = None
    db.delete(c)
    db.commit()
    return {"ok": True}
