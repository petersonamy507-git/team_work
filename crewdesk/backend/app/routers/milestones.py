from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..helpers import get_or_404, apply, log, notify
from ..security import current_user

router = APIRouter(prefix="/api", tags=["milestones"])


def ms_extra(db, m):
    lists = db.scalars(select(models.TaskList).where(models.TaskList.milestone_id == m.id)).all()
    ids = [l.id for l in lists]
    total = done = 0
    if ids:
        total = db.scalar(select(func.count(models.Task.id)).where(models.Task.tasklist_id.in_(ids))) or 0
        done = db.scalar(select(func.count(models.Task.id)).where(models.Task.tasklist_id.in_(ids),
                                                                   models.Task.status == "completed")) or 0
    p = db.get(models.Project, m.project_id)
    return {"project_name": p.name if p else None, "tasklists": [{"id": l.id, "name": l.name} for l in lists],
            "task_count": total, "completed_count": done,
            "late": (not m.completed and m.due_date is not None and m.due_date < date.today())}


@router.get("/milestones")
def all_milestones(status: str = "upcoming", db: Session = Depends(get_db), user=Depends(current_user)):
    stmt = select(models.Milestone)
    if status == "upcoming":
        stmt = stmt.where(models.Milestone.completed.is_(False))
    elif status == "completed":
        stmt = stmt.where(models.Milestone.completed.is_(True))
    rows = db.scalars(stmt.order_by(models.Milestone.due_date.is_(None), models.Milestone.due_date)).all()
    return [schemas.milestone_out(m, ms_extra(db, m)) for m in rows]


@router.get("/projects/{pid}/milestones")
def project_milestones(pid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    rows = db.scalars(select(models.Milestone).where(models.Milestone.project_id == pid)
                      .order_by(models.Milestone.completed, models.Milestone.due_date)).all()
    return [schemas.milestone_out(m, ms_extra(db, m)) for m in rows]


@router.post("/projects/{pid}/milestones")
def create_milestone(pid: int, body: schemas.MilestoneIn, db: Session = Depends(get_db), user=Depends(current_user)):
    m = models.Milestone(project_id=pid, **{k: v for k, v in body.model_dump().items() if v is not None})
    db.add(m)
    db.flush()
    log(db, user, f"added milestone {m.name}", pid)
    from ..automation_engine import fire
    fire(db, "milestone_added", user, milestone=m)
    if m.owner_id:
        fire(db, "milestone_assignee_added", user, milestone=m, ctx={"user_ids": [m.owner_id]})
    notify(db, m.owner_id, user, f"{user.name} made you responsible for milestone {m.name}", f"/projects/{pid}/milestones")
    db.commit()
    return schemas.milestone_out(m, ms_extra(db, m))


@router.patch("/milestones/{mid}")
def update_milestone(mid: int, body: schemas.MilestoneIn, db: Session = Depends(get_db), user=Depends(current_user)):
    m = get_or_404(db, models.Milestone, mid, "Milestone")
    was_done, old_owner = m.completed, m.owner_id
    apply(m, body.model_dump(exclude_unset=True))
    from ..automation_engine import fire
    if body.completed:
        log(db, user, f"completed milestone {m.name}", m.project_id)
        if not was_done:
            fire(db, "milestone_completed", user, milestone=m)
    if m.owner_id != old_owner:
        if old_owner:
            fire(db, "milestone_assignee_removed", user, milestone=m, ctx={"user_ids": [old_owner]})
        if m.owner_id:
            fire(db, "milestone_assignee_added", user, milestone=m, ctx={"user_ids": [m.owner_id]})
    fire(db, "milestone_updated", user, milestone=m)
    db.commit()
    return schemas.milestone_out(m, ms_extra(db, m))


@router.delete("/milestones/{mid}")
def delete_milestone(mid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    m = get_or_404(db, models.Milestone, mid, "Milestone")
    db.delete(m)
    db.commit()
    return {"ok": True}
