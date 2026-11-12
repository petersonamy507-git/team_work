// Project "More…" tabs: Forms, Notebooks, Links, Risks, Comments, Proofs, Finance, Settings
import { useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { Copy, LayoutTemplate, Trash2, Settings as Cog, User, AlignLeft, CalendarDays, Building2, HeartPulse, Users, ChevronLeft, ChevronRight, Sparkles, Plus, ChevronDown, Pencil } from 'lucide-react'
import { useData } from '../lib/ui-context'
import { fmtDate, timeAgo, HEALTH } from '../lib/format'
import { Avatar, AvatarStack, Menu } from '../components/ui'
import { Dashboard } from './Home'
import { ProjectForm } from '../components/QuickAdd'
import { api } from '../lib/api'
import { useUi } from '../lib/ui-context'
import { FormsTab, RisksTab, NotebooksTab, LinksTab, CommentsTab } from './Everything'
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

export function ProjectSection() {
  const { section } = useParams()
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
        <Dashboard compact scope={`project:${pid}`} projectId={pid} defaults={['tasks', 'milestones', 'workflow_stages', 'my_tasks', 'unread', 'activity']}
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
