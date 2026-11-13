// Teamwork-style sidebar: hover flyouts, Recent panel, "Jump to" projects panel, More menu, starred & recent projects.
import { useEffect, useRef, useState } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Home, CircleCheck, History, Inbox, Sparkles, Building2, Folder, LayoutTemplate, Clock, CircleCheckBig, CalendarRange,
  BarChart3, DollarSign, MoreHorizontal, ChevronRight, PanelRightOpen, X, Search, Pin, Star, FileCheck2, LayoutGrid,
  CalendarDays, Users, Zap, Mail, CheckSquare, MessageSquare, FolderOpen, Plus, Rocket,
} from 'lucide-react'
import { api } from '../lib/api'
import { useUi } from '../lib/ui-context'
import { timeAgo } from '../lib/format'

const NAV = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/my-work', icon: CircleCheck, label: 'My work', match: ['/my-work', '/work'], children: [
    ['/my-work', 'My tasks', CheckSquare], ['/my-work?tab=calendar', 'My calendar', CalendarDays], ['/my-work?tab=timesheet', 'My timesheet', Clock],
    ['/my-work?tab=projects', 'My projects', Folder], ['/my-work?tab=activity', 'Activity', History], ['/my-work?tab=dashboards', 'Dashboards', LayoutGrid]] },
  { panel: 'recent', icon: History, label: 'Recent' },
  { to: '/inbox', icon: Inbox, label: 'Inbox', badge: true },
  { to: '/welcome', icon: Rocket, label: 'Welcome' },
  { to: '/ai/ask', icon: Sparkles, label: 'Crewdesk AI', ai: true, match: ['/ai'], children: [
    ['/ai/ask', 'Ask AI', Sparkles], ['/ai/teammates', 'AI teammates', Users], ['/ai/skills', 'AI skills', Zap, 'NEW']] },
  { section: 'Manage' },
  { to: '/clients', icon: Building2, label: 'Clients' },
  { to: '/people/people', icon: Users, label: 'People', match: ['/people'], children: [
    ['/people/people', 'People', Users], ['/people/roles', 'Roles', LayoutGrid], ['/people/skills', 'Skills', Zap, 'NEW'], ['/people/teams', 'Teams', Users], ['/people/statuses', 'Statuses', MessageSquare]] },
  { to: '/projects', icon: Folder, label: 'Projects', jump: true },
  { to: '/templates', icon: LayoutTemplate, label: 'Templates' },
  { to: '/time/all', icon: Clock, label: 'Time', match: ['/time'], children: [
    ['/time/timesheet', 'My timesheet', Clock], ['/time/company', 'Company timesheet', Users], ['/time/all', 'All time', History], ['/time/approvals', 'Approvals', CircleCheckBig]] },
  { to: '/tasks', icon: CircleCheckBig, label: 'Tasks', match: ['/tasks'], children: [
    ['/tasks', 'Tasks', CheckSquare], ['/tasks/board', 'Board', LayoutGrid], ['/tasks/table', 'Table', LayoutGrid], ['/tasks/completed', 'Completed tasks', CircleCheckBig]] },
  { section: 'Plan & Insights' },
  { to: '/planning/workload', icon: CalendarRange, label: 'Resourcing', match: ['/planning'], children: [
    ['/planning/overview', 'Overview', LayoutGrid], ['/planning/schedule', 'Schedule', CalendarDays], ['/planning/workload', 'Workload', Users],
    ['/planning/portfolio', 'Portfolio', Folder], ['/planning/chart', 'Chart', BarChart3]] },
  { to: '/reports/all', icon: BarChart3, label: 'Reporting', match: ['/reports'], children: [
    ['/reports/all', 'All reports', BarChart3], ['/reports/custom', 'Custom Reports', LayoutGrid], ['/reports/scheduled', 'Scheduled reports', CalendarDays]] },
  { to: '/finance/budgets', icon: DollarSign, label: 'Finance', match: ['/finance'], children: [
    ['/finance/rates', 'Rates', DollarSign], ['/finance/budgets', 'Budgets', Folder], ['/finance/invoices', 'Invoices', FileCheck2], ['/finance/expenses', 'Expenses', FileCheck2]] },
]
const MORE = [
  ['/proofs', 'Proofs', FileCheck2],
  ['/everything/milestones', 'Everything', LayoutGrid, [['/everything/milestones', 'Milestones'], ['/everything/comments', 'Comments'], ['/everything/forms', 'Forms'], ['/everything/risks', 'Risks'],
    ['/everything/notebooks', 'Notebooks'], ['/everything/files', 'Files'], ['/everything/messages', 'Messages'], ['/everything/links', 'Links']]],
  ['/calendar', 'Calendar', CalendarDays],
  ['/people/people', 'People', Users, [['/people/people', 'People'], ['/people/roles', 'Roles'], ['/people/skills', 'Skills'], ['/people/teams', 'Teams'], ['/people/statuses', 'Statuses']]],
  ['/automate', 'Automate', Zap],
  ['/chat', 'Chat', MessageSquare],
  ['/settings', 'Settings', LayoutGrid],
]
const AV = ['#fde68a', '#bfdbfe', '#fecaca', '#bbf7d0', '#ddd6fe', '#fbcfe8']

