import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useUi } from '../lib/ui-context'
import { PROJECT_COLORS, parseDuration, todayISO, fmtMinutes } from '../lib/format'
import { Modal } from './ui'
import AddTaskDialog, { MilestoneForm, EventForm } from './AddTaskDialog'

export { default as TaskForm } from './AddTaskDialog'

export function ProjectForm({ project, onDone, onCancel }) {
  const { people, refresh, notify } = useUi()
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [f, setF] = useState({
    name: project?.name || '', description: project?.description || '', color: project?.color || PROJECT_COLORS[0],
    start_date: project?.start_date || '', end_date: project?.end_date || '', client_id: project?.client?.id || '',
    health: project?.health || 'none', budget: project?.budget_minutes ? String(project.budget_minutes / 60) : '',
    member_ids: project?.members?.map((m) => m.id) || [],
  })
  const [err, setErr] = useState('')
  useEffect(() => { api.get('/clients').then(setClients) }, [])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const toggleMember = (id) => setF({ ...f, member_ids: f.member_ids.includes(id) ? f.member_ids.filter((x) => x !== id) : [...f.member_ids, id] })
  const submit = async () => {
    if (!f.name.trim()) return setErr('Project name is required')
    const body = { name: f.name, description: f.description || null, color: f.color, start_date: f.start_date || null,
      end_date: f.end_date || null, client_id: f.client_id ? +f.client_id : null, health: f.health,
      budget_minutes: f.budget ? Math.round(parseFloat(f.budget) * 60) : null, member_ids: f.member_ids }
    try {
      const p = project ? await api.patch(`/projects/${project.id}`, body) : await api.post('/projects', body)
      notify(project ? 'Project updated' : 'Project created'); refresh(); onDone?.(p)
      if (!project) navigate(`/projects/${p.id}/tasks`)
    } catch (e) { setErr(e.message) }
  }
  return (
    <Modal title={project ? 'Edit project' : 'Add project'} onClose={onCancel} footer={<><button className="btn" onClick={onCancel}>Cancel</button><button className="btn primary" onClick={submit}>{project ? 'Save' : 'Create project'}</button></>}>
      {err && <div className="error">{err}</div>}
      <div className="field"><label>Project name</label><input className="input" autoFocus value={f.name} onChange={set('name')} /></div>
      <div className="field"><label>Description</label><textarea className="textarea" value={f.description} onChange={set('description')} /></div>
      <div className="row">
        <div className="field"><label>Start date</label><input type="date" className="input" value={f.start_date} onChange={set('start_date')} /></div>
        <div className="field"><label>End date</label><input type="date" className="input" value={f.end_date} onChange={set('end_date')} /></div>
      </div>
      <div className="row">
        <div className="field"><label>Client</label>
          <select className="select" value={f.client_id} onChange={set('client_id')}><option value="">No client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="field"><label>Health</label>
          <select className="select" value={f.health} onChange={set('health')}><option value="none">Not set</option><option value="good">Good</option><option value="at_risk">At risk</option><option value="needs_attention">Needs attention</option></select></div>
        <div className="field"><label>Time budget (hours)</label><input className="input" type="number" min="0" value={f.budget} onChange={set('budget')} /></div>
      </div>
      <div className="field"><label>Color</label>
        <div className="row">{PROJECT_COLORS.map((c) => (
          <button key={c} onClick={() => setF({ ...f, color: c })} style={{ width: 26, height: 26, borderRadius: 6, background: c, border: f.color === c ? '3px solid #1e2133' : '0' }} />
        ))}</div></div>
      <div className="field"><label>People</label>
        <div className="row" style={{ flexWrap: 'wrap' }}>{people.map((p) => (
          <label key={p.id} className="pill" style={{ cursor: 'pointer', background: f.member_ids.includes(p.id) ? 'var(--accent-soft)' : undefined }}>
            <input type="checkbox" checked={f.member_ids.includes(p.id)} onChange={() => toggleMember(p.id)} />{p.name}
          </label>))}</div></div>
    </Modal>
  )
}

