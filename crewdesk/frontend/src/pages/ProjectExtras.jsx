// Project "More…" tabs: Forms, Notebooks, Links, Risks, Comments, Proofs, Finance, Settings
import { useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { Copy, LayoutTemplate, Trash2, Settings as Cog, User, AlignLeft, CalendarDays, Building2, HeartPulse, Users, ChevronLeft, ChevronRight, Sparkles, Plus, ChevronDown, Pencil } from 'lucide-react'
import { useData } from '../lib/ui-context'
import { fmtDate, timeAgo, HEALTH } from '../lib/format'
import { Avatar, AvatarStack, Menu } from '../components/ui'
import { FormModal } from '../components/Kit'
import { Dashboard } from './Home'
import { ProjectForm } from '../components/QuickAdd'
import { api } from '../lib/api'
import { useUi } from '../lib/ui-context'
import { FormsTab, RisksTab, NotebooksTab, LinksTab, CommentsTab, Reactions } from './Everything'
import { useRows } from '../components/Kit'
import { Eye, MoreHorizontal, Send, ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { Proofs } from './Extras'
import Finance from './Finance'

export const PROJECT_MORE = [['forms', 'Forms'], ['notebooks', 'Notebooks'], ['links', 'Links'], ['risks', 'Risks'], ['comments', 'Comments'],
  ['proofs', 'Proofs'], ['finance', 'Finance'], ['settings', 'Settings']]

function ProjectSettings({ project }) {
  const { notify, refresh } = useUi()
  const navigate = useNavigate()
  const copy = async () => { const r = await api.post(`/projects/${project.id}/copy`); notify('Project copied'); refresh(); navigate(`/projects/${r.id}`) }
  const tpl = async () => { await api.post(`/projects/${project.id}/save-as-template`); notify('Saved as a template'); navigate('/templates') }
  const del = async () => { if (confirm(`Delete project "${project.name}" and everything in it?`)) { await api.del(`/projects/${project.id}`); refresh(); navigate('/projects') } }
  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: 18, marginBottom: 12 }}><Cog size={17} /> Project settings</h2>
      {[[Copy, 'Copy project', 'Duplicate this project with its task lists, tasks, board columns and people.', copy, 'Copy project'],
        [LayoutTemplate, 'Save as template', 'Reuse this project\'s task lists for new projects.', tpl, 'Save as template'],
        [Trash2, 'Delete project', 'Permanently delete this project and everything in it.', del, 'Delete project']].map(([I, t, d, fn, b]) => (
        <div key={t} className="card" style={{ padding: 16, marginBottom: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
          <I size={20} className="muted" /><div style={{ flex: 1 }}><b>{t}</b><div className="muted small">{d}</div></div>
          <button className={`btn ${t.startsWith('Delete') ? '' : 'primary'}`} style={t.startsWith('Delete') ? { color: 'var(--danger)' } : {}} onClick={fn}>{b}</button>
        </div>))}
    </div>
  )
}

export function ProjectSection({ section: fixed }) {
  const params = useParams()
  const section = fixed || params.section
  const { project } = useOutletContext()
  const pid = project.id
  switch (section) {
    case 'forms': return <FormsTab projectId={pid} />
    case 'notebooks': return <NotebooksTab projectId={pid} />
    case 'links': return <LinksTab projectId={pid} />
    case 'risks': return <RisksTab projectId={pid} />
    case 'comments': return <CommentsTab projectId={pid} />
    case 'proofs': return <Proofs projectId={pid} />
    case 'finance': return <Finance projectId={pid} />
    default: return <ProjectSettings project={project} />
  }
}

/* Project › Dashboard tab (Teamwork /app/projects/:id/overview/summary) */
export function ProjectDashboard() {
  const { project, reload } = useOutletContext()
  const { setQuickAdd } = useUi()
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState('summary')
  const [edit, setEdit] = useState(false)
  const { data: act } = useData(tab === 'activity' ? `/projects/${project.id}/activity` : null, [tab])
  const pid = project.id
  const add = (kind) => setQuickAdd(kind === 'task' ? { kind: 'task', project_id: pid } : kind)
  return (
    <div className="proj-dash">
      <div className={`proj-info ${open ? '' : 'closed'}`}>
        <button className="toggle" onClick={() => setOpen(!open)}>{open ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}</button>
        {open && <>
          <h4><User size={15} />Project owner</h4><div className="val">{project.owner ? <span className="kit-person"><Avatar user={project.owner} size={20} />{project.owner.name}</span> : <a style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setEdit(true)}>Not set</a>}</div>
          <h4><AlignLeft size={15} />Description <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => setEdit(true)}><Pencil size={13} /></button></h4><div className="val proj-desc">{project.description || <span className="muted">No description</span>}</div>
          <h4><CalendarDays size={15} />Dates</h4><div className="val">{project.start_date ? fmtDate(project.start_date, { day: 'numeric', month: 'short', year: 'numeric' }) : 'No start date'} – {project.end_date ? fmtDate(project.end_date, { day: 'numeric', month: 'short', year: 'numeric' }) : 'No end date'}</div>
          <h4><Building2 size={15} />Client</h4><div className="val">{project.client?.name || '—'}</div>
          <h4><HeartPulse size={15} />Health</h4><div className="val"><span className="dot" style={{ background: HEALTH[project.health || 'none'].color }} /> {HEALTH[project.health || 'none'].label}</div>
          <h4><Users size={15} />People</h4><div className="val"><AvatarStack users={project.members} max={8} /></div>
          <h4>Progress</h4><div className="val">{project.completed_count}/{project.task_count} tasks · {project.progress}%</div>
        </>}
      </div>
      <div className="proj-main-dash">
        <Dashboard compact hideBody={tab === 'activity'} scope={`project:${pid}`} projectId={pid} defaults={['tasks', 'milestones', 'workflow_stages', 'my_tasks', 'unread', 'activity']}
          header={<div className="row" style={{ gap: 10 }}><h2 style={{ fontSize: 20 }}>Dashboard</h2>
            <div className="wtabs" style={{ border: 0, marginBottom: 0, marginLeft: 16 }}><button className={tab === 'summary' ? 'on' : ''} onClick={() => setTab('summary')}>Summary</button><button className={tab === 'activity' ? 'on' : ''} onClick={() => setTab('activity')}>Activity</button></div></div>}
          extraActions={<>
            <button className="btn ai-outline" onClick={() => navigate('/reports/view/project-health')}><Sparkles size={14} />See project insights</button>
            <span className="split-btn"><button className="btn primary" onClick={() => add('task')}><Plus size={15} />Add</button>
              <Menu trigger={<button className="btn primary caret"><ChevronDown size={14} /></button>}>
                <button onClick={() => add('task')}>Task</button><button onClick={() => add('milestone')}>Milestone</button><button onClick={() => add('message')}>Message</button>
                <button onClick={() => add('time')}>Time entry</button><button onClick={() => add('event')}>Event</button><button onClick={() => navigate(`/projects/${pid}/files`)}>File</button>
                <button onClick={() => navigate(`/projects/${pid}/x/risks`)}>Risk</button><button onClick={() => navigate(`/projects/${pid}/x/notebooks`)}>Notebook</button>
              </Menu></span></>} />
        {tab === 'activity' && <div className="card" style={{ marginTop: 14, padding: 8 }}>{(act || []).map((a) => <div key={a.id} className="row small" style={{ gap: 8, padding: '7px 6px', borderBottom: '1px solid var(--row-line)' }}><Avatar user={a.user} size={22} /><span style={{ flex: 1 }}><b>{a.user?.name}</b> {a.action}</span><span className="muted">{timeAgo(a.created_at)}</span></div>)}{act && !act.length && <div className="muted small">No activity yet</div>}</div>}
      </div>
      {edit && <ProjectForm project={project} onDone={() => { setEdit(false); reload() }} onCancel={() => setEdit(false)} />}
    </div>
  )
}

