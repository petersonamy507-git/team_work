import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  CheckCircle2, ArrowUpDown, CalendarDays, List, LayoutList, ListTodo, Plus, MoreVertical, CheckSquare, X,
  ChevronDown, ChevronRight, Flag, Trash2, Info, Folder,
} from 'lucide-react'
import { useData, useUi } from '../lib/ui-context'
import { useAuth } from '../lib/auth'
import { api, qs } from '../lib/api'
import { fmtDate, todayISO } from '../lib/format'
import { EMPTY_FILTERS, withFilters, filterParams } from '../lib/taskFilters'
import { Avatar, AvatarStack, Empty, Loading, Progress, HealthPill } from '../components/ui'
import { Popover } from '../components/TaskPickers'
import TaskFilter, { ActiveFilters } from '../components/TaskFilter'
import { TaskLine, BulkBar, SearchBox, SortMenu, AddTaskSplit, Crumbs } from '../components/TaskList'
import CalendarPage from './Calendar'
import TimePage from './Time'
import ActivityPage from './Activity'
import { MyTimesheet } from './TimeHub'
import { Dashboard } from './Home'
import { Sparkles } from 'lucide-react'
import { ALL_TABS, useMyWorkTabs, TabManager, MyActivity, MyEvents, MyHealth, MyWorkload } from '../components/MyWorkExtras'

const STORE = 'cd_mywork_v1'
const TABS = [['tasks', 'My tasks'], ['calendar', 'My calendar'], ['timesheet', 'My timesheet'], ['projects', 'My projects'], ['activity', 'Activity'], ['dashboards', 'Dashboards']]

function loadPrefs() {
  const d = { layout: 'grouped', sort: 'start', order: 'desc', filters: { ...EMPTY_FILTERS }, mode: 'tasks' }
  try { const s = JSON.parse(localStorage.getItem(STORE)); return s ? { ...d, ...s, filters: withFilters(s.filters) } : d } catch { return d }
}

export default function MyWork() {
  const { user } = useAuth()
  const loc = useLocation()
  const [myTabs, setMyTabs] = useMyWorkTabs()
  const nav = useNavigate()
  const [tab, setTabState] = useState(() => new URLSearchParams(location.search).get('tab') || 'tasks')
  useEffect(() => { setTabState(new URLSearchParams(loc.search).get('tab') || 'tasks') }, [loc.search])
  const setTab = (t) => nav(t === 'tasks' ? '/my-work' : `/my-work?tab=${t}`)
  const [scout, setScout] = useState(() => { try { return localStorage.getItem('cd_scout_hide') !== '1' } catch { return true } })
  const [p, setP] = useState(loadPrefs)
  const [personId, setPersonId] = useState(user.id)
  useEffect(() => { localStorage.setItem(STORE, JSON.stringify(p)) }, [p])
  const set = (patch) => setP((x) => ({ ...x, ...patch }))
  const { data: sum } = useData(`/work/summary?user_id=${personId}`, [personId])
  const counts = sum?.[p.mode] || { late: 0, today: 0, upcoming: 0 }

  return (
    <div className="tw-page">
      <Crumbs items={[['Home', '/'], ['My work', '/my-work'], [ALL_TABS.find((t) => t[0] === tab)?.[1]]]} />
      <div className="tw-head">
        <h1><CheckCircle2 size={20} />My work</h1>
        <nav className="tw-tabs">
          {myTabs.map((k) => ALL_TABS.find((t) => t[0] === k)).filter(Boolean).map(([k, l]) => <a key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</a>)}
          <TabManager tabs={myTabs} setTabs={setMyTabs} />
        </nav>
        <span className="spacer" />
        {tab === 'tasks' && (
          <span className="mw-counts">
            <button className="mw-mode" onClick={() => set({ mode: p.mode === 'tasks' ? 'milestones' : 'tasks' })} title="Switch between tasks and milestones"><ArrowUpDown size={13} />{p.mode === 'tasks' ? 'My tasks' : 'My milestones'}</button>
            <span><span className="dot" style={{ background: '#ef4444' }} /><b>{counts.late}</b> Late</span>
            <span><span className="dot" style={{ background: '#3b82f6' }} /><b>{counts.today}</b> Today</span>
            <span><span className="dot" style={{ background: '#f59e0b' }} /><b>{counts.upcoming}</b> Upcoming</span>
          </span>
        )}
      </div>
      <div className="tw-body">
        {scout && tab !== 'dashboards' && (
          <div className="scout-banner"><Sparkles size={18} color="#c03cc4" /><div style={{ flex: 1 }}><b>Want Scout to catch you up on what you've missed?</b><div>Get your AI Teammate to provide a quick summary of your project activity over the last 7 days.</div></div>
            <button className="btn" onClick={() => nav(`/ai/ask?prompt=${encodeURIComponent('Catch me up')}`)}>Catch me up</button>
            <button className="icon-btn" onClick={() => { setScout(false); try { localStorage.setItem('cd_scout_hide', '1') } catch { /* ignore */ } }}><X size={15} /></button></div>)}
        {tab === 'tasks' && (p.mode === 'tasks'
          ? <MyTasks p={p} set={set} personId={personId} setPersonId={setPersonId} goCalendar={() => setTab('calendar')} />
          : <MyMilestones personId={personId} />)}
        {tab === 'calendar' && <CalendarPage embedded />}
        {tab === 'timesheet' && <MyTimesheet />}
        {tab === 'dashboards' && <Dashboard scope="mywork" header={null} />}
        {tab === 'projects' && <MyProjects />}
        {tab === 'activity' && <MyActivity />}
        {tab === 'events' && <MyEvents />}
        {tab === 'health' && <MyHealth />}
        {tab === 'workload' && <MyWorkload />}
      </div>
    </div>
  )
}

