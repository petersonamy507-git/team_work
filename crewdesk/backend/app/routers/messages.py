from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..helpers import get_or_404, log, notify
from ..security import current_user

router = APIRouter(prefix="/api", tags=["messages"])


def msg_out(db, m, full=False):
    out = {"id": m.id, "project_id": m.project_id, "title": m.title, "body": m.body,
           "user": schemas.user_brief(m.user), "created_at": schemas.d(m.created_at),
           "reply_count": db.scalar(select(func.count(models.MessageReply.id)).where(
               models.MessageReply.message_id == m.id)) or 0}
    if full:
        replies = db.scalars(select(models.MessageReply).where(models.MessageReply.message_id == m.id)
                             .order_by(models.MessageReply.id)).all()
        out["replies"] = [{"id": r.id, "body": r.body, "user": schemas.user_brief(r.user),
                           "created_at": schemas.d(r.created_at)} for r in replies]
    return out


@router.get("/projects/{pid}/messages")
def list_messages(pid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    rows = db.scalars(select(models.Message).where(models.Message.project_id == pid)
                      .order_by(models.Message.id.desc())).all()
    return [msg_out(db, m) for m in rows]


@router.post("/projects/{pid}/messages")
def create_message(pid: int, body: schemas.MessageIn, db: Session = Depends(get_db), user=Depends(current_user)):
    p = get_or_404(db, models.Project, pid, "Project")
    m = models.Message(project_id=pid, user_id=user.id, title=body.title, body=body.body)
    db.add(m)
    db.flush()
    log(db, user, f"posted message {m.title}", pid)
    for uid in db.scalars(select(models.ProjectMember.user_id).where(models.ProjectMember.project_id == pid)):
        notify(db, uid, user, f"{user.name} posted \"{m.title}\" in {p.name}", f"/projects/{pid}/messages/{m.id}",
               "message")
    db.commit()
    return msg_out(db, m)


@router.get("/messages/{mid}")
def get_message(mid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    return msg_out(db, get_or_404(db, models.Message, mid, "Message"), full=True)


@router.delete("/messages/{mid}")
def delete_message(mid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    m = get_or_404(db, models.Message, mid, "Message")
    if m.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "Not allowed")
    db.delete(m)
    db.commit()
    return {"ok": True}


@router.post("/messages/{mid}/replies")
def reply(mid: int, body: schemas.ReplyIn, db: Session = Depends(get_db), user=Depends(current_user)):
    m = get_or_404(db, models.Message, mid, "Message")
    db.add(models.MessageReply(message_id=mid, user_id=user.id, body=body.body))
    notify(db, m.user_id, user, f"{user.name} replied to \"{m.title}\"", f"/projects/{m.project_id}/messages/{m.id}",
           "message")
    db.commit()
    return msg_out(db, m, full=True)
