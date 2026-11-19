"""Automations engine (Teamwork "Create automation": When <trigger> [and conditions] Then <actions>).

A rule (models.Automation) keeps its trigger key in `trigger`, the first action key in `action` (for icons and
old code) and everything else in `config` (JSON):
    {"trigger_cfg": {...}, "projects": "all" | [ids], "conditions": [{field, op, value}],
     "actions": [{"type": key, "cfg": {...}}]}
Old rules without config still work: their trigger_value / action_value are read as before.
"""
import json
import re
import threading
import time
import urllib.request
from datetime import date, datetime, timedelta

from sqlalchemy import func, or_, select

from . import models
from . import task_extras_models as X

# ------------------------------------------------------------------ catalogs (order = Teamwork's menus)
TRIGGERS = [
    # key, label, group, entity
    ("task_created", "Task added", "Task", "task"),
    ("task_completed", "Task completed", "Task", "task"),
    ("stage_changed", "Task stage changes", "Task", "task"),
    ("list_changed", "Task list changes", "Task", "task"),
    ("task_inactive", "Task inactive", "Task", "task"),
    ("due_arrives", "Task due date arrives", "Task", "task"),
    ("start_arrives", "Task start date arrives", "Task", "task"),
    ("due_changed", "Task due date changes", "Task", "task"),
    ("start_changed", "Task start date changes", "Task", "task"),
    ("name_changed", "Task name changes", "Task", "task"),
    ("task_updated", "Task updated", "Task", "task"),
    ("description_changed", "Task description changes", "Task", "task"),
    ("task_unblocked", "Task unblocked", "Task", "task"),
    ("tag_added", "Task tag added", "Task", "task"),
    ("tag_removed", "Task tag removed", "Task", "task"),
    ("custom_field_changed", "Task custom field changes", "Task", "task"),
    ("estimate_exceeds", "Task estimated time exceeds", "Task", "task"),
    ("time_exceeds", "Task logged time/estimated time", "Task", "task"),
    ("time_logged", "Task time logged", "Task", "task"),
    ("time_removed", "Task time removed", "Task", "task"),
    ("assignee_added", "Task assignee added", "Task", "task"),
    ("assignee_removed", "Task assignee removed", "Task", "task"),
    ("progress_exceeds", "Task progress exceeds", "Task", "task"),
    ("comment_added", "Task comment added", "Task", "task"),
    ("priority_changed", "Task priority changes", "Task", "task"),
    ("milestone_added", "Milestone added", "Milestone", "milestone"),
    ("milestone_updated", "Milestone updated", "Milestone", "milestone"),
    ("milestone_completed", "Milestone completed", "Milestone", "milestone"),
    ("milestone_tag_added", "Milestone tag added", "Milestone", "milestone"),
    ("milestone_tag_removed", "Milestone tag removed", "Milestone", "milestone"),
    ("milestone_comment_added", "Milestone comment added", "Milestone", "milestone"),
    ("milestone_assignee_added", "Milestone assignee added", "Milestone", "milestone"),
    ("milestone_assignee_removed", "Milestone assignee removed", "Milestone", "milestone"),
    ("milestone_list_attached", "Milestone task list attached", "Milestone", "milestone"),
    ("milestone_list_detached", "Milestone task list detached", "Milestone", "milestone"),
    ("milestone_due_arrives", "Milestone due date arrives", "Milestone", "milestone"),
    ("project_added", "Project added", "Project", "project"),
    ("project_portfolio_changed", "Project portfolio column changes", "Project", "project"),
    ("project_updated", "Project updated", "Project", "project"),
    ("project_name_changed", "Project name changes", "Project", "project"),
    ("project_description_changed", "Project description changes", "Project", "project"),
    ("project_category_changed", "Project category changes", "Project", "project"),
    ("project_owner_changed", "Project owner changes", "Project", "project"),
    ("project_company_changed", "Project company changes", "Project", "project"),
    ("project_confirmed", "Project confirmed", "Project", "project"),
    ("project_completed", "Project completed", "Project", "project"),
    ("project_start_arrives", "Project start date arrives", "Project", "project"),
    ("project_end_arrives", "Project end date arrives", "Project", "project"),
    ("project_tag_added", "Project tag added", "Project", "project"),
    ("project_tag_removed", "Project tag removed", "Project", "project"),
    ("people_added", "People added", "Project", "project"),
    ("people_removed", "People removed", "Project", "project"),
    ("project_start_changed", "Project start date changes", "Project", "project"),
    ("project_end_changed", "Project end date changes", "Project", "project"),
    ("every_day", "Every day", "General", "none"),
]
# kept so rules made before the rebuild still read and run
LEGACY_TRIGGERS = {"assignee_changed": "Task assignees change", "progress_changed": "Task progress changes"}

ACTIONS = [
    ("add_comment", "Add task comment", "Task"),
    ("add_followers", "Change task followers", "Task"),
    ("assign", "Change task assignees", "Task"),
    ("set_status", "Move task to stage", "Task"),
    ("move_list", "Move to task list", "Task"),
    ("copy_list", "Copy to task list", "Task"),
    ("set_start", "Change task start date", "Task"),
    ("set_due", "Change task due date", "Task"),
    ("add_tag", "Change task tags", "Task"),
    ("add_task", "Add task", "Task"),
    ("add_subtask", "Add subtask", "Task"),
    ("add_from_template", "Add tasks from template", "Task"),
    ("complete", "Complete task", "Task"),
    ("set_estimate", "Change task estimated time", "Task"),
    ("log_time", "Log task time", "Task"),
    ("set_priority", "Change task priority", "Task"),
    ("set_name", "Update task name", "Task"),
    ("set_description", "Update task description", "Task"),
    ("set_progress", "Change task progress", "Task"),
    ("set_custom_field", "Set task custom field", "Task"),
    ("uncomplete", "Uncomplete task", "Task"),
    ("add_milestone", "Add milestone", "Milestone"),
    ("create_project", "Create project", "Project"),
    ("notify", "Notify people", "General"),
    ("http_request", "Send HTTP request", "General"),
    ("chat_message", "Send Chat message to channel", "Chat"),
    ("slack_message", "Send Slack message to channel", "Slack"),
]
TRIGGER_LABEL = {k: l for k, l, *_ in TRIGGERS} | LEGACY_TRIGGERS
TRIGGER_ENTITY = {k: e for k, _, _, e in TRIGGERS} | {k: "task" for k in LEGACY_TRIGGERS}
ACTION_LABEL = {k: l for k, l, _ in ACTIONS}
TASK_ACTIONS = {k for k, _, g in ACTIONS if g == "Task"}
SCHEDULED = {"due_arrives", "start_arrives", "task_inactive", "milestone_due_arrives", "project_start_arrives",
             "project_end_arrives", "every_day"}

