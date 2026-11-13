from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..helpers import get_or_404, apply, log
from ..security import current_user

router = APIRouter(prefix="/api/time", tags=["time"])


@router.get("")
def list_time(user_id: str | None = "me", project_id: int | None = None, start: date | None = None,
              end: date | None = None, billable: bool | None = None,
              db: Session = Depends(get_db), user=Depends(current_user)):
    stmt = select(models.TimeEntry)
    if user_id == "me":
        stmt = stmt.where(models.TimeEntry.user_id == user.id)
    elif user_id and user_id != "all":
        stmt = stmt.where(models.TimeEntry.user_id == int(user_id))
    if project_id:
        stmt = stmt.where(models.TimeEntry.project_id == project_id)
    if start:
        stmt = stmt.where(models.TimeEntry.date >= start)
    if end:
        stmt = stmt.where(models.TimeEntry.date <= end)
    if billable is not None:
        stmt = stmt.where(models.TimeEntry.billable.is_(billable))
    rows = db.scalars(stmt.order_by(models.TimeEntry.date.desc(), models.TimeEntry.id.desc()).limit(1000)).all()
    return [schemas.time_out(e) for e in rows]


@router.post("")
def log_time(body: schemas.TimeIn, db: Session = Depends(get_db), user=Depends(current_user)):
    get_or_404(db, models.Project, body.project_id, "Project")
    e = models.TimeEntry(user_id=user.id, **body.model_dump())
    db.add(e)
    log(db, user, f"logged {body.minutes // 60}h {body.minutes % 60}m", body.project_id)
    if body.task_id:  # Automations: time logged / logged time exceeds estimate
        from sqlalchemy import func as _f
        from .parity import run_automations
        t = db.get(models.Task, body.task_id)
        if t:
            run_automations(db, t, "time_logged", user)
            total = (db.scalar(select(_f.coalesce(_f.sum(models.TimeEntry.minutes), 0)).where(models.TimeEntry.task_id == t.id)) or 0) + body.minutes
            if t.estimate_minutes and total > t.estimate_minutes >= total - body.minutes:
                run_automations(db, t, "time_exceeds", user)
    db.commit()
    db.refresh(e)
    return schemas.time_out(e)


@router.patch("/{eid}")
def update_time(eid: int, body: schemas.TimeIn, db: Session = Depends(get_db), user=Depends(current_user)):
    e = get_or_404(db, models.TimeEntry, eid, "Time entry")
    if e.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "Not allowed")
    apply(e, body.model_dump())
    db.commit()
    db.refresh(e)
    return schemas.time_out(e)


@router.delete("/{eid}")
def delete_time(eid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    e = get_or_404(db, models.TimeEntry, eid, "Time entry")
    if e.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "Not allowed")
    db.delete(e)
    db.commit()
    return {"ok": True}


@router.get("/timesheet")
def timesheet(week_of: date | None = None, db: Session = Depends(get_db), user=Depends(current_user)):
    """Week grid: rows per project, columns Monday..Sunday (minutes)."""
    ref = week_of or date.today()
    start = ref - timedelta(days=ref.weekday())
    end = start + timedelta(days=6)
    rows = db.scalars(select(models.TimeEntry).where(models.TimeEntry.user_id == user.id,
                                                     models.TimeEntry.date >= start,
                                                     models.TimeEntry.date <= end)).all()
    grid: dict[int, dict] = {}
    for e in rows:
        r = grid.setdefault(e.project_id, {"project_id": e.project_id, "project_name": e.project.name,
                                           "days": [0] * 7})
        r["days"][(e.date - start).days] += e.minutes
    return {"start": start.isoformat(), "end": end.isoformat(),
            "days": [(start + timedelta(days=i)).isoformat() for i in range(7)],
            "rows": list(grid.values())}
