from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, or_, update
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..helpers import get_or_404
from ..security import current_user

router = APIRouter(prefix="/api", tags=["home"])


@router.get("/dashboard")
def dashboard(range_days: int = 7, db: Session = Depends(get_db), user=Depends(current_user)):
    today = date.today()
    since = today - timedelta(days=range_days - 1)

    # time distribution by project for me
    rows = db.execute(select(models.Project.name, models.Project.color, func.sum(models.TimeEntry.minutes))
                      .join(models.Project, models.Project.id == models.TimeEntry.project_id)
                      .where(models.TimeEntry.user_id == user.id, models.TimeEntry.date >= since)
                      .group_by(models.Project.id, models.Project.name, models.Project.color)).all()
    time_distribution = [{"name": n, "color": c, "minutes": int(m or 0)} for n, c, m in rows]

    # projects by health
    health = {"good": 0, "at_risk": 0, "needs_attention": 0, "none": 0}
    for h, n in db.execute(select(models.Project.health, func.count(models.Project.id))
                           .where(models.Project.status == "active").group_by(models.Project.health)).all():
        health[h or "none"] = n

    unread = db.scalars(select(models.Notification).where(models.Notification.user_id == user.id,
                                                          models.Notification.is_read.is_(False))
                        .order_by(models.Notification.id.desc()).limit(8)).all()

    # delegated tasks: created by me, assigned to someone else
    base = select(models.Task).where(models.Task.created_by_id == user.id,
                                     models.Task.assignee_id.is_not(None),
                                     models.Task.assignee_id != user.id)
    open_ = base.where(models.Task.status != "completed")
    delegated = {
        "late": db.scalars(open_.where(models.Task.due_date < today)).all(),
        "today": db.scalars(open_.where(models.Task.due_date == today)).all(),
        "upcoming": db.scalars(open_.where(models.Task.due_date > today)).all(),
        "no_due_date": db.scalars(open_.where(models.Task.due_date.is_(None))).all(),
        "completed": db.scalars(base.where(models.Task.status == "completed")
                                .order_by(models.Task.completed_at.desc()).limit(20)).all(),
    }

    # logged time by weekday (this week, me)
    week_start = today - timedelta(days=today.weekday())
    by_day = [0] * 7
    for e in db.scalars(select(models.TimeEntry).where(models.TimeEntry.user_id == user.id,
                                                       models.TimeEntry.date >= week_start)):
        by_day[e.date.weekday()] += e.minutes

    my_open = select(func.count(models.Task.id)).where(models.Task.assignee_id == user.id,
                                                       models.Task.status != "completed")
    counts = {
        "my_late": db.scalar(my_open.where(models.Task.due_date < today)) or 0,
        "my_today": db.scalar(my_open.where(models.Task.due_date == today)) or 0,
        "my_open": db.scalar(my_open) or 0,
    }
    upcoming_ms = db.scalars(select(models.Milestone).where(models.Milestone.completed.is_(False))
                             .order_by(models.Milestone.due_date.is_(None), models.Milestone.due_date).limit(5)).all()

    return {
        "time_distribution": time_distribution,
        "projects_by_health": health,
        "unread": [notif_out(n) for n in unread],
        "delegated": {k: [schemas.task_out(t) for t in v] for k, v in delegated.items()},
        "time_by_weekday": by_day,
        "counts": counts,
        "milestones": [schemas.milestone_out(m) for m in upcoming_ms],
    }


def notif_out(n: models.Notification):
    return {"id": n.id, "kind": n.kind, "message": n.message, "link": n.link, "is_read": n.is_read,
            "actor": schemas.user_brief(n.actor), "created_at": schemas.d(n.created_at)}


@router.get("/inbox")
def inbox(filter: str = "all", db: Session = Depends(get_db), user=Depends(current_user)):
    from .mywork import fire_due_reminders
    fire_due_reminders(db, user)
    stmt = select(models.Notification).where(models.Notification.user_id == user.id)
    if filter == "unread":
        stmt = stmt.where(models.Notification.is_read.is_(False))
    rows = db.scalars(stmt.order_by(models.Notification.id.desc()).limit(200)).all()
    unread = db.scalar(select(func.count(models.Notification.id)).where(
        models.Notification.user_id == user.id, models.Notification.is_read.is_(False))) or 0
    return {"unread": unread, "items": [notif_out(n) for n in rows]}


@router.post("/inbox/{nid}/read")
def mark_read(nid: int, read: bool = True, db: Session = Depends(get_db), user=Depends(current_user)):
    n = get_or_404(db, models.Notification, nid, "Notification")
    if n.user_id == user.id:
        n.is_read = read
        db.commit()
    return {"ok": True}


@router.post("/inbox/read-all")
def mark_all(db: Session = Depends(get_db), user=Depends(current_user)):
    db.execute(update(models.Notification).where(models.Notification.user_id == user.id).values(is_read=True))
    db.commit()
    return {"ok": True}