/* Project › Timeline (Gantt of task lists and tasks) */
export function ProjectTimeline() {
  const { project } = useOutletContext()
  const { openTask } = useUi()
  const { data } = useData(`/tasks?project_id=${project.id}&status=all`, [project.id])
  const [zoom, setZoom] = useState(28)
  const tasks = (data || []).filter((t) => t.start_date || t.due_date)
  const undated = (data || []).filter((t) => !t.start_date && !t.due_date)
  const today = new Date().toISOString().slice(0, 10)
  const dates = tasks.flatMap((t) => [t.start_date || t.due_date, t.due_date || t.start_date])
  const min = dates.length ? dates.sort()[0] : today
  const start = new Date(min + 'T00:00:00'); start.setDate(start.getDate() - 3)
  const days = Math.max(28, Math.ceil(((dates.length ? new Date(dates.sort().slice(-1)[0]) : new Date()) - start) / 864e5) + 7)
  const x = (d) => Math.round((new Date(d + 'T00:00:00') - start) / 864e5)
  const groups = {}
  tasks.forEach((t) => { (groups[t.tasklist_name || 'Tasks'] = groups[t.tasklist_name || 'Tasks'] || []).push(t) })
  const W = zoom
  return (
    <div>
      <div className="tw-toolbar"><h2>Timeline</h2><span className="muted small">{tasks.length} scheduled tasks{undated.length ? ` · ${undated.length} without dates` : ''}</span><span className="spacer" />
        <div className="chips">{[[14, 'Month'], [28, 'Week'], [48, 'Day']].map(([z, l]) => <button key={l} className={zoom === z ? 'on' : ''} onClick={() => setZoom(z)}>{l}</button>)}</div></div>
      {!tasks.length ? <div className="kit-empty"><b>No dated tasks yet</b><span>Give tasks a start or due date to see them on the timeline.</span></div> : (
        <div className="kit-scroll card" style={{ padding: 0 }}>
          <div style={{ display: 'flex', minWidth: 260 + days * W }}>
            <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--border)' }}>
              <div style={{ height: 34, borderBottom: '1px solid var(--border)' }} />
              {Object.entries(groups).map(([g, l]) => <div key={g}><div className="tl-group">{g}</div>{l.map((t) => <div key={t.id} className="tl-row tl-name" onClick={() => openTask(t.id)}>{t.title}</div>)}</div>)}
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', height: 34, borderBottom: '1px solid var(--border)' }}>{Array.from({ length: days }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); const iso = d.toISOString().slice(0, 10)
                return <div key={i} style={{ width: W, fontSize: 10, textAlign: 'center', color: iso === today ? 'var(--accent)' : 'var(--muted)', background: [0, 6].includes(d.getDay()) ? '#fafafc' : '', paddingTop: 4 }}>{W >= 28 || d.getDate() % 7 === 1 ? d.getDate() : ''}<br />{d.getDate() === 1 || i === 0 ? d.toLocaleDateString(undefined, { month: 'short' }) : ''}</div> })}</div>
              <div style={{ position: 'absolute', left: x(today) * W + W / 2, top: 34, bottom: 0, width: 2, background: 'var(--danger)', opacity: .5 }} />
              {Object.entries(groups).map(([g, l]) => <div key={g}><div className="tl-group" />{l.map((t) => { const s0 = x(t.start_date || t.due_date); const e0 = x(t.due_date || t.start_date)
                return <div key={t.id} className="tl-row" style={{ width: days * W }}><div className="tl-bar" onClick={() => openTask(t.id)} title={`${t.start_date || ''} → ${t.due_date || ''}`}
                  style={{ left: s0 * W + 2, width: Math.max(W - 4, (e0 - s0 + 1) * W - 4), background: t.status === 'completed' ? '#9be3bf' : t.due_date && t.due_date < today ? '#f6a6b2' : '#a9b8f5' }}>{(e0 - s0 + 1) * W > 80 ? t.title : ''}</div></div> })}</div>)}
            </div>
          </div>
        </div>)}
    </div>
  )
}

