import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronDown, ChevronRight, Calendar, Hourglass, Bell, MessageSquare, Tag, Flag, Eye, Pencil, MoreHorizontal,
  Plus, Search, X, Check, RotateCcw, Trash2, UserPlus, CalendarDays, Copy, ArrowUpDown, Link2, Repeat, Lock,
  Paperclip, ListChecks, Users, User, Home,
} from 'lucide-react'
import { api } from '../lib/api'
import { useUi } from '../lib/ui-context'
import { fmtDate, fmtMinutes, parseDuration, dueState, PRIORITY } from '../lib/format'
import { SORTS } from '../lib/taskFilters'
import { Avatar, AvatarStack } from './ui'
import { CheckButton } from './TaskRow'
import { Popover, PeoplePicker, PriorityFlag, StatusPill, STATUS, TagEditor } from './TaskPickers'

const shortDate = (iso) => fmtDate(iso, { weekday: 'short', day: 'numeric', month: 'short' })

/* ---------- breadcrumb above page titles ---------- */
export function Crumbs({ items }) {
  return (
    <div className="tw-crumbs">
      <Home size={12} />
      {items.map(([label, to], i) => (
        <span key={i} className="row" style={{ gap: 4 }}>
          {i > 0 && <ChevronRight size={12} />}
          {to ? <Link to={to}>{label}</Link> : <span className="cur">{label}</span>}
        </span>
      ))}
    </div>
  )
}

/* ---------- toolbar pieces ---------- */
export function SearchBox({ value, onChange }) {
  const [open, setOpen] = useState(!!value)
  const ref = useRef()
  useEffect(() => { if (open) ref.current?.focus() }, [open])
  if (!open) return <button className="tb-btn" onClick={() => setOpen(true)}><Search size={15} />Search</button>
  return (
    <div className="search-box sm"><Search size={14} />
      <input ref={ref} placeholder="Search tasks" value={value} onChange={(e) => onChange(e.target.value)} onBlur={() => !value && setOpen(false)} />
      {value && <X size={13} className="clear" onClick={() => { onChange(''); setOpen(false) }} />}
    </div>
  )
}

export function ScopeToggle({ value, onChange }) {
  return (
    <span className="scope-toggle">
      <button className={value === 'mine' ? 'active' : ''} title="Tasks assigned to me" onClick={() => onChange('mine')}><User size={14} /></button>
      <button className={value === 'everyone' ? 'active' : ''} title="Everyone's tasks" onClick={() => onChange('everyone')}><Users size={14} /></button>
    </span>
  )
}

export function SortMenu({ sort, order, onChange, options = SORTS }) {
  return (
    <Popover align="right" width={190} trigger={<button className="tb-btn"><ArrowUpDown size={15} />{options[sort] || 'Sort'} ({order})</button>}>
      {(close) => <>
        <div className="pop-title">Sort by</div>
        {Object.entries(options).map(([k, l]) => (
          <button key={k} className="pop-item" onClick={() => { onChange(k, sort === k ? (order === 'asc' ? 'desc' : 'asc') : order); close() }}>
            {l}{sort === k && <><span className="muted small">({order})</span><Check size={14} className="ok" /></>}
          </button>
        ))}
      </>}
    </Popover>
  )
}

export function AddTaskSplit({ defaults }) {
  const { setQuickAdd } = useUi()
  return (
    <span className="split-btn">
      <button className="btn primary" onClick={() => setQuickAdd({ kind: 'task', ...defaults })}><Plus size={15} />Add task</button>
      <Popover align="right" width={170} trigger={<button className="btn primary caret"><ChevronDown size={14} /></button>}>
        {(close) => <>
          <button className="pop-item" onClick={() => { setQuickAdd('milestone'); close() }}>Add milestone</button>
          <button className="pop-item" onClick={() => { setQuickAdd('event'); close() }}>Add event</button>
        </>}
      </Popover>
    </span>
  )
}

/* ---------- inline attribute editors shown on each row (set values always, empty ones on hover) ---------- */
function DatesEditor({ t, patch, trigger }) {
  return (
    <Popover width={250} trigger={trigger}>
      <div className="pop-title">Dates</div>
      <div className="field"><label>Start date</label><input type="date" className="input sm" value={t.start_date || ''} onChange={(e) => patch({ start_date: e.target.value || null })} /></div>
      <div className="field" style={{ marginBottom: 4 }}><label>Due date</label><input type="date" className="input sm" value={t.due_date || ''} onChange={(e) => patch({ due_date: e.target.value || null })} /></div>
    </Popover>
  )
}