# placeholders usable in Notify / comment / HTTP payload text, e.g. "{Task name}"
PLACEHOLDERS = {
    "Trigger task": ["Task name", "Task description", "Creator name", "Creator email", "Date created", "Task link",
                     "Due date", "Start date", "Date updated", "Assignee", "Priority", "Progress", "Estimated time",
                     "Tags", "Task list", "Task project", "Newest comment", "Stage"],
    "Trigger user": ["First name", "Name", "Email"],
}
STATUS_LABEL = {"backlog": "Backlog", "new": "To do", "in_progress": "In progress", "completed": "Completed"}


def meta():
    return {
        "triggers": [{"key": k, "label": l, "group": g, "entity": e} for k, l, g, e in TRIGGERS],
        "actions": [{"key": k, "label": l, "group": g} for k, l, g in ACTIONS],
        "placeholders": PLACEHOLDERS,
        # flat maps keep the Templates / Manage tabs working
        "trigger_labels": TRIGGER_LABEL, "action_labels": ACTION_LABEL,
    }


# ------------------------------------------------------------------ helpers
def _ids(v):
    if isinstance(v, list):
        return [int(x) for x in v if str(x).strip().lstrip("-").isdigit()]
    return [int(x) for x in re.split(r"[,\s]+", str(v or "")) if x.strip().isdigit()]


def _texts(v):
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    return [x.strip() for x in str(v or "").split(",") if x.strip()]


def _tags(s):
    return [x for x in (s or "").split(",") if x]


def rule_config(r):
    """Normalised config for a rule (also upgrades rules saved before the rebuild)."""
    try:
        cfg = json.loads(r.config) if getattr(r, "config", None) else {}
    except ValueError:
        cfg = {}
    cfg = dict(cfg or {})
    if not cfg.get("actions"):
        cfg["actions"] = [{"type": r.action, "cfg": {"legacy": r.action_value or ""}}]
    if "projects" not in cfg:
        cfg["projects"] = [r.project_id] if r.project_id else "all"
    tc = dict(cfg.get("trigger_cfg") or {})
    if r.trigger_value and "legacy" not in tc:
        tc["legacy"] = r.trigger_value
    cfg["trigger_cfg"] = tc
    cfg.setdefault("conditions", [])
    return cfg


def _in_projects(cfg, project_id):
    ps = cfg.get("projects")
    if ps in (None, "all", []):
        return True
    return project_id in _ids(ps)


def task_assignees(db, t):
    ids = [t.assignee_id] if t.assignee_id else []
    ids += [u for u in db.scalars(select(models.TaskAssignee.user_id).where(models.TaskAssignee.task_id == t.id)) if u not in ids]
    return ids


def task_followers(db, t):
    return list(db.scalars(select(models.TaskFollower.user_id).where(models.TaskFollower.task_id == t.id)))


def set_task_assignees(db, t, ids):
    ids = [i for i in dict.fromkeys(ids) if i]
    t.assignee_id = ids[0] if ids else None
    db.execute(models.TaskAssignee.__table__.delete().where(models.TaskAssignee.task_id == t.id))
    for uid in ids[1:]:
        db.add(models.TaskAssignee(task_id=t.id, user_id=uid))


def logged_minutes(db, t, billable_only=False):
    q = select(func.coalesce(func.sum(models.TimeEntry.minutes), 0)).where(models.TimeEntry.task_id == t.id)
    if billable_only:
        q = q.where(models.TimeEntry.billable.is_(True))
    return int(db.scalar(q) or 0)


def _stage_name(db, t):
    row = db.scalar(select(X.TaskStage).where(X.TaskStage.task_id == t.id))
    if row:
        s = db.get(X.WorkflowStage, row.stage_id)
        if s:
            return s.name
    return STATUS_LABEL.get(t.status, t.status)


def render(text, db, task=None, actor=None, project=None, milestone=None):
    """Fill {Placeholder} tokens."""
    if not text:
        return text or ""
    vals = {}
    if task is not None:
        creator = db.get(models.User, task.created_by_id) if task.created_by_id else None
        names = [u.name for u in db.scalars(select(models.User).where(models.User.id.in_(task_assignees(db, task) or [0])))]
        last = db.scalar(select(models.Comment).where(models.Comment.task_id == task.id).order_by(models.Comment.id.desc()))
        tl = db.get(models.TaskList, task.tasklist_id) if task.tasklist_id else None
        pr = db.get(models.Project, task.project_id)
        est = task.estimate_minutes or 0
        vals.update({
            "Task name": task.title, "Task description": task.description or "",
            "Creator name": creator.name if creator else "", "Creator email": creator.email if creator else "",
            "Date created": task.created_at.strftime("%d %b %Y") if task.created_at else "",
            "Task link": f"/tasks/{task.id}", "Due date": task.due_date.isoformat() if task.due_date else "",
            "Start date": task.start_date.isoformat() if task.start_date else "",
            "Date updated": task.updated_at.strftime("%d %b %Y") if task.updated_at else "",
            "Assignee": ", ".join(names), "Priority": task.priority or "none", "Progress": f"{task.progress or 0}%",
            "Estimated time": f"{est // 60}h {est % 60}m" if est else "", "Tags": ", ".join(_tags(task.tags)),
            "Task list": tl.name if tl else "", "Task project": pr.name if pr else "",
            "Newest comment": last.body if last else "", "Stage": _stage_name(db, task),
        })
    if project is not None:
        vals.setdefault("Task project", project.name)
        vals["Project name"] = project.name
    if milestone is not None:
        vals["Milestone name"] = milestone.name
    if actor is not None:
        vals.update({"First name": actor.name.split(" ")[0], "Name": actor.name, "Email": actor.email})
    return re.sub(r"\{([^{}]+)\}", lambda m: str(vals.get(m.group(1).strip(), m.group(0))), text)


