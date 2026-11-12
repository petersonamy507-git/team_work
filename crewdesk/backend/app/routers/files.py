import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..helpers import get_or_404, log
from ..security import current_user

router = APIRouter(prefix="/api", tags=["files"])
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", Path(__file__).resolve().parents[2] / "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_BYTES = 25 * 1024 * 1024


def file_out(f: models.FileItem):
    return {"id": f.id, "project_id": f.project_id, "task_id": f.task_id, "name": f.original_name,
            "content_type": f.content_type, "size": f.size, "user": schemas.user_brief(f.user),
            "created_at": schemas.d(f.created_at)}


@router.get("/projects/{pid}/files")
def list_files(pid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    rows = db.scalars(select(models.FileItem).where(models.FileItem.project_id == pid)
                      .order_by(models.FileItem.id.desc())).all()
    return [file_out(f) for f in rows]


@router.post("/projects/{pid}/files")
async def upload(pid: int, file: UploadFile = File(...), task_id: int | None = Form(None),
                 db: Session = Depends(get_db), user=Depends(current_user)):
    get_or_404(db, models.Project, pid, "Project")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File is larger than 25 MB")
    ext = Path(file.filename or "").suffix[:12]
    stored = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / stored).write_bytes(data)
    f = models.FileItem(project_id=pid, task_id=task_id, user_id=user.id,
                        original_name=file.filename or stored, stored_name=stored,
                        content_type=file.content_type, size=len(data))
    db.add(f)
    log(db, user, f"uploaded file {f.original_name}", pid)
    db.commit()
    return file_out(f)


@router.get("/files/{fid}/download")
def download(fid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    f = get_or_404(db, models.FileItem, fid, "File")
    path = UPLOAD_DIR / f.stored_name
    if not path.exists():
        raise HTTPException(404, "File is missing on disk")
    return FileResponse(path, filename=f.original_name, media_type=f.content_type or "application/octet-stream")


@router.delete("/files/{fid}")
def delete_file(fid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    f = get_or_404(db, models.FileItem, fid, "File")
    try:
        (UPLOAD_DIR / f.stored_name).unlink(missing_ok=True)
    except OSError:
        pass
    db.delete(f)
    db.commit()
    return {"ok": True}
