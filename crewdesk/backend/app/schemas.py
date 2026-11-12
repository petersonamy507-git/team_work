"""Request bodies (pydantic) and response serializers (plain dicts)."""
from datetime import date
from typing import Optional

from pydantic import BaseModel, Field

from . import models


# ---------- input ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=190)
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: str
    password: str


class UserIn(BaseModel):
    name: str
    email: str
    password: str = "changeme123"
    title: Optional[str] = None
    role: str = "member"


class UserUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    color: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    client_id: Optional[int] = None
    phone: Optional[str] = None
    capacity_minutes: Optional[int] = None


class ClientIn(BaseModel):
    name: str
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    owner_id: Optional[int] = None
    address: Optional[str] = None
    industry: Optional[str] = None


class ProjectIn(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    health: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget_minutes: Optional[int] = None
    client_id: Optional[int] = None
    owner_id: Optional[int] = None
    is_starred: Optional[bool] = None
    category_id: Optional[int] = None
    type: Optional[str] = None
    member_ids: Optional[list[int]] = None


class TaskListIn(BaseModel):
    name: str
    description: Optional[str] = None
    milestone_id: Optional[int] = None
    position: Optional[int] = None


class ColumnIn(BaseModel):
    name: str
    color: Optional[str] = None
    position: Optional[int] = None


class TaskIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tasklist_id: Optional[int] = None
    column_id: Optional[int] = None
    parent_id: Optional[int] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[int] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    estimate_minutes: Optional[int] = None
    progress: Optional[int] = None
    tags: Optional[str] = None
    position: Optional[int] = None
    is_private: Optional[bool] = None
    repeat: Optional[str] = None
    assignee_ids: Optional[list[int]] = None  # full set of assignees; first one becomes the primary
    follower_ids: Optional[list[int]] = None
    depends_on_ids: Optional[list[int]] = None
    reminders: Optional[list[str]] = None  # ISO datetimes, create only
    notify: Optional[bool] = None
    custom: Optional[dict] = None  # {field_id: value}


class MoveToIn(BaseModel):
    tasklist_id: int
    make_copy: bool = False


class ReminderIn(BaseModel):
    remind_at: str
    note: Optional[str] = None


class PersonalTaskIn(BaseModel):
    title: Optional[str] = None
    done: Optional[bool] = None
    position: Optional[int] = None


class EventIn(BaseModel):
    title: str = Field(min_length=1, max_length=250)
    date: date
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    description: Optional[str] = None
    project_id: Optional[int] = None


class BulkTaskIn(BaseModel):
    ids: list[int]
    patch: TaskIn = TaskIn()
    add_tag: Optional[str] = None
    delete: bool = False


class DependencyIn(BaseModel):
    depends_on_id: int


class SavedViewIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    config: dict


class CommentIn(BaseModel):
    body: str


class MilestoneIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[date] = None
    owner_id: Optional[int] = None
    completed: Optional[bool] = None


class TimeIn(BaseModel):
    project_id: int
    task_id: Optional[int] = None
    date: date
    minutes: int = Field(gt=0, le=24 * 60)
    description: Optional[str] = None
    billable: bool = True


class MessageIn(BaseModel):
    title: str
    body: str


class ReplyIn(BaseModel):
    body: str


# ---------- output ----------
def d(v):
    return v.isoformat() if v else None


def user_out(u: models.User | None):
    if not u:
        return None
    return {"id": u.id, "name": u.name, "email": u.email, "title": u.title, "color": u.color,
            "role": u.role, "is_active": u.is_active, "created_at": d(u.created_at),
            "client_id": u.client_id, "phone": u.phone, "capacity_minutes": u.capacity_minutes}


def user_brief(u: models.User | None):
    if not u:
        return None
    return {"id": u.id, "name": u.name, "color": u.color}


def client_out(c: models.Client):
    return {"id": c.id, "name": c.name, "website": c.website, "email": c.email, "phone": c.phone}


def project_out(p: models.Project, extra: dict | None = None):
    out = {"id": p.id, "name": p.name, "description": p.description, "status": p.status,
           "health": p.health, "color": p.color, "start_date": d(p.start_date), "end_date": d(p.end_date),
           "budget_minutes": p.budget_minutes, "is_starred": p.is_starred, "category_id": p.category_id, "type": p.type,
           "client": client_out(p.client) if p.client else None,
           "owner": user_brief(p.owner), "created_at": d(p.created_at)}
    if extra:
        out.update(extra)
    return out


def task_out(t: models.Task, extra: dict | None = None):
    out = {"id": t.id, "project_id": t.project_id, "project_name": t.project.name if t.project else None,
           "tasklist_id": t.tasklist_id, "tasklist_name": t.tasklist.name if t.tasklist else None,
           "column_id": t.column_id, "parent_id": t.parent_id, "title": t.title,
           "description": t.description, "status": t.status, "priority": t.priority,
           "assignee": user_brief(t.assignee), "created_by": user_brief(t.created_by),
           "start_date": d(t.start_date), "due_date": d(t.due_date),
           "estimate_minutes": t.estimate_minutes, "progress": t.progress,
           "tags": [x.strip() for x in (t.tags or "").split(",") if x.strip()],
           "position": t.position, "completed_at": d(t.completed_at), "created_at": d(t.created_at),
           "updated_at": d(t.updated_at), "is_private": bool(t.is_private), "repeat": t.repeat,
           "assignees": [user_brief(t.assignee)] if t.assignee else []}
    if extra:
        out.update(extra)
    return out


def time_out(e: models.TimeEntry):
    return {"id": e.id, "user": user_brief(e.user), "project_id": e.project_id,
            "project_name": e.project.name if e.project else None, "task_id": e.task_id,
            "task_title": e.task.title if e.task else None, "date": d(e.date), "minutes": e.minutes,
            "description": e.description, "billable": e.billable}


def milestone_out(m: models.Milestone, extra: dict | None = None):
    out = {"id": m.id, "project_id": m.project_id, "name": m.name, "description": m.description,
           "due_date": d(m.due_date), "owner": user_brief(m.owner), "completed": m.completed}
    if extra:
        out.update(extra)
    return out
