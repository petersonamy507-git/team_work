"""My work: personal tasks, events, reminders, summary counts."""
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..helpers import get_or_404, apply
from ..security import current_user

router = APIRouter(prefix="/api", tags=["my work"])


def fire_due_reminders(db: Session, user):
    """Turn reminders that are due into inbox notifications (checked whenever the inbox or My work loads)."""
    due = db.scalars(select(models.TaskReminder).where(models.TaskReminder.user_id == user.id,
                                                       models.TaskReminder.sent.is_(False),
                                                       models.TaskReminder.remind_at <= datetime.now())).all()
    for r in due:
        t = db.get(models.Task, r.task_id)
        if t:
            db.add(models.Notification(user_id=user.id, actor_id=None, kind="reminder",
                                       message=f"Reminder: \"{t.title}\"" + (f" ({r.note})" if r.note else ""),
                                       link=f"/tasks/{t.id}"))
        r.sent = True
    if due:
        db.commit()


def event_out(e: models.Event):
    return {"id": e.id, "title": e.title, "description": e.description, "date": schemas.d(e.date),
            "start_time": e.start_time, "end_time": e.end_time, "project_id": e.project_id}


@router.get("/work/summary")
def work_summary(user_id: int | None = None, db: Session = Depends(get_db), user=Depends(current_user)):
    """Late / today / upcoming counts for My tasks and My milestones."""
    fire_due_reminders(db, user)
    uid = user_id or user.id
    today = date.today()
    extra = select(models.TaskAssignee.task_id).where(models.TaskAssignee.user_id == uid)
    base = select(func.count(models.Task.id)).where(
        models.Task.status != "completed", or_(models.Task.assignee_id == uid, models.Task.id.in_(extra)))
    ms = select(func.count(models.Milestone.id)).where(models.Milestone.completed.is_(False),
                                                         models.Milestone.owner_id == uid)
    c = lambda q: db.scalar(q) or 0
    return {
        "tasks": {"late": c(base.where(models.Task.due_date < today)), "today": c(base.where(models.Task.due_date == today)),
                  "upcoming": c(base.where(models.Task.due_date > today))},
        "milestones": {"late": c(ms.where(models.Milestone.due_date < today)),
                       "today": c(ms.where(models.Milestone.due_date == today)),
                       "upcoming": c(ms.where(models.Milestone.due_date > today))},
    }


@router.get("/work/today")
def work_today(day: date | None = None, db: Session = Depends(get_db), user=Depends(current_user)):
    """Milestones due and events on a day (sidebar on My tasks)."""
    day = day or date.today()
    ms = db.scalars(select(models.Milestone).where(models.Milestone.due_date == day,
                                                   models.Milestone.completed.is_(False))).all()
    ev = db.scalars(select(models.Event).where(models.Event.date == day, models.Event.user_id == user.id)
                    .order_by(models.Event.start_time)).all()
    names = {p.id: p.name for p in db.scalars(select(models.Project))}
    return {"milestones": [schemas.milestone_out(m, {"project_name": names.get(m.project_id)}) for m in ms],
            "events": [event_out(e) for e in ev]}


@router.get("/work/milestones")
def my_milestones(user_id: int | None = None, db: Session = Depends(get_db), user=Depends(current_user)):
    uid = user_id or user.id
    rows = db.scalars(select(models.Milestone).where(models.Milestone.owner_id == uid,
                                                     models.Milestone.completed.is_(False))
                      .order_by(models.Milestone.due_date.is_(None), models.Milestone.due_date)).all()
    names = {p.id: p.name for p in db.scalars(select(models.Project))}
    return [schemas.milestone_out(m, {"project_name": names.get(m.project_id)}) for m in rows]


# ---- personal tasks ----
def pt_out(p):
    return {"id": p.id, "title": p.title, "done": p.done, "position": p.position}


@router.get("/personal-tasks")
def list_personal(db: Session = Depends(get_db), user=Depends(current_user)):
    rows = db.scalars(select(models.PersonalTask).where(models.PersonalTask.user_id == user.id)
                      .order_by(models.PersonalTask.done, models.PersonalTask.position, models.PersonalTask.id)).all()
    return [pt_out(p) for p in rows]


@router.post("/personal-tasks")
def add_personal(body: schemas.PersonalTaskIn, db: Session = Depends(get_db), user=Depends(current_user)):
    if not (body.title or "").strip():
        raise HTTPException(400, "Title is required")
    pos = db.scalar(select(func.coalesce(func.max(models.PersonalTask.position), -1))
                    .where(models.PersonalTask.user_id == user.id)) + 1
    p = models.PersonalTask(user_id=user.id, title=body.title.strip()[:300], position=pos)
    db.add(p)
    db.commit()
    return pt_out(p)


def own_pt(db, pid, user):
    p = get_or_404(db, models.PersonalTask, pid, "Personal task")
    if p.user_id != user.id:
        raise HTTPException(403, "Not allowed")
    return p


@router.patch("/personal-tasks/{pid}")
def edit_personal(pid: int, body: schemas.PersonalTaskIn, db: Session = Depends(get_db), user=Depends(current_user)):
    p = own_pt(db, pid, user)
    apply(p, body.model_dump(exclude_unset=True))
    db.commit()
    return pt_out(p)


@router.delete("/personal-tasks/{pid}")
def del_personal(pid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    db.delete(own_pt(db, pid, user))
    db.commit()
    return {"ok": True}


# ---- events ----
@router.get("/events")
def list_events(start: date, end: date, db: Session = Depends(get_db), user=Depends(current_user)):
    rows = db.scalars(select(models.Event).where(models.Event.user_id == user.id, models.Event.date >= start,
                                                 models.Event.date <= end).order_by(models.Event.date)).all()
    return [event_out(e) for e in rows]


@router.post("/events")
def add_event(body: schemas.EventIn, db: Session = Depends(get_db), user=Depends(current_user)):
    e = models.Event(user_id=user.id, **body.model_dump())
    db.add(e)
    db.commit()
    return event_out(e)


@router.delete("/events/{eid}")
def del_event(eid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    e = get_or_404(db, models.Event, eid, "Event")
    if e.user_id != user.id:
        raise HTTPException(403, "Not allowed")
    db.delete(e)
    db.commit()
    return {"ok": True}