/* ---------------- My tasks ---------------- */
function bucket(t, startedToday) {
  const today = todayISO()
  if (t.due_date && t.due_date < today) return 'late'
  if (t.due_date === today) return 'today'
  if (startedToday && t.start_date && t.start_date <= today) return 'today'
  if (t.due_date) return 'upcoming'
  return 'nodate'
}
const BUCKETS = [['late', 'Late', '#ef4444'], ['today', 'Today', '#3b82f6'], ['upcoming', 'Upcoming', '#f59e0b'], ['nodate', 'No due date', '#94a3b8']]

function MyTasks({ p, set, personId, setPersonId, goCalendar }) {
  const { people, refresh } = useUi()
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [qd, setQd] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [sel, setSel] = useState(new Set())
  const [personal, setPersonal] = useState(false)
  const [closed, setClosed] = useState({})
  useEffect(() => { const t = setTimeout(() => setQd(q), 250); return () => clearTimeout(t) }, [q])
  const params = { ...filterParams(p.filters, { userId: user.id }), assignee: String(personId), q: qd, sort: p.sort, order: p.order, include_subtasks: p.filters.no_subtasks ? '' : 'true', limit: 1000 }
  const { data, reload } = useData(`/tasks${qs(params)}`, [JSON.stringify(params)])
  const tasks = data || []
  const person = people.find((u) => u.id === personId) || user
  const groups = useMemo(() => BUCKETS.map(([k, l, c]) => ({ k, l, c, items: tasks.filter((t) => bucket(t, p.filters.started_today) === k) })).filter((g) => g.items.length), [tasks, p.filters.started_today])
  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const setF = (filters) => set({ filters })

  return (
    <>
      <div className="tw-toolbar">
        <Avatar user={person} size={28} />
        <Popover width={240} trigger={<button className="icon-btn" title="View someone else's tasks"><Plus size={16} /></button>}>
          {(c) => <>
            <div className="pop-title">View tasks for</div>
            {people.map((u) => <button key={u.id} className="pop-item" onClick={() => { setPersonId(u.id); c() }}><Avatar user={u} size={20} />{u.name}{u.id === user.id && <span className="muted small">(me)</span>}</button>)}
          </>}
        </Popover>
        {personId !== user.id && <button className="btn sm ghost" onClick={() => setPersonId(user.id)}><X size={13} />Back to my tasks</button>}
        <span className="spacer" />
        {p.layout === 'grouped' && <button className="tb-btn" onClick={goCalendar}><CalendarDays size={15} />Plan with My calendar</button>}
        <SearchBox value={q} onChange={setQ} />
        {p.layout === 'list' && <SortMenu sort={p.sort} order={p.order} onChange={(sort, order) => set({ sort, order })} />}
        <TaskFilter f={p.filters} setF={setF} variant="mywork" />
        <span className="scope-toggle">
          <button className={p.layout === 'list' ? 'active' : ''} title="List" onClick={() => set({ layout: 'list' })}><List size={14} /></button>
          <button className={p.layout === 'grouped' ? 'active' : ''} title="Grouped by date" onClick={() => set({ layout: 'grouped' })}><LayoutList size={14} /></button>
        </span>
        <button className={`btn outline-accent ${personal ? 'on' : ''}`} onClick={() => setPersonal(!personal)}><ListTodo size={15} />Personal tasks</button>
        <AddTaskSplit defaults={{ assignee_ids: [personId] }} />
        <Popover align="right" width={220} trigger={<button className="icon-btn"><MoreVertical size={17} /></button>}>
          {(c) => <button className="pop-item" onClick={() => { setSelecting(!selecting); setSel(new Set()); c() }}><CheckSquare size={14} />{selecting ? 'Stop selecting' : 'Select multiple tasks'}<span className="muted small" style={{ marginLeft: 'auto' }}>Shift+M</span></button>}
        </Popover>
      </div>
      <ActiveFilters f={p.filters} setF={setF} />
      <div className={p.layout === 'list' ? 'mw-split' : ''}>
        <div className="mw-main">
          {!data ? <Loading /> : !tasks.length ? (
            <Empty icon={CheckCircle2} title="No tasks" text={personId === user.id ? 'Tasks that are assigned to you will appear here.' : `${person.name} has no open tasks.`} action={<AddTaskSplit defaults={{ assignee_ids: [personId] }} />} />
          ) : p.layout === 'grouped' ? groups.map((g) => (
            <div className="tw-group" key={g.k}>
              <div className="tw-ghead">
                <button className="icon-btn xs" onClick={() => setClosed({ ...closed, [g.k]: !closed[g.k] })}>{closed[g.k] ? <ChevronRight size={16} /> : <ChevronDown size={16} />}</button>
                <span className="dot" style={{ background: g.c }} /><b style={{ color: g.k === 'late' ? 'var(--danger)' : undefined }}>{g.l}</b><span className="badge grey">{g.items.length}</span>
              </div>
              {!closed[g.k] && g.items.map((t) => <TaskLine key={t.id} t={t} reload={() => { reload(); refresh() }} showProject selectable={selecting} selected={sel.has(t.id)} onSel={() => toggleSel(t.id)} />)}
            </div>
          )) : (
            <div className="tw-group">{tasks.map((t) => <TaskLine key={t.id} t={t} reload={() => { reload(); refresh() }} showProject selectable={selecting} selected={sel.has(t.id)} onSel={() => toggleSel(t.id)} />)}</div>
          )}
        </div>
        {p.layout === 'list' && <TodaySidebar />}
      </div>
      {personal && <PersonalTasks onClose={() => setPersonal(false)} />}
      {sel.size > 0 && <BulkBar ids={[...sel]} clear={() => setSel(new Set())} done={() => { setSel(new Set()); reload(); refresh() }} />}
      <ShiftM onToggle={() => { setSelecting((v) => !v); setSel(new Set()) }} />
    </>
  )
}