# ------------------------------------------------------------------ trigger filters
def _list_match(want, have):
    want = [str(x).lower() for x in (want or []) if str(x) not in ("", "any")]
    if not want:
        return True
    have = [str(x).lower() for x in (have if isinstance(have, (list, set, tuple)) else [have])]
    return any(w in have for w in want)


def _contains(opts, text):
    opts = _texts(opts)
    return not opts or any(o.lower() in (text or "").lower() for o in opts)


def trigger_matches(trigger, tc, ctx):
    """tc = trigger settings from the builder, ctx = what happened."""
    if tc.get("legacy") and ctx.get("value") is not None:  # rules from before the rebuild
        if tc["legacy"].strip().lower() not in [x.strip().lower() for x in str(ctx["value"]).split(",")]:
            return False
    if trigger == "task_created":
        return tc.get("added_via", "any") in ("any", "", None) or tc.get("added_via") == ctx.get("via", "app")
    if trigger in ("stage_changed",):
        if tc.get("mode") == "workflow":
            if ctx.get("kind") != "workflow" or (tc.get("workflow_id") and int(tc["workflow_id"]) != ctx.get("workflow_id")):
                return False
        elif tc.get("mode") == "project" and ctx.get("kind") == "workflow":
            return False
        return _list_match(tc.get("from"), ctx.get("from")) and _list_match(tc.get("to"), ctx.get("to"))
    if trigger in ("priority_changed", "project_category_changed", "project_owner_changed", "project_company_changed",
                   "project_portfolio_changed"):
        return _list_match(tc.get("from"), ctx.get("from")) and _list_match(tc.get("to"), ctx.get("to"))
    if trigger == "list_changed":
        return _list_match(_ids(tc.get("tasklist_ids")), ctx.get("to"))
    if trigger in ("name_changed", "description_changed", "project_name_changed", "project_description_changed"):
        return _contains(tc.get("contains"), ctx.get("text"))
    if trigger in ("tag_added", "tag_removed", "milestone_tag_added", "milestone_tag_removed", "project_tag_added",
                   "project_tag_removed"):
        return _list_match(_texts(tc.get("tags")), ctx.get("tags") or [])
    if trigger == "custom_field_changed":
        return not tc.get("field_id") or int(tc["field_id"]) in (ctx.get("field_ids") or [])
    if trigger in ("time_logged", "time_removed"):
        return not tc.get("billable_only") or ctx.get("billable")
    if trigger in ("assignee_added", "assignee_removed", "milestone_assignee_added", "milestone_assignee_removed",
                   "people_added", "people_removed"):
        return _list_match(_ids(tc.get("people")), ctx.get("user_ids") or [])
    if trigger == "progress_exceeds":
        p = int(tc.get("percent") or 0)
        return (ctx.get("from") or 0) <= p < (ctx.get("to") or 0)
    if trigger == "estimate_exceeds":
        m = int(tc.get("minutes") or 0)
        return (ctx.get("from") or 0) <= m < (ctx.get("to") or 0)
    if trigger == "time_exceeds":
        est = ctx.get("estimate") or 0
        if not est:
            return False
        before, after = (ctx.get("billable_before"), ctx.get("billable_after")) if tc.get("billable_only") else (ctx.get("before"), ctx.get("after"))
        if tc.get("mode") == "percent":
            line = est * int(tc.get("percent") or 0) / 100
            return before < line <= after if line else after > 0
        line = est + int(tc.get("minutes") or 0)
        return before <= line < after
    if trigger == "comment_added" or trigger == "milestone_comment_added":
        authors = _ids(tc.get("authors"))
        return (not authors or ctx.get("author_id") in authors) and _contains(tc.get("contains"), ctx.get("text"))
    if trigger in ("milestone_list_attached", "milestone_list_detached"):
        return _list_match(_ids(tc.get("tasklist_ids")), ctx.get("tasklist_id"))
    return True


# ------------------------------------------------------------------ conditions
NUM_OPS = {"eq": lambda a, b: a == b, "ne": lambda a, b: a != b, "lt": lambda a, b: a < b, "gt": lambda a, b: a > b,
           "le": lambda a, b: a <= b, "ge": lambda a, b: a >= b}


def _set_op(op, want, have):
    want, have = set(want), set(have)
    if op == "set":
        return bool(have)
    if op == "not_set":
        return not have
    if op == "any_of":
        return bool(want & have)
    if op == "all_of":
        return bool(want) and want <= have
    if op == "not_any_of":
        return not (want & have)
    if op == "not_all_of":
        return not (want and want <= have)
    return True


def _num_op(op, value, have):
    if op == "set":
        return bool(have)
    if op == "not_set":
        return not have
    if op == "added":
        return bool(have)
    try:
        v = float(value or 0)
    except (TypeError, ValueError):
        v = 0
    return NUM_OPS.get(op, NUM_OPS["eq"])(float(have or 0), v)


