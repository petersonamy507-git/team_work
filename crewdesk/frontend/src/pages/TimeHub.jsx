// Manage › Time: My timesheet, Company timesheet, All time, Approvals (Teamwork /app/time/*)
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Clock, Plus, ChevronLeft, ChevronRight, Copy, Play, Square, Check, X, ChevronDown, ChevronRight as Chev, Download, Trash2, Pencil } from 'lucide-react'
import { api, qs } from '../lib/api'
import { useData, useUi } from '../lib/ui-context'
import { fmtDate, parseDuration } from '../lib/format'
import { Avatar } from '../components/ui'
import { TimeForm } from '../components/QuickAdd'
import { Section, DataTable, EmptyState, FormModal, Pill, PersonChip, hrs, toCSV, AskAiButton } from '../components/Kit'
import { downloadText } from '../lib/taskFilters'

const TABS = [{ to: '/time/timesheet', label: 'My timesheet' }, { to: '/time/company', label: 'Company timesheet' }, { to: '/time/all', label: 'All time' }, { to: '/time/approvals', label: 'Approvals' }]
const iso = (d) => d.toISOString().slice(0, 10)
const monday = (s) => { const d = new Date((s || iso(new Date())) + 'T00:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d) }
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d) }
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function TimerButton() {
  const [start, setStart] = useState(() => { try { return Number(localStorage.getItem('cd_timer')) || null } catch { return null } })
  const [, tick] = useState(0)
  const [log, setLog] = useState(null)
  useEffect(() => { if (!start) return; const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t) }, [start])
  const toggle = () => {
    if (start) { const m = Math.max(1, Math.round((Date.now() - start) / 60000)); setLog({ minutes: m }); setStart(null); try { localStorage.removeItem('cd_timer') } catch { /* ignore */ } }
    else { const n = Date.now(); setStart(n); try { localStorage.setItem('cd_timer', String(n)) } catch { /* ignore */ } }
  }
  const el = start ? Math.floor((Date.now() - start) / 1000) : 0
  return (<>
    <button className={`btn ${start ? 'outline-accent on' : ''}`} onClick={toggle}>{start ? <><Square size={13} />{String(Math.floor(el / 3600)).padStart(2, '0')}:{String(Math.floor(el / 60) % 60).padStart(2, '0')}:{String(el % 60).padStart(2, '0')}</> : <><Play size={13} />Start timer</>}</button>
    {log && <TimeForm entry={{ minutes: log.minutes, billable: true }} onDone={() => setLog(null)} onCancel={() => setLog(null)} />}
  </>)
}

export default function TimeHub() {
  const { tab = 'all' } = useParams()
  const C = { timesheet: MyTimesheet, company: CompanyTimesheet, all: AllTime, approvals: Approvals }[tab] || AllTime
  return <Section icon={Clock} title="Time" tabs={TABS}><C /></Section>
}

function WeekNav({ week, setWeek }) {
  return <span className="week-nav"><button className="btn" onClick={() => setWeek(monday())}>This week</button><button className="icon-btn" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft size={16} /></button><button className="icon-btn" onClick={() => setWeek(addDays(week, 7))}><ChevronRight size={16} /></button><b className="small">{fmtDate(week)} – {fmtDate(addDays(week, 6), { day: 'numeric', month: 'short', year: 'numeric' })}</b></span>
}