function EstimateEditor({ t, patch, trigger }) {
  const [v, setV] = useState(t.estimate_minutes ? fmtMinutes(t.estimate_minutes) : '')
  return (
    <Popover width={200} trigger={trigger}>
      {(close) => <form onSubmit={(e) => { e.preventDefault(); patch({ estimate_minutes: parseDuration(v) || null }); close() }}>
        <div className="pop-title">Estimated time</div>
        <input className="input sm" autoFocus placeholder="e.g. 1h 30m" value={v} onChange={(e) => setV(e.target.value)} />
      </form>}
    </Popover>
  )
}

function ProgressEditor({ t, patch, trigger }) {
  return (
    <Popover width={200} trigger={trigger}>
      {(close) => <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((p) => <button key={p} className={`qf ${t.progress === p ? 'on' : ''}`} onClick={() => { patch({ progress: p }); close() }}>{p}%</button>)}
      </div>}
    </Popover>
  )
}

export function QuickAttrs({ t, patch, onOpen }) {
  const s = dueState(t)
  const stop = (e) => e.stopPropagation()
  return (
    <span className="qattrs" onClick={stop}>
      <DatesEditor t={t} patch={patch} trigger={
        <button className={`qa ${t.start_date || t.due_date ? 'set' : ''} ${s}`} title="Dates"><Calendar size={13} />
          {t.due_date && <span>{s === 'late' ? 'Due ' : ''}{shortDate(t.due_date)}</span>}
          {!t.due_date && t.start_date && <span>Starts {shortDate(t.start_date)}</span>}</button>} />
      <EstimateEditor t={t} patch={patch} trigger={<button className={`qa ${t.estimate_minutes ? 'set' : ''}`} title="Estimated time"><Hourglass size={13} />{t.estimate_minutes > 0 && <span>Est: {fmtMinutes(t.estimate_minutes)}</span>}</button>} />
      <button className="qa" title="Reminders" onClick={() => onOpen(t.id)}><Bell size={13} /></button>
      <button className={`qa ${t.comment_count ? 'set' : ''}`} title="Comments" onClick={() => onOpen(t.id)}><MessageSquare size={13} />{t.comment_count > 0 && <span>{t.comment_count}</span>}</button>
      <Popover width={260} trigger={<button className={`qa ${t.tags.length ? 'set' : ''}`} title="Tags">{t.tags.length ? t.tags.slice(0, 3).map((x) => <span className="tag" key={x}>{x}</span>) : <Tag size={13} />}</button>}>
        <div className="pop-title">Tags</div>
        <TagEditor value={t.tags} onChange={(tags) => patch({ tags: tags.join(', ') })} />
      </Popover>
      <Popover width={160} trigger={<button className={`qa ${t.priority && t.priority !== 'none' ? 'set' : ''}`} title="Priority">{t.priority && t.priority !== 'none' ? <PriorityFlag p={t.priority} /> : <Flag size={13} />}</button>}>
        {(close) => ['high', 'medium', 'low', 'none'].map((k) => <button key={k} className="pop-item" onClick={() => { patch({ priority: k }); close() }}><PriorityFlag p={k} showLabel />{k === 'none' && 'None'}{t.priority === k && <Check size={14} className="ok" />}</button>)}
      </Popover>
      <ProgressEditor t={t} patch={patch} trigger={<button className={`qa ${t.progress ? 'set' : ''}`} title="Progress"><span>{t.progress || 0}%</span></button>} />
      <button className={`qa ${t.is_following ? 'set' : ''}`} title={t.is_following ? 'Following' : 'Follow'} onClick={() => api.post(`/tasks/${t.id}/follow?on=${!t.is_following}`).then(() => patch({}))}><Eye size={13} /></button>
    </span>
  )
}

export function StagePicker({ t, patch }) {
  return (
    <Popover width={170} trigger={<button className="stage-btn" onClick={(e) => e.stopPropagation()}><StatusPill s={t.status} /></button>}>
      {(close) => Object.keys(STATUS).map((k) => <button key={k} className="pop-item" onClick={() => { patch({ status: k }); close() }}><StatusPill s={k} />{t.status === k && <Check size={14} className="ok" />}</button>)}
    </Popover>
  )
}