def condition_ok(db, c, task, actor, ctx):
    f, op, v = c.get("field"), c.get("op") or "any_of", c.get("value")
    if task is None:
        if f == "trigger_user":
            return _set_op("any_of" if op != "not_any_of" else "not_any_of", _ids(v), [actor.id])
        return True
    if f == "assignee":
        return _set_op(op, _ids(v), task_assignees(db, task))
    if f == "follower":
        return _set_op(op, _ids(v), task_followers(db, task))
    if f == "priority":
        have = [task.priority] if task.priority and task.priority != "none" else []
        return _set_op(op, _texts(v), have) if op in ("set", "not_set") else _set_op(op, _texts(v), [task.priority or "none"])
    if f == "tag":
        return _set_op(op, [x.lower() for x in _texts(v)], [x.lower() for x in _tags(task.tags)])
    if f == "stage":
        have = [task.status] if task.status else []
        return _set_op(op, _texts(v), have)
    if f == "trigger_user":
        return (actor.id in _ids(v)) != (op == "not_any_of")
    if f == "task_list":
        return (task.tasklist_id in _ids(v)) != (op == "not_any_of")
    if f == "progress":
        return _num_op(op, v, task.progress or 0)
    if f == "time_estimate":
        return _num_op(op, v, task.estimate_minutes or 0)
    if f == "logged_time":
        return _num_op(op, v, logged_minutes(db, task))
    if f in ("start_date", "due_date"):
        have = task.start_date if f == "start_date" else task.due_date
        if op in ("set", "not_set"):
            return bool(have) == (op == "set")
        if not have:
            return False
        val = v or {}
        ref = date.today() if (val.get("source") if isinstance(val, dict) else None) == "trigger" else None
        if ref is None:
            try:
                ref = date.fromisoformat(str(val.get("date") if isinstance(val, dict) else val)[:10])
            except ValueError:
                return False
        return NUM_OPS.get(op, NUM_OPS["eq"])(have, ref)
    if f in ("task_name", "task_description", "project_name", "tasklist_name"):
        text = {"task_name": task.title, "task_description": task.description}.get(f)
        if f == "project_name":
            p = db.get(models.Project, task.project_id)
            text = p.name if p else ""
        if f == "tasklist_name":
            tl = db.get(models.TaskList, task.tasklist_id) if task.tasklist_id else None
            text = tl.name if tl else ""
        return _contains(v, text or "") if _texts(v) else True
    if f in ("is_blocked", "is_completed", "is_subtask", "has_desk_tickets", "has_reminders"):
        want = v not in (False, "false", "False", 0, "0")
        have = False
        if f == "is_completed":
            have = task.status == "completed"
        elif f == "is_subtask":
            have = bool(task.parent_id)
        elif f == "has_reminders":
            have = bool(db.scalar(select(func.count(models.TaskReminder.id)).where(models.TaskReminder.task_id == task.id)))
        elif f == "is_blocked":
            deps = db.scalars(select(models.TaskDependency.depends_on_id).where(models.TaskDependency.task_id == task.id)).all()
            have = bool(deps) and bool(db.scalar(select(func.count(models.Task.id)).where(
                models.Task.id.in_(deps), models.Task.status != "completed")))
        return have == want
    if f == "created_by":
        return (task.created_by_id in _ids(v)) != (op == "ne")
    if f == "comments":
        rows = db.scalars(select(models.Comment).where(models.Comment.task_id == task.id).order_by(models.Comment.id)).all()
        if op == "has_any":
            return bool(rows)
        if op == "has_none":
            return not rows
        if op in ("more_than", "less_than"):
            n = int((v if not isinstance(v, list) else (v[0] if v else 0)) or 0)
            return len(rows) > n if op == "more_than" else len(rows) < n
        if op == "from":
            return bool({r.user_id for r in rows} & set(_ids(v)))
        if op == "last_contains":
            return bool(rows) and _contains(v, rows[-1].body)
        return any(_contains(v, r.body) for r in rows) if _texts(v) else bool(rows)
    if f == "attachments":
        names = list(db.scalars(select(models.FileItem.original_name).where(models.FileItem.task_id == task.id)))
        if op == "has_any":
            return bool(names)
        if op == "has_none":
            return not names
        if op in ("more_than", "less_than"):
            n = int((v if not isinstance(v, list) else (v[0] if v else 0)) or 0)
            return len(names) > n if op == "more_than" else len(names) < n
        return any(_contains(v, n) for n in names)
    if f == "custom_field":
        val = v if isinstance(v, dict) else {}
        fid = val.get("field_id")
        if not fid:
            return True
        row = db.scalar(select(X.TaskFieldValue).where(X.TaskFieldValue.task_id == task.id, X.TaskFieldValue.field_id == int(fid)))
        have = (row.value if row else None) or ""
        if op == "set":
            return bool(have)
        if op == "not_set":
            return not have
        if op == "contains":
            return str(val.get("value") or "").lower() in have.lower()
        return have.lower() == str(val.get("value") or "").lower()
    return True


# ------------------------------------------------------------------ actions
def _people(db, cfg, task, actor, project=None, key="people", mode_key="people_mode"):
    mode = cfg.get(mode_key) or "selected"
    if mode in ("trigger_user", "user_who_completed_trigger"):
        return [actor.id]
    if mode == "project_owner":
        p = project or (db.get(models.Project, task.project_id) if task else None)
        return [p.owner_id] if p and p.owner_id else []
    if mode == "task_assignees":
        return task_assignees(db, task) if task else []
    if mode == "task_followers":
        return task_followers(db, task) if task else []
    if mode == "task_creator":
        return [task.created_by_id] if task and task.created_by_id else []
    return _ids(cfg.get(key))


def _skip_weekends(d, skip):
    if skip and d:
        while d.weekday() >= 5:
            d += timedelta(days=1)
    return d


def _date_from(cfg, task, prefix=""):
    """Teamwork's date options: Days after trigger date, On trigger date, Choose date, Remove date,
    Start date - from the task, Due date - from the task. Returns (date|None, remove_flag)."""
    mode = cfg.get(prefix + "mode") or "on_trigger"
    skip = cfg.get(prefix + "skip_weekends") or cfg.get("skip_weekends")
    n = int(cfg.get(prefix + "days") or 0)
    unit = 7 if cfg.get(prefix + "unit") == "week" else 1
    sign = -1 if cfg.get(prefix + "dir") == "before" else 1
    if mode == "remove":
        return None, True
    if mode == "choose":
        try:
            return date.fromisoformat(str(cfg.get(prefix + "date"))[:10]), False
        except ValueError:
            return None, False
    if mode == "days_after":
        return _skip_weekends(date.today() + timedelta(days=n * unit), skip), False
    if mode in ("from_start", "from_due"):
        base = (task.start_date if mode == "from_start" else task.due_date) if task else None
        if not base:
            return None, False
        return _skip_weekends(base + timedelta(days=sign * n * unit), skip), False
    return _skip_weekends(date.today(), skip), False


