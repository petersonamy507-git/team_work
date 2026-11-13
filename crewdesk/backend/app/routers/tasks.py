import json
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, or_, and_, delete
from sqlalchemy.orm import Session, aliased

from .. import models, schemas
from ..database import get_db
from ..helpers import get_or_404, apply, log, notify
from ..security import current_user
from .. import task_extras_models as X
from ..mailer import send_email

router = APIRouter(prefix="/api", tags=["tasks"])

PRIORITY_RANK = {"high": 0, "medium": 1, "low": 2, "none": 3}
FIELD_LABELS = {"title": "title", "description": "description", "status": "status", "priority": "priority",
                "start_date": "start date", "due_date": "due date", "estimate_minutes": "estimated time",
                "progress": "progress", "tags": "tags", "tasklist_id": "task list", "is_private": "privacy",
                "repeat": "repeat", "column_id": "board column"}


# ---------- helpers ----------
def csv_ints(v: str | None):
    return [int(x) for x in (v or "").split(",") if x.strip().lstrip("-").isdigit()]


def csv_strs(v: str | None):
    return [x.strip() for x in (v or "").split(",") if x.strip()]


def enrich(db: Session, tasks: list[models.Task], user) -> list[dict]:
    """task_out plus assignees, counts and follow state, using a handful of batched queries."""
    if not tasks:
        return []
    ids = [t.id for t in tasks]
    extra = {}
    for ta, u in db.execute(select(models.TaskAssignee, models.User)
                            .join(models.User, models.User.id == models.TaskAssignee.user_id)
                            .where(models.TaskAssignee.task_id.in_(ids))).all():
        extra.setdefault(ta.task_id, []).append(u)
    subs = dict(db.execute(select(models.Task.parent_id, func.count()).where(models.Task.parent_id.in_(ids))
                           .group_by(models.Task.parent_id)).all())
    subs_done = dict(db.execute(select(models.Task.parent_id, func.count())
                                .where(models.Task.parent_id.in_(ids), models.Task.status == "completed")
                                .group_by(models.Task.parent_id)).all())
    comments = dict(db.execute(select(models.Comment.task_id, func.count()).where(models.Comment.task_id.in_(ids))
                               .group_by(models.Comment.task_id)).all())
    files = dict(db.execute(select(models.FileItem.task_id, func.count()).where(models.FileItem.task_id.in_(ids))
                            .group_by(models.FileItem.task_id)).all())
    logged = dict(db.execute(select(models.TimeEntry.task_id, func.sum(models.TimeEntry.minutes))
                             .where(models.TimeEntry.task_id.in_(ids)).group_by(models.TimeEntry.task_id)).all())
    deps = dict(db.execute(select(models.TaskDependency.task_id, func.count())
                           .where(models.TaskDependency.task_id.in_(ids))
                           .group_by(models.TaskDependency.task_id)).all())
    custom = {}
    for tid_, fid_, val_ in db.execute(select(X.TaskFieldValue.task_id, X.TaskFieldValue.field_id, X.TaskFieldValue.value)
                                       .where(X.TaskFieldValue.task_id.in_(ids))).all():
        custom.setdefault(tid_, {})[str(fid_)] = val_
    following = set(db.scalars(select(models.TaskFollower.task_id).where(
        models.TaskFollower.task_id.in_(ids), models.TaskFollower.user_id == user.id)).all())
    out = []
    for t in tasks:
        assignees = ([t.assignee] if t.assignee else []) + [u for u in extra.get(t.id, []) if u.id != t.assignee_id]
        out.append(schemas.task_out(t, {
            "assignees": [schemas.user_brief(u) for u in assignees],
            "subtask_count": int(subs.get(t.id, 0)), "subtask_done": int(subs_done.get(t.id, 0)),
            "comment_count": int(comments.get(t.id, 0)), "file_count": int(files.get(t.id, 0)),
            "logged_minutes": int(logged.get(t.id) or 0), "dependency_count": int(deps.get(t.id, 0)),
            "is_following": t.id in following,
            "custom": custom.get(t.id, {}),
            "project_color": t.project.color if t.project else None,
            "client_name": t.project.client.name if t.project and t.project.client else None,
        }))
    return out


def assignee_ids_of(db, t):
    ids = [t.assignee_id] if t.assignee_id else []
    ids += [i for i in db.scalars(select(models.TaskAssignee.user_id).where(models.TaskAssignee.task_id == t.id))
            if i not in ids]
    return ids


def set_assignees(db, t, ids: list[int]):
    ids = list(dict.fromkeys(i for i in ids if i))
    t.assignee_id = ids[0] if ids else None
    db.execute(delete(models.TaskAssignee).where(models.TaskAssignee.task_id == t.id))
    for uid in ids[1:]:
        db.add(models.TaskAssignee(task_id=t.id, user_id=uid))