/** One task row in Teamwork's list style. */
export function TaskLine({ t, reload, selectable, selected, onSel, depth = 0, showProject }) {
  const { openTask, refresh, notify } = useUi()
  const [open, setOpen] = useState(false)
  const [subs, setSubs] = useState(null)
  const loadSubs = () => api.get(`/tasks?parent_id=${t.id}&status=all&sort=manual`).then(setSubs)
  const patch = async (body) => { if (Object.keys(body).length) await api.patch(`/tasks/${t.id}`, body); reload(); refresh(); if (open) loadSubs() }
  const titleRef = useRef()
  const rename = () => {
    const el = titleRef.current
    el.contentEditable = true; el.focus()
    document.getSelection().selectAllChildren(el)
  }
  const saveTitle = (e) => {
    e.target.contentEditable = false
    const v = e.target.textContent.trim()
    if (v && v !== t.title) patch({ title: v }); else e.target.textContent = t.title
  }
  const dup = async () => { await api.post(`/tasks/${t.id}/duplicate`); notify('Task duplicated'); reload() }
  const del = async () => { if (confirm(`Delete "${t.title}"?`)) { await api.del(`/tasks/${t.id}`); notify('Task deleted'); reload(); refresh() } }
  return (
    <>
      <div className={`twrow ${t.status === 'completed' ? 'done' : ''} ${selected ? 'sel' : ''}`} style={{ paddingLeft: 10 + depth * 30 }} onClick={() => openTask(t.id)}>
        {selectable && <input type="checkbox" className="sel-box" checked={!!selected} onClick={(e) => e.stopPropagation()} onChange={onSel} />}
        <span className="exp">{t.subtask_count > 0 && <button className="icon-btn xs" onClick={(e) => { e.stopPropagation(); if (!open) loadSubs(); setOpen(!open) }}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>}</span>
        <button className="icon-btn xs hover-only" title="Rename" onClick={(e) => { e.stopPropagation(); rename() }}><Pencil size={12} /></button>
        <CheckButton task={t} onChange={() => { reload(); refresh() }} />
        <span onClick={(e) => e.stopPropagation()}>
          <PeoplePicker value={t.assignees.map((a) => a.id)} onChange={(ids) => patch({ assignee_ids: ids })}
            trigger={<button className="avatar-btn" title={t.assignees.map((a) => a.name).join(', ') || 'Assign'}>{t.assignees.length ? <AvatarStack users={t.assignees} size={22} max={2} /> : <span className="avatar empty-av sm"><UserPlus size={11} /></span>}</button>} />
        </span>
        <span className="tw-title" ref={titleRef} onBlur={saveTitle} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur() } }} onClick={(e) => e.target.isContentEditable && e.stopPropagation()}>{t.title}</span>
        {t.is_private && <Lock size={12} className="muted" title="Private" />}
        {t.repeat && <Repeat size={12} className="muted" title={`Repeats ${t.repeat}`} />}
        {t.dependency_count > 0 && <Link2 size={12} className="muted" title="Has dependencies" />}
        {t.file_count > 0 && <span className="meta-i muted small"><Paperclip size={12} />{t.file_count}</span>}
        {t.subtask_count > 0 && <span className="meta-i muted small" title="Subtasks"><ListChecks size={12} />{t.subtask_done}/{t.subtask_count}</span>}
        <StagePicker t={t} patch={patch} />
        <QuickAttrs t={t} patch={patch} onOpen={openTask} />
        {showProject && <span className="proj-pill"><span className="dot" style={{ background: t.project_color }} />{t.project_name}</span>}
        <span className="row-end" onClick={(e) => e.stopPropagation()}>
          <Popover align="right" width={190} trigger={<button className="icon-btn xs hover-only"><MoreHorizontal size={15} /></button>}>
            {(close) => <>
              <button className="pop-item" onClick={() => { openTask(t.id); close() }}><Pencil size={14} />Open task</button>
              <button className="pop-item" onClick={() => { navigator.clipboard?.writeText(`${location.origin}/tasks/${t.id}`); notify('Link copied'); close() }}><Link2 size={14} />Copy link</button>
              <button className="pop-item" onClick={() => { dup(); close() }}><Copy size={14} />Duplicate</button>
              <button className="pop-item" style={{ color: 'var(--danger)' }} onClick={() => { close(); del() }}><Trash2 size={14} />Delete</button>
            </>}
          </Popover>
        </span>
      </div>
      {open && subs && subs.map((s) => <TaskLine key={s.id} t={s} reload={() => { loadSubs(); reload() }} depth={depth + 1} />)}
      {open && subs && <InlineAdd ctx={{ project_id: t.project_id, parent_id: t.id }} depth={depth + 1} onAdded={() => { loadSubs(); reload() }} placeholder="Add a subtask" />}
    </>
  )
}