/* ---------- My timesheet (editable grid) ---------- */
export function MyTimesheet() {
  const [week, setWeek] = useState(monday())
  const { data, reload } = useData(`/time${qs({ user_id: 'me', start: week, end: addDays(week, 6) })}`, [week])
  const { notify, refresh, projects } = useUi()
  const [extra, setExtra] = useState([])
  const [add, setAdd] = useState(false)
  const [tasks, setTasks] = useState([])
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))
  const rows = useMemo(() => {
    const m = new Map()
    ;(data || []).forEach((e) => {
      const k = `${e.project_id}:${e.task_id || ''}`
      const r = m.get(k) || { key: k, project_id: e.project_id, project_name: e.project_name, task_id: e.task_id, task_title: e.task_title, cells: days.map(() => []) }
      const i = days.indexOf(e.date); if (i >= 0) r.cells[i].push(e)
      m.set(k, r)
    })
    extra.forEach((x) => { if (!m.has(x.key)) m.set(x.key, { ...x, cells: days.map(() => []) }) })
    return [...m.values()].sort((a, b) => (a.project_name || '').localeCompare(b.project_name || '') || (a.task_title || '').localeCompare(b.task_title || ''))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, extra, week])
  const setCell = async (r, i, txt) => {
    const minutes = parseDuration(txt)
    const cur = r.cells[i].reduce((a, b) => a + b.minutes, 0)
    if (minutes === cur) return
    for (const e of r.cells[i]) await api.del(`/time/${e.id}`)
    if (minutes > 0) await api.post('/time', { project_id: r.project_id, task_id: r.task_id || null, date: days[i], minutes, billable: true })
    notify('Timesheet saved'); reload(); refresh()
  }
  const copyLast = async () => {
    const prev = await api.get(`/time${qs({ user_id: 'me', start: addDays(week, -7), end: addDays(week, -1) })}`)
    const seen = new Set(); const x = []
    prev.forEach((e) => { const k = `${e.project_id}:${e.task_id || ''}`; if (!seen.has(k)) { seen.add(k); x.push({ key: k, project_id: e.project_id, project_name: e.project_name, task_id: e.task_id, task_title: e.task_title }) } })
    setExtra([...extra, ...x]); notify(x.length ? `Copied ${x.length} rows from last week` : 'Nothing logged last week')
  }
  const total = (i) => rows.reduce((a, r) => a + r.cells[i].reduce((s, e) => s + e.minutes, 0), 0)
  const rowTotal = (r) => r.cells.flat().reduce((a, e) => a + e.minutes, 0)
  return (
    <>
      <div className="tw-toolbar"><WeekNav week={week} setWeek={setWeek} /><span className="spacer" />
        <button className="tb-btn" onClick={copyLast}><Copy size={14} />Copy last week</button>
        <button className="btn primary" onClick={() => setAdd(true)}><Plus size={15} />Add project or task</button></div>
      {data && !rows.length ? (
        <EmptyState icon={Clock} title="Let's start building your timesheet" text="Add the projects and tasks you want to track time against this week."
          action={<div className="row" style={{ gap: 8 }}><button className="btn" onClick={copyLast}>Copy last week</button><button className="btn primary" onClick={() => setAdd(true)}><Plus size={15} />Add project or task</button><AskAiButton /></div>} />
      ) : (
        <table className="grid-sheet">
          <thead><tr><th className="l">Projects / Tasks</th>{days.map((d, i) => <th key={d} className={d === iso(new Date()) ? 'today' : ''}>{DAYS[i]}<br /><b>{d.slice(8)}</b></th>)}<th>Total</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}><td className="l"><b className="small">{r.task_title || 'General project time'}</b><div className="muted small">{r.project_name}</div></td>
                {r.cells.map((c, i) => { const m = c.reduce((a, e) => a + e.minutes, 0)
                  return <td key={i}><input key={`${r.key}${i}${m}`} className="sheet-input" defaultValue={m ? hrs(m) : ''} placeholder="0h" onBlur={(e) => setCell(r, i, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} /></td> })}
                <td><b className="small">{hrs(rowTotal(r))}</b></td></tr>))}
            <tr><td className="l"><b>Total</b></td>{days.map((d, i) => <td key={d}><b className="small">{hrs(total(i))}</b></td>)}<td><b>{hrs(days.reduce((a, _, i) => a + total(i), 0))}</b></td></tr>
          </tbody>
        </table>)}
      {add && <FormModal title="Add project or task" onClose={() => setAdd(false)} onChange={(v) => { if (v.project_id && v.project_id !== tasks.pid) api.get(`/tasks?project_id=${v.project_id}&status=all`).then((t) => setTasks(Object.assign(t, { pid: v.project_id }))) }}
        fields={[{ key: 'project_id', label: 'Project', type: 'project', required: true }, { key: 'task_id', label: 'Task (optional)', type: 'select', options: tasks.map((t) => [t.id, t.title]) }]}
        onSubmit={async (v) => { const t = tasks.find((x) => x.id === Number(v.task_id)); setExtra([...extra, { key: `${v.project_id}:${v.task_id || ''}`, project_id: v.project_id, project_name: t?.project_name || projects.find((p) => p.id === v.project_id)?.name || '', task_id: v.task_id ? Number(v.task_id) : null, task_title: t?.title }]) }}
      />}
    </>
  )
}