def task_full(db, t, user):
    out = enrich(db, [t], user)[0]
    subtasks = db.scalars(select(models.Task).where(models.Task.parent_id == t.id)
                          .order_by(models.Task.position, models.Task.id)).all()
    comments = db.scalars(select(models.Comment).where(models.Comment.task_id == t.id)
                          .order_by(models.Comment.id)).all()
    files = db.scalars(select(models.FileItem).where(models.FileItem.task_id == t.id)).all()
    times = db.scalars(select(models.TimeEntry).where(models.TimeEntry.task_id == t.id)
                       .order_by(models.TimeEntry.date.desc(), models.TimeEntry.id.desc())).all()
    followers = db.scalars(select(models.User).join(models.TaskFollower, models.TaskFollower.user_id == models.User.id)
                           .where(models.TaskFollower.task_id == t.id)).all()
    dep_on = db.scalars(select(models.Task).join(models.TaskDependency,
                                                 models.TaskDependency.depends_on_id == models.Task.id)
                        .where(models.TaskDependency.task_id == t.id)).all()
    blocking = db.scalars(select(models.Task).join(models.TaskDependency,
                                                   models.TaskDependency.task_id == models.Task.id)
                          .where(models.TaskDependency.depends_on_id == t.id)).all()
    activity = db.scalars(select(models.Activity).where(models.Activity.task_id == t.id)
                          .order_by(models.Activity.id.desc()).limit(50)).all()
    parent = db.get(models.Task, t.parent_id) if t.parent_id else None
    reminders = db.scalars(select(models.TaskReminder).where(models.TaskReminder.task_id == t.id)
                           .order_by(models.TaskReminder.remind_at)).all()
    brief = lambda x: {"id": x.id, "title": x.title, "status": x.status, "due_date": schemas.d(x.due_date),
                       "project_name": x.project.name if x.project else None}
    out.update({
        "subtasks": enrich(db, list(subtasks), user),
        "comments": [{"id": c.id, "body": c.body, "user": schemas.user_brief(c.user),
                      "created_at": schemas.d(c.created_at)} for c in comments],
        "files": [{"id": f.id, "name": f.original_name, "size": f.size, "user": schemas.user_brief(f.user),
                   "created_at": schemas.d(f.created_at)} for f in files],
        "time_entries": [schemas.time_out(e) for e in times],
        "followers": [schemas.user_brief(u) for u in followers],
        "depends_on": [brief(x) for x in dep_on],
        "blocking": [brief(x) for x in blocking],
        "activity": [{"id": a.id, "action": a.action, "user": schemas.user_brief(a.user),
                      "created_at": schemas.d(a.created_at)} for a in activity],
        "parent": brief(parent) if parent else None,
        "reminders": [{"id": r.id, "remind_at": schemas.d(r.remind_at), "note": r.note, "sent": r.sent,
                       "user": schemas.user_brief(r.user)} for r in reminders],
    })
    return out