def _targets(db, cfg, task):
    tgt = (cfg or {}).get("target") or "trigger"
    if task is None:
        return []
    if tgt == "parent":
        p = db.get(models.Task, task.parent_id) if task.parent_id else None
        return [p] if p else []
    if tgt == "subtasks":
        return list(db.scalars(select(models.Task).where(models.Task.parent_id == task.id)))
    return [task]


def _new_task(db, project_id, tasklist_id, title, actor, **kw):
    if not tasklist_id:
        tl = db.scalar(select(models.TaskList).where(models.TaskList.project_id == project_id).order_by(models.TaskList.position))
        tasklist_id = tl.id if tl else None
    t = models.Task(project_id=project_id, tasklist_id=tasklist_id, title=(title or "New task")[:300],
                    created_by_id=actor.id, **kw)
    db.add(t)
    db.flush()
    return t


def _http(url, method, headers, payload):
    def go():
        try:
            data = payload.encode() if payload and method in ("POST", "PUT", "PATCH", "DELETE") else None
            req = urllib.request.Request(url, data=data, method=method)
            for k, v in headers:
                if k:
                    req.add_header(k, v)
            if data and not any(k.lower() == "content-type" for k, _ in headers):
                req.add_header("Content-Type", "application/json")
            urllib.request.urlopen(req, timeout=10).read(1000)
        except Exception:  # noqa: BLE001 - an outside server failing must not break Crewdesk
            pass
    threading.Thread(target=go, daemon=True).start()


def apply_action(db, rule, act, task, actor, project=None, milestone=None):
    a, cfg = act.get("type"), dict(act.get("cfg") or {})
    legacy = cfg.get("legacy")
    if legacy is not None:
        return _legacy_action(db, rule, a, legacy, task, actor)
    txt = lambda s: render(s, db, task, actor, project, milestone)  # noqa: E731
    if a in TASK_ACTIONS and task is None and a not in ("add_task",):
        return f"{ACTION_LABEL.get(a, a)}: skipped (no task)"
    if a == "notify":
        uids = _people(db, cfg, task, actor, project)
        if cfg.get("skip_trigger_user"):
            uids = [u for u in uids if u != actor.id]
        title, msg = txt(cfg.get("title") or rule.name), txt(cfg.get("message") or "")
        link = f"/tasks/{task.id}" if task else (f"/projects/{project.id}" if project else None)
        for uid in dict.fromkeys(uids):
            db.add(models.Notification(user_id=uid, actor_id=actor.id, kind="automation",
                                       message=(f"{title}: {msg}" if msg else title)[:500], link=link))
        return f"notified {len(set(uids))} people"
    if a == "http_request":
        url = (cfg.get("url") or "").strip()
        if not re.match(r"^https?://", url):
            return "HTTP request: no valid URL"
        method = (cfg.get("method") or "POST").upper()
        _http(url, method, [(h[0], txt(h[1])) for h in cfg.get("headers") or [] if isinstance(h, (list, tuple)) and len(h) == 2],
              txt(cfg.get("payload") or ""))
        return f"sent {method} {url[:120]}"
    if a == "chat_message":
        ch = db.get(models.ChatChannel, int(cfg.get("channel_id") or 0)) if cfg.get("channel_id") else None
        if not ch:
            return "chat channel not found"
        db.add(models.ChatMessage(channel_id=ch.id, user_id=actor.id, body=txt(cfg.get("message") or rule.name)))
        return f"posted in #{ch.name}"
    if a == "slack_message":
        url = (cfg.get("webhook_url") or "").strip()
        if not url.startswith("https://hooks.slack.com/"):
            return "Slack: add an incoming webhook URL"
        _http(url, "POST", [], json.dumps({"text": txt(cfg.get("message") or rule.name)}))
        return "sent Slack message"
    if a == "create_project":
        name = txt(cfg.get("name") or "New project")
        owner = (_people(db, cfg, task, actor, project, "owner", "owner_mode") or [actor.id])[0]
        p = models.Project(name=name[:200], description=txt(cfg.get("description") or ""), owner_id=owner,
                           type=(cfg.get("type") or "confirmed").capitalize())
        db.add(p)
        db.flush()
        db.add(models.ProjectMember(project_id=p.id, user_id=owner))
        for i, (n, c) in enumerate([("To do", "#94a3b8"), ("In progress", "#3b82f6"), ("Review", "#f59e0b"), ("Done", "#10b981")]):
            db.add(models.BoardColumn(project_id=p.id, name=n, color=c, position=i))
        tpl = db.get(models.ProjectTemplate, int(cfg["template_id"])) if str(cfg.get("template_id") or "").isdigit() else None
        lists = (json.loads(tpl.content or "{}").get("tasklists") if tpl else None) or [{"name": "General tasks", "tasks": []}]
        for li, tl in enumerate(lists):
            lst = models.TaskList(project_id=p.id, name=tl.get("name") or "Task list", position=li)
            db.add(lst)
            db.flush()
            for ti, it in enumerate(tl.get("tasks") or []):
                db.add(models.Task(project_id=p.id, tasklist_id=lst.id, position=ti, created_by_id=actor.id,
                                   title=(it.get("title") if isinstance(it, dict) else str(it))[:300]))
        if cfg.get("workflow_id"):
            db.add(X.WorkflowProject(workflow_id=int(cfg["workflow_id"]), project_id=p.id))
        return f"created project {p.name}"
    if a == "add_milestone":
        pid = (task.project_id if task else project.id if project else milestone.project_id if milestone else None) \
            if (cfg.get("project_mode") or "trigger") == "trigger" else int(cfg.get("project_id") or 0)
        if not pid:
            return "Add milestone: choose a project"
        due, _ = _date_from(cfg, task, "due_")
        owners = _people(db, cfg, task, actor, project, "assignees", "assignees_mode")
        m = models.Milestone(project_id=pid, name=txt(cfg.get("name") or "Milestone")[:200],
                             description=txt(cfg.get("description") or ""), due_date=due or date.today(),
                             owner_id=owners[0] if owners else None)
        db.add(m)
        db.flush()
        for lid in _ids(cfg.get("tasklist_ids")):
            tl = db.get(models.TaskList, lid)
            if tl:
                tl.milestone_id = m.id
        return f"added milestone {m.name}"
    if a == "add_task":
        pid = int(cfg.get("project_id") or 0) or (task.project_id if task else project.id if project else 0)
        if not pid:
            return "Add task: choose a project"
        nt = _new_task(db, pid, int(cfg.get("tasklist_id") or 0) or (task.tasklist_id if task and task.project_id == pid else None),
                       txt(cfg.get("name") or (f"Follow up: {task.title}" if task else "New task")), actor,
                       description=txt(cfg.get("description") or "") or None, priority=cfg.get("priority") or "none")
        set_task_assignees(db, nt, _people(db, cfg, task, actor, project, "assignees", "assignees_mode"))
        return f"added task {nt.title}"
    out = []
    for t in _targets(db, cfg, task):
        out.append(_task_action(db, rule, a, cfg, t, task, actor, txt))
    return "; ".join(out) or "no target task"


