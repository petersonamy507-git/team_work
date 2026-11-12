from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import hash_password, verify_password, create_token, current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"]


@router.post("/register")
def register(body: schemas.RegisterIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if db.scalar(select(models.User).where(models.User.email == email)):
        raise HTTPException(400, "An account with this email already exists")
    count = db.scalar(select(func.count(models.User.id))) or 0
    user = models.User(name=body.name.strip(), email=email, password_hash=hash_password(body.password),
                       role="admin" if count == 0 else "member", color=COLORS[count % len(COLORS)])
    db.add(user)
    db.commit()
    return {"token": create_token(user.id), "user": schemas.user_out(user)}


@router.post("/login")
def login(body: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(models.User).where(models.User.email == body.email.strip().lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Wrong email or password")
    if not user.is_active:
        raise HTTPException(403, "This account is deactivated")
    return {"token": create_token(user.id), "user": schemas.user_out(user)}


@router.get("/me")
def me(user: models.User = Depends(current_user)):
    return schemas.user_out(user)
