"""Task custom fields and named workflows (board stages)."""
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete, func
from sqlalchemy.orm import Session

from .. import models, task_extras_models as X
from ..database import get_db
from ..helpers import get_or_404, log
from ..mailer import smtp_configured
from ..security import current_user
from . import tasks as T

router = APIRouter(prefix="/api", tags=["task extras"])
KINDS = {"text", "number", "date", "dropdown", "checkbox", "url"}


class FieldIn(BaseModel):
    name: str | None = None
    kind: str | None = None
    options: list[str] | None = None
    position: int | None = None


class ValuesIn(BaseModel):
    values: dict[str, str | None]


class WorkflowIn(BaseModel):
    name: str | None = None
    project_ids: list[int] | None = None
    stages: list[dict] | None = None  # [{name, color, is_done}] on create


class StageIn(BaseModel):
    name: str | None = None
    color: str | None = None
    is_done: bool | None = None
    position: int | None = None


class ReorderIn(BaseModel):
    ids: list[int]


class MoveStageIn(BaseModel):
    workflow_id: int
    stage_id: int


def field_out(f):
    return {"id": f.id, "name": f.name, "kind": f.kind, "options": json.loads(f.options or "[]"), "position": f.position}


# ---------------- custom fields ----------------
@router.get("/custom-fields")
def list_fields(db: Session = Depends(get_db), user=Depends(current_user)):
    return [field_out(f) for f in db.scalars(select(X.CustomField).order_by(X.CustomField.position, X.CustomField.id))]


@router.post("/custom-fields")
def add_field(body: FieldIn, db: Session = Depends(get_db), user=Depends(current_user)):
    if not (body.name or "").strip():
        raise HTTPException(400, "Name the field")
    kind = body.kind if body.kind in KINDS else "text"
    pos = db.scalar(select(func.coalesce(func.max(X.CustomField.position), -1))) + 1
    f = X.CustomField(name=body.name.strip()[:120], kind=kind, options=json.dumps(body.options or []), position=pos)
    db.add(f)
    db.commit()
    return field_out(f)


@router.patch("/custom-fields/{fid}")
def edit_field(fid: int, body: FieldIn, db: Session = Depends(get_db), user=Depends(current_user)):
    f = get_or_404(db, X.CustomField, fid, "Field")
    if body.name is not None and body.name.strip():
        f.name = body.name.strip()[:120]
    if body.kind in KINDS:
        f.kind = body.kind
    if body.options is not None:
        f.options = json.dumps(body.options)
    if body.position is not None:
        f.position = body.position
    db.commit()
    return field_out(f)


