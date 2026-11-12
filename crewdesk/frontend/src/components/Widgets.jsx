// Dashboard widget library (mirrors Teamwork's "Add widget" library, by category)
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, ListChecks, Flag, HeartPulse, CheckCircle2, AlertTriangle, FileCheck2, Folder, Plus, Trash2, Bell } from 'lucide-react'
import { api, qs } from '../lib/api'
import { useData, useUi } from '../lib/ui-context'
import { fmtMinutes, HEALTH, timeAgo, fmtDate, todayISO } from '../lib/format'
import { Bars, Donut, Avatar, AvatarStack } from './ui'
import TaskRow from './TaskRow'
import { EmptyState, Pill, money, hrs, Meter, PersonChip } from './Kit'

export const CATEGORIES = ['Project health', 'Tasks', 'Time', 'Revenue & invoicing', 'Risks', 'Activity', 'Proofs', 'Embed & notes']
export const WIDGETS = {
  current_projects: { cat: 'Project health', name: 'Current projects', text: 'Projects that are currently on track' },
  late_projects: { cat: 'Project health', name: 'Late projects', text: 'Projects past their due date - manage delivery risks' },
  milestones: { cat: 'Project health', name: 'Milestones', text: 'Milestones grouped by status - late, today, upcoming, and completed', wide: true },
  project_updates: { cat: 'Project health', name: 'Project updates', text: 'The most recent updates on projects - stay informed' },
  projects: { cat: 'Project health', name: 'Projects', text: 'A live list of your projects - filter by status, owner, category, or tag.' },
  projects_by_category: { cat: 'Project health', name: 'Projects by category', text: 'Understand the types of work that make up the portfolio' },
  projects_by_health: { cat: 'Project health', name: 'Projects by health', text: 'Projects broken down by project health - spot issues fast' },
  budget_usage: { cat: 'Project health', name: 'Budget usage', text: 'Budget consumption grouped by: under 49%, 50-79%, and over 80%' },
  delegated: { cat: 'Tasks', name: 'Delegated tasks', text: 'Tasks you created and assigned to others, grouped into Late, Today, Upcoming, No due date and Completed', wide: true },
  late_by_project: { cat: 'Tasks', name: 'Late tasks by project', text: 'See which projects have the biggest number of overdue tasks' },
  my_tasks: { cat: 'Tasks', name: 'My tasks', text: 'Monitor tasks assigned to you that are late, due today, or upcoming soon.', wide: true },
  personal_tasks: { cat: 'Tasks', name: 'Personal tasks', text: 'Track and prioritise your own work without using a specific project.' },
  tasks: { cat: 'Tasks', name: 'Tasks', text: 'Monitor tasks that are late, due today, or upcoming soon.', wide: true },
  assignee_status: { cat: 'Tasks', name: 'Tasks by assignee × status', text: "Per-person task breakdown by state - see who's on track", wide: true },
  workflow_stages: { cat: 'Tasks', name: 'Workflow stages', text: 'Task counts per stage - track progress across projects' },
  logged_by_project: { cat: 'Time', name: 'Logged time by project', text: 'Uncover which projects generate the most hours' },
  logged_weekday: { cat: 'Time', name: 'Logged time by weekday', text: 'Monitor how logged hours distribute across the week' },
  my_logged: { cat: 'Time', name: 'My logged time', text: 'Your logged hours, split into billable and non-billable' },
  my_logged_weekday: { cat: 'Time', name: 'My logged time by weekday', text: 'Your hours logged across days of the week' },
  billable_trend: { cat: 'Time', name: 'Billable vs non-billable trend', text: 'Track month-on-month billability ratio' },
  non_billable: { cat: 'Time', name: 'Non-billable time', text: 'Non-billable hours - prevent unbilled work leakage' },
  time_distribution: { cat: 'Time', name: 'Time distribution', text: 'Logged time split by project' },
  profitability: { cat: 'Revenue & invoicing', name: 'Profitability', text: 'Total profitability amount, broken into revenue and costs' },
  active_risks: { cat: 'Risks', name: 'Active risks', text: 'Open risks broken down by severity - high, medium, and low' },
  top_risks: { cat: 'Risks', name: 'Top 10 risks', text: 'Monitor top 10 highest priority risks' },
  activity: { cat: 'Activity', name: 'Activity feed', text: 'The most recent activity - stay up to date' },
  inbox: { cat: 'Activity', name: 'Inbox', text: 'The latest items from your inbox' },
  my_calendar: { cat: 'Activity', name: 'My calendar', text: 'Your events, tasks, and milestones for the next two weeks' },
  unread: { cat: 'Activity', name: 'My unread items', text: 'Unread task comments and project messages' },
  status_updates: { cat: 'Activity', name: 'Status updates', text: 'See what everyone is working on, and post your own status update.' },
  proofs: { cat: 'Proofs', name: 'Proofs', text: 'Proofs with their approval status, feedback and version' },
  embedded: { cat: 'Embed & notes', name: 'Embedded', text: 'Bring in external content like YouTube, Google Docs, Figma and more' },
  private_notes: { cat: 'Embed & notes', name: 'Private notes', text: 'Private notes, links, and images - centralize your personal workflow' },
}
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PALETTE = ['#4461d7', '#e8378f', '#22b573', '#f0a500', '#8b5cf6', '#0ea5e9', '#ef4444', '#14b8a6']

