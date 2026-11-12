from fastapi import HTTPException
from sqlalchemy.orm import Session

from . import models


def get_or_404(db: Session, model, obj_id: int, label: str = "Item"):
    obj = db.get(model, obj_id)
    if not obj:
        raise HTTPException(404, f"{label} not found")
    return obj


def log(db: Session, user: models.User | None, action: str, project_id: int | None = None,
        task_id: int | None = None):
    db.add(models.Activity(user_id=user.id if user else None, action=action, project_id=project_id,
                           task_id=task_id))


def notify(db: Session, user_id: int | None, actor: models.User, message: str, link: str | None = None,
           kind: str = "info"):
    if not user_id or user_id == actor.id:
        return
    db.add(models.Notification(user_id=user_id, actor_id=actor.id, message=message, link=link, kind=kind))


def apply(obj, data: dict):
    for k, v in data.items():
        setattr(obj, k, v)
    return obj