function ShiftM({ onToggle }) {
  useEffect(() => {
    const k = (e) => { if (e.shiftKey && e.key.toLowerCase() === 'm' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) onToggle() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onToggle])
  return null
}

function TodaySidebar() {
  const { data } = useData('/work/today')
  return (
    <aside className="mw-side">
      <h3>Milestones</h3>
      {!data ? <Loading /> : data.milestones.length ? data.milestones.map((m) => (
        <Link key={m.id} to={`/projects/${m.project_id}/milestones`} className="mw-item"><Flag size={13} color="#8b5cf6" /><span className="ellipsis">{m.name}</span><span className="muted small">{m.project_name}</span></Link>
      )) : <p className="muted small">You have no milestones due today</p>}
      <h3 style={{ marginTop: 18 }}>Events</h3>
      {data && (data.events.length ? data.events.map((e) => (
        <div key={e.id} className="mw-item"><CalendarDays size={13} className="accent" /><span className="ellipsis">{e.title}</span><span className="muted small">{e.start_time || 'All day'}{e.end_time ? `–${e.end_time}` : ''}</span></div>
      )) : <p className="muted small">You have no events scheduled today</p>)}
    </aside>
  )
}

/* ---------------- personal tasks popup ---------------- */
function PersonalTasks({ onClose }) {
  const { data, reload } = useData('/personal-tasks')
  const [title, setTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const add = async (e) => { e.preventDefault(); if (!title.trim()) return; await api.post('/personal-tasks', { title }); setTitle(''); reload() }
  const toggle = async (t) => { await api.patch(`/personal-tasks/${t.id}`, { done: !t.done }); reload() }
  const del = async (t) => { await api.del(`/personal-tasks/${t.id}`); reload() }
  const rename = async (t, v) => { if (v.trim() && v !== t.title) { await api.patch(`/personal-tasks/${t.id}`, { title: v.trim() }); reload() } }
  return (
    <div className="personal-pop">
      <div className="pp-head"><b>Personal tasks</b><span title="Only you can see these"><Info size={13} /></span><span className="spacer" />
        <Popover align="right" width={200} trigger={<button className="icon-btn xs light"><MoreVertical size={14} /></button>}>
          {(c) => <button className="pop-item" onClick={async () => { for (const t of (data || []).filter((x) => x.done)) await api.del(`/personal-tasks/${t.id}`); reload(); c() }}><Trash2 size={13} />Clear completed</button>}
        </Popover>
        <button className="icon-btn xs light" onClick={onClose}><X size={15} /></button></div>
      <div className="pp-body">
        {(data || []).map((t) => (
          <div key={t.id} className={`pp-row ${t.done ? 'done' : ''}`}>
            <input type="checkbox" checked={t.done} onChange={() => toggle(t)} />
            <span contentEditable suppressContentEditableWarning className="pp-title" onBlur={(e) => rename(t, e.target.textContent)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.target.blur())}>{t.title}</span>
            <button className="icon-btn xs" onClick={() => del(t)}><X size={12} /></button>
          </div>
        ))}
        {adding ? (
          <form onSubmit={add}><input className="input sm" autoFocus placeholder="Type a task and press Enter" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => !title && setAdding(false)} /></form>
        ) : <button className="add-row" onClick={() => setAdding(true)}>Click here to add a personal task...</button>}
      </div>
    </div>
  )
}