export function TaskTabs({ groups, empty }) {
  const keys = [['late', 'Late'], ['today', 'Today'], ['upcoming', 'Upcoming'], ['no_due_date', 'No due date'], ['completed', 'Completed']]
  const [tab, setTab] = useState('late')
  const list = groups[tab] || []
  return (<>
    <div className="wtabs">{keys.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}<span className="n">{(groups[k] || []).length}</span></button>)}</div>
    {list.length ? list.slice(0, 30).map((t) => <TaskRow key={t.id} task={t} showProject />) : <EmptyState icon={ListChecks} title={`No ${keys.find((x) => x[0] === tab)[1].toLowerCase()} tasks`} text={empty} />}
  </>)
}
const bucket = (l) => { const t = todayISO(); const open = l.filter((x) => x.status !== 'completed')
  return { late: open.filter((x) => x.due_date && x.due_date < t), today: open.filter((x) => x.due_date === t), upcoming: open.filter((x) => x.due_date > t), no_due_date: open.filter((x) => !x.due_date), completed: l.filter((x) => x.status === 'completed') } }
const Legend = ({ items, fmt = (v) => v }) => <div className="legend" style={{ flex: 1 }}>{items.map((t) => <div className="li" key={t.name}><span className="dot" style={{ background: t.color }} />{t.name}<span className="v">{fmt(t.value)}</span></div>)}</div>
const DonutBox = ({ items, fmt, center, empty }) => (items.some((i) => i.value) ? <div className="row" style={{ gap: 20, alignItems: 'center' }}><Donut items={items.filter((i) => i.value)} center={center} /><Legend items={items.filter((i) => i.value)} fmt={fmt} /></div> : empty)
const Big = ({ n, label, tone }) => <div style={{ textAlign: 'center', padding: '30px 0' }}><div style={{ fontSize: 44, fontWeight: 700, color: tone }}>{n}</div><div className="muted small">{label}</div></div>

