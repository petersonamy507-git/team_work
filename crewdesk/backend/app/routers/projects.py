from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, delete
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..helpers import get_or_404, apply, log, notify
from ..security import current_user

router = APIRouter(prefix="/api/projects", tags=["projects"])

DEFAULT_COLUMNS = [("To do", "#94a3b8"), ("In progress", "#3b82f6"), ("Review", "#f59e0b"), ("Done", "#10b981")]


def project_stats(db: Session, p: models.Project):
    total = db.scalar(select(func.count(models.Task.id)).where(models.Task.project_id == p.id)) or 0
    done = db.scalar(select(func.count(models.Task.id)).where(models.Task.project_id == p.id,
                                                               models.Task.status == "completed")) or 0
    late = db.scalar(select(func.count(models.Task.id)).where(
        models.Task.project_id == p.id, models.Task.status != "completed",
        models.Task.due_date < date.today())) or 0
    minutes = db.scalar(select(func.coalesce(func.sum(models.TimeEntry.minutes), 0)).where(
        models.TimeEntry.project_id == p.id)) or 0
    members = db.scalars(select(models.User).join(models.ProjectMember,
                                                  models.ProjectMember.user_id == models.User.id)
                         .where(models.ProjectMember.project_id == p.id)).all()
    return {"task_count": total, "completed_count": done, "late_count": late,
            "progress": round(done * 100 / total) if total else 0, "logged_minutes": int(minutes),
            "members": [schemas.user_brief(m) for m in members]}


def set_members(db: Session, project_id: int, member_ids: list[int]):
    db.execute(delete(models.ProjectMember).where(models.ProjectMember.project_id == project_id))
    for uid in set(member_ids):
        db.add(models.ProjectMember(project_id=project_id, user_id=uid))


@router.get("")
def list_projects(status: str = "active", q: str | None = None, db: Session = Depends(get_db),
                  user=Depends(current_user)):
    stmt = select(models.Project)
    if status != "all":
        stmt = stmt.where(models.Project.status == status)
    if q:
        stmt = stmt.where(models.Project.name.ilike(f"%{q}%"))
    projects = db.scalars(stmt.order_by(models.Project.is_starred.desc(), models.Project.name)).all()
    return [schemas.project_out(p, st) for p, st in zip(projects, bulk_stats(db, projects))]


def bulk_stats(db: Session, projects):
    """project_stats for many projects in 4 queries total."""
    ids = [p.id for p in projects] or [0]
    today = date.today()
    T = models.Task
    total = dict(db.execute(select(T.project_id, func.count(T.id)).where(T.project_id.in_(ids)).group_by(T.project_id)).all())
    done = dict(db.execute(select(T.project_id, func.count(T.id)).where(T.project_id.in_(ids), T.status == "completed").group_by(T.project_id)).all())
    late = dict(db.execute(select(T.project_id, func.count(T.id)).where(T.project_id.in_(ids), T.status != "completed",
                                                                        T.due_date < today).group_by(T.project_id)).all())
    mins = dict(db.execute(select(models.TimeEntry.project_id, func.coalesce(func.sum(models.TimeEntry.minutes), 0))
                           .where(models.TimeEntry.project_id.in_(ids)).group_by(models.TimeEntry.project_id)).all())
    members = {}
    for pid, u in db.execute(select(models.ProjectMember.project_id, models.User).join(
            models.User, models.User.id == models.ProjectMember.user_id).where(models.ProjectMember.project_id.in_(ids))).all():
        members.setdefault(pid, []).append(schemas.user_brief(u))
    out = []
    for p in projects:
        t, d = total.get(p.id, 0), done.get(p.id, 0)
        out.append({"task_count": t, "completed_count": d, "late_count": late.get(p.id, 0),
                    "progress": round(d * 100 / t) if t else 0, "logged_minutes": int(mins.get(p.id, 0)),
                    "members": members.get(p.id, [])})
    return out