/* Project › Schedule (who is booked on this project) */
export function ProjectSchedule() {
  const { project } = useOutletContext()
  const { people, notify } = useUi()
  const { data, reload } = useData(`/r/allocations?project_id=${project.id}`, [project.id])
  const [form, setForm] = useState(null)
  const start = new Date(); start.setDate(start.getDate() - start.getDay() + 1)
  const N = 28; const W = 34
  const iso = (d) => d.toISOString().slice(0, 10)
  const days = Array.from({ length: N }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d })
  const byUser = {}
  ;(data || []).forEach((a) => { (byUser[a.user_id] = byUser[a.user_id] || []).push(a) })
  const save = async (v) => { const body = { ...v, project_id: project.id, minutes_per_day: Math.round(Number(v.hours || 8) * 60) }; form.id ? await api.patch(`/r/allocations/${form.id}`, body) : await api.post('/r/allocations', body); notify('Allocation saved'); reload() }
  return (
    <div>
      <div className="tw-toolbar"><h2>Schedule</h2><span className="muted small">Next four weeks</span><span className="spacer" /><button className="btn primary" onClick={() => setForm({ start_date: iso(days[0]), end_date: iso(days[4]), hours: 8 })}><Plus size={15} />Add allocation</button></div>
      {!(data || []).length ? <div className="kit-empty"><b>No one is scheduled on this project</b><span>Add an allocation to book people's time.</span></div> : (
        <div className="kit-scroll card" style={{ padding: 0 }}><div style={{ display: 'flex', minWidth: 220 + N * W }}>
          <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)' }}><div style={{ height: 34, borderBottom: '1px solid var(--border)' }} />
            {Object.keys(byUser).map((uid) => { const u = people.find((p) => p.id === Number(uid)); return <div key={uid} className="tl-row tl-name"><Avatar user={u} size={22} /> {u?.name}</div> })}</div>
          <div><div style={{ display: 'flex', height: 34, borderBottom: '1px solid var(--border)' }}>{days.map((d) => <div key={iso(d)} style={{ width: W, fontSize: 10, textAlign: 'center', color: 'var(--muted)', background: [0, 6].includes(d.getDay()) ? '#fafafc' : '', paddingTop: 4 }}>{'SMTWTFS'[d.getDay()]}<br />{d.getDate()}</div>)}</div>
            {Object.entries(byUser).map(([uid, l]) => <div key={uid} className="tl-row" style={{ width: N * W }}>{l.map((a) => { const s0 = Math.max(0, Math.round((new Date(a.start_date) - start) / 864e5)); const e0 = Math.min(N - 1, Math.round((new Date(a.end_date) - start) / 864e5)); if (e0 < 0 || s0 > N - 1) return null
              return <div key={a.id} className="tl-bar" style={{ left: s0 * W + 2, width: (e0 - s0 + 1) * W - 4, background: project.color }} onClick={() => setForm({ ...a, hours: a.minutes_per_day / 60 })}>{a.minutes_per_day / 60}h/d</div> })}</div>)}
          </div></div></div>)}
      {form && <FormModal title={form.id ? 'Edit allocation' : 'Add allocation'} initial={form} onClose={() => setForm(null)} onSubmit={save}
        fields={[{ key: 'user_id', label: 'Person', type: 'person', required: true }, { key: 'start_date', label: 'Start', type: 'date', required: true, half: true }, { key: 'end_date', label: 'End', type: 'date', required: true, half: true }, { key: 'hours', label: 'Hours per day', type: 'number', half: true }, { key: 'note', label: 'Note', half: true }]}>
        {form.id && <button className="btn" style={{ color: 'var(--danger)' }} onClick={async () => { await api.del(`/r/allocations/${form.id}`); setForm(null); reload() }}><Trash2 size={14} />Delete allocation</button>}
      </FormModal>}
    </div>
  )
}