def filtered_query(user, *, assignee=None, created_by=None, project_id=None, tasklist_id=None, status="open",
                   priority=None, tags=None, due=None, due_from=None, due_to=None, start_from=None,
                   start_to=None, followed=False, q=None, include_subtasks=False, parent_id=None,
                   exclude_tags=None, untagged=False, not_blocked=False, starred=False, client_id=None,
                   owner_id=None):
    stmt = select(models.Task).join(models.Project, models.Project.id == models.Task.project_id)
    stmt = stmt.where(models.Project.status != "archived")
    today = date.today()
    if parent_id:
        stmt = stmt.where(models.Task.parent_id == parent_id)
    elif not include_subtasks:
        stmt = stmt.where(models.Task.parent_id.is_(None))
    # private tasks are only visible to their creator and assignees
    extra_me = select(models.TaskAssignee.task_id).where(models.TaskAssignee.user_id == user.id)
    stmt = stmt.where(or_(models.Task.is_private.is_(False), models.Task.is_private.is_(None),
                          models.Task.created_by_id == user.id, models.Task.assignee_id == user.id,
                          models.Task.id.in_(extra_me)))
    if assignee:
        conds = []
        vals = csv_strs(assignee)
        ids = [user.id if v == "me" else int(v) for v in vals if v == "me" or v.isdigit()]
        if "none" in vals:
            conds.append(models.Task.assignee_id.is_(None))
        if ids:
            conds.append(models.Task.assignee_id.in_(ids))
            conds.append(models.Task.id.in_(select(models.TaskAssignee.task_id)
                                            .where(models.TaskAssignee.user_id.in_(ids))))
        if conds:
            stmt = stmt.where(or_(*conds))
    if created_by == "me":  # "delegated": I created it for someone else
        stmt = stmt.where(models.Task.created_by_id == user.id,
                          or_(models.Task.assignee_id.is_(None), models.Task.assignee_id != user.id))
    elif created_by:
        stmt = stmt.where(models.Task.created_by_id.in_(csv_ints(created_by)))
    if project_id:
        stmt = stmt.where(models.Task.project_id.in_(csv_ints(str(project_id))))
    if tasklist_id:
        stmt = stmt.where(models.Task.tasklist_id.in_(csv_ints(str(tasklist_id))))
    sts = csv_strs(status)
    if "open" in sts:
        stmt = stmt.where(models.Task.status != "completed")
    elif "all" not in sts and sts:
        stmt = stmt.where(models.Task.status.in_(sts))
    if priority:
        stmt = stmt.where(models.Task.priority.in_(csv_strs(priority)))
    if tags:
        stmt = stmt.where(or_(*[func.concat(",", func.replace(func.coalesce(models.Task.tags, ""), ", ", ","), ",")
                                .like(f"%,{tg},%") for tg in csv_strs(tags)]))
    if due == "late":
        stmt = stmt.where(models.Task.due_date < today, models.Task.status != "completed")
    elif due == "today":
        stmt = stmt.where(models.Task.due_date == today)
    elif due == "upcoming":
        stmt = stmt.where(models.Task.due_date > today)
    elif due == "nodate":
        stmt = stmt.where(models.Task.due_date.is_(None))
    elif due == "week":
        stmt = stmt.where(models.Task.due_date >= today, models.Task.due_date <= today + timedelta(days=7))
    elif due == "month" or due == "next30":
        stmt = stmt.where(models.Task.due_date >= today, models.Task.due_date <= today + timedelta(days=30))
    elif due == "next14":
        stmt = stmt.where(models.Task.due_date >= today, models.Task.due_date <= today + timedelta(days=14))
    elif due == "yesterday":
        stmt = stmt.where(models.Task.due_date == today - timedelta(days=1))
    elif due == "tomorrow":
        stmt = stmt.where(models.Task.due_date == today + timedelta(days=1))
    elif due in ("thisweek", "lastweek", "nextweek"):
        shift = {"thisweek": 0, "lastweek": -7, "nextweek": 7}[due]
        monday = today - timedelta(days=today.weekday()) + timedelta(days=shift)
        stmt = stmt.where(models.Task.due_date >= monday, models.Task.due_date <= monday + timedelta(days=6))
    elif due == "thismonth":
        first = today.replace(day=1)
        nxt = (first + timedelta(days=32)).replace(day=1)
        stmt = stmt.where(models.Task.due_date >= first, models.Task.due_date < nxt)
    tag_expr = func.concat(",", func.replace(func.coalesce(models.Task.tags, ""), ", ", ","), ",")
    if exclude_tags:
        for tg in csv_strs(exclude_tags):
            stmt = stmt.where(~tag_expr.like(f"%,{tg},%"))
    if untagged:
        stmt = stmt.where(or_(models.Task.tags.is_(None), models.Task.tags == ""))
    if not_blocked:
        Dep = models.TaskDependency
        Other = aliased(models.Task)
        open_deps = select(Dep.task_id).join(Other, Other.id == Dep.depends_on_id).where(Other.status != "completed")
        stmt = stmt.where(models.Task.id.not_in(open_deps))
    if starred:
        stmt = stmt.where(models.Project.is_starred.is_(True))
    if client_id:
        stmt = stmt.where(models.Project.client_id.in_(csv_ints(str(client_id))))
    if owner_id:
        stmt = stmt.where(models.Project.owner_id.in_(csv_ints(str(owner_id))))
    if due_from:
        stmt = stmt.where(models.Task.due_date >= due_from)
    if due_to:
        stmt = stmt.where(models.Task.due_date <= due_to)
    if start_from:
        stmt = stmt.where(models.Task.start_date >= start_from)
    if start_to:
        stmt = stmt.where(models.Task.start_date <= start_to)
    if followed:
        stmt = stmt.where(models.Task.id.in_(select(models.TaskFollower.task_id)
                                             .where(models.TaskFollower.user_id == user.id)))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(models.Task.title.ilike(like), models.Task.description.ilike(like),
                              models.Task.tags.ilike(like)))
    return stmt