@router.post("")
def create_project(body: schemas.ProjectIn, db: Session = Depends(get_db), user=Depends(current_user)):
    data = body.model_dump(exclude_unset=True)
    member_ids = data.pop("member_ids", None) or []
    data.setdefault("owner_id", user.id)
    p = models.Project(**{k: v for k, v in data.items() if v is not None})
    db.add(p)
    db.flush()
    set_members(db, p.id, member_ids + [user.id])
    for i, (name, color) in enumerate(DEFAULT_COLUMNS):
        db.add(models.BoardColumn(project_id=p.id, name=name, color=color, position=i))
    db.add(models.TaskList(project_id=p.id, name="General tasks", position=0))
    log(db, user, f"created project {p.name}", p.id)
    for uid in member_ids:
        notify(db, uid, user, f"{user.name} added you to project {p.name}", f"/projects/{p.id}")
    db.commit()
    return schemas.project_out(p, project_stats(db, p))


@router.get("/{pid}")
def get_project(pid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    p = get_or_404(db, models.Project, pid, "Project")
    return schemas.project_out(p, project_stats(db, p))


@router.patch("/{pid}")
def update_project(pid: int, body: schemas.ProjectIn, db: Session = Depends(get_db), user=Depends(current_user)):
    p = get_or_404(db, models.Project, pid, "Project")
    data = body.model_dump(exclude_unset=True)
    member_ids = data.pop("member_ids", None)
    apply(p, data)
    if member_ids is not None:
        set_members(db, p.id, member_ids)
    log(db, user, f"updated project {p.name}", p.id)
    db.commit()
    return schemas.project_out(p, project_stats(db, p))


@router.delete("/{pid}")
def delete_project(pid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    p = get_or_404(db, models.Project, pid, "Project")
    if user.role != "admin" and p.owner_id != user.id:
        raise HTTPException(403, "Only the owner or an admin can delete a project")
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.get("/{pid}/activity")
def project_activity(pid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    rows = db.scalars(select(models.Activity).where(models.Activity.project_id == pid)
                      .order_by(models.Activity.id.desc()).limit(50)).all()
    return [{"id": a.id, "user": schemas.user_brief(a.user), "action": a.action,
             "created_at": schemas.d(a.created_at)} for a in rows]


# ---------- task lists ----------
@router.get("/{pid}/tasklists")
def list_tasklists(pid: int, include_completed: bool = False, db: Session = Depends(get_db),
                   user=Depends(current_user)):
    lists = db.scalars(select(models.TaskList).where(models.TaskList.project_id == pid)
                       .order_by(models.TaskList.position, models.TaskList.id)).all()
    out = []
    for tl in lists:
        stmt = select(models.Task).where(models.Task.tasklist_id == tl.id, models.Task.parent_id.is_(None))
        if not include_completed:
            stmt = stmt.where(models.Task.status != "completed")
        tasks = db.scalars(stmt.order_by(models.Task.position, models.Task.id)).all()
        done = db.scalar(select(func.count(models.Task.id)).where(models.Task.tasklist_id == tl.id,
                                                                   models.Task.status == "completed")) or 0
        out.append({"id": tl.id, "name": tl.name, "description": tl.description, "position": tl.position,
                    "milestone_id": tl.milestone_id, "completed_count": done,
                    "tasks": [schemas.task_out(t, {"subtask_count": len_sub(db, t.id)}) for t in tasks]})
    return out


def len_sub(db, tid):
    return db.scalar(select(func.count(models.Task.id)).where(models.Task.parent_id == tid)) or 0


@router.post("/{pid}/tasklists")
def create_tasklist(pid: int, body: schemas.TaskListIn, db: Session = Depends(get_db), user=Depends(current_user)):
    get_or_404(db, models.Project, pid, "Project")
    pos = db.scalar(select(func.coalesce(func.max(models.TaskList.position), -1)).where(
        models.TaskList.project_id == pid)) + 1
    tl = models.TaskList(project_id=pid, name=body.name, description=body.description,
                         milestone_id=body.milestone_id, position=pos)
    db.add(tl)
    log(db, user, f"added task list {body.name}", pid)
    db.commit()
    return {"id": tl.id, "name": tl.name, "description": tl.description, "position": tl.position,
            "milestone_id": tl.milestone_id, "completed_count": 0, "tasks": []}


@router.patch("/tasklists/{lid}")
def update_tasklist(lid: int, body: schemas.TaskListIn, db: Session = Depends(get_db), user=Depends(current_user)):
    tl = get_or_404(db, models.TaskList, lid, "Task list")
    apply(tl, body.model_dump(exclude_unset=True))
    db.commit()
    return {"id": tl.id, "name": tl.name}


@router.delete("/tasklists/{lid}")
def delete_tasklist(lid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    tl = get_or_404(db, models.TaskList, lid, "Task list")
    db.execute(delete(models.Task).where(models.Task.tasklist_id == lid))
    db.delete(tl)
    db.commit()
    return {"ok": True}


# ---------- board ----------
@router.get("/{pid}/board")
def get_board(pid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    cols = db.scalars(select(models.BoardColumn).where(models.BoardColumn.project_id == pid)
                      .order_by(models.BoardColumn.position)).all()
    tasks = db.scalars(select(models.Task).where(models.Task.project_id == pid, models.Task.parent_id.is_(None))
                       .order_by(models.Task.position, models.Task.id)).all()
    first = cols[0].id if cols else None
    out = []
    for c in cols:
        out.append({"id": c.id, "name": c.name, "color": c.color, "position": c.position,
                    "tasks": [schemas.task_out(t) for t in tasks if (t.column_id or first) == c.id]})
    return out


@router.post("/{pid}/columns")
def create_column(pid: int, body: schemas.ColumnIn, db: Session = Depends(get_db), user=Depends(current_user)):
    pos = db.scalar(select(func.coalesce(func.max(models.BoardColumn.position), -1)).where(
        models.BoardColumn.project_id == pid)) + 1
    c = models.BoardColumn(project_id=pid, name=body.name, color=body.color or "#94a3b8", position=pos)
    db.add(c)
    db.commit()
    return {"id": c.id, "name": c.name, "color": c.color, "position": c.position, "tasks": []}


@router.patch("/columns/{cid}")
def update_column(cid: int, body: schemas.ColumnIn, db: Session = Depends(get_db), user=Depends(current_user)):
    c = get_or_404(db, models.BoardColumn, cid, "Column")
    apply(c, body.model_dump(exclude_unset=True))
    db.commit()
    return {"id": c.id, "name": c.name, "color": c.color}


@router.delete("/columns/{cid}")
def delete_column(cid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    c = get_or_404(db, models.BoardColumn, cid, "Column")
    db.delete(c)
    db.commit()
    return {"ok": True}


# ---------- people on project ----------
@router.get("/{pid}/people")
def project_people(pid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    members = db.scalars(select(models.User).join(models.ProjectMember,
                                                  models.ProjectMember.user_id == models.User.id)
                         .where(models.ProjectMember.project_id == pid).order_by(models.User.name)).all()
    out = []
    for m in members:
        open_tasks = db.scalar(select(func.count(models.Task.id)).where(
            models.Task.project_id == pid, models.Task.assignee_id == m.id,
            models.Task.status != "completed")) or 0
        out.append({**schemas.user_out(m), "open_tasks": open_tasks})
    return out


@router.post("/{pid}/people/{uid}")
def add_project_person(pid: int, uid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    p = get_or_404(db, models.Project, pid, "Project")
    if not db.scalar(select(models.ProjectMember).where(models.ProjectMember.project_id == pid,
                                                        models.ProjectMember.user_id == uid)):
        db.add(models.ProjectMember(project_id=pid, user_id=uid))
        notify(db, uid, user, f"{user.name} added you to project {p.name}", f"/projects/{pid}")
        db.commit()
    return {"ok": True}


@router.delete("/{pid}/people/{uid}")
def remove_project_person(pid: int, uid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    db.execute(delete(models.ProjectMember).where(models.ProjectMember.project_id == pid,
                                                  models.ProjectMember.user_id == uid))
    db.commit()
    return {"ok": True}
