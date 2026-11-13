import { useEffect, useState, useRef } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Home, CheckCircle2, Inbox, Folder, Clock, Users, BarChart3, Flag, CalendarDays, Building2, Activity,
  Plus, Search, LogOut, ChevronsLeft, ChevronsRight, Star, Settings, ListChecks, MessageSquare, FolderPlus, Timer,
  Menu as MenuIcon, Bell, HelpCircle, ChevronRight, CheckSquare, Sparkles, DollarSign, Grid3x3,
  MessageCircle, Bot, BookOpen, Pencil, CreditCard, Gift, Palette as PaletteIcon, Rocket, Keyboard,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useUi } from '../lib/ui-context'
import { api } from '../lib/api'
import { Avatar, Menu, Toast } from './ui'
import TaskDrawer from './TaskDrawer'
import QuickAdd from './QuickAdd'
import SideNav from './SideNav'
import { GettingStarted } from '../pages/Welcome'

// Quick add items as in Teamwork: [key, label, icon, quickAdd kind or route, keyboard shortcut]
const QUICK = [
  ['task', 'Task', CheckSquare, 'task', 'T'], ['aitask', 'AI task wizard', Sparkles, '/ai/ask'], ['project', 'Project', FolderPlus, 'project', 'P'],
  ['aiproject', 'Create project with AI', Sparkles, '/ai/ask'], ['timer', 'Start timer', Timer, '', 'S'], ['time', 'Log time', Clock, 'time', 'L'],
  ['budget', 'Budget', DollarSign, '/finance/budgets?new=1', 'B'], ['invite', 'Invite users', Users, '/people/people?invite=1'],
  ['message', 'Message', MessageSquare, 'message', 'N'], ['event', 'Event', CalendarDays, 'event', 'E'], ['milestone', 'Milestone', Flag, 'milestone', 'M'],
  ['client', 'Client', Building2, '/clients?new=1'], ['report', 'Report', BarChart3, '/reports/custom?new=1'],
]

const NAV = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/my-work', icon: CheckCircle2, label: 'My work', more: true },
  { to: '/inbox', icon: Inbox, label: 'Inbox', badge: true },
  { section: 'Manage' },
  { to: '/clients', icon: Building2, label: 'Clients' },
  { to: '/projects', icon: Folder, label: 'Projects', more: true },
  { to: '/time', icon: Clock, label: 'Time', more: true },
  { to: '/tasks', icon: CheckCircle2, label: 'Tasks', more: true },
  { to: '/milestones', icon: Flag, label: 'Milestones' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/people', icon: Users, label: 'People' },
  { section: 'Plan & Insights' },
  { to: '/reports', icon: BarChart3, label: 'Reporting', more: true },
  { to: '/activity', icon: Activity, label: 'Activity' },
]