/* Project › Messages › one message (Teamwork /app/messages/:id): Following, Edit Message, replies with reactions */
export function MessagePage() {
  const { project } = useOutletContext()
  const { mid } = useParams()
  const navigate = useNavigate()
  const { notify } = useUi()
  const { data, setData, reload } = useData(`/messages/${mid}`, [mid])
  const reacts = useRows('reactions')
  const [reply, setReply] = useState('')
  const [edit, setEdit] = useState(false)
  const [following, setFollowing] = useState(null)
  const [order, setOrder] = useState(1)
  useEffect(() => { api.get('/prefs').then((p) => setFollowing((p.followed_messages || []).includes(Number(mid)))) }, [mid])
  if (!data) return <div className="muted">Loading…</div>
  const toggleFollow = async () => { const p = await api.get('/prefs'); const l = new Set(p.followed_messages || []); following ? l.delete(Number(mid)) : l.add(Number(mid)); await api.patch('/prefs', { followed_messages: [...l] }); setFollowing(!following); notify(following ? 'Unfollowed' : 'Following this message') }
  const send = async () => { if (!reply.trim()) return; setData(await api.post(`/messages/${mid}/replies`, { body: reply })); setReply('') }
  const delMsg = async () => { if (confirm('Delete this message and its replies?')) { await api.del(`/messages/${mid}`); navigate(`/projects/${project.id}/messages`) } }
  const delReply = async (r) => { if (confirm('Delete this reply?')) { await api.del(`/message-replies/${r.id}`); reload() } }
  const posts = [{ ...data, id: `main`, isMain: true }, ...[...data.replies].sort((a, b) => (a.created_at > b.created_at ? 1 : -1) * order)]
  return (
    <div style={{ maxWidth: 1040 }}>
      <div className="tw-toolbar">
        <button className="icon-btn" title="All messages" onClick={() => navigate(`/projects/${project.id}/messages`)}><ArrowLeft size={16} /></button>
        <h2 style={{ fontSize: 20 }}>{data.title}</h2><span className="spacer" />
        <button className="tb-btn" title="Sort replies" onClick={() => setOrder(-order)}>{order > 0 ? 'Oldest first' : 'Newest first'}</button>
        <button className={`btn ${following ? 'outline-accent on' : 'outline-accent'}`} onClick={toggleFollow}><Eye size={14} />{following ? 'Following…' : 'Follow'}</button>
        <button className="btn primary" onClick={() => setEdit(true)}><Pencil size={14} />Edit Message</button>
        <Menu trigger={<button className="icon-btn"><MoreHorizontal size={16} /></button>}>
          <button onClick={() => { navigator.clipboard?.writeText(window.location.href); notify('Link copied') }}>Copy link</button>
          <button style={{ color: 'var(--danger)' }} onClick={delMsg}><Trash2 size={14} />Delete message</button>
        </Menu>
      </div>
      {posts.map((m) => (
        <div key={m.id} className="ev-item" style={{ cursor: 'default' }}>
          <Avatar user={m.user} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}><div><b>{m.user?.name}</b> <span className="muted small">({project.client?.name || project.name})</span></div>
            <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{m.body}</div></div>
          <div className="ev-side"><span className="row" style={{ gap: 6 }}><span className="muted small">{new Date(m.created_at + 'Z').toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
            <Reactions kind={m.isMain ? 'msg' : 'reply'} refId={m.isMain ? mid : m.id} all={reacts.rows} reload={reacts.reload} />
            {!m.isMain && <Menu trigger={<button className="react-add"><MoreHorizontal size={15} /></button>}><button style={{ color: 'var(--danger)' }} onClick={() => delReply(m)}><Trash2 size={14} />Delete reply</button></Menu>}</span></div>
        </div>))}
      <div className="chat-compose" style={{ margin: '16px 0' }}>
        <textarea rows={2} placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send() }} />
        <button className="btn primary" disabled={!reply.trim()} onClick={send}><Send size={14} />Reply</button>
      </div>
      {edit && <FormModal wide title="Edit message" initial={data} onClose={() => setEdit(false)} onSubmit={async (v) => { await api.patch(`/messages/${mid}`, { title: v.title, body: v.body }); notify('Message updated'); reload() }}
        fields={[{ key: 'title', label: 'Title', required: true }, { key: 'body', label: 'Message', type: 'textarea', rows: 10 }]} />}
    </div>
  )
}
