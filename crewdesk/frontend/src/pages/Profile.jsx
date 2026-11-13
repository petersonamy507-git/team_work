// Person profile (Teamwork /app/people/:id/*): Details, Events, Projects, Tasks, Teams, Completed, Milestones, Time, Activity, Integrations
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, MessageCircle, MoreVertical, Mail, Phone, Briefcase, Building2, Clock, CheckSquare, Flag, Plug, Trash2, UserX, UserCheck } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useData, useUi } from '../lib/ui-context'
import { fmtDate, timeAgo, fmtMinutes } from '../lib/format'
import { Avatar, HealthPill, Menu } from '../components/ui'
import TaskRow from '../components/TaskRow'
import { EmptyState, DataTable, FormModal, Pill, useRows } from '../components/Kit'
import { INTEGRATIONS } from './SiteSettings'

const TABS = [['details', 'Details'], ['events', 'Events'], ['projects', 'Projects'], ['tasks', 'Tasks'], ['teams', 'Teams'], ['completed', 'Completed'],
  ['milestones', 'Milestones'], ['time', 'Time'], ['activity', 'Activity'], ['integrations', 'Integrations']]

export default function Profile() {
  const { id, tab = 'tasks' } = useParams()
  const { user, setUser } = useAuth()
  const { notify, refresh } = useUi()
  const navigate = useNavigate()
  const { data: p, reload } = useData(`/people/${id}`, [id])
  const { data: done } = useData(tab === 'completed' ? `/tasks?assignee=${id}&status=completed` : null, [tab, id])
  const { data: ms } = useData(tab === 'milestones' ? '/milestones?status=all' : null, [tab])
  const { data: act } = useData(tab === 'activity' ? '/activity' : null, [tab])
  const { data: ev } = useData(tab === 'events' && String(user.id) === String(id) ? `/events?start=${new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)}&end=${new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10)}` : null, [tab])
  const personal = useData(tab === 'tasks' && String(user.id) === String(id) ? '/personal-tasks' : null, [tab])
  const teams = useRows('teams').rows
  const roles = useRows('roles').rows
  const [edit, setEdit] = useState(false)
  const [pt, setPt] = useState('')
  if (!p) return <div className="page">Loading…</div>
  const me = String(user.id) === String(id)
  const myTeams = (teams || []).filter((t) => (t.member_ids || []).includes(p.id))
  const role = (roles || []).find((r) => (r.member_ids || []).includes(p.id))?.name
  const chat = async () => { const c = await api.post(`/chat/dm/${p.id}`); navigate(`/chat/${c.id}`) }
  const save = async (v) => { const u = await api.patch(`/people/${p.id}`, v); if (me) setUser(u); notify('Profile saved'); reload(); refresh() }
  return (
    <div className="page">
      <div className="subtitle" style={{ marginBottom: 6 }}><Link to="/">Home</Link> › <Link to="/people/people">People</Link> › {p.name} › {TABS.find((t) => t[0] === tab)?.[1]}</div>
      <div className="page-head" style={{ marginBottom: 6 }}>
        <Avatar user={p} size={44} />
        <div><div className="row" style={{ gap: 8 }}><h1 style={{ fontSize: 22 }}>{p.name}</h1>{p.role === 'admin' && <span className="role-badge">SITE OWNER</span>}{p.role === 'client' && <span className="role-badge">CLIENT</span>}{!p.is_active && <Pill>inactive</Pill>}
          {!me && <button className="btn outline-accent sm" onClick={chat}><MessageCircle size={13} />Start chat</button>}</div>
          <div className="small" style={{ color: 'var(--accent)' }}>{p.title || role || 'Crewdesk'}</div></div>
        <span className="spacer" />
        {(me || user.role === 'admin') && <button className="btn primary" onClick={() => setEdit(true)}><Pencil size={14} />Edit profile</button>}
        <Menu trigger={<button className="icon-btn"><MoreVertical size={16} /></button>}>
          <a href={`mailto:${p.email}`}><button><Mail size={14} />Send email</button></a>
          {!me && <button onClick={chat}><MessageCircle size={14} />Start chat</button>}
          {user.role === 'admin' && !me && <button onClick={async () => { await api.patch(`/people/${p.id}`, { is_active: !p.is_active }); reload(); refresh() }}>{p.is_active ? <><UserX size={14} />Deactivate</> : <><UserCheck size={14} />Reactivate</>}</button>}
        </Menu>
      </div>
      <div className="tabs">{TABS.map(([k, l]) => <Link key={k} to={`/people/person/${id}/${k}`} className={`tab ${tab === k ? 'active' : ''}`}>{l}{k === 'projects' && <span className="kit-pill gray" style={{ marginLeft: 4 }}>{p.projects.length}</span>}</Link>)}</div>

      {tab === 'details' && <div className="set-card">
        {[[Mail, 'Email', p.email], [Phone, 'Phone', p.phone || '—'], [Briefcase, 'Job title', p.title || '—'], [Briefcase, 'Role', role || '—'], [Building2, 'User type', p.role],
          [Clock, 'Daily capacity', `${(p.capacity_minutes || 480) / 60}h`], [CheckSquare, 'Open tasks', p.tasks.length]].map(([I, l, v]) => <div key={l} className="set-field"><label><I size={14} /> {l}</label><div>{v}</div></div>)}
      </div>}
      {tab === 'events' && (me ? ((ev || []).length ? (ev || []).map((e) => <div key={e.id} className="twrow"><b>{e.title}</b><span className="muted small row-end">{fmtDate(e.date)} {e.start_time || ''}</span></div>) : <EmptyState icon={Clock} title="No events" text="Events you add on the calendar show here." action={<button className="btn" onClick={() => navigate('/calendar')}>Open calendar</button>} />)
        : <EmptyState icon={Clock} title="Events are private" text="Only the person can see their own events." />)}
      {tab === 'projects' && (p.projects.length ? <DataTable rows={p.projects} onRow={(x) => navigate(`/projects/${x.id}`)} columns={[{ key: 'name', label: 'Project', render: (x) => <span className="row" style={{ gap: 8 }}><span className="dot" style={{ background: x.color }} /><b>{x.name}</b></span> }, { key: 'client', label: 'Client', render: (x) => x.client?.name || '—' }, { key: 'health', label: 'Health', render: (x) => <HealthPill h={x.health} /> }, { key: 'end_date', label: 'End date', render: (x) => fmtDate(x.end_date) || '—' }]} /> : <EmptyState icon={Briefcase} title="No projects" />)}
      {tab === 'tasks' && <>
        <h2 style={{ fontSize: 18, margin: '6px 0 10px' }}>{me ? 'My Tasks' : `${p.name.split(' ')[0]}'s tasks`}</h2>
        {me && <div className="tw-group"><div className="tw-ghead" style={{ color: 'var(--accent)' }}><b>Personal tasks</b></div>
          {(personal.data || []).map((t) => <div key={t.id} className="twrow"><input type="checkbox" checked={t.done} onChange={async () => { await api.patch(`/personal-tasks/${t.id}`, { done: !t.done }); personal.reload() }} /><span style={{ textDecoration: t.done ? 'line-through' : '' }}>{t.title}</span><button className="icon-btn row-end" onClick={async () => { await api.del(`/personal-tasks/${t.id}`); personal.reload() }}><Trash2 size={13} /></button></div>)}
          <input className="input" style={{ marginTop: 6 }} placeholder="Click here to add a personal task…" value={pt} onChange={(e) => setPt(e.target.value)} onKeyDown={async (e) => { if (e.key === 'Enter' && pt.trim()) { await api.post('/personal-tasks', { title: pt }); setPt(''); personal.reload() } }} /></div>}
        {p.tasks.length ? p.tasks.map((t) => <TaskRow key={t.id} task={t} showProject />) : <EmptyState icon={CheckSquare} title="No Tasks" text="There are no tasks at the moment" />}
      </>}
      {tab === 'teams' && (myTeams.length ? <div className="dash-grid">{myTeams.map((t) => <div key={t.id} className="widget" style={{ minHeight: 100 }}><b>{t.name}</b><span className="muted small">{t.description}</span><span className="small">{t.members.length} members</span></div>)}</div> : <EmptyState icon={Briefcase} title="Not in any team" action={<button className="btn" onClick={() => navigate('/people/teams')}>Manage teams</button>} />)}
      {tab === 'completed' && ((done || []).length ? done.map((t) => <TaskRow key={t.id} task={t} showProject />) : <EmptyState icon={CheckSquare} title="No completed tasks" />)}
      {tab === 'milestones' && (() => { const l = (ms || []).filter((m) => m.owner?.id === p.id); return l.length ? l.map((m) => <Link key={m.id} to={`/projects/${m.project_id}/milestones`} className="task-row"><Flag size={15} color="#8b5cf6" /><span className="title">{m.name}</span><span className="meta">{m.completed ? 'Completed' : fmtDate(m.due_date)}</span></Link>) : <EmptyState icon={Flag} title="No milestones" text="Milestones this person is responsible for appear here." /> })()}
      {tab === 'time' && (p.time.length ? <DataTable rows={p.time} columns={[{ key: 'date', label: 'Date', render: (e) => fmtDate(e.date) }, { key: 'project_name', label: 'Project' }, { key: 'task_title', label: 'Task', render: (e) => e.task_title || '—' }, { key: 'description', label: 'Description', render: (e) => e.description || '—' }, { key: 'minutes', label: 'Time', render: (e) => fmtMinutes(e.minutes) }]} /> : <EmptyState icon={Clock} title="No time logged" />)}
      {tab === 'activity' && (() => { const l = (act || []).filter((a) => a.user?.id === p.id); return l.length ? l.map((a) => <div key={a.id} className="twrow small"><Avatar user={a.user} size={22} /><span style={{ flex: 1 }}>{a.action}{a.project_name && <span className="muted"> · {a.project_name}</span>}</span><span className="muted">{timeAgo(a.created_at)}</span></div>) : <EmptyState icon={Clock} title="No activity yet" /> })()}
      {tab === 'integrations' && <div>{INTEGRATIONS.slice(8, 16).map(([k, n, d]) => <div key={k} className="int-card"><span className="int-ic"><Plug size={18} /></span><div style={{ flex: 1 }}><b>{n}</b><div className="muted small">{d}</div></div><button className="btn" onClick={() => navigate('/settings/integrations')}>Manage</button></div>)}</div>}

      {edit && <FormModal title="Edit profile" initial={{ ...p, capacity_hours: (p.capacity_minutes || 480) / 60 }} onClose={() => setEdit(false)}
        onSubmit={(v) => save({ name: v.name, title: v.title, phone: v.phone, capacity_minutes: Math.round(Number(v.capacity_hours || 8) * 60), ...(v.password ? { password: v.password } : {}) })}
        fields={[{ key: 'name', label: 'Full name', required: true }, { key: 'title', label: 'Job title', half: true }, { key: 'phone', label: 'Phone', half: true }, { key: 'capacity_hours', label: 'Daily capacity (hours)', type: 'number', half: true }, ...(me ? [{ key: 'password', label: 'New password (optional)', half: true }] : [])]} />}
    </div>
  )
}