function Palette() {
  const { paletteOpen, setPaletteOpen, openTask } = useUi()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [r, setR] = useState(null)
  const timer = useRef()
  useEffect(() => {
    if (!paletteOpen) { setQ(''); setR(null) }
  }, [paletteOpen])
  useEffect(() => {
    clearTimeout(timer.current)
    if (q.trim().length < 2) return setR(null)
    timer.current = setTimeout(() => api.get(`/search?q=${encodeURIComponent(q)}`).then(setR), 200)
  }, [q])
  if (!paletteOpen) return null
  const go = (fn) => { setPaletteOpen(false); fn() }
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setPaletteOpen(false)} onKeyDown={(e) => e.key === 'Escape' && setPaletteOpen(false)}>
      <div className="palette">
        <input autoFocus placeholder="Search projects, tasks, people, messages…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="results">
          {!r && <div className="muted small" style={{ padding: 10 }}>Type at least 2 characters</div>}
          {r && !r.projects.length && !r.tasks.length && !r.people.length && !r.messages.length && <div className="muted small" style={{ padding: 10 }}>No results</div>}
          {r?.projects.length > 0 && <div className="group">Projects</div>}
          {r?.projects.map((p) => <div key={'p' + p.id} className="item" onClick={() => go(() => navigate(`/projects/${p.id}`))}><span className="dot" style={{ background: p.color }} />{p.name}</div>)}
          {r?.tasks.length > 0 && <div className="group">Tasks</div>}
          {r?.tasks.map((t) => <div key={'t' + t.id} className="item" onClick={() => go(() => openTask(t.id))}><CheckSquare size={15} />{t.title}<span className="muted small" style={{ marginLeft: 'auto' }}>{t.project_name}</span></div>)}
          {r?.people.length > 0 && <div className="group">People</div>}
          {r?.people.map((p) => <div key={'u' + p.id} className="item" onClick={() => go(() => navigate(`/people/${p.id}`))}><Avatar user={p} size={22} />{p.name}</div>)}
          {r?.messages.length > 0 && <div className="group">Messages</div>}
          {r?.messages.map((m) => <div key={'m' + m.id} className="item" onClick={() => go(() => navigate(`/projects/${m.project_id}/messages/${m.id}`))}><MessageSquare size={15} />{m.title}</div>)}
        </div>
      </div>
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const { setQuickAdd, setPaletteOpen, unread, projects, toast, notify } = useUi()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('cd_side') === '1')
  const navigate = useNavigate()

  useEffect(() => {
    const k = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(true) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [setPaletteOpen])

  const runQuick = (key) => {
    const q = QUICK.find((x) => x[0] === key)
    if (!q) return
    if (key === 'timer') { try { localStorage.setItem('cd_timer', String(Date.now())) } catch { /* ignore */ } notify('Timer started'); navigate('/time/all'); return }
    if (q[3].startsWith('/')) navigate(q[3]); else setQuickAdd(q[3])
  }
  useEffect(() => {
    const k = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable || document.querySelector('.overlay')) return
      const q = QUICK.find((x) => x[4] && x[4].toLowerCase() === e.key.toLowerCase())
      if (q) { e.preventDefault(); runQuick(q[0]) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  const [chatUnread, setChatUnread] = useState(0)
  useEffect(() => { const f = () => api.get('/chat/unread').then((r) => setChatUnread(r.unread)).catch(() => {}); f(); const t = setInterval(f, 15000); return () => clearInterval(t) }, [])
  const [logo, setLogo] = useState(null)
  useEffect(() => { api.get('/settings').then((st) => setLogo(st.logo?.data || null)).catch(() => {}) }, [])
  const toggle = () => { localStorage.setItem('cd_side', collapsed ? '0' : '1'); setCollapsed(!collapsed) }
  const starred = projects.filter((p) => p.is_starred)

  return (
    <div className="app tw-shell">
      <header className="tw-topbar">
        <div className="tt-left">
          <button className="tt-icon" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={toggle}><MenuIcon size={18} /></button>
          <NavLink to="/" className="tt-logo" title="Crewdesk home"><img src={logo || "/logo.svg"} alt="Crewdesk" /></NavLink>
        </div>
        <button className="tt-search" onClick={() => setPaletteOpen(true)}><Search size={14} />Search<kbd>Ctrl + K</kbd></button>
        <div className="tt-right">
          <button className="tt-icon" title="Start a new timer" onClick={() => runQuick('timer')}><Timer size={17} /></button>
          <button className="tt-upgrade" onClick={() => navigate('/settings/subscription')}>Plan</button>
          <button className="tt-icon rel" title="Notifications" onClick={() => navigate('/inbox')}><Bell size={17} />{unread > 0 && <span className="tt-badge">{unread > 99 ? '99+' : unread}</span>}</button>
          <button className="tt-icon rel" title="Chat" onClick={() => navigate('/chat')}><MessageCircle size={17} />{chatUnread > 0 && <span className="tt-badge">{chatUnread}</span>}</button>
          <Menu trigger={<button className="tt-icon" title="Help"><HelpCircle size={17} /></button>}>
            <button onClick={() => navigate('/welcome')}><Rocket size={15} />Getting started</button>
            <button onClick={() => notify('Shortcuts: Ctrl+K search · T task · P project · L log time · S timer · M milestone · E event · N message · B budget')}><Keyboard size={15} />Keyboard shortcuts</button>
            <button onClick={() => navigate('/ai/ask')}><Sparkles size={15} />Ask AI for help</button>
          </Menu>
          <button className="tt-icon" title="Automations" onClick={() => navigate('/automate')}><Bot size={17} /></button>
          <Menu trigger={<button className="tt-icon" title="Other apps"><Grid3x3 size={17} /></button>}>
            <button onClick={() => navigate('/chat')}><MessageCircle size={15} />Crewdesk Chat</button>
            <button onClick={() => navigate('/everything/notebooks')}><BookOpen size={15} />Crewdesk Spaces (Notebooks)</button>
            <button onClick={() => navigate('/settings/integrations')}><Settings size={15} />Manage apps</button>
          </Menu>
          <button className="tt-ask" onClick={() => navigate('/ai/ask')}><Sparkles size={13} />Ask AI</button>
          <Menu trigger={<button className="tt-avatar"><Avatar user={user} size={24} /></button>}>
            <div className="row" style={{ padding: '8px 10px', gap: 10, cursor: 'pointer' }} onClick={() => navigate(`/people/person/${user.id}/details`)}><Avatar user={user} size={34} /><div><b>{user.name}</b><div className="small" style={{ color: 'var(--accent)' }}>View profile</div></div></div>
            <button onClick={() => navigate('/settings/profile')}><Pencil size={15} />Edit my details</button>
            <button onClick={() => navigate('/settings/general')}><Settings size={15} />Settings</button>
            <button onClick={() => navigate('/settings/subscription')}><CreditCard size={15} />Subscription</button>
            <button onClick={() => navigate('/my-work')}><CheckSquare size={15} />My tasks</button>
            <button onClick={() => navigate('/settings/integrations')}><Grid3x3 size={15} />Apps and integrations</button>
            <button onClick={() => navigate('/activity')}><Gift size={15} />What's new?</button>
            <button onClick={() => navigate('/settings/appearance')}><PaletteIcon size={15} />Appearance</button>
            <button onClick={() => { logout(); navigate('/login') }}><LogOut size={15} />Logout</button>
          </Menu>
        </div>
      </header>
      <div className="tw-frame">
        <aside className={`sidebar tw-side ${collapsed ? 'collapsed' : ''}`}>
          <div className="side-scroll">
            <Menu trigger={<button className="quick-add"><Plus size={16} /><span className="label">Quick add</span></button>}>
              <div className="muted small" style={{ padding: '6px 10px' }}>Quick add</div>
              {QUICK.map(([key, label, Icon, , sc]) => <button key={key} onClick={() => runQuick(key)}><Icon size={15} />{label}{sc && <kbd className="qa-kbd">{sc}</kbd>}</button>)}
            </Menu>
            <SideNav collapsed={collapsed} />
          </div>
        </aside>
        <main className="content"><Outlet /></main>
      </div>
      <TaskDrawer />
      <QuickAdd />
      <GettingStarted />
      <Palette />
      {toast && <Toast text={toast} onDone={() => notify(null)} />}
    </div>
  )
}
