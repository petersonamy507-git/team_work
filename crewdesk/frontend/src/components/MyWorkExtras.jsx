// My work extras: "+" Add/remove tabs panel, grouped Activity feed, Events, Health report, Workload tabs
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, GripVertical, CheckSquare, CalendarDays, Clock, Folder, List, CalendarCheck, HeartPulse, Users, ChevronDown, LayoutGrid } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useData, useUi } from '../lib/ui-context'
import { timeAgo, fmtDate } from '../lib/format'
import { Avatar, HealthPill } from './ui'
import { EmptyState } from './Kit'

export const ALL_TABS = [['tasks', 'My tasks', CheckSquare], ['calendar', 'My calendar', CalendarDays], ['timesheet', 'My timesheet', Clock],
  ['projects', 'My projects', Folder], ['activity', 'Activity', List], ['dashboards', 'Dashboards', LayoutGrid],
  ['events', 'Events', CalendarCheck], ['health', 'Health report', HeartPulse], ['workload', 'Workload', Users]]
const DEFAULT_TABS = ['tasks', 'calendar', 'timesheet', 'projects', 'activity', 'dashboards']

export function useMyWorkTabs() {
  const [tabs, setTabs] = useState(DEFAULT_TABS)
  useEffect(() => { api.get('/prefs').then((p) => p.mywork_tabs && setTabs(p.mywork_tabs)).catch(() => {}) }, [])
  const save = (t) => { setTabs(t); api.patch('/prefs', { mywork_tabs: t }).catch(() => {}) }
  return [tabs, save]
}

export function TabManager({ tabs, setTabs }) {
  const [open, setOpen] = useState(false)
  const [drag, setDrag] = useState(null)
  const on = (k) => tabs.includes(k)
  const toggle = (k) => setTabs(on(k) ? tabs.filter((x) => x !== k) : [...tabs, k])
  const drop = (k) => { if (!drag || drag === k || !on(drag) || !on(k)) return; const t = tabs.filter((x) => x !== drag); t.splice(t.indexOf(k), 0, drag); setTabs(t); setDrag(null) }
  useEffect(() => { if (!open) return; const h = (e) => !e.target.closest('.tabmgr') && setOpen(false); document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [open])
  const row = ([k, l, I]) => (
    <div key={k} className="tabmgr-row" draggable={on(k) && k !== 'tasks'} onDragStart={() => setDrag(k)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(k)}>
      <GripVertical size={14} className="muted" style={{ visibility: k === 'tasks' ? 'hidden' : 'visible' }} /><I size={15} className="muted" /><span style={{ flex: 1 }}>{l}</span>
      <label className="switch"><input type="checkbox" checked={on(k)} disabled={k === 'tasks'} onChange={() => toggle(k)} /><i /></label>
    </div>)
  return (
    <span className="tabmgr" style={{ position: 'relative' }}>
      <a title="Add/remove tabs" onClick={() => setOpen(!open)} style={{ cursor: 'pointer', padding: '10px 8px 12px', display: 'inline-flex' }}><Plus size={16} /></a>
      {open && <div className="tabmgr-pop">
        <b>Add/remove tabs</b>
        {tabs.map((k) => ALL_TABS.find((t) => t[0] === k)).filter(Boolean).map(row)}
        <b style={{ marginTop: 10 }}>Available tabs</b>
        {ALL_TABS.filter((t) => !on(t[0])).map(row)}
        {ALL_TABS.every((t) => on(t[0])) && <div className="muted small">All tabs are shown.</div>}
      </div>}
    </span>
  )
}

export function MyActivity() {
  const { data } = useData('/activity')
  const [range, setRange] = useState('all')
  const navigate = useNavigate()
  const { setQuickAdd } = useUi()
  const since = { today: 1, week: 7, month: 30 }[range]
  const rows = (data || []).filter((a) => !since || Date.now() - new Date(a.created_at + 'Z') < since * 864e5)
  const groups = rows.reduce((g, a) => { const k = a.project_name || 'General'; (g[k] = g[k] || []).push(a); return g }, {})
  return (
    <>
      <div className="tw-toolbar">
        <select className="input" style={{ width: 140, height: 32, border: 0, fontWeight: 500 }} value={range} onChange={(e) => setRange(e.target.value)}><option value="all">All time</option><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option></select>
        <span className="spacer" /><span className="split-btn"><button className="btn primary" onClick={() => setQuickAdd('project')}><Plus size={15} />Add project</button></span>
      </div>
      {data && !rows.length && <EmptyState icon={List} title="No activity" text="Nothing happened in this period." />}
      {Object.entries(groups).map(([proj, list]) => (
        <div key={proj} style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, margin: '10px 0 6px' }}>{list[0].project_id ? <Link to={`/projects/${list[0].project_id}`}>{proj}</Link> : proj}</div>
          {list.map((a) => (
            <div key={a.id} className="twrow" style={{ cursor: a.project_id ? 'pointer' : 'default' }} onClick={() => a.project_id && navigate(`/projects/${a.project_id}/activity`)}>
              <Avatar user={a.user} size={28} /><span className="ellipsis" style={{ flex: 1 }}><b>{a.user?.name}</b> {a.action}</span>
              <span className="kit-pill gray">{fmtDate(a.created_at)}</span><span className="muted small" style={{ width: 70, textAlign: 'right' }}>{new Date(a.created_at + 'Z').toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
            </div>))}
        </div>))}
    </>
  )
}