/* ---------------- My milestones ---------------- */
function MyMilestones({ personId }) {
  const { data, reload } = useData(`/work/milestones?user_id=${personId}`, [personId])
  const { refresh } = useUi()
  if (!data) return <Loading />
  if (!data.length) return <Empty icon={Flag} title="No milestones" text="Milestones you're responsible for will appear here." action={<AddTaskSplit />} />
  const today = todayISO()
  const groups = [['Late', (m) => m.due_date && m.due_date < today], ['Today', (m) => m.due_date === today], ['Upcoming', (m) => m.due_date > today], ['No due date', (m) => !m.due_date]]
  const complete = async (m) => { await api.patch(`/milestones/${m.id}`, { completed: true }); reload(); refresh() }
  return groups.map(([l, fn]) => {
    const items = data.filter(fn)
    if (!items.length) return null
    return (
      <div className="tw-group" key={l}>
        <div className="tw-ghead"><b style={{ color: l === 'Late' ? 'var(--danger)' : undefined }}>{l}</b><span className="badge grey">{items.length}</span></div>
        {items.map((m) => (
          <div key={m.id} className="twrow" style={{ cursor: 'default' }}>
            <button className="check" title="Complete milestone" onClick={() => complete(m)} />
            <Flag size={14} color="#8b5cf6" />
            <Link to={`/projects/${m.project_id}/milestones`} className="tw-title">{m.name}</Link>
            <span className="muted small">{m.project_name}</span>
            {m.task_count > 0 && <span style={{ width: 90 }}><Progress value={(m.completed_count / m.task_count) * 100} /></span>}
            <span className={`row-end dates ${m.due_date && m.due_date < today ? 'late' : ''}`}>{m.due_date ? fmtDate(m.due_date) : ''}</span>
          </div>
        ))}
      </div>
    )
  })
}

/* ---------------- My projects ---------------- */
function MyProjects() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data } = useData('/projects?status=active')
  if (!data) return <Loading />
  const mine = data.filter((p) => p.members?.some((m) => m.id === user.id) || p.owner?.id === user.id)
  if (!mine.length) return <Empty icon={Folder} title="No projects" text="Projects you're a member of will appear here." />
  return (
    <div className="card table-wrap">
      <table className="table">
        <thead><tr><th>Project</th><th>Client</th><th>Health</th><th>Progress</th><th>Late</th><th>Owner</th><th>People</th></tr></thead>
        <tbody>{mine.map((p) => (
          <tr key={p.id} className="click" onClick={() => navigate(`/projects/${p.id}`)}>
            <td><span className="row" style={{ gap: 8 }}><span className="dot" style={{ background: p.color }} /><b>{p.name}</b></span></td>
            <td className="muted">{p.client?.name || '—'}</td>
            <td><HealthPill h={p.health} /></td>
            <td style={{ width: 140 }}><span className="row" style={{ gap: 6 }}><span style={{ flex: 1 }}><Progress value={p.progress} /></span><span className="small muted">{p.progress}%</span></span></td>
            <td>{p.late_count ? <span className="dates late">{p.late_count}</span> : <span className="muted">0</span>}</td>
            <td>{p.owner && <Avatar user={p.owner} size={22} />}</td>
            <td><AvatarStack users={p.members} size={22} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}
