"""Invite users (Teamwork's 3-step "Invite users" dialog).

POST /api/invites creates one user per person, ties them to a client, adds them to projects with the chosen
permissions and gives each a one-time invite link. If SMTP is configured the link is emailed; otherwise the
inviter copies the link from the dialog. The invited person opens /invite/<token>, picks a password and is in.
"""
import secrets
from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..helpers import get_or_404, log, notify
from ..mailer import send_email, smtp_configured
from ..security import current_user, hash_password, create_token
from .auth import COLORS

router = APIRouter(prefix="/api", tags=["invites"])


class Invitee(BaseModel):
    first_name: str = ""
    last_name: str = ""
    email: str
    password: str | None = None        # optional: set it now so they can sign in without the invite link


class InviteIn(BaseModel):
    people: list[Invitee]
    client_id: int | None = None
    user_type: str = "member"          # member (Standard user) | client (Client user)
    project_ids: list[int] = []
    permission: str = "default"        # default | project_admin | admin
    can_add_users: bool = False
    can_create_projects: bool = False
    message: str | None = None
    origin: str | None = None          # the browser's origin, used to build the invite link


def can_invite(user: models.User) -> bool:
    return user.role == "admin" or (user.role != "client" and bool(getattr(user, "can_add_users", False)))


def _link(origin: str | None, token: str) -> str:
    base = (origin or "http://localhost:5180").rstrip("/")
    return f"{base}/invite/{token}"


def _email_invite(inviter: models.User, u: models.User, link: str, message: str | None, projects: list[str],
                  password_set: bool = False) -> bool:
    body = [f"Hi {u.name.split(' ')[0]},", "", f"{inviter.name} has invited you to join Crewdesk."]
    if projects:
        body.append("You've been added to: " + ", ".join(projects) + ".")
    if message:
        body += ["", message]
    body += ["", "Sign in here with this email and the password you were given:" if password_set
             else "Accept the invite and choose your password here:", link, "", "See you there!"]
    return send_email([u.email], f"{inviter.name} invited you to Crewdesk", "\n".join(body))


@router.post("/invites")
def send_invites(body: InviteIn, db: Session = Depends(get_db), user=Depends(current_user)):
    if not can_invite(user):
        raise HTTPException(403, "You don't have permission to add users")
    people = [p for p in body.people if p.email.strip()]
    if not people:
        raise HTTPException(400, "Add at least one email address")
    if body.permission == "admin" and user.role != "admin":
        raise HTTPException(403, "Only administrators can invite administrators")
    if body.client_id:
        get_or_404(db, models.Client, body.client_id, "Client")
    seen = set()
    for p in people:
        e = p.email.strip().lower()
        if "@" not in e or "." not in e.split("@")[-1]:
            raise HTTPException(400, f"{p.email} is not a valid email address")
        if e in seen:
            raise HTTPException(400, f"{e} is listed twice")
        seen.add(e)
        if db.scalar(select(models.User).where(models.User.email == e)):
            raise HTTPException(400, f"{e} already has an account")
        if p.password and len(p.password.strip()) < 6:
            raise HTTPException(400, f"The password for {e} must be at least 6 characters")
    projects = db.scalars(select(models.Project).where(models.Project.id.in_(body.project_ids))).all() \
        if body.project_ids else []
    role = "admin" if body.permission == "admin" else ("client" if body.user_type == "client" else "member")
    count = db.scalar(select(func.count(models.User.id))) or 0
    out, created = [], []
    for i, p in enumerate(people):
        email = p.email.strip().lower()
        name = f"{p.first_name.strip()} {p.last_name.strip()}".strip() or email.split("@")[0]
        pw = (p.password or "").strip()
        token = None if pw else secrets.token_urlsafe(32)
        u = models.User(name=name, email=email, role=role, client_id=body.client_id,
                        # with a password they can sign in now; otherwise unusable until the invite is accepted
                        password_hash=hash_password(pw or secrets.token_urlsafe(24)),
                        color=COLORS[(count + i) % len(COLORS)], invite_token=token, invited_at=datetime.utcnow(),
                        invited_by_id=user.id, can_add_users=body.can_add_users or role == "admin",
                        can_create_projects=body.can_create_projects or role == "admin")
        db.add(u)
        db.flush()
        for pr in projects:
            db.add(models.ProjectMember(project_id=pr.id, user_id=u.id, is_admin=body.permission == "project_admin"))
            log(db, user, f"added {name} to project {pr.name}", pr.id)
        created.append(u)
        out.append((u, token))
    db.flush()
    from ..automation_engine import fire
    for pr in projects:
        fire(db, "people_added", user, project=pr, ctx={"user_ids": [u.id for u in created]})
    db.commit()
    names = [pr.name for pr in projects]
    result = []
    for u, token in out:
        link = _link(body.origin, token) if token else None
        login_url = (body.origin or "http://localhost:5180").rstrip("/") + "/login"
        emailed = _email_invite(user, u, link or login_url, body.message, names, password_set=not token)
        result.append({**schemas.user_out(u), "invite_url": link, "login_url": login_url,
                       "password_set": not token, "emailed": emailed})
    return {"invited": result, "email_enabled": smtp_configured()}


@router.post("/invites/{uid}/link")
def new_invite_link(uid: int, body: dict = Body(default={}), db: Session = Depends(get_db), user=Depends(current_user)):
    """Get (or regenerate with resend=true) the invite link of someone who hasn't accepted yet."""
    if not can_invite(user):
        raise HTTPException(403, "You don't have permission to add users")
    u = get_or_404(db, models.User, uid, "Person")
    if not u.invite_token:
        raise HTTPException(400, f"{u.name} has already accepted their invite")
    if body.get("regenerate"):
        u.invite_token = secrets.token_urlsafe(32)
        u.invited_at = datetime.utcnow()
    db.commit()
    link = _link(body.get("origin"), u.invite_token)
    emailed = _email_invite(user, u, link, None, []) if body.get("resend") else False
    return {"invite_url": link, "emailed": emailed, "email_enabled": smtp_configured()}


# ---------- public: accepting an invite ----------
def _pending(db: Session, token: str) -> models.User:
    u = db.scalar(select(models.User).where(models.User.invite_token == token)) if token else None
    if not u:
        raise HTTPException(404, "This invite link is invalid or has already been used")
    if not u.is_active:
        raise HTTPException(403, "This account is deactivated")
    return u


@router.get("/invites/{token}")
def view_invite(token: str, db: Session = Depends(get_db)):
    u = _pending(db, token)
    inviter = db.get(models.User, u.invited_by_id) if u.invited_by_id else None
    client = db.get(models.Client, u.client_id) if u.client_id else None
    n = db.scalar(select(func.count(models.ProjectMember.id)).where(models.ProjectMember.user_id == u.id)) or 0
    return {"name": u.name, "email": u.email, "invited_by": inviter.name if inviter else None,
            "client": client.name if client else None, "project_count": n}


@router.post("/invites/{token}/accept")
def accept_invite(token: str, body: dict = Body(...), db: Session = Depends(get_db)):
    u = _pending(db, token)
    pw = (body.get("password") or "").strip()
    if len(pw) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    name = (body.get("name") or "").strip()
    if name:
        u.name = name
    u.password_hash = hash_password(pw)
    u.invite_token = None
    if u.invited_by_id:
        notify(db, u.invited_by_id, u, f"{u.name} accepted your invite and joined Crewdesk", f"/people/person/{u.id}")
    db.commit()
    return {"token": create_token(u.id), "user": schemas.user_out(u)}