function Flyout({ anchor, children, onEnter, onLeave }) {
  if (!anchor) return null
  const r = anchor.getBoundingClientRect()
  const top = Math.min(r.top, window.innerHeight - 340)
  return <div className="side-flyout" style={{ left: r.right + 6, top }} onMouseEnter={onEnter} onMouseLeave={onLeave}>{children}</div>
}

function RecentPanel({ onClose }) {
  const [tab, setTab] = useState('')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState(null)
  const navigate = useNavigate()
  const { openTask } = useUi()
  useEffect(() => { api.get(`/recent?${tab ? `kind=${tab}&` : ''}${q ? `q=${encodeURIComponent(q)}` : ''}`).then(setRows) }, [tab, q])
  const day = (s) => { const d = (Date.now() - new Date(s.endsWith('Z') ? s : s + 'Z')) / 864e5; return d < 1 ? 'Today' : d < 2 ? 'Yesterday' : 'Earlier' }
  let last = ''
  const Icon = { project: Folder, task: CheckSquare, message: Mail, comment: MessageSquare }
  return (
    <div className="side-panel" style={{ left: 255 }}>
      <div className="sp-head"><h3>Recent</h3><button className="icon-btn" title="Pin"><Pin size={15} /></button><button className="icon-btn" onClick={onClose}><X size={16} /></button></div>
      <label className="sp-search"><Search size={14} /><input autoFocus placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <div className="sp-tabs">{[['', 'All'], ['project', 'Projects'], ['task', 'Tasks'], ['message', 'Messages']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div className="sp-list">
        {rows && !rows.length && <div className="muted small" style={{ padding: 12 }}>Things you open will show up here.</div>}
        {(rows || []).map((r) => { const d = day(r.viewed_at); const head = d !== last; last = d; const I = Icon[r.kind] || Folder
          return <div key={r.id}>{head && <div className="sp-day">{d}</div>}
            <div className="sp-item" onClick={() => { onClose(); if (r.kind === 'task') openTask(r.ref_id); else navigate(r.link) }}><span className="ic"><I size={12} /></span><span className="t"><b>{r.title}</b><span>{r.subtitle} · {timeAgo(r.viewed_at)}</span></span></div></div> })}
      </div>
    </div>
  )
}

function JumpPanel({ onClose }) {
  const { projects } = useUi()
  const [tab, setTab] = useState('recent')
  const [q, setQ] = useState('')
  const [recent, setRecent] = useState([])
  const [cats, setCats] = useState([])
  const navigate = useNavigate()
  useEffect(() => { api.get('/recent?kind=project').then(setRecent); api.get('/r/categories').then(setCats) }, [])
  let list = tab === 'starred' ? projects.filter((p) => p.is_starred) : tab === 'recent' ? recent.map((r) => projects.find((p) => p.id === r.ref_id)).filter(Boolean) : projects
  if (tab === 'recent' && !list.length) list = projects
  list = list.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
  const go = (to) => { onClose(); navigate(to) }
  return (
    <div className="side-panel" style={{ left: 255 }}>
      <div className="sp-head"><h3>Jump to</h3><button className="icon-btn" title="Add project" onClick={() => go('/projects')}><Plus size={15} /></button><button className="icon-btn"><Pin size={15} /></button><button className="icon-btn" onClick={onClose}><X size={16} /></button></div>
      <label className="sp-search"><Search size={14} /><input autoFocus placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <div className="sp-tabs">{[['recent', 'Recent'], ['starred', 'Starred'], ['all', 'All'], ['categories', 'Categories']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div className="sp-list">
        {tab === 'categories' ? cats.map((c) => <div key={c.id}><div className="sp-day">{c.name}</div>{projects.filter((p) => p.category_id === c.id).map((p) => <div key={p.id} className="sp-item" onClick={() => go(`/projects/${p.id}`)}><Star size={14} className="muted" /><span className="t"><b>{p.name}</b><span>{p.client?.name || ''}</span></span></div>)}</div>)
          : list.map((p) => <div key={p.id} className="sp-item" onClick={() => go(`/projects/${p.id}`)}><Star size={14} fill={p.is_starred ? '#f0b400' : 'none'} color={p.is_starred ? '#f0b400' : '#9aa0b5'} /><span className="t"><b>{p.name}</b><span>{p.client?.name || 'No client'}</span></span></div>)}
        {tab === 'categories' && !cats.length && <div className="muted small" style={{ padding: 12 }}>No categories yet.</div>}
      </div>
      <div className="sp-foot"><a onClick={() => go('/projects')}><FolderOpen size={15} />See all projects<ChevronRight size={14} style={{ marginLeft: 'auto' }} /></a><a onClick={() => go('/templates')}><LayoutTemplate size={15} />Project templates<ChevronRight size={14} style={{ marginLeft: 'auto' }} /></a></div>
    </div>
  )
}

export default function SideNav({ collapsed }) {
  const { unread, projects, taskId } = useUi()
  const loc = useLocation()
  const [fly, setFly] = useState(null) // {key, el}
  const [sub, setSub] = useState(null)
  const [panel, setPanel] = useState(null)
  const [recentProjects, setRecentProjects] = useState([])
  const timer = useRef()
  const open = (key, el) => { clearTimeout(timer.current); setFly({ key, el }); setSub(null) }
  const close = () => { timer.current = setTimeout(() => { setFly(null); setSub(null) }, 180) }
  const keep = () => clearTimeout(timer.current)
  useEffect(() => { setFly(null); setPanel(null) }, [loc.pathname])
  useEffect(() => { api.get('/recent?kind=project').then(setRecentProjects).catch(() => {}) }, [loc.pathname])
  // remember opened projects and tasks for the Recent panel
  useEffect(() => {
    const m = loc.pathname.match(/^\/projects\/(\d+)/)
    const p = m && projects.find((x) => x.id === Number(m[1]))
    if (p) api.post('/recent', { kind: 'project', ref_id: p.id, title: p.name, subtitle: p.client?.name || 'Project', link: `/projects/${p.id}` }).catch(() => {})
    const mm = loc.pathname.match(/^\/projects\/(\d+)\/messages\/(\d+)/)
    if (mm) api.get(`/messages/${mm[2]}`).then((x) => api.post('/recent', { kind: 'message', ref_id: x.id, title: x.title, subtitle: p?.name || 'Message', link: loc.pathname })).catch(() => {})
  }, [loc.pathname, projects])
  useEffect(() => {
    if (taskId) api.get(`/tasks/${taskId}`).then((t) => api.post('/recent', { kind: 'task', ref_id: t.id, title: t.title, subtitle: t.project_name, link: `/tasks/${t.id}` })).catch(() => {})
  }, [taskId])
  const active = (n) => (n.match ? n.match.some((m) => loc.pathname.startsWith(m)) : null)
  const starred = projects.filter((p) => p.is_starred)
  const recentP = recentProjects.map((r) => projects.find((p) => p.id === r.ref_id)).filter(Boolean)
  const shownRecent = (recentP.length ? recentP : projects).slice(0, 8)
  const flyItem = fly ? NAV.find((n) => n.children && n.label === fly.key) : null
  return (
    <>
      {NAV.map((n, i) => {
        if (n.section) return <div className="side-section" key={i}>{n.section}</div>
        if (n.panel) return (
          <a key={n.label} className={`side-link ${panel === 'recent' ? 'active' : ''}`} title={n.label} onClick={() => setPanel(panel === 'recent' ? null : 'recent')} style={{ cursor: 'pointer' }}>
            <n.icon size={17} /><span className="label">{n.label}</span></a>)
        return (
          <NavLink key={n.to} to={n.to} end={n.end} title={n.label}
            className={({ isActive }) => `side-link ${(active(n) ?? isActive) ? 'active' : ''}`}
            onMouseEnter={(e) => n.children && open(n.label, e.currentTarget)} onMouseLeave={() => n.children && close()}>
            <n.icon size={17} color={n.ai ? '#c03cc4' : undefined} /><span className="label">{n.label}</span>
            {n.badge && unread > 0 && <span className="side-count">{unread > 9999 ? '9999+' : unread}</span>}
            {n.children && <ChevronRight size={15} className="side-chevron" />}
            {n.jump && <button className="jump-btn label" title="Jump to" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPanel(panel === 'jump' ? null : 'jump') }}><PanelRightOpen size={14} /></button>}
          </NavLink>)
      })}
      <div style={{ borderTop: '1px solid var(--border)', margin: '10px 0 6px' }} />
      <a className={`side-link ${fly?.key === 'More' ? 'active' : ''}`} style={{ cursor: 'pointer' }} onClick={(e) => (fly?.key === 'More' ? setFly(null) : open('More', e.currentTarget))} onMouseLeave={close}><MoreHorizontal size={17} /><span className="label">More</span></a>
      {!collapsed && <>
        <div className="side-section">Starred projects</div>
        {starred.length ? starred.map((p) => <Link key={p.id} to={`/projects/${p.id}`} className="side-recent-proj"><span className="av" style={{ background: AV[p.id % AV.length] }}>{p.name[0]}</span><span className="t"><b>{p.name}</b><span>{p.client?.name || 'No client'}</span></span></Link>)
          : <div className="side-empty label">No starred projects</div>}
        <div className="side-section">Recent projects</div>
        {shownRecent.map((p) => <Link key={p.id} to={`/projects/${p.id}`} className="side-recent-proj"><span className="av" style={{ background: AV[p.id % AV.length] }}>{p.name[0]}</span><span className="t"><b>{p.name}</b><span>{p.client?.name || 'No client'}</span></span></Link>)}
      </>}

      {flyItem && <Flyout anchor={fly.el} onEnter={keep} onLeave={close}>
        {flyItem.children.map(([to, label, I, badge]) => <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'active' : '')}><I size={15} />{label}{badge && <span className="new-badge">{badge}</span>}</NavLink>)}
      </Flyout>}
      {fly?.key === 'More' && <Flyout anchor={fly.el} onEnter={keep} onLeave={close}>
        {MORE.map(([to, label, I, kids]) => kids ? (
          <button key={to} className={sub?.key === label ? 'hov' : ''} onMouseEnter={(e) => setSub({ key: label, el: e.currentTarget, kids })} onClick={(e) => setSub({ key: label, el: e.currentTarget, kids })}><I size={15} />{label}<ChevronRight size={14} className="fly-chev" /></button>
        ) : <NavLink key={to} to={to} onMouseEnter={() => setSub(null)}><I size={15} />{label}</NavLink>)}
      </Flyout>}
      {fly?.key === 'More' && sub && <Flyout anchor={sub.el} onEnter={keep} onLeave={close}>
        {sub.kids.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>)}
      </Flyout>}
      {panel === 'recent' && <RecentPanel onClose={() => setPanel(null)} />}
      {panel === 'jump' && <JumpPanel onClose={() => setPanel(null)} />}
    </>
  )
}
