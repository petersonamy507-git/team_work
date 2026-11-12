import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import {
  Plus, MoreHorizontal, Pencil, Trash2, Archive, CheckCircle2, Flag, MessageSquare, Paperclip, Download, Clock,
  Users, ListChecks, GripVertical, UserMinus, Reply, RotateCcw, Copy, DollarSign, LayoutTemplate, MoreVertical, Bot, ChevronDown, Sparkles, Building,
} from 'lucide-react'
import { api } from '../lib/api'
import { useData, useUi } from '../lib/ui-context'
import { fmtDate, fmtMinutes, timeAgo, fmtDateTime, todayISO } from '../lib/format'
import { Avatar, AvatarStack, Due, Empty, HealthPill, Loading, Menu, Modal, PriorityPill, Progress } from '../components/ui'
import TaskRow from '../components/TaskRow'
import { ProjectForm, TaskForm, TimeForm, MessageForm } from '../components/QuickAdd'
import { StarButton } from './Projects'
import { PROJECT_MORE } from './ProjectExtras'

// Teamwork project tabs: Dashboard, List, Board, Table, Files, Messages, Comments, then the rest under More…
const TABS = [['', 'Dashboard'], ['tasks', 'List'], ['board', 'Board'], ['table', 'Table'], ['files', 'Files'], ['messages', 'Messages'], ['x/comments', 'Comments']]
const MORE_TABS = [['milestones', 'Milestones'], ['time', 'Time'], ['people', 'People'], ['activity', 'Activity'], ['overview', 'Overview']]

