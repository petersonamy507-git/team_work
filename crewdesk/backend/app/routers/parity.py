"""Teamwork-parity API: generic CRUD for the "Everything", People, Finance, Resourcing, Reports, AI and
Automate sections, plus the computed views (workload, company timesheet, report library, AI answers)."""
import json
import re
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import Boolean, Date, DateTime, Integer, func, or_, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..helpers import get_or_404, log, notify
from ..security import current_user

router = APIRouter(prefix="/api", tags=["parity"])

# kind -> (model, scope) ; scope "project" means rows carry project_id, "user" means private to the user
RESOURCES = {
    "risks": (models.Risk, "project"),
    "notebooks": (models.Notebook, "project"),
    "links": (models.Link, "project"),
    "forms": (models.Form, "project"),
    "proofs": (models.Proof, "project"),
    "categories": (models.ProjectCategory, "global"),
    "roles": (models.Role, "global"),
    "skills": (models.Skill, "global"),
    "teams": (models.Team, "global"),
    "statuses": (models.StatusUpdate, "user_public"),
    "rates": (models.Rate, "global"),
    "budgets": (models.Budget, "project"),
    "invoices": (models.Invoice, "project"),
    "expenses": (models.Expense, "project"),
    "templates": (models.ProjectTemplate, "global"),
    "allocations": (models.Allocation, "project"),
    "portfolio": (models.PortfolioBoard, "global"),
    "saved-reports": (models.SavedReport, "user"),
    "automations": (models.Automation, "global"),
    "ai-chats": (models.AiChat, "user"),
    "ai-skills": (models.AiSkill, "user"),
    "ai-teammates": (models.AiTeammate, "global"),
    "dashboards": (models.Dashboard, "user"),
    "placeholders": (models.Placeholder, "global"),
    "reactions": (models.Reaction, "user_public"),
}
JSON_FIELDS = {"fields", "columns", "messages", "widgets", "content", "config", "answers"}
ID_LIST_FIELDS = {"member_ids", "reviewer_ids"}


def _model(kind):
    if kind not in RESOURCES:
        raise HTTPException(404, "Unknown section")
    return RESOURCES[kind]


def _names(db, ids):
    ids = {i for i in ids if i}
    if not ids:
        return {}
    return {u.id: schemas.user_brief(u) for u in db.scalars(select(models.User).where(models.User.id.in_(ids)))}


def serialize(db, rows):
    if not rows:
        return []
    cols = rows[0].__table__.columns
    uids, pids = set(), set()
    for r in rows:
        for c in cols:
            v = getattr(r, c.name)
            if c.name.endswith("user_id") or c.name in ("owner_id", "created_by_id", "lead_id"):
                uids.add(v)
            if c.name in ID_LIST_FIELDS and v:
                uids.update(int(x) for x in v.split(",") if x.strip().isdigit())
            if c.name == "project_id":
                pids.add(v)
    users = _names(db, uids)
    projects = {p.id: p for p in db.scalars(select(models.Project).where(models.Project.id.in_(pids or {0})))}
    out = []
    for r in rows:
        o = {}
        for c in cols:
            v = getattr(r, c.name)
            if isinstance(v, (date, datetime)):
                v = v.isoformat()
            elif c.name in JSON_FIELDS:
                try:
                    v = json.loads(v) if v else None
                except ValueError:
                    v = None
            elif c.name in ID_LIST_FIELDS:
                ids = [int(x) for x in (v or "").split(",") if x.strip().isdigit()]
                o[c.name.replace("_ids", "s")] = [users[i] for i in ids if i in users]
                v = ids
            o[c.name] = v
            if c.name in ("owner_id", "created_by_id", "lead_id", "user_id") and v:
                o[c.name[:-3]] = users.get(v)
            if c.name == "project_id" and v in projects:
                p = projects[v]
                o["project_name"] = p.name
                o["project_color"] = p.color
                o["client_name"] = p.client.name if p.client else None
        out.append(o)
    return out


def coerce(model, data: dict):
    cols = {c.name: c for c in model.__table__.columns}
    clean = {}
    for k, v in data.items():
        if k not in cols or k == "id":
            continue
        t = cols[k].type
        if k in JSON_FIELDS:
            v = json.dumps(v) if v is not None else None
        elif k in ID_LIST_FIELDS:
            v = ",".join(str(int(x)) for x in (v or []))
        elif v in ("", None):
            v = None
        elif isinstance(t, DateTime):
            v = datetime.fromisoformat(v) if isinstance(v, str) else v
        elif isinstance(t, Date):
            v = date.fromisoformat(v[:10]) if isinstance(v, str) else v
        elif isinstance(t, Boolean):
            v = bool(v)
        elif isinstance(t, Integer):
            v = int(float(v))
        if v is None and not cols[k].nullable:
            continue
        clean[k] = v
    return clean


@router.get("/r/{kind}")
def list_rows(kind: str, project_id: int | None = None, scope: str | None = None, q: str | None = None,
              db: Session = Depends(get_db), user=Depends(current_user)):
    model, sc = _model(kind)
    stmt = select(model)
    if sc == "user":
        stmt = stmt.where(model.user_id == user.id)
    if project_id and hasattr(model, "project_id"):
        stmt = stmt.where(model.project_id == project_id)
    if scope and hasattr(model, "scope"):
        stmt = stmt.where(model.scope == scope)
    if q:
        for f in ("title", "name", "source", "text", "number"):
            if hasattr(model, f):
                stmt = stmt.where(getattr(model, f).ilike(f"%{q}%"))
                break
    order = model.position if hasattr(model, "position") else model.id.desc()
    rows = db.scalars(stmt.order_by(order)).all()
    return serialize(db, rows)