@router.get("/search")
def search(q: str, db: Session = Depends(get_db), user=Depends(current_user)):
    like = f"%{q}%"
    projects = db.scalars(select(models.Project).where(models.Project.name.ilike(like)).limit(8)).all()
    tasks = db.scalars(select(models.Task).where(models.Task.title.ilike(like)).limit(12)).all()
    people = db.scalars(select(models.User).where(or_(models.User.name.ilike(like),
                                                      models.User.email.ilike(like))).limit(8)).all()
    messages = db.scalars(select(models.Message).where(models.Message.title.ilike(like)).limit(8)).all()
    return {"projects": [{"id": p.id, "name": p.name, "color": p.color} for p in projects],
            "tasks": [{"id": t.id, "title": t.title, "project_name": t.project.name} for t in tasks],
            "people": [schemas.user_brief(p) for p in people],
            "messages": [{"id": m.id, "title": m.title, "project_id": m.project_id} for m in messages]}


@router.get("/activity")
def everything_activity(db: Session = Depends(get_db), user=Depends(current_user)):
    rows = db.scalars(select(models.Activity).order_by(models.Activity.id.desc()).limit(80)).all()
    names = {p.id: p.name for p in db.scalars(select(models.Project))}
    return [{"id": a.id, "user": schemas.user_brief(a.user), "action": a.action,
             "project_id": a.project_id, "project_name": names.get(a.project_id),
             "created_at": schemas.d(a.created_at)} for a in rows]


@router.get("/reports")
def reports(start: date | None = None, end: date | None = None, db: Session = Depends(get_db),
            user=Depends(current_user)):
    end = end or date.today()
    start = start or end - timedelta(days=29)
    today = date.today()
    projects = db.scalars(select(models.Project).where(models.Project.status == "active")).all()
    proj_rows = []
    for p in projects:
        total = db.scalar(select(func.count(models.Task.id)).where(models.Task.project_id == p.id)) or 0
        done = db.scalar(select(func.count(models.Task.id)).where(models.Task.project_id == p.id,
                                                                   models.Task.status == "completed")) or 0
        late = db.scalar(select(func.count(models.Task.id)).where(
            models.Task.project_id == p.id, models.Task.status != "completed", models.Task.due_date < today)) or 0
        mins = db.scalar(select(func.coalesce(func.sum(models.TimeEntry.minutes), 0)).where(
            models.TimeEntry.project_id == p.id, models.TimeEntry.date >= start, models.TimeEntry.date <= end)) or 0
        billable = db.scalar(select(func.coalesce(func.sum(models.TimeEntry.minutes), 0)).where(
            models.TimeEntry.project_id == p.id, models.TimeEntry.billable.is_(True),
            models.TimeEntry.date >= start, models.TimeEntry.date <= end)) or 0
        proj_rows.append({"id": p.id, "name": p.name, "color": p.color, "health": p.health,
                          "tasks": total, "completed": done, "late": late,
                          "progress": round(done * 100 / total) if total else 0,
                          "minutes": int(mins), "billable_minutes": int(billable),
                          "budget_minutes": p.budget_minutes, "end_date": schemas.d(p.end_date)})
    people_rows = []
    for u in db.scalars(select(models.User).where(models.User.is_active.is_(True))).all():
        open_ = db.scalar(select(func.count(models.Task.id)).where(models.Task.assignee_id == u.id,
                                                                    models.Task.status != "completed")) or 0
        done = db.scalar(select(func.count(models.Task.id)).where(
            models.Task.assignee_id == u.id, models.Task.status == "completed")) or 0
        mins = db.scalar(select(func.coalesce(func.sum(models.TimeEntry.minutes), 0)).where(
            models.TimeEntry.user_id == u.id, models.TimeEntry.date >= start, models.TimeEntry.date <= end)) or 0
        est = db.scalar(select(func.coalesce(func.sum(models.Task.estimate_minutes), 0)).where(
            models.Task.assignee_id == u.id, models.Task.status != "completed")) or 0
        people_rows.append({**schemas.user_brief(u), "open_tasks": open_, "completed_tasks": done,
                            "minutes": int(mins), "estimated_open_minutes": int(est)})
    # daily totals
    daily = {}
    for e in db.scalars(select(models.TimeEntry).where(models.TimeEntry.date >= start,
                                                       models.TimeEntry.date <= end)):
        daily[e.date.isoformat()] = daily.get(e.date.isoformat(), 0) + e.minutes
    days = []
    cur = start
    while cur <= end:
        days.append({"date": cur.isoformat(), "minutes": daily.get(cur.isoformat(), 0)})
        cur += timedelta(days=1)
    return {"start": start.isoformat(), "end": end.isoformat(), "projects": proj_rows,
            "people": people_rows, "daily": days}


@router.get("/calendar")
def calendar(start: date, end: date, mine: bool = False, db: Session = Depends(get_db), user=Depends(current_user)):
    stmt = select(models.Task).where(models.Task.due_date >= start, models.Task.due_date <= end)
    if mine:
        stmt = stmt.where(models.Task.assignee_id == user.id)
    tasks = db.scalars(stmt).all()
    ms = db.scalars(select(models.Milestone).where(models.Milestone.due_date >= start,
                                                   models.Milestone.due_date <= end)).all()
    from .mywork import event_out
    ev = db.scalars(select(models.Event).where(models.Event.user_id == user.id, models.Event.date >= start,
                                               models.Event.date <= end)).all()
    return {"tasks": [schemas.task_out(t) for t in tasks], "milestones": [schemas.milestone_out(m) for m in ms],
            "events": [event_out(e) for e in ev]}