def _task_action(db, rule, a, cfg, t, trigger_task, actor, txt):
    if a == "add_comment":
        body = txt(cfg.get("comment") or "")
        if not body:
            return "no comment text"
        db.add(models.Comment(task_id=t.id, user_id=actor.id, body=body))
        return "added comment"
    if a in ("add_followers", "assign"):
        people = _people(db, cfg, trigger_task, actor)
        have = task_followers(db, t) if a == "add_followers" else task_assignees(db, t)
        opt = cfg.get("option") or "add"
        new = [u for u in have if u not in people] if opt == "remove" else people if opt in ("replace", "reassign") \
            else have + [u for u in people if u not in have]
        if a == "assign":
            set_task_assignees(db, t, new)
            for uid in set(new) - set(have):
                db.add(models.Notification(user_id=uid, actor_id=actor.id, kind="task", link=f"/tasks/{t.id}",
                                           message=f"Automation \"{rule.name}\" assigned you \"{t.title}\""))
        else:
            db.execute(models.TaskFollower.__table__.delete().where(models.TaskFollower.task_id == t.id))
            for uid in dict.fromkeys(new):
                db.add(models.TaskFollower(task_id=t.id, user_id=uid))
        return f"{'assignees' if a == 'assign' else 'followers'}: {opt} {len(people)}"
    if a == "set_status":
        if cfg.get("mode") == "workflow" and cfg.get("stage_id"):
            s = db.get(X.WorkflowStage, int(cfg["stage_id"]))
            if not s:
                return "stage not found"
            row = db.scalar(select(X.TaskStage).where(X.TaskStage.task_id == t.id, X.TaskStage.workflow_id == s.workflow_id))
            if row:
                row.stage_id = s.id
            else:
                db.add(X.TaskStage(task_id=t.id, workflow_id=s.workflow_id, stage_id=s.id))
            if s.is_done:
                t.status, t.progress, t.completed_at = "completed", 100, datetime.utcnow()
            return f"moved to stage {s.name}"
        st = cfg.get("stage")
        if st not in STATUS_LABEL:
            return "choose a stage"
        t.status = st
        if st == "completed":
            t.completed_at, t.progress = datetime.utcnow(), 100
        return f"stage {STATUS_LABEL[st]}"
    if a in ("move_list", "copy_list"):
        tl = db.get(models.TaskList, int(cfg.get("tasklist_id") or 0)) if cfg.get("tasklist_id") else None
        if not tl:
            return "task list not found"
        if a == "move_list":
            t.tasklist_id, t.project_id = tl.id, tl.project_id
            return f"moved to {tl.name}"
        _new_task(db, tl.project_id, tl.id, t.title, actor, description=t.description, priority=t.priority,
                  assignee_id=t.assignee_id, due_date=t.due_date, start_date=t.start_date, tags=t.tags,
                  estimate_minutes=t.estimate_minutes)
        return f"copied to {tl.name}"
    if a in ("set_start", "set_due"):
        d, remove = _date_from(cfg, t)
        if not d and not remove:
            return "no date"
        if a == "set_start":
            t.start_date = d
        else:
            t.due_date = d
        return f"{'start' if a == 'set_start' else 'due'} date {d.isoformat() if d else 'removed'}"
    if a == "add_tag":
        tags, want = _tags(t.tags), _texts(cfg.get("tags"))
        opt = cfg.get("option") or "add"
        if opt == "remove":
            tags = [x for x in tags if x.lower() not in [w.lower() for w in want]]
        elif opt == "replace":
            tags = want
        else:
            tags += [w for w in want if w not in tags]
        t.tags = ",".join(tags)[:255]
        return f"tags {opt} {', '.join(want)}"
    if a == "add_subtask":
        parent = t if (cfg.get("parent_mode") or "trigger") == "trigger" else \
            db.get(models.Task, int(cfg.get("parent_id") or 0)) if cfg.get("parent_id") else None
        if not parent:
            return "Add subtask: choose a parent task"
        start = _date_from(cfg, t, "start_")[0] if cfg.get("start_mode") else None
        due = _date_from(cfg, t, "due_")[0] if cfg.get("due_mode") else None
        st = _new_task(db, parent.project_id, parent.tasklist_id, txt(cfg.get("name") or "Subtask"), actor,
                       parent_id=parent.id, description=txt(cfg.get("description") or "") or None,
                       priority=cfg.get("priority") or "none", start_date=start, due_date=due,
                       tags=",".join(_texts(cfg.get("tags"))) or None, estimate_minutes=int(cfg.get("estimate") or 0) or None)
        set_task_assignees(db, st, _people(db, cfg, t, actor, None, "assignees", "assignees_mode"))
        for uid in _people(db, cfg, t, actor, None, "followers", "followers_mode"):
            db.add(models.TaskFollower(task_id=st.id, user_id=uid))
        if cfg.get("notify"):
            for uid in task_assignees(db, st):
                db.add(models.Notification(user_id=uid, actor_id=actor.id, kind="task", link=f"/tasks/{st.id}",
                                           message=f"You were assigned subtask \"{st.title}\""))
        return f"added subtask {st.title}"
    if a == "add_from_template":
        tpl = db.get(models.ProjectTemplate, int(cfg.get("template_id") or 0)) if cfg.get("template_id") else None
        if not tpl:
            return "choose a template"
        items = [it for tl in (json.loads(tpl.content or "{}").get("tasklists") or []) for it in (tl.get("tasks") or [])]
        loc = cfg.get("location") or "trigger"
        tl_id = int(cfg.get("tasklist_id") or 0) or t.tasklist_id
        pid = int(cfg.get("project_id") or 0) or t.project_id
        n = 0
        for it in items:
            title = it.get("title") if isinstance(it, dict) else str(it)
            nt = _new_task(db, pid if loc != "trigger" else t.project_id, tl_id if loc != "trigger" else t.tasklist_id,
                           title, actor, parent_id=t.id if loc == "trigger" else None)
            if cfg.get("notify"):
                set_task_assignees(db, nt, task_assignees(db, t))
            n += 1
        return f"added {n} tasks from {tpl.name}"
    if a in ("complete", "uncomplete"):
        if a == "complete":
            t.status, t.progress, t.completed_at = "completed", 100, datetime.utcnow()
        else:
            t.status, t.completed_at = "in_progress", None
            if t.progress == 100:
                t.progress = 0
        return "completed task" if a == "complete" else "reopened task"
    if a == "set_estimate":
        mins = logged_minutes(db, t) if cfg.get("time_mode") == "logged" else int(cfg.get("minutes") or 0)
        opt = cfg.get("option") or "set"
        cur = t.estimate_minutes or 0
        t.estimate_minutes = max(0, cur + mins if opt == "increase" else cur - mins if opt == "reduce" else mins)
        return f"estimate {t.estimate_minutes} min"
    if a == "log_time":
        loc = cfg.get("location") or "task"
        task_id, pid = t.id, t.project_id
        if loc == "project":
            task_id = None
        elif loc == "select_task" and cfg.get("task_id"):
            other = db.get(models.Task, int(cfg["task_id"]))
            task_id, pid = (other.id, other.project_id) if other else (t.id, t.project_id)
        elif loc == "select_project" and cfg.get("project_id"):
            task_id, pid = None, int(cfg["project_id"])
        mins = (t.estimate_minutes or 0) if cfg.get("time_mode") == "estimate" else int(cfg.get("minutes") or 0)
        if mins <= 0:
            return "no time to log"
        mode = cfg.get("tracked_for") or "trigger_user"
        uids = [actor.id] if mode == "trigger_user" else task_assignees(db, t) if mode == "assignees" else _ids(cfg.get("people"))
        for uid in uids or [actor.id]:
            db.add(models.TimeEntry(user_id=uid, project_id=pid, task_id=task_id, date=date.today(), minutes=mins,
                                    description=txt(cfg.get("description") or f"Automation: {rule.name}")[:500],
                                    billable=bool(cfg.get("billable"))))
        return f"logged {mins} min"
    if a == "set_priority":
        p = cfg.get("priority") or "none"
        t.priority = p if p in ("none", "low", "medium", "high") else "none"
        return f"priority {t.priority}"
    if a == "set_name":
        if cfg.get("name"):
            t.title = txt(cfg["name"])[:300]
        return f"renamed to {t.title}"
    if a == "set_description":
        t.description = txt(cfg.get("description") or "")
        return "updated description"
    if a == "set_progress":
        v = int(cfg.get("percent") or 0)
        opt = cfg.get("option") or "set"
        t.progress = max(0, min(100, (t.progress or 0) + v if opt == "increase" else (t.progress or 0) - v if opt == "decrease" else v))
        return f"progress {t.progress}%"
    if a == "set_custom_field":
        fid = int(cfg.get("field_id") or 0)
        if not fid:
            return "choose a custom field"
        row = db.scalar(select(X.TaskFieldValue).where(X.TaskFieldValue.task_id == t.id, X.TaskFieldValue.field_id == fid))
        val = txt(str(cfg.get("value") or "")) or None
        if row:
            row.value = val
        else:
            db.add(X.TaskFieldValue(task_id=t.id, field_id=fid, value=val))
        return "set custom field"
    return "nothing to do"