export function TimeForm({ entry, projectId, onDone, onCancel }) {
  const { projects, refresh, notify } = useUi()
  const [f, setF] = useState({
    project_id: entry?.project_id || projectId || '', task_id: entry?.task_id || '', date: entry?.date || todayISO(),
    dur: entry ? fmtMinutes(entry.minutes) : '', description: entry?.description || '', billable: entry ? entry.billable : true,
  })
  const [tasks, setTasks] = useState([])
  const [err, setErr] = useState('')
  useEffect(() => { if (f.project_id) api.get(`/tasks?project_id=${f.project_id}&status=all`).then(setTasks) }, [f.project_id])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async () => {
    const minutes = parseDuration(f.dur)
    if (!f.project_id || !minutes) return setErr('Pick a project and enter a duration like 1h 30m')
    const body = { project_id: +f.project_id, task_id: f.task_id ? +f.task_id : null, date: f.date, minutes, description: f.description || null, billable: f.billable }
    try {
      entry ? await api.patch(`/time/${entry.id}`, body) : await api.post('/time', body)
      notify(`Logged ${fmtMinutes(minutes)}`); refresh(); onDone?.()
    } catch (e) { setErr(e.message) }
  }
  return (
    <Modal title={entry ? 'Edit time' : 'Log time'} onClose={onCancel} footer={<><button className="btn" onClick={onCancel}>Cancel</button><button className="btn primary" onClick={submit}>{entry ? 'Save' : 'Log time'}</button></>}>
      {err && <div className="error">{err}</div>}
      <div className="row">
        <div className="field"><label>Project</label>
          <select className="select" value={f.project_id} onChange={set('project_id')}><option value="">Choose…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="field"><label>Task (optional)</label>
          <select className="select" value={f.task_id} onChange={set('task_id')}><option value="">No task</option>{tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></div>
      </div>
      <div className="row">
        <div className="field"><label>Date</label><input type="date" className="input" value={f.date} onChange={set('date')} /></div>
        <div className="field"><label>Duration</label><input className="input" placeholder="1h 30m" autoFocus value={f.dur} onChange={set('dur')} /></div>
      </div>
      <div className="field"><label>Description</label><input className="input" value={f.description} onChange={set('description')} /></div>
      <label className="row small"><input type="checkbox" checked={f.billable} onChange={(e) => setF({ ...f, billable: e.target.checked })} /> Billable</label>
    </Modal>
  )
}

export function MessageForm({ projectId, onDone, onCancel }) {
  const { projects, refresh, notify } = useUi()
  const [f, setF] = useState({ project_id: projectId || '', title: '', body: '' })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async () => {
    if (!f.project_id || !f.title.trim() || !f.body.trim()) return setErr('Fill in project, subject and message')
    try {
      const m = await api.post(`/projects/${f.project_id}/messages`, { title: f.title, body: f.body })
      notify('Message posted'); refresh(); onDone?.(m)
    } catch (e) { setErr(e.message) }
  }
  return (
    <Modal title="New message" onClose={onCancel} footer={<><button className="btn" onClick={onCancel}>Cancel</button><button className="btn primary" onClick={submit}>Post</button></>}>
      {err && <div className="error">{err}</div>}
      <div className="field"><label>Project</label>
        <select className="select" value={f.project_id} onChange={set('project_id')} disabled={!!projectId}><option value="">Choose…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div className="field"><label>Subject</label><input className="input" autoFocus value={f.title} onChange={set('title')} /></div>
      <div className="field"><label>Message</label><textarea className="textarea" style={{ minHeight: 160 }} value={f.body} onChange={set('body')} /></div>
    </Modal>
  )
}

export default function QuickAdd() {
  const { quickAdd, setQuickAdd } = useUi()
  const navigate = useNavigate()
  if (!quickAdd) return null
  const close = () => setQuickAdd(null)
  const kind = typeof quickAdd === 'object' ? quickAdd.kind : quickAdd
  if (kind === 'task') return <AddTaskDialog defaults={typeof quickAdd === 'object' ? quickAdd : {}} onDone={close} onCancel={close} />
  if (kind === 'milestone') return <MilestoneForm onDone={close} onCancel={close} />
  if (kind === 'event') return <EventForm onDone={close} onCancel={close} />
  if (quickAdd === 'project') return <ProjectForm onDone={close} onCancel={close} />
  if (quickAdd === 'time') return <TimeForm onDone={close} onCancel={close} />
  if (quickAdd === 'message') return <MessageForm onDone={(m) => { close(); navigate(`/projects/${m.project_id}/messages/${m.id}`) }} onCancel={close} />
  return null
}