export function InlineAdd({ ctx, onAdded, depth = 0, placeholder = 'Add a task' }) {
  const { projects, notify } = useUi()
  const [title, setTitle] = useState('')
  const [pid, setPid] = useState('')
  const [active, setActive] = useState(false)
  const project = ctx.project_id || pid
  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    if (!project) return notify('Pick a project for the new task')
    const body = { title: title.trim() }
    for (const k of ['tasklist_id', 'parent_id', 'due_date', 'priority', 'status', 'assignee_ids']) if (ctx[k] !== undefined) body[k] = ctx[k]
    await api.post(`/projects/${project}/tasks`, body)
    setTitle('')
    onAdded()
  }
  if (!active) return <button className="add-row" style={{ paddingLeft: 40 + depth * 30 }} onClick={() => setActive(true)}><Plus size={14} />{placeholder}</button>
  return (
    <form className="add-task-inline" style={{ paddingLeft: 40 + depth * 30 }} onSubmit={submit}>
      <Plus size={16} className="muted" />
      <input autoFocus placeholder={`${placeholder}, then press Enter`} value={title} onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && (setTitle(''), setActive(false))} onBlur={() => !title && setActive(false)} />
      {!ctx.project_id && (
        <select className="select sm" style={{ width: 180 }} value={pid} onChange={(e) => setPid(e.target.value)}>
          <option value="">Choose project…</option>{projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      )}
      {title && <button className="btn sm primary">Add</button>}
    </form>
  )
}

/* ---------- bulk actions ---------- */
export function BulkBar({ ids, clear, done }) {
  const { notify } = useUi()
  const [tag, setTag] = useState('')
  const run = async (body, msg) => { await api.post('/tasks/bulk', { ids, ...body }); notify(msg); done() }
  return (
    <div className="bulk-bar">
      <b>{ids.length} selected</b>
      <button className="btn sm" onClick={() => run({ patch: { status: 'completed' } }, 'Tasks completed')}><Check size={14} />Complete</button>
      <button className="btn sm" onClick={() => run({ patch: { status: 'new' } }, 'Tasks reopened')}><RotateCcw size={14} />Reopen</button>
      <Popover width={170} trigger={<button className="btn sm">Stage</button>}>
        {(close) => Object.keys(STATUS).map((k) => <button key={k} className="pop-item" onClick={() => { run({ patch: { status: k } }, 'Stage updated'); close() }}><StatusPill s={k} /></button>)}
      </Popover>
      <PeoplePicker value={[]} onChange={(v) => run({ patch: { assignee_ids: v } }, 'Assignees updated')} trigger={<button className="btn sm"><UserPlus size={14} />Assign</button>} />
      <Popover width={200} trigger={<button className="btn sm"><CalendarDays size={14} />Due date</button>}>
        {(close) => <>
          <input type="date" className="input sm" onChange={(e) => { run({ patch: { due_date: e.target.value || null } }, 'Due date updated'); close() }} />
          <button className="pop-item" onClick={() => { run({ patch: { due_date: null } }, 'Due date removed'); close() }}>Remove due date</button>
        </>}
      </Popover>
      <Popover width={170} trigger={<button className="btn sm"><Flag size={14} />Priority</button>}>
        {(close) => ['high', 'medium', 'low', 'none'].map((k) => <button key={k} className="pop-item" onClick={() => { run({ patch: { priority: k } }, 'Priority updated'); close() }}><PriorityFlag p={k} showLabel />{k === 'none' && 'None'}</button>)}
      </Popover>
      <Popover width={220} trigger={<button className="btn sm"><Tag size={14} />Add tag</button>}>
        {(close) => <form onSubmit={(e) => { e.preventDefault(); if (tag.trim()) { run({ add_tag: tag.trim() }, 'Tag added'); setTag(''); close() } }}><input className="input sm" autoFocus placeholder="Tag name, then Enter" value={tag} onChange={(e) => setTag(e.target.value)} /></form>}
      </Popover>
      <button className="btn sm danger" onClick={() => confirm(`Delete ${ids.length} tasks?`) && run({ delete: true }, 'Tasks deleted')}><Trash2 size={14} />Delete</button>
      <button className="icon-btn" onClick={clear} title="Clear selection"><X size={16} /></button>
    </div>
  )
}

export { shortDate, PRIORITY }