def _legacy_action(db, r, a, v, task, actor):
    """Actions saved before the rebuild (single text value)."""
    if task is None:
        return "skipped (no task)"
    cfg = {}
    if a == "notify":
        cfg = {"people_mode": "selected", "people": _ids(v)} if _ids(v) else {"people_mode": "task_assignees"}
        cfg["title"] = f"Automation \"{r.name}\""
        cfg["message"] = "{Task name}"
        return apply_action(db, r, {"type": a, "cfg": cfg}, task, actor)
    if a in ("assign", "add_followers"):
        cfg = {"option": "reassign" if a == "assign" else "add", "people": _ids(v)}
    elif a == "add_tag":
        cfg = {"option": "add", "tags": _texts(v)}
    elif a == "set_priority":
        cfg = {"priority": v}
    elif a in ("move_list", "copy_list"):
        cfg = {"tasklist_id": v}
    elif a in ("add_task", "add_subtask"):
        cfg = {"name": v or f"Follow up: {task.title}"}
    elif a in ("set_due", "set_start"):
        cfg = {"mode": "days_after", "days": int(v or 0) if str(v or "0").lstrip("-").isdigit() else 0}
    elif a == "set_progress":
        cfg = {"option": "set", "percent": v}
    elif a == "add_comment":
        cfg = {"comment": v}
    elif a == "set_estimate":
        cfg = {"option": "set", "minutes": v}
    elif a == "set_status":
        cfg = {"stage": v}
    elif a == "log_time":
        cfg = {"minutes": v, "tracked_for": "assignees", "billable": True}
    return apply_action(db, r, {"type": a, "cfg": cfg}, task, actor)


