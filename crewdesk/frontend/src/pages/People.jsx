import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { UserPlus, Users } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useData, useUi } from '../lib/ui-context'
import { fmtMinutes } from '../lib/format'
import { Avatar, Empty, Loading, Modal, HealthPill } from '../components/ui'
import TaskRow from '../components/TaskRow'
import { TimeTable } from './Project'

function AddPerson({ onClose }) {
  const { refresh, notify } = useUi()
  const [f, setF] = useState({ name: '', email: '', title: '', password: '', role: 'member' })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async () => {
    try { await api.post('/people', { ...f, password: f.password || 'changeme123' }); notify('Person added'); refresh(); onClose() } catch (e) { setErr(e.message) }
  }
  return (
    <Modal title="Add person" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={submit}>Add</button></>}>
      {err && <div className="error">{err}</div>}
      <div className="row"><div className="field"><label>Full name</label><input className="input" autoFocus value={f.name} onChange={set('name')} /></div>
        <div className="field"><label>Job title</label><input className="input" value={f.title} onChange={set('title')} /></div></div>
      <div className="field"><label>Email</label><input className="input" type="email" value={f.email} onChange={set('email')} /></div>
      <div className="row"><div className="field"><label>Temporary password</label><input className="input" placeholder="changeme123" value={f.password} onChange={set('password')} /></div>
        <div className="field"><label>Role</label><select className="select" value={f.role} onChange={set('role')}><option value="member">Member</option><option value="admin">Admin</option><option value="client">Client</option></select></div></div>
    </Modal>
  )
}

export default function People() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data } = useData('/people')
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const items = (data || []).filter((p) => (p.name + p.email).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="page">
      <div className="page-head"><h1>People</h1><span className="spacer" />
        <input className="input" style={{ width: 220 }} placeholder="Filter people" value={q} onChange={(e) => setQ(e.target.value)} />
        {user.role === 'admin' && <button className="btn primary" onClick={() => setAdding(true)}><UserPlus size={16} />Add person</button>}</div>
      <div className="card" style={{ overflowX: 'auto' }}>
        {!data ? <Loading /> : items.length === 0 ? <Empty icon={Users} title="No people" /> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Title</th><th>Role</th><th>Projects</th><th>Open tasks</th><th>Late</th><th>Logged this week</th></tr></thead>
            <tbody>{items.map((p) => (
              <tr key={p.id} className="click" onClick={() => navigate(`/people/${p.id}`)}>
                <td><span className="row"><Avatar user={p} size={30} /><span><b>{p.name}</b><div className="muted small">{p.email}</div></span></span></td>
                <td>{p.title || '—'}</td>
                <td><span className="pill">{p.role}</span>{!p.is_active && <span className="badge red" style={{ marginLeft: 6 }}>inactive</span>}</td>
                <td>{p.project_count}</td><td>{p.open_tasks}</td>
                <td>{p.late_tasks ? <span className="badge red">{p.late_tasks}</span> : 0}</td>
                <td>{fmtMinutes(p.week_minutes)}</td>
              </tr>))}</tbody>
          </table>)}
      </div>
      {adding && <AddPerson onClose={() => setAdding(false)} />}
    </div>
  )
}

export function PersonDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { refresh } = useUi()
  const { data } = useData(`/people/${id}`, [id])
  const [tab, setTab] = useState('tasks')
  if (!data) return <div className="page"><Loading /></div>
  const toggleActive = async () => { await api.patch(`/people/${id}`, { is_active: !data.is_active }); refresh() }
  return (
    <div className="page">
      <div className="page-head">
        <Avatar user={data} size={56} />
        <div><h1>{data.name}</h1><div className="muted">{data.title || 'No title'} · {data.email}</div></div>
        <span className="spacer" />
        {user.role === 'admin' && user.id !== data.id && <button className="btn" onClick={toggleActive}>{data.is_active ? 'Deactivate' : 'Reactivate'}</button>}
      </div>
      <div className="tabs">
        {[['tasks', `Tasks (${data.tasks.length})`], ['projects', `Projects (${data.projects.length})`], ['time', 'Recent time']].map(([k, l]) => <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'tasks' && <div className="card">{data.tasks.length ? data.tasks.map((t) => <TaskRow key={t.id} task={t} showProject />) : <Empty title="No open tasks" />}</div>}
      {tab === 'projects' && <div className="grid cols-3">{data.projects.map((p) => (
        <Link key={p.id} to={`/projects/${p.id}`} className="card card-body row"><span className="dot" style={{ background: p.color, width: 12, height: 12 }} /><b style={{ flex: 1 }}>{p.name}</b><HealthPill h={p.health} /></Link>))}</div>}
      {tab === 'time' && <div className="card" style={{ overflowX: 'auto' }}><TimeTable entries={data.time} /></div>}
    </div>
  )
}
