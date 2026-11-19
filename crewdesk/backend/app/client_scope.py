"""Client view: what a signed-in client user (User.role == "client") may see and do.

Mirrors Teamwork's client experience: a client only sees the projects they were added to
(or projects that belong to their company), and the areas Teamwork hides from clients
(finance, reporting, templates, automations, people management, chat, AI...) are blocked.

How it works:
* `apply_client_scope(request, db, user)` is called from `security.current_user` for every
  authenticated request. For clients it rejects blocked API paths with 403 and stores the
  allowed project ids in `db.info["client_scope"]`.
* A `do_orm_execute` listener adds `with_loader_criteria` filters to every ORM SELECT in that
  session, so every list, count and lookup only returns rows from the client's projects
  (rows with no project only when the client owns them).
"""
import re

from fastapi import HTTPException, Request
from sqlalchemy import event, select, or_, false
from sqlalchemy.orm import Session, with_loader_criteria

from . import models

# API paths a client may never call (regex on the path, any method)
BLOCKED = [
    r"^/api/clients", r"^/api/finance", r"^/api/reports", r"^/api/ai/", r"^/api/automations",
    r"^/api/chat", r"^/api/templates", r"^/api/time/(approv|company)", r"^/api/resourcing/(workload|unplanned|overview)",
    r"^/api/people/import", r"^/api/settings/email", r"^/api/everything/(?!comments)",
]
# API paths a client may read but not change
READ_ONLY = [
    r"^/api/settings$", r"^/api/people$", r"^/api/custom-fields", r"^/api/workflows", r"^/api/workflow-stages",
    r"^/api/projects$", r"^/api/projects/\d+/people", r"^/api/projects/\d+/(copy|save-as-template)",
    r"^/api/projects/\d+/columns", r"^/api/projects/columns",
]
# generic CRUD kinds (/api/r/<kind>) a client may use; anything else is blocked
R_READ = {"dashboards", "proofs", "reactions", "risks", "notebooks", "links", "forms", "categories", "statuses", "tickets"}
R_WRITE = {"dashboards", "proofs", "reactions", "tickets"}


def client_project_ids(db: Session, user: models.User) -> list[int]:
    member = select(models.ProjectMember.project_id).where(models.ProjectMember.user_id == user.id)
    ids = set(db.scalars(member).all())
    if user.client_id:
        ids |= set(db.scalars(select(models.Project.id).where(models.Project.client_id == user.client_id)).all())
    return sorted(ids)


def apply_client_scope(request: Request | None, db: Session, user: models.User):
    if user.role != "client":
        return
    if request is not None:
        path, method = request.url.path, request.method.upper()
        if any(re.search(p, path) for p in BLOCKED):
            raise HTTPException(403, "You do not have access to this page")
        if method != "GET" and any(re.search(p, path) for p in READ_ONLY):
            raise HTTPException(403, "Client users can't change this")
        m = re.match(r"^/api/r/([\w-]+)", path)
        if m:
            kind = m.group(1)
            if kind not in R_READ or (method != "GET" and kind not in R_WRITE):
                raise HTTPException(403, "You do not have access to this page")
    db.info["client_scope"] = {"uid": user.id, "client_id": user.client_id, "pids": client_project_ids(db, user)}


def scope_of(db: Session):
    return db.info.get("client_scope")


def _criteria(scope):
    pids, uid = scope["pids"] or [0], scope["uid"]
    out = [with_loader_criteria(models.Project, models.Project.id.in_(pids))]
    out.append(with_loader_criteria(models.Client, models.Client.id == scope["client_id"]) if scope["client_id"]
               else with_loader_criteria(models.Client, false()))
    seen = set()
    for mapper in models.Base.registry.mappers:
        cls = mapper.class_
        if cls in seen or cls is models.Project or not hasattr(cls, "project_id"):
            continue
        seen.add(cls)
        owner = next((getattr(cls, c) for c in ("user_id", "created_by_id") if hasattr(cls, c)), None)
        cond = cls.project_id.in_(pids)
        if owner is not None:
            cond = or_(cond, (cls.project_id.is_(None)) & (owner == uid))
        out.append(with_loader_criteria(cls, cond))
    # rows that hang off a task or message (comments, replies...) follow their parent's project
    task_ids = select(models.Task.id).where(models.Task.project_id.in_(pids))
    for mapper in models.Base.registry.mappers:
        cls = mapper.class_
        if hasattr(cls, "task_id") and not hasattr(cls, "project_id"):
            out.append(with_loader_criteria(cls, cls.task_id.in_(task_ids)))
    out.append(with_loader_criteria(models.MessageReply, models.MessageReply.message_id.in_(
        select(models.Message.id).where(models.Message.project_id.in_(pids)))))
    # private notebooks stay private
    out.append(with_loader_criteria(models.Notebook, or_(models.Notebook.is_private.is_(False),
                                                         models.Notebook.is_private.is_(None),
                                                         models.Notebook.created_by_id == uid)))
    return out


@event.listens_for(Session, "do_orm_execute")
def _scope_client_queries(state):
    scope = state.session.info.get("client_scope")
    if scope and state.is_select:
        state.statement = state.statement.options(*_criteria(scope))


def visible_user_ids(db: Session):
    """For a client: themselves plus everyone on their projects. None for everyone else (no limit)."""
    scope = scope_of(db)
    if not scope:
        return None
    ids = set(db.scalars(select(models.ProjectMember.user_id)).all())  # already limited to the client's projects
    return ids | {scope["uid"]}