# ------------------------------------------------------------------ firing
_depth = threading.local()


def _record(db, r, task, result, key=None):
    r.run_count = (r.run_count or 0) + 1
    r.last_run_at = datetime.utcnow()
    db.add(models.AutomationRun(automation_id=r.id, task_id=task.id if task else None, result=(result or "")[:300], key=key))


def run_rule(db, r, cfg, task, actor, project=None, milestone=None, key=None):
    if not all(condition_ok(db, c, task, actor, {}) for c in cfg.get("conditions") or []):
        return False
    results = []
    for act in cfg.get("actions") or []:
        try:
            results.append(apply_action(db, r, act, task, actor, project, milestone))
        except Exception as e:  # noqa: BLE001 - a broken rule must never break the user's request
            results.append(f"error: {e}")
    db.flush()
    _record(db, r, task, " | ".join(results), key)
    return True


def fire(db, trigger, actor, task=None, project=None, milestone=None, ctx=None):
    """Run every active rule for `trigger`. Safe to call from any request handler."""
    if getattr(_depth, "n", 0) > 0:  # actions don't re-trigger automations (prevents loops)
        return
    _depth.n = 1
    try:
        ctx = ctx or {}
        db.flush()  # the session doesn't autoflush: make the new comment / time entry visible to conditions
        pid = task.project_id if task else project.id if project else milestone.project_id if milestone else None
        rules = db.scalars(select(models.Automation).where(models.Automation.is_active.is_(True),
                                                           models.Automation.trigger == trigger)).all()
        for r in rules:
            cfg = rule_config(r)
            if pid is not None and not _in_projects(cfg, pid):
                continue
            if not trigger_matches(trigger, cfg["trigger_cfg"], ctx):
                continue
            run_rule(db, r, cfg, task, actor, project, milestone)
    finally:
        _depth.n = 0


def fire_task(db, task, trigger, actor, **ctx):
    fire(db, trigger, actor, task=task, ctx=ctx)


# ------------------------------------------------------------------ scheduled triggers
def _actor_for(db, r):
    u = db.get(models.User, r.created_by_id) if getattr(r, "created_by_id", None) else None
    return u or db.scalar(select(models.User).where(models.User.role == "admin").order_by(models.User.id)) \
        or db.scalar(select(models.User).order_by(models.User.id))


def _at_passed(tc, now):
    at = (tc.get("at") or "09:00")[:5]
    try:
        h, m = [int(x) for x in at.split(":")]
    except ValueError:
        h, m = 9, 0
    return (now.hour, now.minute) >= (h, m)


def _offset_day(tc, today):
    """The date whose 'arrives' fires today, given 'N day/week before/after'."""
    n = int(tc.get("offset") or 0) * (7 if tc.get("unit") == "week" else 1)
    return today + timedelta(days=n) if tc.get("dir", "before") == "before" else today - timedelta(days=n)


def tick(db, now=None):
    """Fire time-based triggers once per (rule, item, day)."""
    now = now or datetime.now()
    today = now.date()
    rules = db.scalars(select(models.Automation).where(models.Automation.is_active.is_(True),
                                                       models.Automation.trigger.in_(SCHEDULED))).all()
    fired = 0
    for r in rules:
        cfg = rule_config(r)
        tc = cfg["trigger_cfg"]
        if r.trigger != "task_inactive" and not _at_passed(tc, now):
            continue
        done = set(db.scalars(select(models.AutomationRun.key).where(models.AutomationRun.automation_id == r.id,
                                                                     models.AutomationRun.key.is_not(None))))
        actor = _actor_for(db, r)
        if actor is None:
            continue
        if r.trigger == "every_day":
            days = [d.lower()[:3] for d in (tc.get("days") or ["mon", "tue", "wed", "thu", "fri", "sat", "sun"])]
            key = f"day:{today.isoformat()}"
            if now.strftime("%a").lower() in days and key not in done:
                fired += run_rule(db, r, cfg, None, actor, key=key)
            continue
        if r.trigger in ("due_arrives", "start_arrives", "task_inactive"):
            stmt = select(models.Task).where(models.Task.status != "completed")
            if r.trigger == "task_inactive":
                n = int(tc.get("for") or 1) * (7 if tc.get("unit") == "week" else 1)
                stmt = stmt.where(models.Task.updated_at <= now - timedelta(days=n))
            else:
                col = models.Task.due_date if r.trigger == "due_arrives" else models.Task.start_date
                stmt = stmt.where(col == _offset_day(tc, today))
            for t in db.scalars(stmt.limit(500)):
                key = f"task:{t.id}:{(t.updated_at.date() if r.trigger == 'task_inactive' and t.updated_at else today).isoformat()}"
                if key in done or not _in_projects(cfg, t.project_id):
                    continue
                fired += run_rule(db, r, cfg, t, actor, key=key)
            continue
        if r.trigger == "milestone_due_arrives":
            for m in db.scalars(select(models.Milestone).where(models.Milestone.completed.is_(False),
                                                              models.Milestone.due_date == _offset_day(tc, today))):
                key = f"ms:{m.id}:{today.isoformat()}"
                if key not in done and _in_projects(cfg, m.project_id):
                    fired += run_rule(db, r, cfg, None, actor, milestone=m, key=key)
            continue
        col = models.Project.start_date if r.trigger == "project_start_arrives" else models.Project.end_date
        for p in db.scalars(select(models.Project).where(col == _offset_day(tc, today), models.Project.status == "active")):
            key = f"pr:{p.id}:{today.isoformat()}"
            if key not in done:
                fired += run_rule(db, r, cfg, None, actor, project=p, key=key)
    db.commit()
    return fired


_started = False


def start_scheduler(session_factory, every=60):
    """Background loop for the scheduled triggers (due dates, every day, inactive tasks...)."""
    global _started
    if _started:
        return
    _started = True

    def loop():
        while True:
            time.sleep(every)
            db = session_factory()
            try:
                tick(db)
            except Exception:  # noqa: BLE001
                db.rollback()
            finally:
                db.close()
    threading.Thread(target=loop, daemon=True, name="automations").start()