@router.delete("/custom-fields/{fid}")
def delete_field(fid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    db.delete(get_or_404(db, X.CustomField, fid, "Field"))
    db.commit()
    return {"ok": True}


def save_values(db, task, values: dict):
    names = {f.id: f.name for f in db.scalars(select(X.CustomField))}
    changed = []
    for k, v in values.items():
        fid = int(k)
        if fid not in names:
            continue
        row = db.scalar(select(X.TaskFieldValue).where(X.TaskFieldValue.task_id == task.id, X.TaskFieldValue.field_id == fid))
        v = None if v in ("", None) else str(v)[:5000]
        if row and row.value == v:
            continue
        if row:
            row.value = v
        else:
            db.add(X.TaskFieldValue(task_id=task.id, field_id=fid, value=v))
        changed.append(names[fid])
    return changed


@router.put("/tasks/{tid}/custom")
def set_task_fields(tid: int, body: ValuesIn, db: Session = Depends(get_db), user=Depends(current_user)):
    t = get_or_404(db, models.Task, tid, "Task")
    changed = save_values(db, t, body.values)
    if changed:
        log(db, user, "changed " + ", ".join(changed), t.project_id, t.id)
    db.commit()
    return T.task_full(db, t, user)


# ---------------- workflows ----------------
def wf_out(db, w):
    stages = db.scalars(select(X.WorkflowStage).where(X.WorkflowStage.workflow_id == w.id)
                        .order_by(X.WorkflowStage.position, X.WorkflowStage.id)).all()
    pids = db.scalars(select(X.WorkflowProject.project_id).where(X.WorkflowProject.workflow_id == w.id)).all()
    return {"id": w.id, "name": w.name, "project_ids": list(pids),
            "stages": [{"id": s.id, "name": s.name, "color": s.color, "position": s.position, "is_done": s.is_done} for s in stages]}


def set_projects(db, w, ids):
    db.execute(delete(X.WorkflowProject).where(X.WorkflowProject.workflow_id == w.id))
    for pid in set(ids):
        db.add(X.WorkflowProject(workflow_id=w.id, project_id=pid))


@router.get("/workflows")
def list_workflows(db: Session = Depends(get_db), user=Depends(current_user)):
    return [wf_out(db, w) for w in db.scalars(select(X.Workflow).order_by(X.Workflow.name))]


@router.post("/workflows")
def add_workflow(body: WorkflowIn, db: Session = Depends(get_db), user=Depends(current_user)):
    if not (body.name or "").strip():
        raise HTTPException(400, "Name the workflow")
    w = X.Workflow(name=body.name.strip()[:120])
    db.add(w)
    db.flush()
    stages = body.stages or [{"name": "To do", "color": "#ec4899"}, {"name": "In progress", "color": "#f59e0b"},
                             {"name": "Review", "color": "#8b5cf6"}, {"name": "Done", "color": "#10b981", "is_done": True}]
    for i, s in enumerate(stages):
        db.add(X.WorkflowStage(workflow_id=w.id, name=str(s.get("name") or f"Stage {i + 1}")[:80],
                               color=s.get("color") or "#94a3b8", position=i, is_done=bool(s.get("is_done"))))
    set_projects(db, w, body.project_ids or [])
    db.commit()
    return wf_out(db, w)


@router.patch("/workflows/{wid}")
def edit_workflow(wid: int, body: WorkflowIn, db: Session = Depends(get_db), user=Depends(current_user)):
    w = get_or_404(db, X.Workflow, wid, "Workflow")
    if body.name and body.name.strip():
        w.name = body.name.strip()[:120]
    if body.project_ids is not None:
        set_projects(db, w, body.project_ids)
    db.commit()
    return wf_out(db, w)


@router.delete("/workflows/{wid}")
def delete_workflow(wid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    db.delete(get_or_404(db, X.Workflow, wid, "Workflow"))
    db.commit()
    return {"ok": True}


@router.post("/workflows/{wid}/stages")
def add_stage(wid: int, body: StageIn, db: Session = Depends(get_db), user=Depends(current_user)):
    w = get_or_404(db, X.Workflow, wid, "Workflow")
    pos = db.scalar(select(func.coalesce(func.max(X.WorkflowStage.position), -1)).where(X.WorkflowStage.workflow_id == wid)) + 1
    db.add(X.WorkflowStage(workflow_id=wid, name=(body.name or "New stage").strip()[:80], color=body.color or "#94a3b8",
                           position=pos, is_done=bool(body.is_done)))
    db.commit()
    return wf_out(db, w)


@router.patch("/workflow-stages/{sid}")
def edit_stage(sid: int, body: StageIn, db: Session = Depends(get_db), user=Depends(current_user)):
    s = get_or_404(db, X.WorkflowStage, sid, "Stage")
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(s, k, v.strip()[:80] if k == "name" else v)
    db.commit()
    return wf_out(db, db.get(X.Workflow, s.workflow_id))


@router.delete("/workflow-stages/{sid}")
def delete_stage(sid: int, db: Session = Depends(get_db), user=Depends(current_user)):
    s = get_or_404(db, X.WorkflowStage, sid, "Stage")
    w = db.get(X.Workflow, s.workflow_id)
    if db.scalar(select(func.count()).select_from(X.WorkflowStage).where(X.WorkflowStage.workflow_id == w.id)) <= 1:
        raise HTTPException(400, "A workflow needs at least one stage")
    db.delete(s)
    db.commit()
    return wf_out(db, w)


@router.post("/workflows/{wid}/stages/reorder")
def reorder_stages(wid: int, body: ReorderIn, db: Session = Depends(get_db), user=Depends(current_user)):
    w = get_or_404(db, X.Workflow, wid, "Workflow")
    for i, sid in enumerate(body.ids):
        s = db.get(X.WorkflowStage, sid)
        if s and s.workflow_id == wid:
            s.position = i
    db.commit()
    return wf_out(db, w)


@router.get("/workflows/{wid}/board")
def workflow_board(wid: int, q: str | None = None, assignee: str | None = None, project_id: str | None = None,
                   priority: str | None = None, tags: str | None = None, due: str | None = None,
                   db: Session = Depends(get_db), user=Depends(current_user)):
    w = get_or_404(db, X.Workflow, wid, "Workflow")
    info = wf_out(db, w)
    if not info["stages"]:
        return {**info, "tasks": []}
    pids = info["project_ids"]
    if project_id:
        pids = [p for p in pids if str(p) in project_id.split(",")] if pids else [int(x) for x in project_id.split(",") if x.isdigit()]
    if not pids:
        return {**info, "tasks": []}
    stmt = T.filtered_query(user, assignee=assignee, project_id=",".join(map(str, pids)), status="all", priority=priority,
                            tags=tags, due=due, q=q)
    tasks = list(db.scalars(stmt.order_by(*T.sort_clause("due", "asc"))).all())
    rows = T.enrich(db, tasks, user)
    placed = dict(db.execute(select(X.TaskStage.task_id, X.TaskStage.stage_id).where(
        X.TaskStage.workflow_id == wid, X.TaskStage.task_id.in_([t.id for t in tasks] or [0]))).all())
    first = info["stages"][0]["id"]
    done = next((s["id"] for s in info["stages"] if s["is_done"]), info["stages"][-1]["id"])
    stage_ids = {s["id"] for s in info["stages"]}
    for r in rows:
        sid = placed.get(r["id"])
        r["stage_id"] = sid if sid in stage_ids else (done if r["status"] == "completed" else first)
    return {**info, "tasks": rows}


@router.post("/tasks/{tid}/stage")
def move_to_stage(tid: int, body: MoveStageIn, db: Session = Depends(get_db), user=Depends(current_user)):
    t = get_or_404(db, models.Task, tid, "Task")
    s = get_or_404(db, X.WorkflowStage, body.stage_id, "Stage")
    if s.workflow_id != body.workflow_id:
        raise HTTPException(400, "That stage belongs to another workflow")
    row = db.scalar(select(X.TaskStage).where(X.TaskStage.task_id == tid, X.TaskStage.workflow_id == body.workflow_id))
    if row:
        row.stage_id = s.id
    else:
        db.add(X.TaskStage(task_id=tid, workflow_id=body.workflow_id, stage_id=s.id))
    log(db, user, f"moved to stage {s.name}", t.project_id, t.id)
    if s.is_done and t.status != "completed":
        T.apply_update(db, t, {"status": "completed"}, user)
    elif not s.is_done and t.status == "completed":
        T.apply_update(db, t, {"status": "in_progress"}, user)
    db.commit()
    return {"ok": True}


@router.get("/settings/email")
def email_status(user=Depends(current_user)):
    return {"configured": smtp_configured()}