/* ---------- Company timesheet ---------- */
function CompanyTimesheet() {
  const [week, setWeek] = useState(monday())
  const [open, setOpen] = useState({})
  const [q, setQ] = useState('')
  const { data } = useData(`/time/company?week_of=${week}`, [week])
  const rows = (data?.rows || []).filter((r) => r.user.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <div className="tw-toolbar"><WeekNav week={week} setWeek={setWeek} /><span className="spacer" />
        <input className="input" style={{ width: 180, height: 32 }} placeholder="Search users" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <table className="grid-sheet">
        <thead><tr><th className="l">Users</th>{(data?.days || []).map((d, i) => <th key={d}>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}<br />{fmtDate(d)}</th>)}<th>Week total</th></tr></thead>
        <tbody>{rows.map((r) => (
          <Fragment key={r.user.id}>
            <tr><td className="l"><span className="row" style={{ gap: 6, cursor: 'pointer' }} onClick={() => setOpen({ ...open, [r.user.id]: !open[r.user.id] })}>{r.tasks.length ? (open[r.user.id] ? <ChevronDown size={14} /> : <Chev size={14} />) : <span style={{ width: 14 }} />}<Avatar user={r.user} size={26} /><b className="small">{r.user.name}</b></span></td>
              {r.days.map((m, i) => <td key={i}>{i < 5 || m ? <div className="cell-time" title={`${hrs(m)} of ${hrs(r.capacity)}`}>{hrs(m)}<i style={{ width: `${Math.min(100, (m / r.capacity) * 100)}%`, background: m > r.capacity ? 'var(--danger)' : '' }} /></div> : <div className="cell-load weekend" />}</td>)}
              <td><b>{hrs(r.total)}</b></td></tr>
            {open[r.user.id] && r.tasks.map((t, j) => <tr key={j}><td className="l" style={{ paddingLeft: 52 }}><div className="small">{t.title}</div><div className="muted" style={{ fontSize: 11 }}>{t.project_name}</div></td>{t.days.map((m, i) => <td key={i} className="small">{hrs(m)}</td>)}<td className="small">{hrs(t.days.reduce((a, b) => a + b, 0))}</td></tr>)}
          </Fragment>))}</tbody>
      </table>
    </>
  )
}