def sort_clause(sort: str, order: str):
    T = models.Task
    desc = order == "desc"
    if sort == "title":
        cols = [T.title.desc() if desc else T.title]
    elif sort == "priority":
        from sqlalchemy import case
        rank = case(PRIORITY_RANK, value=T.priority, else_=3)
        cols = [rank.desc() if desc else rank]
    elif sort == "start":
        cols = [T.start_date.is_(None), T.start_date.desc() if desc else T.start_date]
    elif sort == "created":
        cols = [T.created_at.desc() if desc else T.created_at]
    elif sort == "updated":
        cols = [T.updated_at.desc() if desc else T.updated_at]
    elif sort == "project":
        cols = [models.Project.name.desc() if desc else models.Project.name, T.position]
    elif sort == "client":
        cols = [models.Project.client_id.is_(None), models.Project.client_id.desc() if desc else models.Project.client_id]
    elif sort == "created_by":
        cols = [T.created_by_id.desc() if desc else T.created_by_id]
    elif sort == "completed":
        cols = [T.completed_at.desc() if desc else T.completed_at]
    elif sort == "manual":
        cols = [T.project_id, T.tasklist_id, T.position]
    else:  # due
        cols = [T.due_date.is_(None), T.due_date.desc() if desc else T.due_date]
    return cols + [T.id]


# ---------- list / tags / views ----------
@router.get("/tasks")
def list_tasks(assignee: str | None = None, project_id: str | None = None, tasklist_id: str | None = None,
               status: str = "open", due: str | None = None, due_from: date | None = None,
               due_to: date | None = None, start_from: date | None = None, start_to: date | None = None,
               created_by: str | None = None, q: str | None = None, priority: str | None = None,
               tags: str | None = None, followed: bool = False, include_subtasks: bool = False,
               parent_id: int | None = None, sort: str = "due", order: str = "asc", limit: int = 500,
               offset: int = 0, exclude_tags: str | None = None, untagged: bool = False,
               not_blocked: bool = False, starred: bool = False, client_id: str | None = None,
               owner_id: str | None = None, db: Session = Depends(get_db), user=Depends(current_user)):
    """Filters take comma separated values. assignee=me|none|<id>,...  status=open|all|new,in_progress,completed
    due=late|today|week|month|upcoming|nodate  created_by=me (delegated) or ids."""
    stmt = filtered_query(user, assignee=assignee, created_by=created_by, project_id=project_id,
                          tasklist_id=tasklist_id, status=status, priority=priority, tags=tags, due=due,
                          due_from=due_from, due_to=due_to, start_from=start_from, start_to=start_to,
                          followed=followed, q=q, include_subtasks=include_subtasks, parent_id=parent_id,
                          exclude_tags=exclude_tags, untagged=untagged, not_blocked=not_blocked, starred=starred,
                          client_id=client_id, owner_id=owner_id)
    stmt = stmt.order_by(*sort_clause(sort, order)).offset(offset).limit(min(limit, 2000))
    return enrich(db, list(db.scalars(stmt).all()), user)


@router.get("/tasks/summary")
def task_summary(db: Session = Depends(get_db), user=Depends(current_user)):
    """Counts for the quick filter chips."""
    today = date.today()
    base = filtered_query(user, status="open").subquery()
    T = base.c

    def count(*conds):
        return db.scalar(select(func.count()).select_from(base).where(*conds)) or 0
    mine = select(models.TaskAssignee.task_id).where(models.TaskAssignee.user_id == user.id)
    return {"open": count(), "late": count(T.due_date < today), "today": count(T.due_date == today),
            "upcoming": count(T.due_date > today), "nodate": count(T.due_date.is_(None)),
            "mine": count(or_(T.assignee_id == user.id, T.id.in_(mine))),
            "unassigned": count(T.assignee_id.is_(None))}


@router.get("/tags")
def list_tags(db: Session = Depends(get_db), user=Depends(current_user)):
    counts = {}
    for raw in db.scalars(select(models.Task.tags).where(models.Task.tags.is_not(None))).all():
        for tg in csv_strs(raw):
            counts[tg] = counts.get(tg, 0) + 1
    return [{"name": k, "count": v} for k, v in sorted(counts.items(), key=lambda x: x[0].lower())]


@router.get("/task-views")
def list_views(db: Session = Depends(get_db), user=Depends(current_user)):
    rows = db.scalars(select(models.SavedView).where(models.SavedView.user_id == user.id)
                      .order_by(models.SavedView.name)).all()
    return [{"id": v.id, "name": v.name, "config": json.loads(v.config or "{}")} for v in rows]


@router.post("/task-views")
def create_view(body: schemas.SavedViewIn, db: Session = Depends(get_db), user=Depends(current_user)):
    v = models.SavedView(user_id=user.id, name=body.name, config=json.dumps(body.config))
    db.add(v)
    db.commit()
    return {"id": v.id, "name": v.name, "config": body.config}


