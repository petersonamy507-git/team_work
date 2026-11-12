import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  X, Trash2, Clock, Paperclip, Plus, Check, Bell, Eye, EyeOff, MoreVertical, Copy, Link2, Lock, Unlock, Info,
  Repeat, ChevronDown, ChevronRight, Calendar, Flag, Tag, Hourglass, Columns3, Percent, ExternalLink, FolderInput,
  History, ListPlus, Printer, Send, UserPlus,
} from 'lucide-react'
import { api } from '../lib/api'
import { useUi } from '../lib/ui-context'
import { fmtMinutes, timeAgo, parseDuration, todayISO, fmtDate, fmtDateTime, dueState } from '../lib/format'
import { Avatar, AvatarStack, Modal, Progress } from './ui'
import { CheckButton } from './TaskRow'
import { Popover, PeoplePicker, PriorityFlag, StatusPill, STATUS, TagEditor } from './TaskPickers'
import { CustomFieldsTab } from './TaskExtras'

const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
const longDate = (iso) => fmtDate(iso, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

export default function TaskDrawer() {
  const { taskId, openTask, refresh, notify } = useUi()
  const navigate = useNavigate()
  const [task, setTask] = useState(null)
  const [tab, setTab] = useState('details')
  const [low, setLow] = useState('comments')
  const [moving, setMoving] = useState(false)
  const [quickSubs, setQuickSubs] = useState(false)
  const [editDesc, setEditDesc] = useState(false)

  const load = () => api.get(`/tasks/${taskId}`).then(setTask).catch((e) => { notify(e.message); openTask(null) })

  useEffect(() => {
    if (!taskId) return setTask(null)
    setEditDesc(false)
    load()
    const k = (e) => e.key === 'Escape' && !document.querySelector('.popover, .modal') && openTask(null)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  if (!taskId) return null
  const close = () => openTask(null)
  const save = async (patch) => { setTask(await api.patch(`/tasks/${taskId}`, patch)); refresh() }
  const del = async () => {
    if (!confirm('Delete this task and its subtasks?')) return
    await api.del(`/tasks/${taskId}`)
    notify('Task deleted'); close(); refresh()
  }
  const duplicate = async () => { const t = await api.post(`/tasks/${taskId}/duplicate`); notify('Task duplicated'); refresh(); openTask(t.id) }
  const copyLink = () => { navigator.clipboard?.writeText(`${location.origin}/tasks/${taskId}`); notify('Link copied') }
  const follow = async () => setTask(await api.post(`/tasks/${taskId}/follow?on=${!task.is_following}`))
  const printTask = () => {
    const w = window.open('', '_blank')
    w.document.write(`<title>${task.title}</title><h1>${task.title}</h1><p>${task.project_name} › ${task.tasklist_name || ''}</p><p>Stage: ${STATUS[task.status]?.label} · Priority: ${task.priority} · Due: ${task.due_date || '—'}</p><pre style="white-space:pre-wrap;font-family:inherit">${(task.description || '').replace(/</g, '&lt;')}</pre><h3>Subtasks</h3><ul>${task.subtasks.map((s) => `<li>${s.status === 'completed' ? '✔ ' : ''}${s.title}</li>`).join('')}</ul><h3>Comments</h3>${task.comments.map((c) => `<p><b>${c.user?.name}</b>: ${c.body.replace(/</g, '&lt;')}</p>`).join('')}`)
    w.document.close(); w.print()
  }

  return (
    <aside className="task-side-panel">
      {!task ? <div className="drawer-body">Loading…</div> : (
        <>
          <div className="sp-top">
            <span style={{ flex: 1 }} />
            <Popover align="right" width={260} trigger={<button className="icon-btn" title="Task info"><Info size={17} /></button>}>
              <div className="info-grid">
                <span className="muted">Created by</span><span className="row" style={{ gap: 6 }}><Avatar user={task.created_by} size={20} />{task.created_by?.name || '—'}</span>
                <span className="muted">Created</span><span>{fmtDateTime(task.created_at)}</span>
                <span className="muted">Updated</span><span>{fmtDateTime(task.updated_at)}</span>
                <span className="muted">Task ID</span><span>#{task.id}</span>
              </div>
            </Popover>
            <button className="icon-btn" title="Copy link" onClick={copyLink}><Link2 size={17} /></button>
            <ReminderButton task={task} setTask={setTask} />
            <Popover align="right" width={200} trigger={<button className={`icon-btn ${task.repeat ? 'accent' : ''}`} title="Repeat"><Repeat size={17} /></button>}>
              {(c) => [['', 'Does not repeat'], ['daily', 'Every day'], ['weekly', 'Every week'], ['monthly', 'Every month']].map(([k, l]) => <button key={k} className="pop-item" onClick={() => { save({ repeat: k || null }); c() }}>{l}{(task.repeat || '') === k && <Check size={14} className="ok" />}</button>)}
            </Popover>
            <button className={`icon-btn ${task.is_following ? 'accent' : ''}`} title={task.is_following ? 'Stop following' : 'Follow'} onClick={follow}>{task.is_following ? <Eye size={17} /> : <EyeOff size={17} />}</button>
            <Popover align="right" width={230} trigger={<button className="icon-btn"><MoreVertical size={17} /></button>}>
              {(c) => <>
                <button className="pop-item" onClick={() => { setMoving(true); c() }}><FolderInput size={14} />Move or copy</button>
                <button className="pop-item" onClick={() => { setLow('activity'); c() }}><History size={14} />View activity</button>
                <button className="pop-item" onClick={() => { setTab('deps'); c() }}><Link2 size={14} />Add dependency</button>
                <button className="pop-item" onClick={() => { setQuickSubs(true); c() }}><ListPlus size={14} />Quickly add subtasks</button>
                <div className="pop-sep" />
                <button className="pop-item" onClick={() => { duplicate(); c() }}><Copy size={14} />Duplicate</button>
                <button className="pop-item" onClick={() => { printTask(); c() }}><Printer size={14} />Print / save as PDF</button>
                <button className="pop-item" onClick={() => { save({ is_private: !task.is_private }); c() }}>{task.is_private ? <Unlock size={14} /> : <Lock size={14} />}{task.is_private ? 'Make public' : 'Make private'}</button>
                <div className="pop-sep" />
                <button className="pop-item" style={{ color: 'var(--danger)' }} onClick={() => { c(); del() }}><Trash2 size={14} />Delete task</button>
              </>}
            </Popover>
            <button className="btn sm ghost" onClick={() => { close(); navigate(`/projects/${task.project_id}/tasks`) }}><ExternalLink size={14} />Open in project</button>
            <button className="icon-btn" onClick={close}><X size={18} /></button>
          </div>

          <div className="sp-body">
            <div className="crumbs small muted">
              <Link to={`/projects/${task.project_id}/tasks`}>{task.project_name}</Link>
              {task.tasklist_name && <><ChevronRight size={12} />{task.tasklist_name}</>}
              {task.parent && <><ChevronRight size={12} /><a onClick={() => openTask(task.parent.id)}>{task.parent.title}</a></>}
            </div>
            {task.is_private && <div className="private-note"><Lock size={13} />Private: only the creator and assignees can see this task.</div>}
            <div className="sp-title">
              <CheckButton task={task} onChange={load} />
              <PeoplePicker value={task.assignees.map((a) => a.id)} onChange={(ids) => save({ assignee_ids: ids })}
                trigger={<button className="avatar-btn" title="Assignees">{task.assignees.length ? <AvatarStack users={task.assignees} size={26} max={3} /> : <span className="avatar empty-av"><UserPlus size={12} /></span>}</button>} />
              <input className="title-input" defaultValue={task.title} key={task.id + task.title}
                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                onBlur={(e) => e.target.value.trim() && e.target.value !== task.title && save({ title: e.target.value.trim() })} />
            </div>

            <div className="sp-fields">
              <Popover width={260} trigger={<button className={`fld ${task.start_date || task.due_date ? 'set' : ''} ${dueState(task)}`}><Calendar size={15} />
                {task.start_date || task.due_date ? <span>{task.start_date ? longDate(task.start_date) : 'No start'} – {task.due_date ? longDate(task.due_date) : 'No due date'}</span> : 'No dates'}</button>}>
                <div className="field"><label>Start date</label><input type="date" className="input sm" value={task.start_date || ''} onChange={(e) => save({ start_date: e.target.value || null })} /></div>
                <div className="field"><label>Due date</label><input type="date" className="input sm" value={task.due_date || ''} onChange={(e) => save({ due_date: e.target.value || null })} /></div>
              </Popover>
              <Popover width={170} trigger={<button className={`fld ${task.priority !== 'none' ? 'set' : ''}`}>{task.priority !== 'none' ? <PriorityFlag p={task.priority} showLabel /> : <><Flag size={15} />No priority</>}</button>}>
                {(c) => ['high', 'medium', 'low', 'none'].map((k) => <button key={k} className="pop-item" onClick={() => { save({ priority: k }); c() }}><PriorityFlag p={k} showLabel />{k === 'none' && 'None'}{task.priority === k && <Check size={14} className="ok" />}</button>)}
              </Popover>
              <Popover width={280} trigger={<button className={`fld ${task.tags.length ? 'set' : ''}`}><Tag size={15} />{task.tags.length ? task.tags.map((t) => <span className="tag" key={t}>{t}</span>) : 'No tags'}</button>}>
                <div className="pop-title">Tags</div>
                <TagEditor value={task.tags} onChange={(tags) => save({ tags: tags.join(', ') })} />
              </Popover>
              <EstimateField task={task} save={save} />
              <Popover width={170} trigger={<button className="fld set"><Columns3 size={15} /><StatusPill s={task.status} /></button>}>
                {(c) => Object.keys(STATUS).map((k) => <button key={k} className="pop-item" onClick={() => { save({ status: k }); c() }}><StatusPill s={k} />{task.status === k && <Check size={14} className="ok" />}</button>)}
              </Popover>
              <span className="fld set"><Percent size={15} />{task.progress}%
                <input type="range" min="0" max="100" step="10" value={task.progress} onChange={(e) => setTask({ ...task, progress: +e.target.value })} onMouseUp={(e) => save({ progress: +e.target.value })} onTouchEnd={(e) => save({ progress: +e.target.value })} style={{ flex: 1, maxWidth: 160 }} /></span>
              <PeoplePicker title="Followers" allowNone={false} value={task.followers.map((u) => u.id)} onChange={(ids) => save({ follower_ids: ids })}
                trigger={<button className={`fld ${task.followers.length ? 'set' : ''}`}><Eye size={15} />{task.followers.length ? <><AvatarStack users={task.followers} size={20} max={5} />{task.followers.length} follower{task.followers.length > 1 ? 's' : ''}</> : 'No followers'}</button>} />
              <ReminderButton task={task} setTask={setTask} asField />
            </div>

            {editDesc || !task.description ? (
              <textarea className="textarea desc" autoFocus={editDesc} placeholder="Add a description" defaultValue={task.description || ''} key={'d' + task.id}
                onBlur={(e) => { setEditDesc(false); e.target.value !== (task.description || '') && save({ description: e.target.value }) }} />
            ) : <div className="desc-view pre" onClick={() => setEditDesc(true)} title="Click to edit">{task.description}</div>}

            <div className="tabs sp-tabs">
              {[['details', 'Details'], ['custom', 'Custom fields', Object.values(task.custom || {}).filter(Boolean).length], ['deps', 'Dependencies', task.depends_on.length + task.blocking.length], ['time', 'Time', task.time_entries.length]].map(([k, l, n]) => (
                <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}{n > 0 && <span className="badge grey" style={{ marginLeft: 6 }}>{n}</span>}</button>
              ))}
            </div>
            {tab === 'details' && <>
              <Subtasks task={task} reload={load} quick={quickSubs} setQuick={setQuickSubs} />
              <Files task={task} reload={load} />
            </>}
            {tab === 'custom' && <CustomFieldsTab task={task} setTask={setTask} />}
            {tab === 'deps' && <Deps task={task} setTask={setTask} />}
            {tab === 'time' && <TimeTab task={task} reload={load} />}

            <div className="tabs sp-tabs" style={{ marginTop: 22 }}>
              {[['comments', 'Comments', task.comments.length], ['activity', 'Activity'], ['info', 'Info']].map(([k, l, n]) => (
                <button key={k} className={`tab ${low === k ? 'active' : ''}`} onClick={() => setLow(k)}>{l}{n > 0 && <span className="badge grey" style={{ marginLeft: 6 }}>{n}</span>}</button>
              ))}
            </div>
            {low === 'comments' && <Comments task={task} setTask={setTask} />}
            {low === 'activity' && <ActivityTab task={task} />}
            {low === 'info' && (
              <div className="info-grid">
                <span className="muted">Created by</span><span className="row" style={{ gap: 6 }}><Avatar user={task.created_by} size={20} />{task.created_by?.name || '—'}</span>
                <span className="muted">Date added</span><span>{fmtDateTime(task.created_at)}</span>
                <span className="muted">Last updated</span><span>{fmtDateTime(task.updated_at)}</span>
                {task.completed_at && <><span className="muted">Completed</span><span>{fmtDateTime(task.completed_at)}</span></>}
                <span className="muted">Task ID</span><span>#{task.id}</span>
                <span className="muted">Project</span><span>{task.project_name}</span>
                <span className="muted">Task list</span><span>{task.tasklist_name}</span>
                <span className="muted">Logged time</span><span>{fmtMinutes(task.logged_minutes)}{task.estimate_minutes ? ` of ${fmtMinutes(task.estimate_minutes)}` : ''}</span>
              </div>
            )}
          </div>
          {moving && <MoveCopy task={task} onClose={() => setMoving(false)} onDone={(t) => { setMoving(false); refresh(); t.id !== task.id ? openTask(t.id) : load() }} />}
        </>
      )}
    </aside>
  )
}

function EstimateField({ task, save }) {
  const [v, setV] = useState(task.estimate_minutes ? fmtMinutes(task.estimate_minutes) : '')
  return (
    <Popover width={210} trigger={<button className={`fld ${task.estimate_minutes ? 'set' : ''}`}><Hourglass size={15} />{task.estimate_minutes ? `Est: ${fmtMinutes(task.estimate_minutes)}` : 'No estimate'}</button>}>
      {(c) => <form onSubmit={(e) => { e.preventDefault(); save({ estimate_minutes: parseDuration(v) || null }); c() }}>
        <div className="pop-title">Estimated time</div>
        <input className="input sm" autoFocus placeholder="e.g. 2h 30m" value={v} onChange={(e) => setV(e.target.value)} />
      </form>}
    </Popover>
  )
}

function ReminderButton({ task, setTask, asField }) {
  const { notify } = useUi()
  const [when, setWhen] = useState('')
  const [note, setNote] = useState('')
  const add = async (e) => {
    e.preventDefault()
    if (!when) return
    try { setTask(await api.post(`/tasks/${task.id}/reminders`, { remind_at: when, note: note || null })); setWhen(''); setNote('') } catch (err) { notify(err.message) }
  }
  const rm = async (id) => setTask(await api.del(`/tasks/${task.id}/reminders/${id}`))
  const n = task.reminders.filter((r) => !r.sent).length
  return (
    <Popover align={asField ? 'left' : 'right'} width={300} trigger={asField
      ? <button className={`fld ${n ? 'set' : ''}`}><Bell size={15} />{n ? `${n} reminder${n > 1 ? 's' : ''}` : 'No reminders'}</button>
      : <button className={`icon-btn ${n ? 'accent' : ''}`} title="Reminders"><Bell size={17} /></button>}>
      <div className="pop-title">Reminders</div>
      {task.reminders.map((r) => (
        <div key={r.id} className="file-row" style={{ cursor: 'default' }}>
          <Bell size={13} className={r.sent ? 'muted' : 'accent'} /><span style={{ flex: 1 }}>{fmtDateTime(r.remind_at)}{r.note && <span className="muted"> · {r.note}</span>}</span>
          {r.sent && <span className="muted small">sent</span>}
          <button className="icon-btn xs" onClick={() => rm(r.id)}><X size={12} /></button>
        </div>
      ))}
      <form onSubmit={add} style={{ marginTop: 6 }}>
        <input type="datetime-local" className="input sm" value={when} onChange={(e) => setWhen(e.target.value)} />
        <input className="input sm" style={{ marginTop: 6 }} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn sm primary" style={{ marginTop: 6 }} disabled={!when}><Plus size={13} />Add reminder</button>
      </form>
      <p className="muted small" style={{ margin: '8px 2px 0' }}>Reminders arrive in your Inbox.</p>
    </Popover>
  )
}

function MoveCopy({ task, onClose, onDone }) {
  const { projects, notify } = useUi()
  const [pid, setPid] = useState(task.project_id)
  const [lists, setLists] = useState([])
  const [lid, setLid] = useState(task.tasklist_id)
  const [copy, setCopy] = useState(false)
  useEffect(() => { api.get(`/projects/${pid}/tasklists?include_completed=true`).then((l) => { setLists(l); if (!l.some((x) => x.id === lid)) setLid(l[0]?.id) }) }, [pid])
  const go = async () => {
    if (!lid) return notify('Pick a task list')
    const t = await api.post(`/tasks/${task.id}/move-to`, { tasklist_id: +lid, make_copy: copy })
    notify(copy ? 'Task copied' : 'Task moved'); onDone(t)
  }
  return (
    <Modal title="Move or copy task" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={go}>{copy ? 'Copy task' : 'Move task'}</button></>}>
      <div className="seg" style={{ marginBottom: 14 }}><button className={!copy ? 'active' : ''} onClick={() => setCopy(false)}>Move</button><button className={copy ? 'active' : ''} onClick={() => setCopy(true)}>Copy</button></div>
      <div className="field"><label>Project</label><select className="select" value={pid} onChange={(e) => setPid(+e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div className="field"><label>Task list</label><select className="select" value={lid || ''} onChange={(e) => setLid(+e.target.value)}>{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
    </Modal>
  )
}

function Subtasks({ task, reload, quick, setQuick }) {
  const { openTask, refresh } = useUi()
  const [title, setTitle] = useState('')
  const [bulk, setBulk] = useState('')
  const add = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    await api.post(`/projects/${task.project_id}/tasks`, { title: title.trim(), parent_id: task.id })
    setTitle(''); reload(); refresh()
  }
  const addMany = async () => {
    const lines = bulk.split('\n').map((l) => l.trim()).filter(Boolean)
    for (const l of lines) await api.post(`/projects/${task.project_id}/tasks`, { title: l, parent_id: task.id })
    setBulk(''); setQuick(false); reload(); refresh()
  }
  const done = task.subtasks.filter((s) => s.status === 'completed').length
  return (
    <div className="sp-section">
      <div className="sp-h">Subtasks <span className="badge grey">{task.subtasks.length}</span>
        {task.subtasks.length > 0 && <span style={{ flex: 1, maxWidth: 160, marginLeft: 8 }}><Progress value={(done / task.subtasks.length) * 100} /></span>}</div>
      {task.subtasks.map((s) => (
        <div key={s.id} className={`twrow ${s.status === 'completed' ? 'done' : ''}`} onClick={() => openTask(s.id)}>
          <CheckButton task={s} onChange={reload} />
          <AvatarStack users={s.assignees} size={20} max={2} />
          <span className="tw-title">{s.title}</span>
          <StatusPill s={s.status} />
          {s.due_date && <span className={`dates small ${dueState(s)}`}>{fmtDate(s.due_date)}</span>}
        </div>
      ))}
      {quick ? (
        <div style={{ marginTop: 8 }}>
          <textarea className="textarea" autoFocus placeholder="One subtask per line" value={bulk} onChange={(e) => setBulk(e.target.value)} />
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 6 }}><button className="btn sm" onClick={() => setQuick(false)}>Cancel</button><button className="btn sm primary" onClick={addMany}>Add subtasks</button></div>
        </div>
      ) : (
        <form className="add-task-inline" onSubmit={add} style={{ paddingLeft: 0 }}>
          <Plus size={16} className="muted" />
          <input placeholder="Add a subtask" value={title} onChange={(e) => setTitle(e.target.value)} />
        </form>
      )}
    </div>
  )
}

function Files({ task, reload }) {
  const [over, setOver] = useState(false)
  const upload = async (files) => {
    for (const f of files) {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('task_id', task.id)
      await api.upload(`/projects/${task.project_id}/files`, fd)
    }
    reload()
  }
  return (
    <div className="sp-section">
      <div className="sp-h">Files {task.files.length > 0 && <span className="badge grey">{task.files.length}</span>}</div>
      {task.files.map((f) => (
        <div key={f.id} className="file-row" onClick={() => api.download(`/files/${f.id}/download`, f.name)}>
          <Paperclip size={15} className="muted" /><span className="ellipsis" style={{ flex: 1 }}>{f.name}</span>
          <span className="muted small">{fmtSize(f.size)}</span>{f.user && <Avatar user={f.user} size={20} />}<span className="muted small">{timeAgo(f.created_at)}</span>
        </div>
      ))}
      <label className={`dropzone ${over ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload([...e.dataTransfer.files]) }}>
        <Paperclip size={15} />Drag and drop your files here. <span className="accent">Browse files</span>
        <input type="file" multiple hidden onChange={(e) => upload([...e.target.files])} />
      </label>
    </div>
  )
}

function Comments({ task, setTask }) {
  const [body, setBody] = useState('')
  const [open, setOpen] = useState(false)
  const add = async (e) => {
    e.preventDefault()
    if (!body.trim()) return
    setTask(await api.post(`/tasks/${task.id}/comments`, { body }))
    setBody(''); setOpen(false)
  }
  const del = async (c) => {
    if (!confirm('Delete this comment?')) return
    await api.del(`/comments/${c.id}`)
    setTask(await api.get(`/tasks/${task.id}`))
  }
  return <>
    {task.comments.map((c) => (
      <div className="comment" key={c.id}>
        <Avatar user={c.user} />
        <div className="bubble">
          <div className="who">{c.user?.name}<span className="when">{timeAgo(c.created_at)}</span>
            <button className="icon-btn xs" style={{ float: 'right' }} title="Delete" onClick={() => del(c)}><Trash2 size={12} /></button></div>
          <div className="pre">{c.body}</div>
        </div>
      </div>
    ))}
    <form onSubmit={add} className="comment-box">
      {!open ? <input className="input" placeholder="Add a comment" onFocus={() => setOpen(true)} /> : <>
        <textarea className="textarea" autoFocus style={{ minHeight: 80 }} placeholder="Write a comment… (Ctrl+Enter to send)" value={body} onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && add(e)} />
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn sm" onClick={() => { setOpen(false); setBody('') }}>Cancel</button>
          <button className="btn sm primary"><Send size={13} />Post comment</button>
        </div>
      </>}
    </form>
  </>
}

function TimeTab({ task, reload }) {
  const { refresh, notify } = useUi()
  const [f, setF] = useState({ dur: '', desc: '', date: todayISO(), billable: true })
  const log = async (e) => {
    e.preventDefault()
    const minutes = parseDuration(f.dur)
    if (!minutes) return notify('Enter a duration like 1h 30m')
    await api.post('/time', { project_id: task.project_id, task_id: task.id, date: f.date, minutes, description: f.desc, billable: f.billable })
    setF({ ...f, dur: '', desc: '' })
    notify(`Logged ${fmtMinutes(minutes)}`); reload(); refresh()
  }
  return <div className="sp-section">
    <div className="row" style={{ marginBottom: 10 }}>
      <b>{fmtMinutes(task.logged_minutes)}</b><span className="muted">logged{task.estimate_minutes ? ` of ${fmtMinutes(task.estimate_minutes)} estimated` : ''}</span>
      {task.estimate_minutes > 0 && <span style={{ flex: 1 }}><Progress value={Math.min(100, (task.logged_minutes / task.estimate_minutes) * 100)} /></span>}
    </div>
    <form className="row card" style={{ padding: 10, marginBottom: 10, flexWrap: 'wrap' }} onSubmit={log}>
      <input type="date" className="input sm" style={{ width: 145 }} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
      <input className="input sm" style={{ width: 90 }} placeholder="1h 30m" value={f.dur} onChange={(e) => setF({ ...f, dur: e.target.value })} />
      <input className="input sm" style={{ flex: 1, minWidth: 140 }} placeholder="What did you do?" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} />
      <label className="small row" style={{ gap: 4 }}><input type="checkbox" checked={f.billable} onChange={(e) => setF({ ...f, billable: e.target.checked })} />Billable</label>
      <button className="btn sm primary"><Clock size={13} />Log time</button>
    </form>
    {task.time_entries.map((e) => (
      <div key={e.id} className="file-row" style={{ cursor: 'default' }}>
        <Avatar user={e.user} size={22} /><span style={{ width: 70 }}>{fmtDate(e.date)}</span><b style={{ width: 60 }}>{fmtMinutes(e.minutes)}</b>
        <span className="ellipsis muted" style={{ flex: 1 }}>{e.description}</span>{e.billable && <span className="pill">Billable</span>}
      </div>
    ))}
  </div>
}

function Deps({ task, setTask }) {
  const { openTask, notify } = useUi()
  const [q, setQ] = useState('')
  const [res, setRes] = useState([])
  useEffect(() => {
    if (q.trim().length < 2) return setRes([])
    const t = setTimeout(() => api.get(`/tasks?q=${encodeURIComponent(q)}&status=all&limit=10`).then((r) => setRes(r.filter((x) => x.id !== task.id))), 200)
    return () => clearTimeout(t)
  }, [q, task.id])
  const add = async (id) => { try { setTask(await api.post(`/tasks/${task.id}/dependencies`, { depends_on_id: id })); setQ('') } catch (e) { notify(e.message) } }
  const rm = async (id) => setTask(await api.del(`/tasks/${task.id}/dependencies/${id}`))
  const Item = ({ d, onRemove }) => (
    <div className="file-row" onClick={() => openTask(d.id)}>
      <StatusPill s={d.status} /><span className="ellipsis" style={{ flex: 1 }}>{d.title}</span><span className="muted small">{d.project_name}</span>
      {d.due_date && <span className="muted small">{fmtDate(d.due_date)}</span>}
      {onRemove && <button className="icon-btn xs" onClick={(e) => { e.stopPropagation(); onRemove() }}><X size={13} /></button>}
    </div>
  )
  const waiting = task.depends_on.filter((d) => d.status !== 'completed').length
  return <div className="sp-section">
    <div className="sp-h">Waiting on {waiting > 0 && <span className="badge red">{waiting} open</span>}</div>
    {task.depends_on.length ? task.depends_on.map((d) => <Item key={d.id} d={d} onRemove={() => rm(d.id)} />) : <p className="muted small">This task isn't waiting on anything.</p>}
    <div className="rel" style={{ margin: '8px 0 18px' }}>
      <input className="input sm" placeholder="Search for a task this one waits on…" value={q} onChange={(e) => setQ(e.target.value)} />
      {res.length > 0 && <div className="popover" style={{ left: 0, right: 0 }}>{res.map((r) => <button key={r.id} className="pop-item" onClick={() => add(r.id)}><span className="ellipsis" style={{ flex: 1 }}>{r.title}</span><span className="muted small">{r.project_name}</span></button>)}</div>}
    </div>
    <div className="sp-h">Blocking</div>
    {task.blocking.length ? task.blocking.map((d) => <Item key={d.id} d={d} />) : <p className="muted small">No tasks are waiting on this one.</p>}
  </div>
}

function ActivityTab({ task }) {
  if (!task.activity.length) return <p className="muted small">No activity recorded yet.</p>
  return (
    <div className="timeline">
      {task.activity.map((a) => (
        <div key={a.id} className="tl-item"><Avatar user={a.user} size={22} /><span><b>{a.user?.name || 'Someone'}</b> {a.action}</span><span className="muted small" style={{ marginLeft: 'auto' }}>{timeAgo(a.created_at)}</span></div>
      ))}
    </div>
  )
}