/** Renders one widget's body. w = { key, title?, config?, project_id? } */
export function WidgetBody({ w, data, range, onConfig }) {
  const { setQuickAdd, projects, people } = useUi()
  const k = w.key
  const pid = w.project_id ? Number(w.project_id) : null
  const need = (cond, url) => (cond ? url : null)
  const t = todayISO()
  const since = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10)
  const tasksAll = useData(need(['tasks', 'assignee_status', 'workflow_stages', 'late_by_project'].includes(k), `/tasks${qs({ status: k === 'late_by_project' ? 'open' : 'all', project_id: pid || '' })}`), [k, pid])
  const mine = useData(need(k === 'my_tasks', `/tasks${qs({ assignee: 'me', status: 'all', project_id: pid || '' })}`), [k, pid])
  const act = useData(need(['activity', 'project_updates'].includes(k), '/activity'), [k])
  const time = useData(need(['logged_by_project', 'billable_trend', 'non_billable', 'profitability'].includes(k), `/time${qs({ user_id: 'all', start: k === 'billable_trend' ? new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10) : since, project_id: pid || '' })}`), [k, pid])
  const myTime = useData(need(['my_logged', 'my_logged_weekday'].includes(k), `/time${qs({ user_id: 'me', start: since })}`), [k])
  const rates = useData(need(k === 'profitability', '/finance/rates'), [k])
  const budgets = useData(need(k === 'budget_usage', '/finance/budgets'), [k])
  const risks = useData(need(['active_risks', 'top_risks'].includes(k), '/r/risks'), [k])
  const proofs = useData(need(k === 'proofs', '/r/proofs'), [k])
  const statuses = useData(need(k === 'status_updates', '/r/statuses'), [k])
  const inbox = useData(need(k === 'inbox', '/inbox2'), [k])
  const personal = useData(need(k === 'personal_tasks', '/personal-tasks'), [k])
  const cats = useData(need(k === 'projects_by_category', '/r/categories'), [k])
  const cal = useData(need(k === 'my_calendar', `/calendar?start=${t}&end=${new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)}&mine=true`), [k])
  const allMs = useData(need(k === 'milestones', `/milestones?status=all`), [k])
  const [txt, setTxt] = useState('')
  const plist = pid ? projects.filter((p) => p.id === pid) : projects
  const pname = (id) => projects.find((p) => p.id === id)?.name || '—'
  const grouped = (rows, key, val) => { const g = {}; (rows || []).forEach((r) => { g[key(r)] = (g[key(r)] || 0) + val(r) }); return Object.entries(g).sort((a, b) => b[1] - a[1]) }
  const score = (r) => (r.probability / 100) * ({ low: 1, medium: 2, high: 3 }[r.impact] || 2)

  switch (k) {
    case 'current_projects': return <Big n={plist.filter((p) => p.health !== 'needs_attention' && p.health !== 'at_risk').length} label="projects on track" tone="#22b573" />
    case 'late_projects': { const l = plist.filter((p) => p.end_date && p.end_date < t); return l.length ? l.map((p) => <Link key={p.id} to={`/projects/${p.id}`} className="row small" style={{ gap: 8, padding: '7px 0', borderBottom: '1px solid var(--row-line)' }}><span className="dot" style={{ background: p.color }} /><b style={{ flex: 1 }}>{p.name}</b><span style={{ color: 'var(--danger)' }}>{fmtDate(p.end_date)}</span></Link>) : <Big n={0} label="late projects" tone="#22b573" /> }
    case 'milestones': { const ms = (allMs.data || []).filter((m) => !pid || m.project_id === pid)
      const g = { late: ms.filter((m) => m.late), today: ms.filter((m) => !m.completed && m.due_date === t), upcoming: ms.filter((m) => !m.completed && !m.late && m.due_date !== t), completed: ms.filter((m) => m.completed) }
      return <MsTabs g={g} pname={pname} /> }
    case 'project_updates': return (act.data || []).filter((a) => a.action.includes('project')).slice(0, 12).map((a) => <div key={a.id} className="row small" style={{ gap: 8, padding: '6px 0', borderBottom: '1px solid var(--row-line)' }}><Avatar user={a.user} size={22} /><span style={{ flex: 1 }}><b>{a.user?.name}</b> {a.action}</span><span className="muted">{timeAgo(a.created_at)}</span></div>)
    case 'projects': return plist.slice(0, 15).map((p) => <Link key={p.id} to={`/projects/${p.id}`} className="row small" style={{ gap: 8, padding: '7px 0', borderBottom: '1px solid var(--row-line)' }}><span className="dot" style={{ background: p.color }} /><b style={{ flex: 1 }}>{p.name}</b><span className="muted">{p.client?.name}</span><span className="muted" style={{ width: 36, textAlign: 'right' }}>{p.progress}%</span></Link>)
    case 'projects_by_category': { const items = [...(cats.data || []).map((c) => ({ name: c.name, color: c.color, value: plist.filter((p) => p.category_id === c.id).length })), { name: 'No category', color: '#cbd5e1', value: plist.filter((p) => !p.category_id).length }]
      return <DonutBox items={items} empty={<EmptyState icon={Folder} title="No projects" />} /> }
    case 'projects_by_health': { const h = data ? Object.entries(data.projects_by_health).filter(([key]) => key !== 'none').map(([key, v]) => ({ name: HEALTH[key].label, color: HEALTH[key].color, value: v })) : []
      return <DonutBox items={h} empty={<EmptyState icon={HeartPulse} title="No data yet" text="Update project health to get started" />} /> }
    case 'budget_usage': { const b = (budgets.data || []).filter((x) => !pid || x.project_id === pid)
      const items = [{ name: 'Under 49%', color: '#22b573', value: b.filter((x) => x.pct < 50).length }, { name: '50-79%', color: '#f0a500', value: b.filter((x) => x.pct >= 50 && x.pct < 80).length }, { name: 'Over 80%', color: '#e2445c', value: b.filter((x) => x.pct >= 80).length }]
      return <DonutBox items={items} empty={<EmptyState icon={Folder} title="No budgets yet" action={<Link className="btn sm" to="/finance/budgets?new=1">Add budget</Link>} />} /> }
    case 'delegated': return data ? <TaskTabs groups={data.delegated} empty="You're all caught up!" /> : null
    case 'late_by_project': { const g = grouped((tasksAll.data || []).filter((x) => x.due_date && x.due_date < t), (x) => x.project_name, () => 1)
      return g.length ? g.slice(0, 10).map(([n, c]) => <div key={n} className="row small" style={{ gap: 8, padding: '6px 0' }}><span style={{ width: 140 }} className="ellipsis">{n}</span><div style={{ flex: 1 }}><Meter value={c} max={g[0][1]} tone="over" /></div><b>{c}</b></div>) : <EmptyState icon={CheckCircle2} title="No late tasks" text="You're all caught up!" /> }
    case 'my_tasks': return <TaskTabs groups={bucket(mine.data || [])} empty="Nothing here." />
    case 'tasks': return <TaskTabs groups={bucket(tasksAll.data || [])} empty="Nothing here." />
    case 'personal_tasks': return (<>
      <div className="row" style={{ gap: 6, marginBottom: 6 }}><input className="input" placeholder="Add a personal task" value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={async (e) => { if (e.key === 'Enter' && txt.trim()) { await api.post('/personal-tasks', { title: txt }); setTxt(''); personal.reload() } }} /></div>
      {(personal.data || []).map((p) => <div key={p.id} className="row small" style={{ gap: 8, padding: '5px 0' }}><input type="checkbox" checked={p.done} onChange={async () => { await api.patch(`/personal-tasks/${p.id}`, { done: !p.done }); personal.reload() }} /><span style={{ flex: 1, textDecoration: p.done ? 'line-through' : '' }}>{p.title}</span><button className="icon-btn" onClick={async () => { await api.del(`/personal-tasks/${p.id}`); personal.reload() }}><Trash2 size={13} /></button></div>)}</>)
    case 'assignee_status': { const rows = {}; (tasksAll.data || []).forEach((x) => { const n = x.assignee?.name || 'Unassigned'; rows[n] = rows[n] || { late: 0, open: 0, done: 0 }; if (x.status === 'completed') rows[n].done++; else if (x.due_date && x.due_date < t) rows[n].late++; else rows[n].open++ })
      return <table className="kit-table"><thead><tr><th>Assignee</th><th>Late</th><th>Open</th><th>Completed</th></tr></thead><tbody>{Object.entries(rows).map(([n, r]) => <tr key={n}><td>{n}</td><td style={{ color: r.late ? 'var(--danger)' : '' }}>{r.late}</td><td>{r.open}</td><td>{r.done}</td></tr>)}</tbody></table> }
    case 'workflow_stages': { const st = [['backlog', 'Backlog', '#94a3b8'], ['new', 'To do', '#4461d7'], ['in_progress', 'In progress', '#f0a500'], ['completed', 'Completed', '#22b573']]
      const items = st.map(([s, n, c]) => ({ name: n, color: c, value: (tasksAll.data || []).filter((x) => x.status === s).length }))
      return <DonutBox items={items} empty={<EmptyState icon={ListChecks} title="No tasks" />} /> }
    case 'logged_by_project': { const g = grouped(time.data, (e) => e.project_name, (e) => e.minutes)
      return <DonutBox items={g.map(([n, v], i) => ({ name: n, value: v, color: PALETTE[i % 8] }))} fmt={fmtMinutes} center={fmtMinutes(g.reduce((a, b) => a + b[1], 0))} empty={<EmptyState icon={Clock} title="No time logged" />} /> }
    case 'time_distribution': { const items = data ? data.time_distribution.map((x) => ({ name: x.name, color: x.color, value: x.minutes })) : []
      return <DonutBox items={items} fmt={fmtMinutes} center={fmtMinutes(items.reduce((a, b) => a + b.value, 0))} empty={<EmptyState icon={Clock} title="No data just yet" text={`Adjust timeframe (now ${range} days) to check other periods`} />} /> }
    case 'logged_weekday': return data && data.time_by_weekday.some(Boolean) ? <Bars data={data.time_by_weekday} labels={DAYS} format={fmtMinutes} /> : <EmptyState icon={Clock} title="No time logged" action={<button className="btn primary sm" onClick={() => setQuickAdd('time')}>Log time</button>} />
    case 'my_logged': { const b = (myTime.data || []).filter((e) => e.billable).reduce((a, e) => a + e.minutes, 0); const n = (myTime.data || []).filter((e) => !e.billable).reduce((a, e) => a + e.minutes, 0)
      return <DonutBox items={[{ name: 'Billable', color: '#22b573', value: b }, { name: 'Non-billable', color: '#94a3b8', value: n }]} fmt={fmtMinutes} center={fmtMinutes(b + n)} empty={<EmptyState icon={Clock} title="No time logged" action={<button className="btn primary sm" onClick={() => setQuickAdd('time')}>Log time</button>} />} /> }
    case 'my_logged_weekday': { const d = [0, 0, 0, 0, 0, 0, 0]; (myTime.data || []).forEach((e) => { d[(new Date(e.date + 'T00:00:00').getDay() + 6) % 7] += e.minutes })
      return d.some(Boolean) ? <Bars data={d} labels={DAYS} format={fmtMinutes} /> : <EmptyState icon={Clock} title="No time logged" /> }
    case 'billable_trend': { const m = {}; (time.data || []).forEach((e) => { const k2 = e.date.slice(0, 7); m[k2] = m[k2] || [0, 0]; m[k2][e.billable ? 0 : 1] += e.minutes })
      const keys = Object.keys(m).sort()
      return keys.length ? <Bars data={keys.map((x) => Math.round((m[x][0] * 100) / (m[x][0] + m[x][1] || 1)))} labels={keys.map((x) => x.slice(5))} format={(v) => `${v}%`} /> : <EmptyState icon={Clock} title="No time logged" /> }
    case 'non_billable': { const l = (time.data || []).filter((e) => !e.billable); const g = grouped(l, (e) => e.user?.name, (e) => e.minutes)
      return l.length ? <><Big n={hrs(l.reduce((a, e) => a + e.minutes, 0))} label="non-billable in the last 30 days" tone="#94a3b8" />{g.map(([n, v]) => <div key={n} className="row small" style={{ justifyContent: 'space-between' }}><span>{n}</span><b>{hrs(v)}</b></div>)}</> : <EmptyState icon={Clock} title="No non-billable time" /> }
    case 'profitability': { const r = Object.fromEntries((rates.data || []).map((x) => [x.user_id, x])); let rev = 0; let cost = 0
      ;(time.data || []).forEach((e) => { const x = r[e.user?.id]; if (!x) return; if (e.billable) rev += (e.minutes / 60) * x.billable_rate; cost += (e.minutes / 60) * x.cost_rate })
      return <div style={{ padding: '10px 0' }}><Big n={money(rev - cost)} label="profit, last 30 days" tone={rev - cost >= 0 ? '#22b573' : '#e2445c'} /><div className="row small" style={{ justifyContent: 'space-around' }}><span>Revenue <b>{money(rev)}</b></span><span>Costs <b>{money(cost)}</b></span></div>{!rev && !cost && <div className="muted small" style={{ textAlign: 'center', marginTop: 8 }}>Set rates in <Link to="/finance/rates" style={{ color: 'var(--accent)' }}>Finance › Rates</Link></div>}</div> }
    case 'active_risks': { const o = (risks.data || []).filter((x) => x.status === 'open' && (!pid || x.project_id === pid))
      return <DonutBox items={[['high', '#e2445c'], ['medium', '#f0a500'], ['low', '#22b573']].map(([s, c]) => ({ name: s, color: c, value: o.filter((x) => x.impact === s).length }))} empty={<EmptyState icon={AlertTriangle} title="No active risks" />} /> }
    case 'top_risks': { const o = (risks.data || []).filter((x) => x.status === 'open').sort((a, b) => score(b) - score(a)).slice(0, 10)
      return o.length ? o.map((x) => <div key={x.id} className="row small" style={{ gap: 8, padding: '6px 0', borderBottom: '1px solid var(--row-line)' }}><Pill tone={{ high: 'red', medium: 'amber', low: 'green' }[x.impact]}>{x.impact}</Pill><span style={{ flex: 1 }}>{x.source}</span><span className="muted">{x.probability}%</span></div>) : <EmptyState icon={AlertTriangle} title="No risks" /> }
    case 'activity': return (act.data || []).slice(0, 15).map((a) => <div key={a.id} className="row small" style={{ gap: 8, padding: '6px 0', borderBottom: '1px solid var(--row-line)' }}><Avatar user={a.user} size={22} /><span style={{ flex: 1 }}><b>{a.user?.name}</b> {a.action}{a.project_name && <span className="muted"> · {a.project_name}</span>}</span><span className="muted">{timeAgo(a.created_at)}</span></div>)
    case 'inbox': return (inbox.data?.items || []).slice(0, 10).map((n) => <Link key={n.id} to="/inbox" className="row small" style={{ gap: 8, padding: '6px 0', borderBottom: '1px solid var(--row-line)', fontWeight: n.is_read ? 400 : 600 }}><Avatar user={n.actor} size={22} /><span style={{ flex: 1 }} className="ellipsis">{n.message}</span><span className="muted">{timeAgo(n.created_at)}</span></Link>)
    case 'my_calendar': { const items = [...(cal.data?.events || []).map((e) => ({ d: e.date, l: `${e.start_time || ''} ${e.title}`, c: '#0ea5e9' })), ...(cal.data?.tasks || []).map((x) => ({ d: x.due_date, l: x.title, c: '#4461d7' })), ...(cal.data?.milestones || []).map((m) => ({ d: m.due_date, l: `⚑ ${m.name}`, c: '#8b5cf6' }))].sort((a, b) => (a.d > b.d ? 1 : -1))
      return items.length ? items.map((x, i) => <div key={i} className="row small" style={{ gap: 8, padding: '5px 0' }}><span className="muted" style={{ width: 54 }}>{fmtDate(x.d)}</span><span className="dot" style={{ background: x.c }} /><span>{x.l}</span></div>) : <EmptyState icon={Clock} title="Nothing in the next two weeks" /> }
    case 'unread': return <UnreadTabs data={data} />
    case 'status_updates': return (<>
      <div className="row" style={{ gap: 6, marginBottom: 6 }}><input className="input" placeholder="What are you working on?" value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={async (e) => { if (e.key === 'Enter' && txt.trim()) { await api.post('/r/statuses', { text: txt, emoji: '💬' }); setTxt(''); statuses.reload() } }} /></div>
      {(statuses.data || []).slice(0, 10).map((s) => <div key={s.id} className="row small" style={{ gap: 8, padding: '6px 0' }}><Avatar user={s.user} size={22} /><span style={{ flex: 1 }}><b>{s.user?.name}</b> {s.emoji} {s.text}</span><span className="muted">{timeAgo(s.created_at)}</span></div>)}</>)
    case 'proofs': return (proofs.data || []).length ? proofs.data.slice(0, 10).map((p) => <div key={p.id} className="row small" style={{ gap: 8, padding: '6px 0', borderBottom: '1px solid var(--row-line)' }}><FileCheck2 size={14} color="#4461d7" /><span style={{ flex: 1 }}>{p.title}</span><Pill>V{p.version}</Pill><Pill tone={{ approved: 'green', in_review: 'blue', changes: 'amber', rejected: 'red' }[p.status]}>{p.status.replace('_', ' ')}</Pill><AvatarStack users={p.reviewers} size={20} /></div>) : <EmptyState icon={FileCheck2} title="No proofs yet" action={<Link className="btn sm" to="/proofs">Open proofs</Link>} />
    case 'embedded': return w.config?.url ? <iframe title="embed" src={w.config.url} style={{ width: '100%', height: 230, border: 0, borderRadius: 8 }} allowFullScreen /> : (
      <div style={{ padding: 10 }}><div className="muted small" style={{ marginBottom: 6 }}>Paste a link to YouTube, Google Docs, Figma, Loom or any embeddable page.</div><div className="row" style={{ gap: 6 }}><input className="input" placeholder="https://" value={txt} onChange={(e) => setTxt(e.target.value)} /><button className="btn primary" onClick={() => { let u = txt.trim(); if (!u) return; u = u.replace('youtube.com/watch?v=', 'youtube.com/embed/').replace('youtu.be/', 'youtube.com/embed/'); onConfig({ url: u }) }}>Embed</button></div></div>)
    case 'private_notes': return <textarea className="input" style={{ width: '100%', height: 220, resize: 'vertical' }} placeholder="Private notes, links and to-dos only you can see" defaultValue={w.config?.notes || ''} onBlur={(e) => e.target.value !== (w.config?.notes || '') && onConfig({ notes: e.target.value })} />
    default: return <div className="muted">Unknown widget</div>
  }
  // eslint-disable-next-line no-unreachable
  return people
}