export default function ProjectLayout() {
  const { pid } = useParams()
  const navigate = useNavigate()
  const { refresh, notify, version } = useUi()
  const [project, setProject] = useState(null)
  const [editing, setEditing] = useState(false)
  const load = () => api.get(`/projects/${pid}`).then(setProject).catch(() => navigate('/projects'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [pid, version])
  if (!project) return <div className="page"><Loading /></div>

  const setStatus = async (status) => { await api.patch(`/projects/${pid}`, { name: project.name, status }); notify(`Project ${status}`); refresh() }
  const del = async () => {
    if (!confirm(`Delete project "${project.name}" and everything in it?`)) return
    await api.del(`/projects/${pid}`); notify('Project deleted'); refresh(); navigate('/projects')
  }

  return (
    <div className="page">
      <div className="subtitle" style={{ marginBottom: 6 }}><Link to="/">Home</Link> › <Link to="/projects">Projects</Link> › {project.name}</div>
      <div className="page-head proj-head" style={{ marginBottom: 8 }}>
        <span className="proj-av" style={{ background: project.color + '33', color: project.color }}>{project.name[0]}</span>
        <h1>{project.name}</h1>
        <StarButton project={project} />
        {project.client && <Link to="/clients" className="proj-client"><Building size={13} />{project.client.name}</Link>}
        {project.status !== 'active' && <span className="pill">{project.status}</span>}
        <Menu trigger={<button className="icon-btn"><MoreVertical size={16} /></button>}>
          <button onClick={() => setEditing(true)}><Pencil size={15} />Edit project</button>
          <button onClick={async () => { const r = await api.post(`/projects/${pid}/copy`); notify('Project copied'); refresh(); navigate(`/projects/${r.id}`) }}><Copy size={15} />Copy project</button>
          <button onClick={() => navigate(`/projects/${pid}/x/finance`)}><DollarSign size={15} />Budget</button>
          <button onClick={async () => { await api.post(`/projects/${pid}/save-as-template`); notify('Saved as a template') }}><LayoutTemplate size={15} />Save as template</button>
          {project.status === 'active' ? <>
            <button onClick={() => setStatus('completed')}><CheckCircle2 size={15} />Mark complete</button>
            <button onClick={() => setStatus('archived')}><Archive size={15} />Archive</button>
          </> : <button onClick={() => setStatus('active')}><RotateCcw size={15} />Reactivate</button>}
          <button onClick={del} style={{ color: 'var(--danger)' }}><Trash2 size={15} />Delete</button>
        </Menu>
        <span className="spacer" />
        <AvatarStack users={project.members} />
        <HealthPill h={project.health} />
        <span className="split-btn"><button className="btn" onClick={() => navigate('/automate')}><Bot size={15} />Automate</button>
          <Menu trigger={<button className="btn caret" style={{ borderLeft: '1px solid var(--border)' }}><ChevronDown size={14} /></button>}>
            <button onClick={() => navigate('/automate')}><Bot size={14} />Manage automations</button>
            <button onClick={() => navigate(`/ai/ask?prompt=${encodeURIComponent('project ' + project.name)}`)}><Sparkles size={14} />Ask AI about this project</button>
          </Menu></span>
      </div>
      <div className="tabs">
        {TABS.map(([path, label]) => (
          <NavLink key={path} end={path === ''} to={`/projects/${pid}${path ? '/' + path : ''}`} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>{label}</NavLink>
        ))}
        <Menu trigger={<button className={`tab ${/\/(x\/(?!comments)|milestones|time|people|activity|overview)/.test(window.location.pathname) ? 'active' : ''}`}>More…</button>}>
          {MORE_TABS.map(([k, l]) => <button key={k} onClick={() => navigate(`/projects/${pid}/${k}`)}>{l}</button>)}
          {PROJECT_MORE.filter(([k]) => k !== 'comments').map(([k, l]) => <button key={k} onClick={() => navigate(`/projects/${pid}/x/${k}`)}>{l}</button>)}
        </Menu>
        <button className="tab" title="Add tab" onClick={() => navigate(`/projects/${pid}/x/settings`)}><Plus size={15} /></button>
      </div>
      <Outlet context={{ project, reload: load }} />
      {editing && <ProjectForm project={project} onDone={() => { setEditing(false); load() }} onCancel={() => setEditing(false)} />}
    </div>
  )
}

const useProject = () => useOutletContext()

/* ---------------- Overview ---------------- */
export function ProjectOverview() {
  const { project } = useProject()
  const { data: activity } = useData(`/projects/${project.id}/activity`)
  const { data: ms } = useData(`/projects/${project.id}/milestones`)
  const { data: late } = useData(`/tasks?project_id=${project.id}&due=late`)
  const budgetPct = project.budget_minutes ? Math.round((project.logged_minutes / project.budget_minutes) * 100) : null
  return (
    <div className="grid cols-2">
      <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
        <div className="grid cols-4">
          <div className="card stat"><div className="num">{project.progress}%</div><div className="lbl">Complete</div></div>
          <div className="card stat"><div className="num">{project.task_count - project.completed_count}</div><div className="lbl">Open tasks</div></div>
          <div className="card stat"><div className="num" style={{ color: project.late_count ? 'var(--danger)' : undefined }}>{project.late_count}</div><div className="lbl">Late tasks</div></div>
          <div className="card stat"><div className="num">{fmtMinutes(project.logged_minutes)}</div><div className="lbl">Time logged</div></div>
        </div>
        <div className="card"><div className="card-head"><h3>About</h3></div>
          <div className="card-body">
            <p className="pre" style={{ marginTop: 0 }}>{project.description || <span className="muted">No description yet.</span>}</p>
            <div className="props" style={{ margin: 0 }}>
              <span className="k">Owner</span><span className="row"><Avatar user={project.owner} size={22} />{project.owner?.name}</span>
              <span className="k">Dates</span><span>{project.start_date ? fmtDate(project.start_date, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} → {project.end_date ? fmtDate(project.end_date, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
              <span className="k">Progress</span><Progress value={project.progress} />
              {budgetPct !== null && <><span className="k">Time budget</span><span>{fmtMinutes(project.logged_minutes)} of {fmtMinutes(project.budget_minutes)} ({budgetPct}%)</span></>}
            </div>
          </div>
        </div>
        <div className="card"><div className="card-head"><h3>Late tasks</h3></div>
          {late?.length ? late.map((t) => <TaskRow key={t.id} task={t} />) : <Empty title="Nothing late" />}
        </div>
      </div>
      <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
        <div className="card"><div className="card-head"><Flag size={16} /><h3>Milestones</h3></div>
          {ms?.length ? ms.map((m) => (
            <div key={m.id} className="task-row"><Flag size={15} color={m.completed ? '#10b981' : m.late ? '#ef4444' : '#8b5cf6'} /><span className="title">{m.name}</span><span className="meta">{fmtDate(m.due_date)}</span></div>
          )) : <Empty icon={Flag} title="No milestones" />}
        </div>
        <div className="card"><div className="card-head"><h3>Recent activity</h3></div>
          <div className="card-body">
            {activity?.length ? activity.slice(0, 15).map((a) => (
              <div key={a.id} className="row small" style={{ marginBottom: 10 }}><Avatar user={a.user} size={22} /><span style={{ flex: 1 }}><b>{a.user?.name}</b> {a.action}</span><span className="muted">{timeAgo(a.created_at)}</span></div>
            )) : <span className="muted">No activity yet</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------- List view ---------------- */
export function ProjectTasks() {
  const { project } = useProject()
  const { refresh, notify } = useUi()
  const [showDone, setShowDone] = useState(false)
  const { data: lists } = useData(`/projects/${project.id}/tasklists?include_completed=${showDone}`, [showDone])
  const { data: milestones } = useData(`/projects/${project.id}/milestones`)
  const [adding, setAdding] = useState(false)
  const [newList, setNewList] = useState({ name: '', milestone_id: '' })
  const [inline, setInline] = useState({})
  const [modalList, setModalList] = useState(null)
  const [drag, setDrag] = useState(null)

  const addInline = async (e, lid) => {
    e.preventDefault()
    const title = (inline[lid] || '').trim()
    if (!title) return
    await api.post(`/projects/${project.id}/tasks`, { title, tasklist_id: lid })
    setInline({ ...inline, [lid]: '' })
    refresh()
  }
  const createList = async () => {
    if (!newList.name.trim()) return
    await api.post(`/projects/${project.id}/tasklists`, { name: newList.name, milestone_id: newList.milestone_id ? +newList.milestone_id : null })
    setNewList({ name: '', milestone_id: '' }); setAdding(false); refresh()
  }
  const renameList = async (l) => {
    const name = prompt('Rename task list', l.name)
    if (name?.trim()) { await api.patch(`/projects/tasklists/${l.id}`, { name }); refresh() }
  }
  const deleteList = async (l) => {
    if (!confirm(`Delete "${l.name}" and all its tasks?`)) return
    await api.del(`/projects/tasklists/${l.id}`); notify('Task list deleted'); refresh()
  }
  const dropOn = async (lid, index) => {
    if (!drag) return
    await api.post(`/tasks/${drag.id}/move?tasklist_id=${lid}&position=${index}`)
    setDrag(null); refresh()
  }

  if (!lists) return <Loading />
  return (
    <>
      <div className="page-head">
        <label className="row small muted"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />Show completed tasks</label>
        <span className="spacer" />
        <button className="btn" onClick={() => setAdding(true)}><Plus size={16} />Add task list</button>
        <button className="btn primary" onClick={() => setModalList(lists[0]?.id || 0)}><Plus size={16} />Add task</button>
      </div>
      {adding && (
        <div className="card card-body row" style={{ marginBottom: 16 }}>
          <input className="input" autoFocus placeholder="Task list name" value={newList.name} onChange={(e) => setNewList({ ...newList, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && createList()} />
          <select className="select" style={{ width: 220 }} value={newList.milestone_id} onChange={(e) => setNewList({ ...newList, milestone_id: e.target.value })}>
            <option value="">No milestone</option>{milestones?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button className="btn primary" onClick={createList}>Add</button><button className="btn" onClick={() => setAdding(false)}>Cancel</button>
        </div>
      )}
      {lists.length === 0 && <div className="card"><Empty icon={ListChecks} title="No task lists yet" /></div>}
      {lists.map((l) => {
        const total = l.tasks.filter((t) => t.status !== 'completed').length + l.completed_count
        return (
          <div className="card list-block" key={l.id} onDragOver={(e) => e.preventDefault()} onDrop={() => dropOn(l.id, l.tasks.length)}>
            <div className="list-head">
              <h3>{l.name}</h3>
              <span className="muted small">{l.completed_count}/{total} done</span>
              {l.milestone_id && <span className="pill"><Flag size={11} />{milestones?.find((m) => m.id === l.milestone_id)?.name}</span>}
              <span style={{ flex: 1 }} />
              <Menu trigger={<button className="icon-btn"><MoreHorizontal size={16} /></button>}>
                <button onClick={() => setModalList(l.id)}><Plus size={15} />Add task with details</button>
                <button onClick={() => renameList(l)}><Pencil size={15} />Rename</button>
                <button onClick={() => deleteList(l)} style={{ color: 'var(--danger)' }}><Trash2 size={15} />Delete list</button>
              </Menu>
            </div>
            {l.tasks.map((t, i) => (
              <div key={t.id} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); dropOn(l.id, i) }}>
                <TaskRow task={t} draggable onDragStart={() => setDrag(t)} />
              </div>
            ))}
            <form className="add-task-inline" onSubmit={(e) => addInline(e, l.id)}>
              <Plus size={16} className="muted" />
              <input placeholder="Add a task, press Enter" value={inline[l.id] || ''} onChange={(e) => setInline({ ...inline, [l.id]: e.target.value })} />
            </form>
          </div>
        )
      })}
      {modalList !== null && <TaskForm projectId={project.id} tasklistId={modalList || undefined} onDone={() => setModalList(null)} onCancel={() => setModalList(null)} />}
    </>
  )
}

/* ---------------- Board view ---------------- */
export function ProjectBoard() {
  const { project } = useProject()
  const { openTask, refresh } = useUi()
  const { data: cols, setData } = useData(`/projects/${project.id}/board`)
  const [drag, setDrag] = useState(null)
  const [over, setOver] = useState(null)
  const [adding, setAdding] = useState({})
  if (!cols) return <Loading />

  const drop = async (colId, index) => {
    setOver(null)
    if (!drag) return
    // optimistic move
    const next = cols.map((c) => ({ ...c, tasks: c.tasks.filter((t) => t.id !== drag.id) }))
    const target = next.find((c) => c.id === colId)
    target.tasks.splice(index ?? target.tasks.length, 0, drag)
    setData(next)
    await api.post(`/tasks/${drag.id}/move?column_id=${colId}&position=${index ?? target.tasks.length - 1}`)
    setDrag(null)
    refresh()
  }
  const addCard = async (e, col) => {
    e.preventDefault()
    const title = (adding[col.id] || '').trim()
    if (!title) return
    await api.post(`/projects/${project.id}/tasks`, { title, column_id: col.id })
    setAdding({ ...adding, [col.id]: '' }); refresh()
  }
  const addColumn = async () => {
    const name = prompt('Column name')
    if (name?.trim()) { await api.post(`/projects/${project.id}/columns`, { name }); refresh() }
  }
  const renameColumn = async (c) => {
    const name = prompt('Rename column', c.name)
    if (name?.trim()) { await api.patch(`/projects/columns/${c.id}`, { name }); refresh() }
  }
  const deleteColumn = async (c) => {
    if (!confirm(`Delete column "${c.name}"? Its tasks move to the first column.`)) return
    await api.del(`/projects/columns/${c.id}`); refresh()
  }
  const recolor = async (c, color) => { await api.patch(`/projects/columns/${c.id}`, { name: c.name, color }); refresh() }

  return (
    <div className="board">
      {cols.map((c) => (
        <div className="column" key={c.id}>
          <div className="column-head" style={{ borderTop: `3px solid ${c.color}`, borderRadius: '10px 10px 0 0' }}>
            <span className="ellipsis">{c.name}</span><span className="badge grey">{c.tasks.length}</span><span style={{ flex: 1 }} />
            <Menu trigger={<button className="icon-btn"><MoreHorizontal size={16} /></button>}>
              <button onClick={() => renameColumn(c)}><Pencil size={15} />Rename</button>
              <div className="row" style={{ padding: '6px 10px', gap: 6 }}>{['#94a3b8', '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'].map((col) => <span key={col} onClick={() => recolor(c, col)} style={{ width: 18, height: 18, borderRadius: 4, background: col, cursor: 'pointer' }} />)}</div>
              <button onClick={() => deleteColumn(c)} style={{ color: 'var(--danger)' }}><Trash2 size={15} />Delete column</button>
            </Menu>
          </div>
          <div className={`column-body ${over === c.id ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(c.id) }} onDragLeave={() => setOver(null)} onDrop={() => drop(c.id)}>
            {c.tasks.map((t, i) => (
              <div key={t.id} className={`bcard ${drag?.id === t.id ? 'dragging' : ''}`} style={{ borderLeftColor: t.priority === 'high' ? '#ef4444' : t.priority === 'medium' ? '#f59e0b' : 'transparent' }}
                draggable onDragStart={() => setDrag(t)} onDragEnd={() => setDrag(null)} onClick={() => openTask(t.id)}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(c.id) }} onDrop={(e) => { e.stopPropagation(); drop(c.id, i) }}>
                <div className="t" style={{ textDecoration: t.status === 'completed' ? 'line-through' : undefined }}>{t.title}</div>
                {t.tags.length > 0 && <div className="row" style={{ gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>{t.tags.map((x) => <span className="tag" key={x}>{x}</span>)}</div>}
                <div className="m"><span className="ellipsis" style={{ flex: 1 }}>{t.tasklist_name}</span><PriorityPill p={t.priority} /><Due task={t} /><Avatar user={t.assignee} size={22} /></div>
              </div>
            ))}
            <form onSubmit={(e) => addCard(e, c)}><input className="input" placeholder="+ Add card" value={adding[c.id] || ''} onChange={(e) => setAdding({ ...adding, [c.id]: e.target.value })} style={{ background: 'transparent', border: '1px dashed #c3c7d6' }} /></form>
          </div>
        </div>
      ))}
      <button className="btn" style={{ flexShrink: 0 }} onClick={addColumn}><Plus size={16} />Add column</button>
    </div>
  )
}

/* ---------------- Table view ---------------- */
export function ProjectTable() {
  const { project } = useProject()
  const { openTask, people, refresh } = useUi()
  const [status, setStatus] = useState('open')
  const [sort, setSort] = useState({ k: 'due_date', dir: 1 })
  const { data } = useData(`/tasks?project_id=${project.id}&status=${status}`, [status])
  if (!data) return <Loading />
  const val = (t, k) => k === 'assignee' ? t.assignee?.name || '' : t[k] ?? ''
  const rows = [...data].sort((a, b) => (val(a, sort.k) > val(b, sort.k) ? 1 : val(a, sort.k) < val(b, sort.k) ? -1 : 0) * sort.dir)
  const th = (k, label) => <th style={{ cursor: 'pointer' }} onClick={() => setSort({ k, dir: sort.k === k ? -sort.dir : 1 })}>{label}{sort.k === k ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}</th>
  const patch = async (t, body) => { await api.patch(`/tasks/${t.id}`, body); refresh() }
  return (
    <>
      <div className="page-head"><div className="seg">{['open', 'completed', 'all'].map((s) => <button key={s} className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>{s}</button>)}</div></div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead><tr>{th('title', 'Task')}{th('tasklist_name', 'List')}{th('assignee', 'Assignee')}{th('status', 'Status')}{th('priority', 'Priority')}{th('start_date', 'Start')}{th('due_date', 'Due')}{th('estimate_minutes', 'Estimate')}{th('progress', 'Progress')}</tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td><a style={{ cursor: 'pointer', fontWeight: 500 }} onClick={() => openTask(t.id)}>{t.title}</a></td>
                <td className="muted">{t.tasklist_name}</td>
                <td><select className="select" style={{ padding: '3px 6px' }} value={t.assignee?.id || ''} onChange={(e) => patch(t, { assignee_id: e.target.value ? +e.target.value : null })}><option value="">Anyone</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                <td><select className="select" style={{ padding: '3px 6px' }} value={t.status} onChange={(e) => patch(t, { status: e.target.value })}><option value="new">To do</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></td>
                <td><PriorityPill p={t.priority} /></td>
                <td className="muted">{fmtDate(t.start_date)}</td>
                <td><Due task={t} /></td>
                <td className="muted">{t.estimate_minutes ? fmtMinutes(t.estimate_minutes) : ''}</td>
                <td style={{ width: 120 }}><Progress value={t.progress} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty title="No tasks" />}
      </div>
    </>
  )
}

/* ---------------- Milestones ---------------- */
export function MilestoneForm({ projectId, milestone, onDone, onCancel }) {
  const { people } = useUi()
  const [f, setF] = useState({ name: milestone?.name || '', description: milestone?.description || '', due_date: milestone?.due_date || '', owner_id: milestone?.owner?.id || '' })
  const submit = async () => {
    if (!f.name.trim()) return
    const body = { ...f, due_date: f.due_date || null, owner_id: f.owner_id ? +f.owner_id : null }
    milestone ? await api.patch(`/milestones/${milestone.id}`, body) : await api.post(`/projects/${projectId}/milestones`, body)
    onDone()
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <Modal title={milestone ? 'Edit milestone' : 'Add milestone'} onClose={onCancel} footer={<><button className="btn" onClick={onCancel}>Cancel</button><button className="btn primary" onClick={submit}>Save</button></>}>
      <div className="field"><label>Name</label><input className="input" autoFocus value={f.name} onChange={set('name')} /></div>
      <div className="row">
        <div className="field"><label>Due date</label><input type="date" className="input" value={f.due_date} onChange={set('due_date')} /></div>
        <div className="field"><label>Responsible</label><select className="select" value={f.owner_id} onChange={set('owner_id')}><option value="">Nobody</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      </div>
      <div className="field"><label>Description</label><textarea className="textarea" value={f.description} onChange={set('description')} /></div>
    </Modal>
  )
}

export function MilestoneRow({ m, onEdit, showProject }) {
  const { refresh } = useUi()
  const toggle = async () => { await api.patch(`/milestones/${m.id}`, { completed: !m.completed }); refresh() }
  const del = async () => { if (confirm('Delete milestone?')) { await api.del(`/milestones/${m.id}`); refresh() } }
  const pct = m.task_count ? Math.round((m.completed_count / m.task_count) * 100) : 0
  return (
    <div className="task-row" style={{ padding: '12px 14px' }}>
      <button className={`check ${m.completed ? 'on' : ''}`} onClick={toggle}>{m.completed && '✓'}</button>
      <Flag size={16} color={m.completed ? '#10b981' : m.late ? '#ef4444' : '#8b5cf6'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, textDecoration: m.completed ? 'line-through' : undefined }}>{m.name}</div>
        <div className="small muted">{showProject && <>{m.project_name} · </>}{m.tasklists?.length ? `${m.tasklists.length} task list(s), ${m.completed_count}/${m.task_count} tasks done` : 'No task lists linked'}</div>
      </div>
      {m.task_count > 0 && <div style={{ width: 100 }}><Progress value={pct} /></div>}
      <Avatar user={m.owner} size={24} />
      <span className={`due ${m.late ? 'late' : ''}`} style={{ width: 70, textAlign: 'right' }}>{fmtDate(m.due_date)}</span>
      {onEdit && <Menu trigger={<button className="icon-btn"><MoreHorizontal size={16} /></button>}>
        <button onClick={onEdit}><Pencil size={15} />Edit</button>
        <button onClick={del} style={{ color: 'var(--danger)' }}><Trash2 size={15} />Delete</button>
      </Menu>}
    </div>
  )
}

export function ProjectMilestones() {
  const { project } = useProject()
  const { refresh } = useUi()
  const { data } = useData(`/projects/${project.id}/milestones`)
  const [edit, setEdit] = useState(null)
  if (!data) return <Loading />
  const groups = [['Late', data.filter((m) => m.late)], ['Upcoming', data.filter((m) => !m.completed && !m.late)], ['Completed', data.filter((m) => m.completed)]]
  return (
    <>
      <div className="page-head"><span className="spacer" /><button className="btn primary" onClick={() => setEdit({})}><Plus size={16} />Add milestone</button></div>
      {data.length === 0 ? <div className="card"><Empty icon={Flag} title="No milestones" text="Milestones mark key dates and deliverables" /></div> :
        groups.filter(([, x]) => x.length).map(([label, items]) => (
          <div className="card list-block" key={label}>
            <div className="list-head"><h3>{label}</h3><span className="badge grey">{items.length}</span></div>
            {items.map((m) => <MilestoneRow key={m.id} m={m} onEdit={() => setEdit(m)} />)}
          </div>
        ))}
      {edit && <MilestoneForm projectId={project.id} milestone={edit.id ? edit : null} onDone={() => { setEdit(null); refresh() }} onCancel={() => setEdit(null)} />}
    </>
  )
}

/* ---------------- Messages ---------------- */
export function ProjectMessages() {
  const { project } = useProject()
  const navigate = useNavigate()
  const { data } = useData(`/projects/${project.id}/messages`)
  const [adding, setAdding] = useState(false)
  if (!data) return <Loading />
  return (
    <>
      <div className="page-head"><span className="spacer" /><button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} />New message</button></div>
      <div className="card">
        {data.length === 0 ? <Empty icon={MessageSquare} title="No messages yet" text="Start a discussion with the project team" /> : data.map((m) => (
          <Link key={m.id} to={`/projects/${project.id}/messages/${m.id}`} className="task-row" style={{ padding: '12px 14px', alignItems: 'flex-start' }}>
            <Avatar user={m.user} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{m.title}</div>
              <div className="muted small ellipsis">{m.body}</div>
              <div className="muted small" style={{ marginTop: 4 }}>{m.user?.name} · {timeAgo(m.created_at)}</div>
            </div>
            <span className="pill"><Reply size={12} />{m.reply_count}</span>
          </Link>
        ))}
      </div>
      {adding && <MessageForm projectId={project.id} onDone={(m) => { setAdding(false); navigate(`/projects/${project.id}/messages/${m.id}`) }} onCancel={() => setAdding(false)} />}
    </>
  )
}

export function MessageDetail() {
  const { project } = useProject()
  const { mid } = useParams()
  const navigate = useNavigate()
  const { data, setData } = useData(`/messages/${mid}`, [mid])
  const [reply, setReply] = useState('')
  if (!data) return <Loading />
  const send = async (e) => {
    e.preventDefault()
    if (!reply.trim()) return
    setData(await api.post(`/messages/${mid}/replies`, { body: reply })); setReply('')
  }
  const del = async () => { if (confirm('Delete message?')) { await api.del(`/messages/${mid}`); navigate(`/projects/${project.id}/messages`) } }
  return (
    <div style={{ maxWidth: 860 }}>
      <Link to={`/projects/${project.id}/messages`} className="small muted">← All messages</Link>
      <div className="card" style={{ marginTop: 10 }}>
        <div className="card-head"><Avatar user={data.user} size={34} /><div><h2>{data.title}</h2><div className="muted small">{data.user?.name} · {fmtDateTime(data.created_at)}</div></div><span className="spacer" /><button className="icon-btn" onClick={del}><Trash2 size={16} /></button></div>
        <div className="card-body pre">{data.body}</div>
      </div>
      <h3 style={{ margin: '20px 0 12px' }}>{data.replies.length} replies</h3>
      {data.replies.map((r) => (
        <div className="comment" key={r.id}><Avatar user={r.user} /><div className="bubble"><div className="who">{r.user?.name}<span className="when">{timeAgo(r.created_at)}</span></div><div className="pre">{r.body}</div></div></div>
      ))}
      <form onSubmit={send}>
        <textarea className="textarea" placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
        <div style={{ marginTop: 8, textAlign: 'right' }}><button className="btn primary">Reply</button></div>
      </form>
    </div>
  )
}

/* ---------------- Files ---------------- */
function fmtSize(b) { return b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB` }

export function ProjectFiles() {
  const { project } = useProject()
  const { refresh, notify } = useUi()
  const { data } = useData(`/projects/${project.id}/files`)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const upload = async (files) => {
    setBusy(true)
    try {
      for (const f of files) { const fd = new FormData(); fd.append('file', f); await api.upload(`/projects/${project.id}/files`, fd) }
      notify(`${files.length} file(s) uploaded`)
    } catch (e) { alert(e.message) }
    setBusy(false); refresh()
  }
  const del = async (f) => { if (confirm(`Delete ${f.name}?`)) { await api.del(`/files/${f.id}`); refresh() } }
  if (!data) return <Loading />
  return (
    <>
      <div className={`card card-body`} style={{ border: `2px dashed ${over ? 'var(--accent)' : '#d4d7e3'}`, textAlign: 'center', marginBottom: 16, background: over ? 'var(--accent-soft)' : undefined }}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); upload([...e.dataTransfer.files]) }}>
        <Paperclip size={22} className="muted" />
        <div style={{ margin: '6px 0' }}>{busy ? 'Uploading…' : 'Drag files here or'}</div>
        <label className="btn primary">Choose files<input type="file" multiple hidden onChange={(e) => upload([...e.target.files])} /></label>
      </div>
      <div className="card">
        {data.length === 0 ? <Empty icon={Paperclip} title="No files yet" /> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Size</th><th>Uploaded by</th><th>Date</th><th /></tr></thead>
            <tbody>{data.map((f) => (
              <tr key={f.id}>
                <td><span className="row"><Paperclip size={14} className="muted" />{f.name}</span></td>
                <td className="muted">{fmtSize(f.size)}</td>
                <td><span className="row"><Avatar user={f.user} size={22} />{f.user?.name}</span></td>
                <td className="muted">{fmtDateTime(f.created_at)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="icon-btn" title="Download" onClick={() => api.download(`/files/${f.id}/download`, f.name)}><Download size={16} /></button>
                  <button className="icon-btn" title="Delete" onClick={() => del(f)}><Trash2 size={16} /></button>
                </td>
              </tr>))}</tbody>
          </table>
        )}
      </div>
    </>
  )
}

/* ---------------- Time ---------------- */
export function TimeTable({ entries, onEdit }) {
  const { refresh } = useUi()
  const del = async (e) => { if (confirm('Delete this time entry?')) { await api.del(`/time/${e.id}`); refresh() } }
  if (!entries.length) return <Empty icon={Clock} title="No time logged" />
  return (
    <table className="table">
      <thead><tr><th>Date</th><th>Person</th><th>Project</th><th>Task</th><th>Description</th><th>Billable</th><th style={{ textAlign: 'right' }}>Time</th><th /></tr></thead>
      <tbody>{entries.map((e) => (
        <tr key={e.id}>
          <td className="muted">{fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
          <td><span className="row"><Avatar user={e.user} size={22} />{e.user?.name}</span></td>
          <td>{e.project_name}</td>
          <td className="muted">{e.task_title || '—'}</td>
          <td>{e.description}</td>
          <td>{e.billable ? <span className="badge">Billable</span> : <span className="badge grey">No</span>}</td>
          <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtMinutes(e.minutes)}</td>
          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
            {onEdit && <button className="icon-btn" onClick={() => onEdit(e)}><Pencil size={15} /></button>}
            <button className="icon-btn" onClick={() => del(e)}><Trash2 size={15} /></button>
          </td>
        </tr>))}</tbody>
    </table>
  )
}

export function ProjectTime() {
  const { project } = useProject()
  const { data } = useData(`/time?user_id=all&project_id=${project.id}`)
  const [form, setForm] = useState(null)
  if (!data) return <Loading />
  const total = data.reduce((a, b) => a + b.minutes, 0)
  const billable = data.filter((e) => e.billable).reduce((a, b) => a + b.minutes, 0)
  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <div className="card stat"><div className="num">{fmtMinutes(total)}</div><div className="lbl">Total logged</div></div>
        <div className="card stat"><div className="num">{fmtMinutes(billable)}</div><div className="lbl">Billable</div></div>
        <div className="card stat"><div className="num">{fmtMinutes(total - billable)}</div><div className="lbl">Non-billable</div></div>
        <div className="card stat"><div className="num">{project.budget_minutes ? fmtMinutes(Math.max(0, project.budget_minutes - total)) : '—'}</div><div className="lbl">Budget remaining</div></div>
      </div>
      <div className="page-head"><span className="spacer" /><button className="btn primary" onClick={() => setForm({})}><Plus size={16} />Log time</button></div>
      <div className="card" style={{ overflowX: 'auto' }}><TimeTable entries={data} onEdit={setForm} /></div>
      {form && <TimeForm entry={form.id ? form : null} projectId={project.id} onDone={() => setForm(null)} onCancel={() => setForm(null)} />}
    </>
  )
}

/* ---------------- People ---------------- */
export function ProjectPeople() {
  const { project } = useProject()
  const { people, refresh } = useUi()
  const { data } = useData(`/projects/${project.id}/people`)
  const [pick, setPick] = useState('')
  if (!data) return <Loading />
  const others = people.filter((p) => !data.some((d) => d.id === p.id))
  const add = async () => { if (pick) { await api.post(`/projects/${project.id}/people/${pick}`); setPick(''); refresh() } }
  const remove = async (u) => { if (confirm(`Remove ${u.name} from this project?`)) { await api.del(`/projects/${project.id}/people/${u.id}`); refresh() } }
  return (
    <>
      <div className="page-head"><span className="spacer" />
        <select className="select" style={{ width: 220 }} value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Add someone…</option>{others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <button className="btn primary" onClick={add}><Users size={16} />Add to project</button>
      </div>
      <div className="grid cols-3">
        {data.map((u) => (
          <div key={u.id} className="card card-body row">
            <Avatar user={u} size={42} />
            <Link to={`/people/${u.id}`} style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{u.name}</div><div className="muted small">{u.title || u.email}</div><div className="small">{u.open_tasks} open tasks here</div></Link>
            <button className="icon-btn" title="Remove" onClick={() => remove(u)}><UserMinus size={16} /></button>
          </div>
        ))}
      </div>
    </>
  )
}

/* ---------------- Activity ---------------- */
export function ProjectActivity() {
  const { project } = useProject()
  const { data } = useData(`/projects/${project.id}/activity`)
  if (!data) return <Loading />
  return (
    <div className="card">
      {data.length === 0 ? <Empty title="No activity yet" /> : data.map((a) => (
        <div key={a.id} className="task-row"><Avatar user={a.user} size={26} /><span style={{ flex: 1 }}><b>{a.user?.name}</b> {a.action}</span><span className="muted small">{fmtDateTime(a.created_at)}</span></div>
      ))}
    </div>
  )
}