@router.get("/r/{kind}/{rid}")
def get_row(kind: str, rid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    model, _ = _model(kind)
    return serialize(db, [get_or_404(db, model, rid)])[0]


@router.post("/r/{kind}")
def create_row(kind: str, body: dict = Body(...), db: Session = Depends(get_db), user=Depends(current_user)):
    model, sc = _model(kind)
    data = coerce(model, body)
    if hasattr(model, "user_id") and sc in ("user", "user_public") and "user_id" not in data:
        data["user_id"] = user.id
    if hasattr(model, "created_by_id"):
        data["created_by_id"] = user.id
    if sc == "project" and not data.get("project_id"):
        raise HTTPException(400, "Choose a project")
    for req in ("title", "name", "source", "text", "url"):
        if req in model.__table__.columns and not model.__table__.columns[req].nullable and not data.get(req):
            if req not in ("url",) or kind == "links":
                raise HTTPException(400, f"{req.capitalize()} is required")
    if kind == "invoices" and not data.get("number"):
        n = (db.scalar(select(func.count(models.Invoice.id))) or 0) + 1
        data["number"] = f"INV-{date.today().year}-{n:03d}"
    if kind == "dashboards" and "widgets" not in data:
        data["widgets"] = "[]"
    if kind == "ai-chats" and "messages" not in data:
        data["messages"] = "[]"
    obj = model(**data)
    db.add(obj)
    if data.get("project_id"):
        label = data.get("title") or data.get("name") or data.get("source") or data.get("number") or ""
        log(db, user, f"added {kind.rstrip('s').replace('-', ' ')} {label}", data["project_id"])
    if kind == "proofs":
        for uid in [int(x) for x in (data.get("reviewer_ids") or "").split(",") if x]:
            notify(db, uid, user, f"{user.name} asked you to review proof \"{data['title']}\"", "/proofs", "proof")
    db.commit()
    db.refresh(obj)
    return serialize(db, [obj])[0]


@router.patch("/r/{kind}/{rid}")
def update_row(kind: str, rid: int, body: dict = Body(...), db: Session = Depends(get_db),
               user=Depends(current_user)):
    model, sc = _model(kind)
    obj = get_or_404(db, model, rid)
    if sc == "user" and obj.user_id != user.id:
        raise HTTPException(403, "Not allowed")
    for k, v in coerce(model, body).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return serialize(db, [obj])[0]


@router.delete("/r/{kind}/{rid}")
def delete_row(kind: str, rid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    model, sc = _model(kind)
    obj = get_or_404(db, model, rid)
    if sc in ("user", "user_public") and obj.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "Not allowed")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- Everything
@router.get("/everything/comments")
def all_comments(db: Session = Depends(get_db), user=Depends(current_user)):
    out = []
    for c in db.scalars(select(models.Comment).order_by(models.Comment.id.desc()).limit(200)):
        t = db.get(models.Task, c.task_id)
        out.append({"id": f"t{c.id}", "kind": "task", "body": c.body, "user": schemas.user_brief(c.user),
                    "created_at": schemas.d(c.created_at), "on": t.title if t else "", "link": f"/tasks/{c.task_id}",
                    "project_id": t.project_id if t else None, "project_name": t.project.name if t else None})
    for r in db.scalars(select(models.MessageReply).order_by(models.MessageReply.id.desc()).limit(200)):
        m = db.get(models.Message, r.message_id)
        if not m:
            continue
        p = db.get(models.Project, m.project_id)
        out.append({"id": f"m{r.id}", "kind": "message", "body": r.body, "user": schemas.user_brief(r.user),
                    "created_at": schemas.d(r.created_at), "on": m.title,
                    "link": f"/projects/{m.project_id}/messages/{m.id}", "project_id": m.project_id,
                    "project_name": p.name if p else None})
    out.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return out


@router.get("/everything/messages")
def all_messages(db: Session = Depends(get_db), user=Depends(current_user)):
    rows = db.scalars(select(models.Message).order_by(models.Message.id.desc()).limit(300)).all()
    out = []
    for m in rows:
        p = db.get(models.Project, m.project_id)
        n = db.scalar(select(func.count(models.MessageReply.id)).where(models.MessageReply.message_id == m.id)) or 0
        out.append({"id": m.id, "title": m.title, "body": m.body, "user": schemas.user_brief(m.user),
                    "project_id": m.project_id, "project_name": p.name if p else None, "replies": n,
                    "created_at": schemas.d(m.created_at)})
    return out


@router.get("/everything/files")
def all_files(db: Session = Depends(get_db), user=Depends(current_user)):
    rows = db.scalars(select(models.FileItem).order_by(models.FileItem.id.desc()).limit(500)).all()
    names = {p.id: p.name for p in db.scalars(select(models.Project))}
    return [{"id": f.id, "name": f.original_name, "size": f.size, "content_type": f.content_type,
             "user": schemas.user_brief(f.user), "project_id": f.project_id, "project_name": names.get(f.project_id),
             "task_id": f.task_id, "created_at": schemas.d(f.created_at)} for f in rows]


@router.post("/forms/{fid}/responses")
def submit_form(fid: int, body: dict = Body(...), db: Session = Depends(get_db), user=Depends(current_user)):
    f = get_or_404(db, models.Form, fid, "Form")
    if not f.is_active:
        raise HTTPException(400, "This form is closed")
    answers = body.get("answers") or {}
    first = next((str(v) for v in answers.values() if v), f.title)
    tl = db.scalar(select(models.TaskList).where(models.TaskList.project_id == f.project_id)
                   .order_by(models.TaskList.position))
    if not tl:
        tl = models.TaskList(project_id=f.project_id, name="General tasks")
        db.add(tl)
        db.flush()
    desc = "\n".join(f"{k}: {v}" for k, v in answers.items())
    t = models.Task(project_id=f.project_id, tasklist_id=tl.id, title=f"{f.title}: {first[:200]}",
                    description=desc, created_by_id=user.id)
    db.add(t)
    db.flush()
    r = models.FormResponse(form_id=f.id, answers=json.dumps(answers), task_id=t.id)
    db.add(r)
    log(db, user, f"submitted form {f.title}", f.project_id, t.id)
    db.commit()
    return {"ok": True, "task_id": t.id}


@router.get("/forms/{fid}/responses")
def form_responses(fid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    rows = db.scalars(select(models.FormResponse).where(models.FormResponse.form_id == fid)
                      .order_by(models.FormResponse.id.desc())).all()
    return [{"id": r.id, "answers": json.loads(r.answers), "task_id": r.task_id,
             "created_at": schemas.d(r.created_at)} for r in rows]


# ---------------------------------------------------------------- Templates
@router.post("/templates/{tid}/use")
def use_template(tid: int, body: dict = Body(...), db: Session = Depends(get_db), user=Depends(current_user)):
    if tid == 0:  # built-in gallery template, content sent by the client
        tpl = models.ProjectTemplate(name=body.get("template_name") or "Template", description=body.get("description"),
                                     content=json.dumps(body.get("content") or {}))
    else:
        tpl = get_or_404(db, models.ProjectTemplate, tid, "Template")
    content = json.loads(tpl.content or "{}")
    p = models.Project(name=body.get("name") or tpl.name, description=tpl.description, owner_id=user.id,
                       client_id=body.get("client_id") or None,
                       start_date=date.fromisoformat(body["start_date"]) if body.get("start_date") else None)
    db.add(p)
    db.flush()
    db.add(models.ProjectMember(project_id=p.id, user_id=user.id))
    for i, (n, c) in enumerate([("To do", "#94a3b8"), ("In progress", "#4461d7"), ("Done", "#10b981")]):
        db.add(models.BoardColumn(project_id=p.id, name=n, color=c, position=i))
    for li, tl in enumerate(content.get("tasklists") or []):
        lst = models.TaskList(project_id=p.id, name=tl.get("name") or "Task list", position=li)
        db.add(lst)
        db.flush()
        for ti, title in enumerate(tl.get("tasks") or []):
            db.add(models.Task(project_id=p.id, tasklist_id=lst.id, title=title, position=ti, created_by_id=user.id))
    log(db, user, f"created project {p.name} from template {tpl.name}", p.id)
    db.commit()
    return {"id": p.id}


@router.post("/projects/{pid}/save-as-template")
def save_template(pid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    p = get_or_404(db, models.Project, pid, "Project")
    lists = []
    for tl in db.scalars(select(models.TaskList).where(models.TaskList.project_id == pid).order_by(models.TaskList.position)):
        titles = db.scalars(select(models.Task.title).where(models.Task.tasklist_id == tl.id,
                                                            models.Task.parent_id.is_(None))
                            .order_by(models.Task.position)).all()
        lists.append({"name": tl.name, "tasks": list(titles)})
    tpl = models.ProjectTemplate(name=f"{p.name} template", description=p.description,
                                 content=json.dumps({"tasklists": lists}), created_by_id=user.id)
    db.add(tpl)
    db.commit()
    return serialize(db, [tpl])[0]


@router.post("/projects/{pid}/copy")
def copy_project(pid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    src = get_or_404(db, models.Project, pid, "Project")
    p = models.Project(name=f"Copy of {src.name}", description=src.description, color=src.color,
                       client_id=src.client_id, owner_id=user.id, category_id=src.category_id,
                       start_date=src.start_date, end_date=src.end_date, budget_minutes=src.budget_minutes)
    db.add(p)
    db.flush()
    for m in db.scalars(select(models.ProjectMember).where(models.ProjectMember.project_id == pid)):
        db.add(models.ProjectMember(project_id=p.id, user_id=m.user_id))
    colmap = {}
    for c in db.scalars(select(models.BoardColumn).where(models.BoardColumn.project_id == pid)):
        n = models.BoardColumn(project_id=p.id, name=c.name, color=c.color, position=c.position)
        db.add(n)
        db.flush()
        colmap[c.id] = n.id
    for tl in db.scalars(select(models.TaskList).where(models.TaskList.project_id == pid)):
        n = models.TaskList(project_id=p.id, name=tl.name, description=tl.description, position=tl.position)
        db.add(n)
        db.flush()
        for t in db.scalars(select(models.Task).where(models.Task.tasklist_id == tl.id, models.Task.parent_id.is_(None))):
            db.add(models.Task(project_id=p.id, tasklist_id=n.id, title=t.title, description=t.description,
                               priority=t.priority, assignee_id=t.assignee_id, created_by_id=user.id,
                               start_date=t.start_date, due_date=t.due_date, estimate_minutes=t.estimate_minutes,
                               tags=t.tags, position=t.position, column_id=colmap.get(t.column_id)))
    log(db, user, f"copied project {src.name}", p.id)
    db.commit()
    return {"id": p.id}


# ---------------------------------------------------------------- Recent
@router.post("/recent")
def track_recent(body: dict = Body(...), db: Session = Depends(get_db), user=Depends(current_user)):
    kind, ref = body.get("kind"), int(body.get("ref_id") or 0)
    if not kind or not ref:
        return {"ok": False}
    old = db.scalar(select(models.RecentItem).where(models.RecentItem.user_id == user.id,
                                                    models.RecentItem.kind == kind, models.RecentItem.ref_id == ref))
    if old:
        old.viewed_at = datetime.utcnow()
        old.title = body.get("title") or old.title
        old.subtitle = body.get("subtitle")
    else:
        db.add(models.RecentItem(user_id=user.id, kind=kind, ref_id=ref, title=(body.get("title") or "")[:300],
                                 subtitle=(body.get("subtitle") or "")[:300], link=body.get("link") or "/"))
    db.commit()
    return {"ok": True}


@router.get("/recent")
def list_recent(kind: str | None = None, q: str | None = None, db: Session = Depends(get_db),
                user=Depends(current_user)):
    stmt = select(models.RecentItem).where(models.RecentItem.user_id == user.id)
    if kind:
        stmt = stmt.where(models.RecentItem.kind == kind)
    if q:
        stmt = stmt.where(models.RecentItem.title.ilike(f"%{q}%"))
    rows = db.scalars(stmt.order_by(models.RecentItem.viewed_at.desc()).limit(60)).all()
    return [{"id": r.id, "kind": r.kind, "ref_id": r.ref_id, "title": r.title, "subtitle": r.subtitle,
             "link": r.link, "viewed_at": schemas.d(r.viewed_at)} for r in rows]


# ---------------------------------------------------------------- Clients (Teamwork columns)
@router.get("/clients/overview")
def clients_overview(db: Session = Depends(get_db), user=Depends(current_user)):
    out = []
    for c in db.scalars(select(models.Client).order_by(models.Client.name)):
        pids = db.scalars(select(models.Project.id).where(models.Project.client_id == c.id)).all()
        total = done = 0
        if pids:
            total = db.scalar(select(func.count(models.Task.id)).where(models.Task.project_id.in_(pids))) or 0
            done = db.scalar(select(func.count(models.Task.id)).where(models.Task.project_id.in_(pids),
                                                                     models.Task.status == "completed")) or 0
        healths = db.scalars(select(models.Project.health).where(models.Project.id.in_(pids or [0]))).all()
        worst = next((h for h in ("needs_attention", "at_risk", "good") if h in healths), None)
        budget = db.scalar(select(func.coalesce(func.sum(models.Budget.amount), 0)).where(
            models.Budget.project_id.in_(pids or [0]), models.Budget.type == "financial")) or 0
        tbudget = db.scalar(select(func.coalesce(func.sum(models.Budget.amount), 0)).where(
            models.Budget.project_id.in_(pids or [0]), models.Budget.type == "time")) or 0
        owner = db.get(models.User, c.owner_id) if c.owner_id else None
        projects = [{"id": p.id, "name": p.name, "status": p.status, "health": p.health}
                    for p in db.scalars(select(models.Project).where(models.Project.id.in_(pids or [0])))]
        out.append({**schemas.client_out(c), "owner_id": c.owner_id, "owner": schemas.user_brief(owner),
                    "address": c.address, "industry": c.industry, "project_count": len(pids), "projects": projects,
                    "tasks_total": total, "tasks_done": done, "tasks_left": total - done,
                    "completion": round(done * 100 / total) if total else 0, "health": worst,
                    "budget": int(budget), "time_budget": int(tbudget)})
    return out


# ---------------------------------------------------------------- Time
@router.get("/time/company")
def company_timesheet(week_of: date | None = None, db: Session = Depends(get_db), user=Depends(current_user)):
    ref = week_of or date.today()
    start = ref - timedelta(days=ref.weekday())
    end = start + timedelta(days=6)
    entries = db.scalars(select(models.TimeEntry).where(models.TimeEntry.date >= start,
                                                        models.TimeEntry.date <= end)).all()
    rows = []
    for u in db.scalars(select(models.User).where(models.User.is_active.is_(True)).order_by(models.User.name)):
        mine = [e for e in entries if e.user_id == u.id]
        days = [0] * 7
        tasks = {}
        for e in mine:
            i = (e.date - start).days
            days[i] += e.minutes
            key = e.task_id or -e.project_id
            r = tasks.setdefault(key, {"title": e.task.title if e.task else "Project time",
                                       "project_name": e.project.name if e.project else "",
                                       "days": [0] * 7})
            r["days"][i] += e.minutes
        rows.append({"user": schemas.user_brief(u), "capacity": u.capacity_minutes or 480, "days": days,
                     "total": sum(days), "tasks": list(tasks.values())})
    return {"start": start.isoformat(), "days": [(start + timedelta(days=i)).isoformat() for i in range(7)],
            "rows": rows}


@router.get("/time/approvals")
def approvals(month: str | None = None, db: Session = Depends(get_db), user=Depends(current_user)):
    ref = date.fromisoformat(month + "-01") if month else date.today().replace(day=1)
    nxt = (ref.replace(day=28) + timedelta(days=4)).replace(day=1)
    entries = db.scalars(select(models.TimeEntry).where(models.TimeEntry.date >= ref,
                                                        models.TimeEntry.date < nxt)
                         .order_by(models.TimeEntry.date)).all()
    workdays = sum(1 for i in range((nxt - ref).days) if (ref + timedelta(days=i)).weekday() < 5)
    out = []
    for u in db.scalars(select(models.User).where(models.User.is_active.is_(True)).order_by(models.User.name)):
        mine = [e for e in entries if e.user_id == u.id]
        if not mine:
            continue
        out.append({"user": schemas.user_brief(u), "estimated": workdays * (u.capacity_minutes or 480),
                    "logged": sum(e.minutes for e in mine),
                    "billable": sum(e.minutes for e in mine if e.billable),
                    "non_billable": sum(e.minutes for e in mine if not e.billable),
                    "pending": sum(1 for e in mine if (e.approval or "pending") == "pending"),
                    "approved": sum(1 for e in mine if e.approval == "approved"),
                    "rejected": sum(1 for e in mine if e.approval == "rejected"),
                    "entries": [{**schemas.time_out(e), "approval": e.approval or "pending"} for e in mine]})
    return {"month": ref.isoformat()[:7], "rows": out}


@router.post("/time/approve")
def approve_time(body: dict = Body(...), db: Session = Depends(get_db), user=Depends(current_user)):
    status = body.get("status", "approved")
    if status not in ("approved", "rejected", "pending"):
        raise HTTPException(400, "Bad status")
    for e in db.scalars(select(models.TimeEntry).where(models.TimeEntry.id.in_(body.get("ids") or [0]))):
        e.approval = status
        notify(db, e.user_id, user, f"{user.name} {status} your time on {e.date.isoformat()}", "/time/approvals", "time")
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- Resourcing
def _workload(db, start: date, days: int):
    end = start + timedelta(days=days - 1)
    users = db.scalars(select(models.User).where(models.User.is_active.is_(True)).order_by(models.User.name)).all()
    tasks = db.scalars(select(models.Task).where(models.Task.status != "completed",
                                                 models.Task.assignee_id.is_not(None),
                                                 or_(models.Task.due_date.is_(None), models.Task.due_date >= start))).all()
    allocs = db.scalars(select(models.Allocation).where(models.Allocation.end_date >= start,
                                                        models.Allocation.start_date <= end)).all()
    logged = db.scalars(select(models.TimeEntry).where(models.TimeEntry.date >= start,
                                                       models.TimeEntry.date <= end)).all()
    roles = db.scalars(select(models.Role)).all()
    rows = []
    for u in users:
        cap = u.capacity_minutes or 480
        load = [0] * days
        mytasks = []
        for t in tasks:
            if t.assignee_id != u.id:
                continue
            s = t.start_date or t.due_date
            e = t.due_date or t.start_date
            if not s or not t.estimate_minutes:
                mytasks.append(t)
                continue
            span = [s + timedelta(days=i) for i in range((e - s).days + 1) if (s + timedelta(days=i)).weekday() < 5] or [s]
            per = t.estimate_minutes / len(span)
            for dday in span:
                i = (dday - start).days
                if 0 <= i < days:
                    load[i] += per
            mytasks.append(t)
        for a in allocs:
            if a.user_id != u.id:
                continue
            for i in range(days):
                dday = start + timedelta(days=i)
                if a.start_date <= dday <= a.end_date and dday.weekday() < 5:
                    load[i] += a.minutes_per_day
        role = next((r.name for r in roles if str(u.id) in (r.member_ids or "").split(",")), None)
        rows.append({"user": schemas.user_brief(u), "role": role, "capacity": cap,
                     "days": [{"date": (start + timedelta(days=i)).isoformat(), "minutes": round(load[i]),
                               "capacity": 0 if (start + timedelta(days=i)).weekday() >= 5 else cap}
                              for i in range(days)],
                     "open_tasks": len(mytasks),
                     "estimated": sum(t.estimate_minutes or 0 for t in mytasks),
                     "logged": sum(e.minutes for e in logged if e.user_id == u.id),
                     "tasks": [schemas.task_out(t) for t in mytasks[:50]]})
    return rows


@router.get("/resourcing/workload")
def workload(start: date | None = None, days: int = 14, db: Session = Depends(get_db), user=Depends(current_user)):
    start = start or date.today()
    return {"start": start.isoformat(), "rows": _workload(db, start, min(max(days, 1), 62))}


@router.get("/resourcing/overview")
def resourcing_overview(start: date | None = None, end: date | None = None, db: Session = Depends(get_db),
                        user=Depends(current_user)):
    start = start or date.today().replace(day=1)
    end = end or ((start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1))
    days = (end - start).days + 1
    rows = _workload(db, start, days)
    workdays = sum(1 for i in range(days) if (start + timedelta(days=i)).weekday() < 5)
    out = []
    for r in rows:
        available = workdays * r["capacity"]
        completed = db.scalar(select(func.count(models.Task.id)).where(
            models.Task.assignee_id == r["user"]["id"], models.Task.status == "completed",
            models.Task.completed_at >= start)) or 0
        out.append({"user": r["user"], "role": r["role"], "open_tasks": r["open_tasks"], "completed_tasks": completed,
                    "available": available, "estimated": r["estimated"], "logged": r["logged"],
                    "time_left": max(available - r["logged"], 0),
                    "capacity_pct": round(r["estimated"] * 100 / available) if available else 0})
    unassigned = db.scalar(select(func.count(models.Task.id)).where(models.Task.assignee_id.is_(None),
                                                                    models.Task.status != "completed")) or 0
    # weekly chart: estimated vs logged vs available per week
    weeks = []
    ws = start - timedelta(days=start.weekday())
    while ws <= end:
        we = ws + timedelta(days=6)
        est = sum(dd["minutes"] for r in rows for dd in r["days"] if ws.isoformat() <= dd["date"] <= we.isoformat())
        cap = sum(dd["capacity"] for r in rows for dd in r["days"] if ws.isoformat() <= dd["date"] <= we.isoformat())
        lg = db.scalar(select(func.coalesce(func.sum(models.TimeEntry.minutes), 0)).where(
            models.TimeEntry.date >= ws, models.TimeEntry.date <= we)) or 0
        weeks.append({"label": f"{ws.strftime('%b %d')} - {we.strftime('%b %d')}", "estimated": est,
                      "logged": int(lg), "available": cap})
        ws += timedelta(days=7)
    return {"start": start.isoformat(), "end": end.isoformat(), "rows": out, "unassigned": unassigned, "weeks": weeks}


@router.get("/resourcing/unplanned")
def unplanned(db: Session = Depends(get_db), user=Depends(current_user)):
    rows = db.scalars(select(models.Task).where(models.Task.status != "completed",
                                                or_(models.Task.assignee_id.is_(None), models.Task.due_date.is_(None),
                                                    models.Task.estimate_minutes.is_(None))).limit(100)).all()
    return [schemas.task_out(t) for t in rows]


# ---------------------------------------------------------------- Finance
@router.get("/finance/budgets")
def budgets_view(db: Session = Depends(get_db), user=Depends(current_user)):
    rates = {r.user_id: r.billable_rate for r in db.scalars(select(models.Rate).where(models.Rate.project_id.is_(None)))}
    out = []
    for b in serialize(db, db.scalars(select(models.Budget).order_by(models.Budget.id.desc())).all()):
        stmt = select(models.TimeEntry).where(models.TimeEntry.project_id == b["project_id"])
        if b["start_date"]:
            stmt = stmt.where(models.TimeEntry.date >= date.fromisoformat(b["start_date"]))
        if b["end_date"]:
            stmt = stmt.where(models.TimeEntry.date <= date.fromisoformat(b["end_date"]))
        entries = db.scalars(stmt).all()
        if b["type"] == "time":
            used = sum(e.minutes for e in entries)
        else:
            used = round(sum(e.minutes / 60 * rates.get(e.user_id, 0) for e in entries if e.billable))
            used += db.scalar(select(func.coalesce(func.sum(models.Expense.cost), 0)).where(
                models.Expense.project_id == b["project_id"])) or 0
        b["used"] = int(used)
        b["remaining"] = int(b["amount"] - used)
        b["pct"] = round(used * 100 / b["amount"]) if b["amount"] else 0
        out.append(b)
    return out


@router.get("/finance/rates")
def rates_view(db: Session = Depends(get_db), user=Depends(current_user)):
    rates = {r.user_id: r for r in db.scalars(select(models.Rate).where(models.Rate.project_id.is_(None)))}
    out = []
    for u in db.scalars(select(models.User).where(models.User.is_active.is_(True)).order_by(models.User.name)):
        r = rates.get(u.id)
        out.append({"user": schemas.user_brief(u), "user_id": u.id, "rate_id": r.id if r else None,
                    "billable_rate": r.billable_rate if r else 0, "cost_rate": r.cost_rate if r else 0})
    return out


@router.post("/finance/rates/{uid}")
def set_rate(uid: int, body: dict = Body(...), db: Session = Depends(get_db), user=Depends(current_user)):
    r = db.scalar(select(models.Rate).where(models.Rate.user_id == uid, models.Rate.project_id.is_(None)))
    if not r:
        r = models.Rate(user_id=uid)
        db.add(r)
    if "billable_rate" in body:
        r.billable_rate = int(float(body["billable_rate"] or 0))
    if "cost_rate" in body:
        r.cost_rate = int(float(body["cost_rate"] or 0))
    db.commit()
    return {"ok": True}


@router.post("/finance/invoices/{iid}/from-time")
def invoice_from_time(iid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    inv = get_or_404(db, models.Invoice, iid, "Invoice")
    rates = {r.user_id: r.billable_rate for r in db.scalars(select(models.Rate).where(models.Rate.project_id.is_(None)))}
    entries = db.scalars(select(models.TimeEntry).where(models.TimeEntry.project_id == inv.project_id,
                                                        models.TimeEntry.billable.is_(True))).all()
    inv.amount = round(sum(e.minutes / 60 * rates.get(e.user_id, 0) for e in entries))
    db.commit()
    return serialize(db, [inv])[0]


# ---------------------------------------------------------------- Reports library
@router.get("/reports/library/{kind}")
def report(kind: str, start: date | None = None, end: date | None = None, db: Session = Depends(get_db),
           user=Depends(current_user)):
    end = end or date.today()
    start = start or end - timedelta(days=29)
    today = date.today()
    projects = db.scalars(select(models.Project).where(models.Project.status == "active").order_by(models.Project.name)).all()
    if kind == "project-health":
        rows = []
        for p in projects:
            total = db.scalar(select(func.count(models.Task.id)).where(models.Task.project_id == p.id)) or 0
            done = db.scalar(select(func.count(models.Task.id)).where(models.Task.project_id == p.id,
                                                                     models.Task.status == "completed")) or 0
            late = db.scalar(select(func.count(models.Task.id)).where(models.Task.project_id == p.id,
                                                                     models.Task.status != "completed",
                                                                     models.Task.due_date < today)) or 0
            rows.append({"Project": p.name, "Client": p.client.name if p.client else "", "Health": p.health,
                         "Owner": p.owner.name if p.owner else "", "Tasks": total, "Completed": done, "Late": late,
                         "Progress": f"{round(done * 100 / total) if total else 0}%",
                         "End date": schemas.d(p.end_date) or ""})
        return {"title": "Project health", "rows": rows}
    if kind == "utilization":
        rows = []
        for r in resourcing_overview(start, end, db, user)["rows"]:
            rows.append({"Person": r["user"]["name"], "Available": r["available"], "Estimated": r["estimated"],
                         "Logged": r["logged"], "Utilization": f"{round(r['logged'] * 100 / r['available']) if r['available'] else 0}%",
                         "Open tasks": r["open_tasks"]})
        return {"title": "Utilization", "rows": rows, "minutes": ["Available", "Estimated", "Logged"]}
    if kind == "time":
        rows = []
        for e in db.scalars(select(models.TimeEntry).where(models.TimeEntry.date >= start, models.TimeEntry.date <= end)
                            .order_by(models.TimeEntry.date.desc())):
            rows.append({"Date": schemas.d(e.date), "Person": e.user.name if e.user else "",
                         "Project": e.project.name if e.project else "", "Task": e.task.title if e.task else "",
                         "Description": e.description or "", "Billable": "Yes" if e.billable else "No",
                         "Time": e.minutes})
        return {"title": "Time", "rows": rows, "minutes": ["Time"]}
    if kind == "planned-vs-actual":
        rows = []
        for p in projects:
            est = db.scalar(select(func.coalesce(func.sum(models.Task.estimate_minutes), 0)).where(
                models.Task.project_id == p.id)) or 0
            act = db.scalar(select(func.coalesce(func.sum(models.TimeEntry.minutes), 0)).where(
                models.TimeEntry.project_id == p.id)) or 0
            ms = db.scalar(select(func.count(models.Milestone.id)).where(models.Milestone.project_id == p.id)) or 0
            msd = db.scalar(select(func.count(models.Milestone.id)).where(models.Milestone.project_id == p.id,
                                                                          models.Milestone.completed.is_(True))) or 0
            rows.append({"Project": p.name, "Planned": int(est), "Actual": int(act), "Variance": int(act - est),
                         "Milestones": f"{msd}/{ms}"})
        return {"title": "Planned vs actual", "rows": rows, "minutes": ["Planned", "Actual", "Variance"]}
    if kind == "invoice-status":
        rows = [{"Invoice": i["number"], "Project": i.get("project_name"), "Client": i.get("client_name") or "",
                 "Issued": i["issue_date"] or "", "Due": i["due_date"] or "", "Status": i["status"],
                 "Amount": i["amount"]} for i in serialize(db, db.scalars(select(models.Invoice)).all())]
        return {"title": "Invoice status", "rows": rows, "money": ["Amount"]}
    if kind == "budget-insights":
        rows = [{"Project": b.get("project_name"), "Type": b["type"], "Budget": b["amount"], "Used": b["used"],
                 "Remaining": b["remaining"], "Used %": f"{b['pct']}%"} for b in budgets_view(db, user)]
        return {"title": "Budget insights", "rows": rows}
    if kind == "tasks":
        rows = []
        for t in db.scalars(select(models.Task).where(models.Task.created_at >= start).order_by(models.Task.id.desc()).limit(500)):
            rows.append({"Task": t.title, "Project": t.project.name if t.project else "",
                         "Assignee": t.assignee.name if t.assignee else "", "Status": t.status,
                         "Priority": t.priority, "Due": schemas.d(t.due_date) or ""})
        return {"title": "Tasks", "rows": rows}
    if kind == "milestones":
        rows = [{"Milestone": m.name, "Project": db.get(models.Project, m.project_id).name,
                 "Due": schemas.d(m.due_date) or "", "Owner": m.owner.name if m.owner else "",
                 "Status": "Completed" if m.completed else ("Late" if m.due_date and m.due_date < today else "Upcoming")}
                for m in db.scalars(select(models.Milestone))]
        return {"title": "Milestones", "rows": rows}
    raise HTTPException(404, "Unknown report")


# ---------------------------------------------------------------- AI (answers built from workspace data)
def _ai_answer(db, user, prompt: str) -> str:
    p = prompt.lower()
    today = date.today()
    mine = select(models.Task).where(models.Task.assignee_id == user.id, models.Task.status != "completed")
    if any(k in p for k in ("overdue", "late")):
        if "project" in p:
            rows = db.execute(select(models.Project.name, func.count(models.Task.id))
                              .join(models.Task, models.Task.project_id == models.Project.id)
                              .where(models.Task.status != "completed", models.Task.due_date < today)
                              .group_by(models.Project.name)).all()
            return ("Projects with overdue work:\n" + "\n".join(f"- {n}: {c} late tasks" for n, c in rows)) if rows \
                else "None of your projects have overdue work right now."
        rows = db.scalars(select(models.Task).where(models.Task.status != "completed", models.Task.due_date < today)
                          .order_by(models.Task.due_date).limit(15)).all()
        return ("These tasks are overdue:\n" + "\n".join(
            f"- {t.title} ({t.project.name}, due {t.due_date.isoformat()})" for t in rows)) if rows else "Nothing is overdue."
    if "focus" in p or "plan my day" in p or "today" in p:
        rows = db.scalars(mine.order_by(models.Task.due_date.is_(None), models.Task.due_date).limit(8)).all()
        if not rows:
            return "You have no open tasks assigned. A good moment to plan ahead or help a teammate."
        return "Here's what I'd focus on, most urgent first:\n" + "\n".join(
            f"{i + 1}. {t.title} ({t.project.name}{', due ' + t.due_date.isoformat() if t.due_date else ''}"
            f"{', ' + t.priority + ' priority' if t.priority != 'none' else ''})" for i, t in enumerate(rows))
    if "yesterday" in p and ("log" in p or "time" in p):
        y = today - timedelta(days=1)
        rows = db.scalars(select(models.TimeEntry).where(models.TimeEntry.user_id == user.id, models.TimeEntry.date == y)).all()
        if not rows:
            done = db.scalars(select(models.Task).where(models.Task.assignee_id == user.id,
                                                        func.date(models.Task.completed_at) == y)).all()
            return "You haven't logged time for yesterday." + (
                " You completed: " + ", ".join(t.title for t in done) + ". Use Log time to record it." if done else "")
        return f"Yesterday you logged {sum(e.minutes for e in rows) // 60}h {sum(e.minutes for e in rows) % 60}m:\n" + \
            "\n".join(f"- {e.project.name}: {e.minutes} min {e.description or ''}" for e in rows)
    if "changed" in p or "catch me up" in p or "since" in p:
        rows = db.scalars(select(models.Activity).where(models.Activity.created_at >= datetime.utcnow() - timedelta(days=1))
                          .order_by(models.Activity.id.desc()).limit(15)).all()
        return ("In the last day:\n" + "\n".join(f"- {a.user.name if a.user else 'Someone'} {a.action}" for a in rows)) \
            if rows else "Nothing has changed in the last day."
    if "milestone" in p:
        rows = db.scalars(select(models.Milestone).where(models.Milestone.completed.is_(False))
                          .order_by(models.Milestone.due_date).limit(10)).all()
        return ("Upcoming milestones:\n" + "\n".join(f"- {m.name} ({schemas.d(m.due_date) or 'no date'})" for m in rows)) \
            if rows else "There are no open milestones."
    if "summar" in p or "status" in p:
        n_open = db.scalar(select(func.count(models.Task.id)).where(models.Task.status != "completed")) or 0
        n_late = db.scalar(select(func.count(models.Task.id)).where(models.Task.status != "completed",
                                                                   models.Task.due_date < today)) or 0
        n_proj = db.scalar(select(func.count(models.Project.id)).where(models.Project.status == "active")) or 0
        return f"Across {n_proj} active projects there are {n_open} open tasks, {n_late} of them late."
    m = re.search(r"project (.+)", p)
    if m:
        pr = db.scalar(select(models.Project).where(models.Project.name.ilike(f"%{m.group(1).strip(' ?.')}%")))
        if pr:
            n = db.scalar(select(func.count(models.Task.id)).where(models.Task.project_id == pr.id,
                                                                  models.Task.status != "completed")) or 0
            return f"{pr.name}: {n} open tasks, health {pr.health.replace('_', ' ')}."
    return ("I can help with your tasks, time, milestones and projects. Try: \"What should I focus on today?\", "
            "\"Which tasks are overdue?\", \"Catch me up\" or \"Log yesterday's time\".")


@router.post("/ai/ask")
def ai_ask(body: dict = Body(...), db: Session = Depends(get_db), user=Depends(current_user)):
    prompt = (body.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(400, "Ask something")
    answer = _ai_answer(db, user, prompt)
    chat = db.get(models.AiChat, body["chat_id"]) if body.get("chat_id") else None
    if not chat or chat.user_id != user.id:
        chat = models.AiChat(user_id=user.id, title=prompt[:120], messages="[]")
        db.add(chat)
    msgs = json.loads(chat.messages or "[]") + [{"role": "user", "text": prompt}, {"role": "ai", "text": answer}]
    chat.messages = json.dumps(msgs)
    db.commit()
    return serialize(db, [chat])[0]


# ---------------------------------------------------------------- Automations
def run_automations(db: Session, task: models.Task, trigger: str, actor: models.User):
    rules = db.scalars(select(models.Automation).where(models.Automation.is_active.is_(True),
                                                       models.Automation.trigger == trigger,
                                                       or_(models.Automation.project_id.is_(None),
                                                           models.Automation.project_id == task.project_id))).all()
    for r in rules:
        v = r.action_value or ""
        if r.action == "assign" and v.isdigit():
            task.assignee_id = int(v)
        elif r.action == "set_priority" and v in ("low", "medium", "high", "none"):
            task.priority = v
        elif r.action == "add_tag" and v:
            tags = [x for x in (task.tags or "").split(",") if x]
            if v not in tags:
                task.tags = ",".join(tags + [v])
        elif r.action == "set_status" and v in ("new", "in_progress", "completed", "backlog"):
            task.status = v
        elif r.action == "notify" and v.isdigit():
            db.add(models.Notification(user_id=int(v), actor_id=actor.id, kind="automation",
                                       message=f"Automation \"{r.name}\": {task.title}", link=f"/tasks/{task.id}"))
        r.run_count = (r.run_count or 0) + 1


# ---------------------------------------------------------------- Inbox (Teamwork-style list + preview)
@router.get("/inbox2")
def inbox2(q: str | None = None, kind: str | None = None, read: str | None = None, archived: bool = False,
           db: Session = Depends(get_db), user=Depends(current_user)):
    stmt = select(models.Notification).where(models.Notification.user_id == user.id,
                                              models.Notification.is_archived.is_(archived))
    if kind:
        stmt = stmt.where(models.Notification.kind.in_(kind.split(",")))
    if read == "unread":
        stmt = stmt.where(models.Notification.is_read.is_(False))
    elif read == "read":
        stmt = stmt.where(models.Notification.is_read.is_(True))
    if q:
        stmt = stmt.where(models.Notification.message.ilike(f"%{q}%"))
    rows = db.scalars(stmt.order_by(models.Notification.id.desc()).limit(300)).all()
    unread = db.scalar(select(func.count(models.Notification.id)).where(
        models.Notification.user_id == user.id, models.Notification.is_read.is_(False),
        models.Notification.is_archived.is_(False))) or 0
    from .home import notif_out
    return {"unread": unread, "items": [{**notif_out(n), "is_archived": n.is_archived} for n in rows]}


@router.post("/inbox/{nid}/archive")
def archive_one(nid: int, archived: bool = True, db: Session = Depends(get_db), user=Depends(current_user)):
    n = get_or_404(db, models.Notification, nid, "Notification")
    if n.user_id == user.id:
        n.is_archived = archived
        n.is_read = True if archived else n.is_read
        db.commit()
    return {"ok": True}


@router.post("/inbox/archive-all")
def archive_all(only_read: bool = False, db: Session = Depends(get_db), user=Depends(current_user)):
    for n in db.scalars(select(models.Notification).where(models.Notification.user_id == user.id,
                                                          models.Notification.is_archived.is_(False))):
        if not only_read or n.is_read:
            n.is_archived = True
            n.is_read = True
    db.commit()
    return {"ok": True}


@router.post("/people/import")
def import_people(body: dict = Body(...), db: Session = Depends(get_db), user=Depends(current_user)):
    """Bulk add people from CSV rows: [{name, email, title}]."""
    from ..security import hash_password
    from .auth import COLORS
    if user.role != "admin":
        raise HTTPException(403, "Only admins can import people")
    added, skipped = 0, []
    for r in body.get("rows") or []:
        email = (r.get("email") or "").strip().lower()
        name = (r.get("name") or "").strip() or email.split("@")[0]
        if not email or "@" not in email or db.scalar(select(models.User).where(models.User.email == email)):
            skipped.append(email or name)
            continue
        n = db.scalar(select(func.count(models.User.id))) or 0
        db.add(models.User(name=name, email=email, title=r.get("title") or None, role="member",
                           password_hash=hash_password("changeme123"), color=COLORS[n % len(COLORS)]))
        db.flush()
        added += 1
    db.commit()
    return {"added": added, "skipped": skipped}


@router.delete("/message-replies/{rid}")
def delete_reply(rid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    r = get_or_404(db, models.MessageReply, rid, "Reply")
    if r.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "Not allowed")
    db.delete(r)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- Settings + user prefs
def _jload(v, default=None):
    try:
        return json.loads(v) if v else default
    except ValueError:
        return default


@router.get("/settings")
def get_settings(db: Session = Depends(get_db), user=Depends(current_user)):
    return {r.key: _jload(r.value) for r in db.scalars(select(models.SiteSetting))}


@router.patch("/settings")
def set_settings(body: dict = Body(...), db: Session = Depends(get_db), user=Depends(current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Only admins can change site settings")
    for k, v in body.items():
        row = db.scalar(select(models.SiteSetting).where(models.SiteSetting.key == k))
        if not row:
            row = models.SiteSetting(key=k[:80])
            db.add(row)
        row.value = json.dumps(v)
    db.commit()
    return get_settings(db, user)


@router.get("/prefs")
def get_prefs(db: Session = Depends(get_db), user=Depends(current_user)):
    return {r.key: _jload(r.value) for r in db.scalars(select(models.UserPref).where(models.UserPref.user_id == user.id))}


@router.patch("/prefs")
def set_prefs(body: dict = Body(...), db: Session = Depends(get_db), user=Depends(current_user)):
    for k, v in body.items():
        row = db.scalar(select(models.UserPref).where(models.UserPref.user_id == user.id, models.UserPref.key == k))
        if not row:
            row = models.UserPref(user_id=user.id, key=k[:80])
            db.add(row)
        row.value = json.dumps(v)
    db.commit()
    return get_prefs(db, user)


@router.patch("/messages/{mid}")
def edit_message(mid: int, body: dict = Body(...), db: Session = Depends(get_db), user=Depends(current_user)):
    m = get_or_404(db, models.Message, mid, "Message")
    if m.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "Only the author can edit this message")
    if body.get("title"):
        m.title = body["title"][:250]
    if "body" in body:
        m.body = body["body"] or ""
    log(db, user, f"edited message {m.title}", m.project_id)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- Chat
def _members(c):
    return [int(x) for x in (c.member_ids or "").split(",") if x.strip().isdigit()]


def _visible(c, uid):
    return not (c.is_dm or c.is_private) or uid in _members(c)


def _chan_out(db, c, uid):
    last = db.scalar(select(models.ChatMessage).where(models.ChatMessage.channel_id == c.id)
                     .order_by(models.ChatMessage.id.desc()).limit(1))
    read = db.scalar(select(models.ChatRead).where(models.ChatRead.channel_id == c.id, models.ChatRead.user_id == uid))
    unread = db.scalar(select(func.count(models.ChatMessage.id)).where(
        models.ChatMessage.channel_id == c.id, models.ChatMessage.id > (read.last_read_id if read else 0),
        models.ChatMessage.user_id != uid)) or 0
    mem = _members(c)
    name = c.name
    other = None
    if c.is_dm:
        oid = next((m for m in mem if m != uid), uid)
        other = db.get(models.User, oid)
        name = other.name if other else c.name
    return {"id": c.id, "name": name, "description": c.description, "is_dm": c.is_dm, "is_private": c.is_private,
            "member_ids": mem, "member_count": len(mem) if mem else db.scalar(select(func.count(models.User.id))) or 0,
            "is_member": not mem or uid in mem, "other": schemas.user_brief(other),
            "last": {"body": last.body[:120], "user": schemas.user_brief(last.user_ref) if False else
                     schemas.user_brief(db.get(models.User, last.user_id)) if last.user_id else None,
                     "created_at": schemas.d(last.created_at)} if last else None,
            "unread": unread, "created_at": schemas.d(c.created_at)}


@router.get("/chat/channels")
def chat_channels(db: Session = Depends(get_db), user=Depends(current_user)):
    if not db.scalar(select(models.ChatChannel).limit(1)):
        db.add(models.ChatChannel(name="General", description="Company-wide announcements and chat", created_by_id=user.id))
        db.commit()
    rows = [c for c in db.scalars(select(models.ChatChannel)) if _visible(c, user.id)]
    out = [_chan_out(db, c, user.id) for c in rows]
    out.sort(key=lambda c: (c["last"] or {}).get("created_at") or c["created_at"] or "", reverse=True)
    return out


@router.post("/chat/channels")
def chat_create(body: dict = Body(...), db: Session = Depends(get_db), user=Depends(current_user)):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Channel name is required")
    ids = sorted({int(i) for i in body.get("member_ids") or []} | ({user.id} if body.get("is_private") else set()))
    c = models.ChatChannel(name=name[:120], description=body.get("description"), is_private=bool(body.get("is_private")),
                           member_ids=",".join(map(str, ids)) if body.get("is_private") else None, created_by_id=user.id)
    db.add(c)
    db.flush()
    db.add(models.ChatMessage(channel_id=c.id, user_id=user.id, body=f"{user.name} created the channel."))
    db.commit()
    return _chan_out(db, c, user.id)


@router.post("/chat/dm/{uid}")
def chat_dm(uid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    other = get_or_404(db, models.User, uid, "Person")
    key = ",".join(map(str, sorted({user.id, other.id})))
    c = db.scalar(select(models.ChatChannel).where(models.ChatChannel.is_dm.is_(True), models.ChatChannel.member_ids == key))
    if not c:
        c = models.ChatChannel(name=f"dm:{key}", is_dm=True, member_ids=key, created_by_id=user.id)
        db.add(c)
        db.commit()
    return _chan_out(db, c, user.id)


@router.patch("/chat/channels/{cid}")
def chat_update(cid: int, body: dict = Body(...), db: Session = Depends(get_db), user=Depends(current_user)):
    c = get_or_404(db, models.ChatChannel, cid, "Channel")
    if body.get("name"):
        c.name = body["name"][:120]
    if "description" in body:
        c.description = body["description"]
    if "join" in body and not c.is_dm:
        mem = set(_members(c))
        if mem:
            mem = mem | {user.id} if body["join"] else mem - {user.id}
            c.member_ids = ",".join(map(str, sorted(mem)))
    db.commit()
    return _chan_out(db, c, user.id)


@router.delete("/chat/channels/{cid}")
def chat_delete(cid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    c = get_or_404(db, models.ChatChannel, cid, "Channel")
    if c.created_by_id != user.id and user.role != "admin":
        raise HTTPException(403, "Only the creator can delete this channel")
    db.delete(c)
    db.commit()
    return {"ok": True}


def _msg_out(db, m, users):
    return {"id": m.id, "channel_id": m.channel_id, "body": m.body, "user": users.get(m.user_id),
            "is_bookmarked": m.is_bookmarked, "created_at": schemas.d(m.created_at)}


@router.get("/chat/channels/{cid}/messages")
def chat_messages(cid: int, after: int = 0, db: Session = Depends(get_db), user=Depends(current_user)):
    c = get_or_404(db, models.ChatChannel, cid, "Channel")
    if not _visible(c, user.id):
        raise HTTPException(403, "Not a member of this channel")
    rows = db.scalars(select(models.ChatMessage).where(models.ChatMessage.channel_id == cid, models.ChatMessage.id > after)
                      .order_by(models.ChatMessage.id.desc()).limit(200)).all()[::-1]
    users = _names(db, [m.user_id for m in rows])
    if rows:
        read = db.scalar(select(models.ChatRead).where(models.ChatRead.channel_id == cid, models.ChatRead.user_id == user.id))
        if not read:
            read = models.ChatRead(channel_id=cid, user_id=user.id)
            db.add(read)
        read.last_read_id = max(read.last_read_id or 0, rows[-1].id)
        db.commit()
    return [_msg_out(db, m, users) for m in rows]


@router.post("/chat/channels/{cid}/messages")
def chat_send(cid: int, body: dict = Body(...), db: Session = Depends(get_db), user=Depends(current_user)):
    c = get_or_404(db, models.ChatChannel, cid, "Channel")
    if not _visible(c, user.id):
        raise HTTPException(403, "Not a member of this channel")
    text = (body.get("body") or "").strip()
    if not text:
        raise HTTPException(400, "Message is empty")
    m = models.ChatMessage(channel_id=cid, user_id=user.id, body=text[:5000])
    db.add(m)
    if c.is_dm:
        for uid in _members(c):
            notify(db, uid, user, f"{user.name} sent you a chat message: {text[:80]}", f"/chat/{cid}", "chat")
    db.commit()
    return _msg_out(db, m, _names(db, [user.id]))


@router.patch("/chat/messages/{mid}")
def chat_edit(mid: int, body: dict = Body(...), db: Session = Depends(get_db), user=Depends(current_user)):
    m = get_or_404(db, models.ChatMessage, mid, "Message")
    if "is_bookmarked" in body:
        m.is_bookmarked = bool(body["is_bookmarked"])
    if "body" in body:
        if m.user_id != user.id:
            raise HTTPException(403, "You can only edit your own messages")
        m.body = (body["body"] or "")[:5000]
    db.commit()
    return _msg_out(db, m, _names(db, [m.user_id]))


@router.delete("/chat/messages/{mid}")
def chat_del(mid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    m = get_or_404(db, models.ChatMessage, mid, "Message")
    if m.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "Not allowed")
    db.delete(m)
    db.commit()
    return {"ok": True}


@router.get("/chat/bookmarks")
def chat_bookmarks(db: Session = Depends(get_db), user=Depends(current_user)):
    rows = db.scalars(select(models.ChatMessage).where(models.ChatMessage.is_bookmarked.is_(True))
                      .order_by(models.ChatMessage.id.desc()).limit(100)).all()
    users = _names(db, [m.user_id for m in rows])
    chans = {c.id: c for c in db.scalars(select(models.ChatChannel))}
    return [{**_msg_out(db, m, users), "channel_name": _chan_out(db, chans[m.channel_id], user.id)["name"]}
            for m in rows if m.channel_id in chans and _visible(chans[m.channel_id], user.id)]


@router.get("/chat/unread")
def chat_unread(db: Session = Depends(get_db), user=Depends(current_user)):
    return {"unread": sum(c["unread"] for c in chat_channels(db, user))}