function MsTabs({ g, pname }) {
  const [tab, setTab] = useState('upcoming')
  return (<>
    <div className="wtabs">{[['late', 'Late'], ['today', 'Today'], ['upcoming', 'Upcoming'], ['completed', 'Completed']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}<span className="n">{g[k].length}</span></button>)}</div>
    {g[tab].length ? g[tab].map((m) => <Link to={`/projects/${m.project_id}/milestones`} key={m.id} className="task-row"><Flag size={15} color="#8b5cf6" /><span className="title">{m.name}</span><span className="meta">{pname(m.project_id)} · {fmtDate(m.due_date)}</span></Link>) : <EmptyState icon={Flag} title="No milestones" text="Milestones will appear here once available" />}
  </>)
}

function UnreadTabs({ data }) {
  const [tab, setTab] = useState('comments')
  if (!data) return null
  const list = data.unread.filter((n) => (tab === 'messages' ? n.kind === 'message' : n.kind !== 'message'))
  return (<><div className="wtabs"><button className={tab === 'comments' ? 'on' : ''} onClick={() => setTab('comments')}>Task comments</button><button className={tab === 'messages' ? 'on' : ''} onClick={() => setTab('messages')}>Messages<span className="n">{data.unread.filter((n) => n.kind === 'message').length}</span></button></div>
    {!list.length ? <EmptyState icon={CheckCircle2} title={`No unread ${tab === 'messages' ? 'messages' : 'task comments'}`} text="You're up to date!" /> : list.map((n) => (
      <Link to={n.link || '/inbox'} key={n.id} className="row" style={{ padding: 8, borderRadius: 8, gap: 8 }}><Avatar user={n.actor} size={26} /><span style={{ flex: 1 }} className="small">{n.message}</span><span className="muted small">{timeAgo(n.created_at)}</span></Link>))}</>)
}

export { Bell, Plus, PersonChip, useMemo }