/* ---------- All time ---------- */
export function AllTime() {
  const { people, projects } = useUi()
  const [f, setF] = useState({ user_id: 'all', project_id: '', start: '', end: '', billable: '' })
  const { data } = useData(`/time${qs(f)}`, [JSON.stringify(f)])
  const [form, setForm] = useState(null)
  const { refresh } = useUi()
  const total = (data || []).reduce((a, b) => a + b.minutes, 0)
  const bill = (data || []).filter((e) => e.billable).reduce((a, b) => a + b.minutes, 0)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const groups = useMemo(() => { const g = {}; (data || []).forEach((e) => { (g[e.date] = g[e.date] || []).push(e) }); return Object.entries(g) }, [data])
  const del = async (e) => { if (confirm('Delete this time entry?')) { await api.del(`/time/${e.id}`); refresh() } }
  return (
    <>
      <div className="tw-toolbar">
        <select className="input" style={{ width: 150, height: 32 }} value={f.user_id} onChange={set('user_id')}><option value="all">Everyone</option><option value="me">Me</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select className="input" style={{ width: 170, height: 32 }} value={f.project_id} onChange={set('project_id')}><option value="">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <input type="date" className="input" style={{ width: 140, height: 32 }} value={f.start} onChange={set('start')} />
        <input type="date" className="input" style={{ width: 140, height: 32 }} value={f.end} onChange={set('end')} />
        <select className="input" style={{ width: 130, height: 32 }} value={f.billable} onChange={set('billable')}><option value="">All time</option><option value="true">Billable</option><option value="false">Non-billable</option></select>
        <span className="spacer" />
        <span className="muted small">Total <b>{hrs(total)}</b> · Billable <b>{hrs(bill)}</b></span>
        <button className="tb-btn" onClick={() => downloadText('time.csv', toCSV((data || []).map((e) => ({ Date: e.date, Who: e.user?.name, Project: e.project_name, Task: e.task_title || '', Description: e.description || '', Billable: e.billable ? 'Yes' : 'No', Minutes: e.minutes }))))}><Download size={14} />Export</button>
        <TimerButton />
        <button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Log time</button>
      </div>
      {data && !data.length && <EmptyState icon={Clock} title="All Time" text="Effortless time tracking. Understand how long work really takes, so you can better manage team resources and timelines." action={<div className="row" style={{ gap: 8 }}><button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Log time</button><TimerButton /></div>} />}
      {groups.map(([d, list]) => (
        <div key={d} className="card" style={{ padding: '10px 16px', marginBottom: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}><b>{fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}</b><span className="muted small">{hrs(list.reduce((a, b) => a + b.minutes, 0))}</span></div>
          <DataTable rows={list} columns={[
            { key: 'user', label: 'Who', render: (e) => <PersonChip user={e.user} />, sort: (e) => e.user?.name },
            { key: 'description', label: 'Description', render: (e) => <div><div>{e.task_title ? `Task: ${e.task_title}` : e.description || '—'}</div><div className="muted small">{e.project_name}{e.task_title && e.description ? ` · ${e.description}` : ''}</div></div> },
            { key: 'billable', label: 'Billable', render: (e) => e.billable ? <Check size={16} color="#22b573" /> : <X size={16} className="muted" /> },
            { key: 'minutes', label: 'Time', render: (e) => <b>{hrs(e.minutes)}</b> },
            { key: 'a', label: '', nosort: true, render: (e) => <span className="act"><button className="icon-btn" onClick={() => setForm(e)}><Pencil size={14} /></button><button className="icon-btn" onClick={() => del(e)}><Trash2 size={14} /></button></span> },
          ]} />
        </div>))}
      {form && <TimeForm entry={form.id ? form : null} onDone={() => setForm(null)} onCancel={() => setForm(null)} />}
    </>
  )
}

/* ---------- Approvals ---------- */
function Approvals() {
  const [month, setMonth] = useState(iso(new Date()).slice(0, 7))
  const { data, reload } = useData(`/time/approvals?month=${month}`, [month])
  const [open, setOpen] = useState({})
  const { notify } = useUi()
  const shift = (n) => { const d = new Date(month + '-01T00:00:00'); d.setMonth(d.getMonth() + n); setMonth(iso(d).slice(0, 7)) }
  const act = async (ids, status) => { await api.post('/time/approve', { ids, status }); notify(`Time ${status}`); reload() }
  const tone = { approved: 'green', rejected: 'red', pending: 'amber' }
  return (
    <>
      <div className="tw-toolbar"><span className="week-nav"><button className="btn" onClick={() => setMonth(iso(new Date()).slice(0, 7))}>This month</button><button className="icon-btn" onClick={() => shift(-1)}><ChevronLeft size={16} /></button><button className="icon-btn" onClick={() => shift(1)}><ChevronRight size={16} /></button><b className="small">{new Date(month + '-01T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b></span></div>
      {data && !data.rows.length && <EmptyState icon={Check} title="No time to review" text="Logged time for this month will appear here for approval." />}
      {data?.rows.length > 0 && <table className="kit-table">
        <thead><tr><th>User</th><th>Estimated time</th><th>Logged time</th><th>Billable vs non-billable</th><th>Approval status</th><th /></tr></thead>
        <tbody>{data.rows.map((r) => (
          <Fragment key={r.user.id}>
            <tr><td><span className="row" style={{ gap: 6, cursor: 'pointer' }} onClick={() => setOpen({ ...open, [r.user.id]: !open[r.user.id] })}>{open[r.user.id] ? <ChevronDown size={14} /> : <Chev size={14} />}<PersonChip user={r.user} /></span></td>
              <td>{hrs(r.estimated)}</td><td>{hrs(r.logged)}</td>
              <td><div className="row small" style={{ gap: 8 }}>{hrs(r.billable)}<div style={{ width: 120 }}><div className="kit-meter"><div style={{ width: `${r.logged ? (r.billable / r.logged) * 100 : 0}%` }} /></div></div>{hrs(r.non_billable)}</div></td>
              <td>{r.pending ? <Pill tone="amber">{r.pending} in review</Pill> : <Pill tone="green">All reviewed</Pill>}</td>
              <td><span className="row" style={{ gap: 4 }}><button className="btn" onClick={() => act(r.entries.map((e) => e.id), 'approved')}><Check size={14} />Approve all</button></span></td></tr>
            {open[r.user.id] && r.entries.map((e) => (
              <tr key={e.id} style={{ background: '#fafbfd' }}><td style={{ paddingLeft: 48 }} className="small">{fmtDate(e.date)} · {e.project_name}</td><td colSpan={2} className="small">{e.task_title || e.description || '—'}</td>
                <td className="small">{hrs(e.minutes)} {e.billable ? '· billable' : ''}</td><td><Pill tone={tone[e.approval]}>{e.approval}</Pill></td>
                <td><button className="icon-btn" title="Approve" onClick={() => act([e.id], 'approved')}><Check size={15} /></button><button className="icon-btn" title="Reject" onClick={() => act([e.id], 'rejected')}><X size={15} /></button></td></tr>))}
          </Fragment>))}</tbody>
      </table>}
    </>
  )
}