@router.delete("/task-views/{vid}")
def delete_view(vid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    v = get_or_404(db, models.SavedView, vid, "View")
    if v.user_id != user.id:
        raise HTTPException(403, "Not allowed")
    db.delete(v)
    db.commit()
    return {"ok": True}


# ---------- create ----------
@router.post("/projects/{pid}/tasks")
def create_task(pid: int, body: schemas.TaskIn, db: Session = Depends(get_db), user=Depends(current_user)):
    p = get_or_404(db, models.Project, pid, "Project")
    if not body.title or not body.title.strip():
        raise HTTPException(400, "Title is required")
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    assignee_ids = data.pop("assignee_ids", None)
    follower_ids = data.pop("follower_ids", None) or []
    depends_on_ids = data.pop("depends_on_ids", None) or []
    reminders = data.pop("reminders", None) or []
    send = data.pop("notify", True)
    custom_vals = data.pop("custom", None) or {}
    if data.get("parent_id"):
        parent = get_or_404(db, models.Task, data["parent_id"], "Parent task")
        data.setdefault("tasklist_id", parent.tasklist_id)
    if not data.get("tasklist_id"):
        tl = db.scalar(select(models.TaskList).where(models.TaskList.project_id == pid)
                       .order_by(models.TaskList.position))
        if not tl:
            tl = models.TaskList(project_id=pid, name="General tasks")
            db.add(tl)
            db.flush()
        data["tasklist_id"] = tl.id
    if not data.get("column_id"):
        col = db.scalar(select(models.BoardColumn).where(models.BoardColumn.project_id == pid)
                        .order_by(models.BoardColumn.position))
        if col:
            data["column_id"] = col.id
    pos = db.scalar(select(func.coalesce(func.max(models.Task.position), -1)).where(
        models.Task.tasklist_id == data.get("tasklist_id"))) + 1
    t = models.Task(project_id=pid, created_by_id=user.id, position=pos, **data)
    t.title = t.title.strip()
    db.add(t)
    db.flush()
    if assignee_ids is not None:
        set_assignees(db, t, assignee_ids)
    for uid in {user.id, *follower_ids}:
        db.add(models.TaskFollower(task_id=t.id, user_id=uid))
    for did in set(depends_on_ids):
        if did != t.id and db.get(models.Task, did):
            db.add(models.TaskDependency(task_id=t.id, depends_on_id=did))
    for r in reminders:
        try:
            db.add(models.TaskReminder(task_id=t.id, user_id=user.id, remind_at=datetime.fromisoformat(r)))
        except ValueError:
            pass
    log(db, user, f"added task {t.title}", pid, t.id)
    from .parity import run_automations  # Automate rules (More > Automate)
    run_automations(db, t, "task_created", user)
    if custom_vals:
        from .taskextras import save_values
        save_values(db, t, custom_vals)
    if body.notify is True:
        emails = [u.email for u in db.scalars(select(models.User).where(models.User.id.in_(assignee_ids_of(db, t) or [0])))
                  if u.id != user.id]
        send_email(emails, f"{user.name} assigned you a task: {t.title}",
                   f"{user.name} assigned you \"{t.title}\" in {p.name}.\n\nDue: {t.due_date or 'no due date'}\n\n{t.description or ''}")
    for uid in (assignee_ids_of(db, t) if send is not False else []):
        notify(db, uid, user, f"{user.name} assigned you \"{t.title}\" in {p.name}", f"/tasks/{t.id}", "task")
    db.commit()
    db.refresh(t)
    return enrich(db, [t], user)[0]


@router.get("/tasks/{tid}")
def get_task(tid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    return task_full(db, get_or_404(db, models.Task, tid, "Task"), user)


def next_occurrence(d: date | None, rule: str):
    if not d:
        return None
    if rule == "daily":
        return d + timedelta(days=1)
    if rule == "weekly":
        return d + timedelta(days=7)
    if rule == "monthly":
        m = d.month % 12 + 1
        y = d.year + (1 if d.month == 12 else 0)
        for day in (d.day, 30, 29, 28):
            try:
                return d.replace(year=y, month=m, day=day)
            except ValueError:
                continue
    return None


def apply_update(db, t, data: dict, user):
    old_assignees = set(assignee_ids_of(db, t))
    old_status = t.status
    _old = {"priority": t.priority, "tags": set(x for x in (t.tags or "").split(",") if x), "due": t.due_date,
            "progress": t.progress}  # for Automations triggers
    assignee_ids = data.pop("assignee_ids", None)
    follower_ids = data.pop("follower_ids", None)
    for k in ("depends_on_ids", "reminders", "notify", "custom"):
        data.pop(k, None)
    if follower_ids is not None:
        db.execute(delete(models.TaskFollower).where(models.TaskFollower.task_id == t.id))
        for uid in set(follower_ids):
            db.add(models.TaskFollower(task_id=t.id, user_id=uid))
    if "assignee_id" in data and assignee_ids is None:
        assignee_ids = [data.pop("assignee_id")] if data.get("assignee_id") else []
    data.pop("assignee_id", None)
    # keep status and board column in sync
    if "column_id" in data and data["column_id"]:
        cols = db.scalars(select(models.BoardColumn).where(models.BoardColumn.project_id == t.project_id)
                          .order_by(models.BoardColumn.position)).all()
        if cols and data["column_id"] == cols[-1].id and "status" not in data:
            data["status"] = "completed"
        elif cols and data["column_id"] != cols[0].id and "status" not in data and t.status == "new":
            data["status"] = "in_progress"
        elif "status" not in data and t.status == "completed":
            data["status"] = "in_progress"
    changed = [k for k, v in data.items() if getattr(t, k, None) != v and k in FIELD_LABELS]
    apply(t, data)
    if assignee_ids is not None:
        set_assignees(db, t, assignee_ids)
        new = set(i for i in assignee_ids if i)
        for uid in new - old_assignees:
            notify(db, uid, user, f"{user.name} assigned you \"{t.title}\"", f"/tasks/{t.id}", "task")
        if new != old_assignees:
            names = [u.name for u in db.scalars(select(models.User).where(models.User.id.in_(new))).all()]
            log(db, user, f"assigned to {', '.join(names) or 'nobody'}", t.project_id, t.id)
    if "status" in data and data["status"] != old_status:
        changed = [c for c in changed if c != "status"]
        if data["status"] == "completed":
            t.completed_at = datetime.utcnow()
            t.progress = 100
            log(db, user, f"completed task {t.title}", t.project_id, t.id)
            from .parity import run_automations
            run_automations(db, t, "task_completed", user)
            for uid in {t.created_by_id, *db.scalars(select(models.TaskFollower.user_id)
                                                      .where(models.TaskFollower.task_id == t.id))}:
                notify(db, uid, user, f"{user.name} completed \"{t.title}\"", f"/tasks/{t.id}", "task")
            if "column_id" not in data:
                last = db.scalar(select(models.BoardColumn).where(models.BoardColumn.project_id == t.project_id)
                                 .order_by(models.BoardColumn.position.desc()))
                if last:
                    t.column_id = last.id
            if t.repeat and not t.parent_id:
                nxt = models.Task(project_id=t.project_id, tasklist_id=t.tasklist_id, title=t.title,
                                  description=t.description, priority=t.priority, assignee_id=t.assignee_id,
                                  created_by_id=t.created_by_id, estimate_minutes=t.estimate_minutes,
                                  tags=t.tags, repeat=t.repeat, position=t.position, is_private=t.is_private,
                                  start_date=next_occurrence(t.start_date, t.repeat),
                                  due_date=next_occurrence(t.due_date or date.today(), t.repeat))
                db.add(nxt)
                db.flush()
                for uid in assignee_ids_of(db, t)[1:]:
                    db.add(models.TaskAssignee(task_id=nxt.id, user_id=uid))
                t.repeat = None
                log(db, user, f"created next repeat of {t.title}", t.project_id, nxt.id)
        else:
            if old_status == "completed":
                t.completed_at = None
                if t.progress == 100:
                    t.progress = 0
                log(db, user, f"reopened task {t.title}", t.project_id, t.id)
                if "column_id" not in data:
                    first = db.scalar(select(models.BoardColumn).where(models.BoardColumn.project_id == t.project_id)
                                      .order_by(models.BoardColumn.position))
                    if first:
                        t.column_id = first.id
            else:
                log(db, user, f"set status to {data['status'].replace('_', ' ')}", t.project_id, t.id)
    if changed:
        log(db, user, "changed " + ", ".join(FIELD_LABELS[c] for c in changed), t.project_id, t.id)
    # Automations: fire change triggers (More > Automate)
    from .parity import run_automations
    if t.status != old_status:
        run_automations(db, t, "stage_changed", user, t.status)
    if t.priority != _old["priority"]:
        run_automations(db, t, "priority_changed", user, t.priority)
    new_tags = set(x for x in (t.tags or "").split(",") if x) - _old["tags"]
    if new_tags:
        run_automations(db, t, "tag_added", user, ",".join(new_tags))
    if t.due_date != _old["due"]:
        run_automations(db, t, "due_changed", user)
    if t.progress != _old["progress"]:
        run_automations(db, t, "progress_changed", user, str(t.progress))
    if assignee_ids is not None and set(i for i in assignee_ids if i) != old_assignees:
        run_automations(db, t, "assignee_changed", user)


@router.patch("/tasks/{tid}")
def update_task(tid: int, body: schemas.TaskIn, db: Session = Depends(get_db), user=Depends(current_user)):
    t = get_or_404(db, models.Task, tid, "Task")
    apply_update(db, t, body.model_dump(exclude_unset=True), user)
    db.commit()
    db.refresh(t)
    return task_full(db, t, user)


@router.post("/tasks/bulk")
def bulk_update(body: schemas.BulkTaskIn, db: Session = Depends(get_db), user=Depends(current_user)):
    tasks = db.scalars(select(models.Task).where(models.Task.id.in_(body.ids))).all()
    patch = body.patch.model_dump(exclude_unset=True)
    for t in tasks:
        if body.delete:
            log(db, user, f"deleted task {t.title}", t.project_id)
            db.delete(t)
            continue
        if patch:
            apply_update(db, t, dict(patch), user)
        if body.add_tag:
            tags = csv_strs(t.tags)
            if body.add_tag.strip() not in tags:
                tags.append(body.add_tag.strip())
                t.tags = ", ".join(tags)[:255]
    db.commit()
    return {"ok": True, "count": len(tasks)}


@router.post("/tasks/{tid}/duplicate")
def duplicate_task(tid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    t = get_or_404(db, models.Task, tid, "Task")
    cols = ["project_id", "tasklist_id", "column_id", "parent_id", "description", "priority", "assignee_id",
            "start_date", "due_date", "estimate_minutes", "tags", "is_private", "repeat"]
    copy = models.Task(**{c: getattr(t, c) for c in cols}, title=f"Copy of {t.title}"[:300],
                       created_by_id=user.id, position=t.position + 1)
    db.add(copy)
    db.flush()
    for uid in assignee_ids_of(db, t)[1:]:
        db.add(models.TaskAssignee(task_id=copy.id, user_id=uid))
    for s in db.scalars(select(models.Task).where(models.Task.parent_id == t.id)).all():
        db.add(models.Task(project_id=s.project_id, tasklist_id=s.tasklist_id, parent_id=copy.id, title=s.title,
                           priority=s.priority, assignee_id=s.assignee_id, due_date=s.due_date,
                           created_by_id=user.id, position=s.position))
    log(db, user, f"duplicated task {t.title}", t.project_id, copy.id)
    db.commit()
    return enrich(db, [copy], user)[0]


@router.post("/tasks/{tid}/move")
def move_task(tid: int, column_id: int | None = None, tasklist_id: int | None = None, position: int = 0,
              db: Session = Depends(get_db), user=Depends(current_user)):
    """Drag and drop: move to a board column or task list at a position."""
    t = get_or_404(db, models.Task, tid, "Task")
    if column_id is not None:
        siblings = db.scalars(select(models.Task).where(models.Task.column_id == column_id, models.Task.id != tid)
                              .order_by(models.Task.position, models.Task.id)).all()
        apply_update(db, t, {"column_id": column_id}, user)
    else:
        siblings = db.scalars(select(models.Task).where(models.Task.tasklist_id == tasklist_id,
                                                        models.Task.id != tid)
                              .order_by(models.Task.position, models.Task.id)).all()
        if tasklist_id and tasklist_id != t.tasklist_id:
            tl = get_or_404(db, models.TaskList, tasklist_id, "Task list")
            t.project_id = tl.project_id
        t.tasklist_id = tasklist_id
    siblings.insert(max(0, min(position, len(siblings))), t)
    for i, s in enumerate(siblings):
        s.position = i
    db.commit()
    return {"ok": True}


@router.delete("/tasks/{tid}")
def delete_task(tid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    t = get_or_404(db, models.Task, tid, "Task")
    log(db, user, f"deleted task {t.title}", t.project_id)
    db.delete(t)
    db.commit()
    return {"ok": True}


# ---------- follow / dependencies / comments ----------
@router.post("/tasks/{tid}/follow")
def follow(tid: int, on: bool = True, db: Session = Depends(get_db), user=Depends(current_user)):
    t = get_or_404(db, models.Task, tid, "Task")
    db.execute(delete(models.TaskFollower).where(models.TaskFollower.task_id == tid,
                                                 models.TaskFollower.user_id == user.id))
    if on:
        db.add(models.TaskFollower(task_id=tid, user_id=user.id))
    db.commit()
    return task_full(db, t, user)


@router.post("/tasks/{tid}/dependencies")
def add_dependency(tid: int, body: schemas.DependencyIn, db: Session = Depends(get_db), user=Depends(current_user)):
    t = get_or_404(db, models.Task, tid, "Task")
    other = get_or_404(db, models.Task, body.depends_on_id, "Task")
    if other.id == t.id:
        raise HTTPException(400, "A task cannot depend on itself")
    reverse = db.scalar(select(models.TaskDependency).where(models.TaskDependency.task_id == other.id,
                                                            models.TaskDependency.depends_on_id == t.id))
    if reverse:
        raise HTTPException(400, "That task already depends on this one")
    exists = db.scalar(select(models.TaskDependency).where(models.TaskDependency.task_id == t.id,
                                                           models.TaskDependency.depends_on_id == other.id))
    if not exists:
        db.add(models.TaskDependency(task_id=t.id, depends_on_id=other.id))
        log(db, user, f"made it wait on \"{other.title}\"", t.project_id, t.id)
    db.commit()
    return task_full(db, t, user)


@router.delete("/tasks/{tid}/dependencies/{did}")
def remove_dependency(tid: int, did: int, db: Session = Depends(get_db), user=Depends(current_user)):
    t = get_or_404(db, models.Task, tid, "Task")
    db.execute(delete(models.TaskDependency).where(models.TaskDependency.task_id == tid,
                                                   models.TaskDependency.depends_on_id == did))
    db.commit()
    return task_full(db, t, user)


@router.post("/tasks/{tid}/comments")
def add_comment(tid: int, body: schemas.CommentIn, db: Session = Depends(get_db), user=Depends(current_user)):
    t = get_or_404(db, models.Task, tid, "Task")
    if not body.body.strip():
        raise HTTPException(400, "Comment is empty")
    db.add(models.Comment(task_id=tid, user_id=user.id, body=body.body))
    followers = db.scalars(select(models.TaskFollower.user_id).where(models.TaskFollower.task_id == tid)).all()
    for uid in {t.created_by_id, *assignee_ids_of(db, t), *followers}:
        notify(db, uid, user, f"{user.name} commented on \"{t.title}\"", f"/tasks/{t.id}", "comment")
    log(db, user, "commented", t.project_id, t.id)
    from .parity import run_automations
    run_automations(db, t, "comment_added", user)
    db.commit()
    return task_full(db, t, user)


@router.delete("/comments/{cid}")
def delete_comment(cid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    c = get_or_404(db, models.Comment, cid, "Comment")
    if c.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "Not allowed")
    db.delete(c)
    db.commit()
    return {"ok": True}


# ---------- reminders / move or copy ----------
@router.post("/tasks/{tid}/reminders")
def add_reminder(tid: int, body: schemas.ReminderIn, db: Session = Depends(get_db), user=Depends(current_user)):
    t = get_or_404(db, models.Task, tid, "Task")
    try:
        when = datetime.fromisoformat(body.remind_at)
    except ValueError:
        raise HTTPException(400, "Pick a valid date and time")
    db.add(models.TaskReminder(task_id=tid, user_id=user.id, remind_at=when, note=body.note))
    db.commit()
    return task_full(db, t, user)


@router.delete("/tasks/{tid}/reminders/{rid}")
def delete_reminder(tid: int, rid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    t = get_or_404(db, models.Task, tid, "Task")
    db.delete(get_or_404(db, models.TaskReminder, rid, "Reminder"))
    db.commit()
    return task_full(db, t, user)


@router.post("/tasks/{tid}/move-to")
def move_or_copy(tid: int, body: schemas.MoveToIn, db: Session = Depends(get_db), user=Depends(current_user)):
    src = get_or_404(db, models.Task, tid, "Task")
    tl = get_or_404(db, models.TaskList, body.tasklist_id, "Task list")
    t = src
    if body.make_copy:
        cols = ["description", "priority", "assignee_id", "start_date", "due_date", "estimate_minutes", "tags",
                "is_private", "repeat"]
        t = models.Task(**{c: getattr(src, c) for c in cols}, title=src.title, created_by_id=user.id, status="new")
        db.add(t)
    pos = db.scalar(select(func.coalesce(func.max(models.Task.position), -1)).where(
        models.Task.tasklist_id == tl.id)) + 1
    changed_project = t.project_id != tl.project_id
    t.project_id, t.tasklist_id, t.position = tl.project_id, tl.id, pos
    if changed_project or body.make_copy:
        col = db.scalar(select(models.BoardColumn).where(models.BoardColumn.project_id == tl.project_id)
                        .order_by(models.BoardColumn.position))
        t.column_id = col.id if col else None
    db.flush()
    if not body.make_copy:
        for sub in db.scalars(select(models.Task).where(models.Task.parent_id == t.id)).all():
            sub.project_id, sub.tasklist_id = tl.project_id, tl.id
    log(db, user, f"{'copied' if body.make_copy else 'moved'} task to {tl.name}", tl.project_id, t.id)
    db.commit()
    db.refresh(t)
    return enrich(db, [t], user)[0]