export function MyEvents() {
  const s = new Date().toISOString().slice(0, 10)
  const e = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10)
  const { data } = useData(`/events?start=${s}&end=${e}`)
  const { setQuickAdd } = useUi()
  return (<>
    <div className="tw-toolbar"><h2>Upcoming events</h2><span className="spacer" /><button className="btn primary" onClick={() => setQuickAdd('event')}><Plus size={15} />Add event</button></div>
    {data && !data.length && <EmptyState icon={CalendarCheck} title="No upcoming events" text="Events you add show up here and on your calendar." />}
    {(data || []).map((ev) => <div key={ev.id} className="twrow"><CalendarCheck size={16} className="muted" /><b style={{ flex: 1 }}>{ev.title}</b><span className="muted small">{fmtDate(ev.date, { weekday: 'short', day: 'numeric', month: 'short' })} {ev.start_time || ''}{ev.end_time ? `–${ev.end_time}` : ''}</span></div>)}
  </>)
}

export function MyHealth() {
  const { user } = useAuth()
  const { data } = useData('/projects?status=active')
  const mine = (data || []).filter((p) => p.owner?.id === user.id || p.members?.some((m) => m.id === user.id))
  return (<>
    <div className="tw-toolbar"><h2>Health report</h2><span className="muted small">Projects you own or belong to</span></div>
    <table className="kit-table"><thead><tr><th>Project</th><th>Health</th><th>Progress</th><th>Late tasks</th><th>End date</th></tr></thead>
      <tbody>{mine.map((p) => <tr key={p.id}><td><Link to={`/projects/${p.id}`}><b>{p.name}</b></Link></td><td><HealthPill h={p.health} /></td><td>{p.progress}%</td><td style={{ color: p.late_count ? 'var(--danger)' : '' }}>{p.late_count}</td><td>{fmtDate(p.end_date) || '—'}</td></tr>)}</tbody></table>
  </>)
}

export function MyWorkload() {
  const { user } = useAuth()
  const { data } = useData('/resourcing/workload?days=14')
  const me = data?.rows.find((r) => r.user.id === user.id)
  return (<>
    <div className="tw-toolbar"><h2>My workload</h2><span className="muted small">Next two weeks · estimated time vs capacity</span><span className="spacer" /><Link className="btn" to="/planning/workload">Team workload</Link></div>
    {me && <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{me.days.map((d) => { const pct = d.capacity ? d.minutes / d.capacity : 0
      return <div key={d.date} className={`cell-load ${!d.capacity ? 'weekend' : pct > 1 ? 'over' : pct >= 0.8 ? 'full' : d.minutes ? 'under' : ''}`} style={{ width: 70, height: 56, flexDirection: 'column' }}><span className="small">{fmtDate(d.date, { weekday: 'short', day: 'numeric' })}</span><b>{d.capacity ? `${Math.round(d.minutes / 60 * 10) / 10}h` : ''}</b></div> })}</div>}
    {me && <div style={{ marginTop: 16 }}><b>{me.open_tasks} open tasks</b> <span className="muted small">· {Math.round(me.estimated / 60)}h estimated</span></div>}
    <ChevronDown size={0} />
  </>)
}

export { timeAgo }
