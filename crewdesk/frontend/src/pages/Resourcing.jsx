// Plan & Insights › Resourcing: Overview, Schedule, Workload, Portfolio, Chart (Teamwork /app/planning/*)
import { Fragment, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarRange, ChevronLeft, ChevronRight, Plus, Trash2, Sparkles, ChevronDown, ChevronRight as Chev, Kanban, Folder, X } from 'lucide-react'
import { api, qs } from '../lib/api'
import { useData, useUi } from '../lib/ui-context'
import { fmtDate } from '../lib/format'
import { Avatar } from '../components/ui'
import { Section, DataTable, EmptyState, FormModal, PersonChip, useRows, hrs, Meter } from '../components/Kit'

const TABS = [{ to: '/planning/overview', label: 'Overview' }, { to: '/planning/schedule', label: 'Schedule' }, { to: '/planning/workload', label: 'Workload' },
  { to: '/planning/portfolio', label: 'Portfolio' }, { to: '/planning/chart', label: 'Chart' }]
const iso = (d) => d.toISOString().slice(0, 10)
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d) }
const todayIso = () => iso(new Date())
const dow = (s) => new Date(s + 'T00:00:00').getDay()

export default function Resourcing() {
  const { tab = 'workload' } = useParams()
  const C = { overview: Overview, schedule: Schedule, workload: Workload, portfolio: Portfolio, chart: ChartTab }[tab] || Workload
  return <Section icon={CalendarRange} title="Resourcing" tabs={TABS}><C /></Section>
}

function Nav({ label, onPrev, onNext, onToday }) {
  return <span className="week-nav"><button className="btn" onClick={onToday}>Today</button><button className="icon-btn" onClick={onPrev}><ChevronLeft size={16} /></button><button className="icon-btn" onClick={onNext}><ChevronRight size={16} /></button><b className="small">{label}</b></span>
}

/* ---------- Overview ---------- */
function Overview() {
  const [month, setMonth] = useState(todayIso().slice(0, 7))
  const start = `${month}-01`
  const { data } = useData(`/resourcing/overview?start=${start}`, [month])
  const shift = (n) => { const d = new Date(start + 'T00:00:00'); d.setMonth(d.getMonth() + n); setMonth(iso(d).slice(0, 7)) }
  const weeks = data?.weeks || []
  const max = Math.max(1, ...weeks.flatMap((w) => [w.estimated, w.logged, w.available]))
  const H = 180
  const pts = (k) => weeks.map((w, i) => `${40 + i * (600 / Math.max(1, weeks.length - 1))},${H - (w[k] / max) * (H - 20)}`).join(' ')
  return (
    <>
      <div className="tw-toolbar"><Nav label={new Date(start + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} onPrev={() => shift(-1)} onNext={() => shift(1)} onToday={() => setMonth(todayIso().slice(0, 7))} /></div>
      <div className="widget" style={{ minHeight: 0, marginBottom: 16 }}>
        <div className="row small" style={{ gap: 14 }}><span><span className="dot" style={{ background: '#e8378f' }} /> Estimated</span><span><span className="dot" style={{ background: '#a0a6bb' }} /> Logged</span><span><span className="dot" style={{ background: '#22b573' }} /> Available</span></div>
        <svg viewBox={`0 0 680 ${H + 24}`} style={{ width: '100%', height: 220 }}>
          {[0, .5, 1].map((f) => <g key={f}><line x1="40" x2="660" y1={H - f * (H - 20)} y2={H - f * (H - 20)} stroke="#eef0f4" /><text x="0" y={H - f * (H - 20) + 4} fontSize="10" fill="#858a9d">{hrs(max * f)}</text></g>)}
          <polyline points={pts('available')} fill="none" stroke="#22b573" strokeWidth="2" strokeDasharray="6 4" />
          <polyline points={pts('estimated')} fill="none" stroke="#e8378f" strokeWidth="2" />
          <polyline points={pts('logged')} fill="none" stroke="#a0a6bb" strokeWidth="2" />
          {weeks.map((w, i) => <text key={i} x={40 + i * (600 / Math.max(1, weeks.length - 1))} y={H + 18} fontSize="10" textAnchor="middle" fill="#858a9d">{w.label}</text>)}
        </svg>
      </div>
      <DataTable rows={data?.rows} rowKey={(r) => r.user.id} search={(r) => r.user.name}
        toolbar={<span className="muted small">Unassigned tasks: <b>{data?.unassigned ?? 0}</b></span>}
        columns={[
          { key: 'user', label: 'Name', sort: (r) => r.user.name, render: (r) => <div><PersonChip user={r.user} /><div className="small" style={{ color: 'var(--accent)', marginLeft: 29 }}>{r.role || 'Assign role'}</div></div> },
          { key: 'open_tasks', label: 'Open tasks' }, { key: 'completed_tasks', label: 'Completed tasks' },
          { key: 'available', label: 'Available time', render: (r) => hrs(r.available) },
          { key: 'estimated', label: 'Estimated time', render: (r) => hrs(r.estimated) },
          { key: 'logged', label: 'Logged time', render: (r) => hrs(r.logged) },
          { key: 'time_left', label: 'Time left to log', render: (r) => hrs(r.time_left) },
          { key: 'capacity_pct', label: 'Total capacity', render: (r) => <div className="row" style={{ gap: 6 }}><div style={{ width: 90 }}><Meter value={r.capacity_pct} max={100} tone={r.capacity_pct > 100 ? 'over' : 'green'} /></div>{r.capacity_pct}%</div> },
        ]} />
    </>
  )
}

/* ---------- Workload ---------- */
function Workload() {
  const [start, setStart] = useState(todayIso())
  const [days, setDays] = useState(14)
  const [open, setOpen] = useState({})
  const [unplanned, setUnplanned] = useState(false)
  const { data } = useData(`/resourcing/workload?start=${start}&days=${days}`, [start, days])
  const un = useData(unplanned ? '/resourcing/unplanned' : null, [unplanned])
  const { openTask } = useUi()
  const cls = (d) => (!d.capacity ? 'weekend' : d.minutes > d.capacity ? 'over' : d.minutes >= d.capacity * 0.8 ? 'full' : d.minutes ? 'under' : '')
  const dates = data?.rows[0]?.days.map((d) => d.date) || []
  return (
    <>
      <div className="tw-toolbar">
        <Nav label={dates.length ? `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}` : ''} onToday={() => setStart(todayIso())} onPrev={() => setStart(addDays(start, -7))} onNext={() => setStart(addDays(start, 7))} />
        <span className="spacer" />
        <select className="input" style={{ width: 110, height: 32 }} value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>Week</option><option value={14}>2 weeks</option><option value={31}>Month</option></select>
        <button className={`btn outline-accent ${unplanned ? 'on' : ''}`} onClick={() => setUnplanned(!unplanned)}><Sparkles size={14} />Unplanned tasks</button>
      </div>
      <div className="mw-split">
        <div className="mw-main kit-scroll">
          <table className="grid-sheet">
            <thead><tr><th className="l">All people</th><th>Capacity</th>{dates.map((d) => <th key={d} className={d === todayIso() ? 'today' : ''}>{'SMTWTFS'[dow(d)]}<br />{d.slice(8)}</th>)}</tr></thead>
            <tbody>{(data?.rows || []).map((r) => (<Fragment key={r.user.id}>
              <tr>
                <td className="l"><span className="row" style={{ gap: 6, cursor: 'pointer' }} onClick={() => setOpen({ ...open, [r.user.id]: !open[r.user.id] })}>{open[r.user.id] ? <ChevronDown size={14} /> : <Chev size={14} />}<Avatar user={r.user} size={26} /><span><b className="small">{r.user.name}</b><div className="small" style={{ color: 'var(--accent)' }}>{r.role || 'Assign role'}</div></span></span></td>
                <td className="muted small">{hrs(r.days.reduce((a, d) => a + d.minutes, 0))} | {hrs(r.days.reduce((a, d) => a + d.capacity, 0))}</td>
                {r.days.map((d) => <td key={d.date}><div className={`cell-load ${cls(d)}`} title={`${hrs(d.minutes)} of ${hrs(d.capacity)}`}>{d.capacity ? hrs(d.minutes) : ''}</div></td>)}
              </tr>
              {open[r.user.id] && r.tasks.map((t) => (
                <tr key={`t${t.id}`}><td className="l" colSpan={2}><a className="small" style={{ paddingLeft: 36, cursor: 'pointer' }} onClick={() => openTask(t.id)}>{t.title} <span className="muted">· {t.project_name}</span></a></td>
                  {dates.map((d) => <td key={d}>{(t.start_date || t.due_date) && d >= (t.start_date || t.due_date) && d <= (t.due_date || t.start_date) ? <div className="cell-load full" style={{ height: 8 }} /> : null}</td>)}</tr>))}
            </Fragment>))}</tbody>
          </table>
        </div>
        {unplanned && <div className="mw-side"><h3>Unplanned tasks</h3><div className="muted small" style={{ marginBottom: 8 }}>Tasks missing an assignee, due date or estimate.</div>
          {(un.data || []).map((t) => <div key={t.id} className="mw-item" style={{ cursor: 'pointer' }} onClick={() => openTask(t.id)}><span className="ellipsis">{t.title}</span><span className="muted small" style={{ marginLeft: 'auto' }}>{!t.assignee ? 'no assignee' : !t.due_date ? 'no date' : 'no estimate'}</span></div>)}
          {un.data && !un.data.length && <div className="muted small">Everything is planned.</div>}</div>}
      </div>
    </>
  )
}

/* ---------- Schedule (allocations) ---------- */
function Schedule() {
  const [start, setStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return iso(d) })
  const [by, setBy] = useState('projects')
  const [form, setForm] = useState(null)
  const { rows, create, update, remove } = useRows('allocations')
  const { projects, people } = useUi()
  const N = 28
  const [open, setOpen] = useState({})
  const [banner, setBanner] = useState(() => { try { return localStorage.getItem('cd_sched_banner') !== '0' } catch { return true } })
  const navigate = useNavigate()
  const allocsOf = (g) => (rows || []).filter((a) => a[g.key] === g.id)
  const dates = Array.from({ length: N }, (_, i) => addDays(start, i))
  const W = 36
  const groups = by === 'projects' ? projects.map((p) => ({ id: p.id, name: p.name, sub: p.client?.name, color: p.color, key: 'project_id' }))
    : people.map((u) => ({ id: u.id, name: u.name, user: u, key: 'user_id' }))
  const bar = (a) => {
    const s = Math.max(0, Math.round((new Date(a.start_date) - new Date(start)) / 864e5))
    const e = Math.min(N - 1, Math.round((new Date(a.end_date) - new Date(start)) / 864e5))
    if (e < 0 || s > N - 1) return null
    return { left: s * W + 2, width: (e - s + 1) * W - 4 }
  }
  const save = (v) => (form.id ? update(form.id, { ...v, minutes_per_day: Math.round(Number(v.hours) * 60) }) : create({ ...v, minutes_per_day: Math.round(Number(v.hours || 8) * 60) }))
  return (
    <>
      {banner && <div className="scout-banner"><Sparkles size={18} color="#c03cc4" /><div style={{ flex: 1 }}><b>Save your scheduling sanity in 36 seconds</b><div>Smart scheduling finds the right person for every allocation and warns you about double bookings in the Workload view.</div></div>
        <a style={{ color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }} onClick={() => navigate('/planning/workload')}>See how it works</a>
        <button className="icon-btn" onClick={() => { setBanner(false); try { localStorage.setItem('cd_sched_banner', '0') } catch { /* ignore */ } }}><X size={15} /></button></div>}
      <div className="tw-toolbar">
        <Nav label={`${fmtDate(dates[0])} – ${fmtDate(dates[N - 1])}`} onToday={() => setStart(todayIso())} onPrev={() => setStart(addDays(start, -7))} onNext={() => setStart(addDays(start, 7))} />
        <div className="chips" style={{ marginLeft: 12 }}><button className={by === 'projects' ? 'on' : ''} onClick={() => setBy('projects')}>Projects</button><button className={by === 'people' ? 'on' : ''} onClick={() => setBy('people')}>People</button></div>
        <span className="spacer" /><button className="btn primary" onClick={() => setForm({ start_date: start, end_date: addDays(start, 4), hours: 8 })}><Plus size={15} />Add allocation</button>
      </div>
      <div className="kit-scroll">
        <div style={{ display: 'flex', minWidth: 260 + N * W }}>
          <div style={{ width: 260, flexShrink: 0 }}>
            <div className="muted small" style={{ height: 36, borderBottom: '1px solid var(--border)', padding: '10px 6px' }}>{by === 'projects' ? `All projects ${groups.length}` : `All people ${groups.length}`}</div>
            {groups.map((g) => <Fragment key={g.id}>
              <div className="sched-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px', cursor: 'pointer' }} onClick={() => setOpen({ ...open, [g.id]: !open[g.id] })}>
                {open[g.id] ? <ChevronDown size={14} /> : <Chev size={14} />}
                {g.user ? <Avatar user={g.user} size={24} /> : <span className="sched-folder"><Folder size={14} /></span>}<div style={{ minWidth: 0 }}><div className="small ellipsis"><b>{g.name}</b></div>{g.sub && <div className="muted ellipsis" style={{ fontSize: 11 }}>{g.sub}</div>}</div></div>
              {open[g.id] && allocsOf(g).map((a) => <div key={a.id} className="sched-row small" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 40 }}>{by === 'projects' ? <><Avatar user={people.find((u) => u.id === a.user_id)} size={20} />{people.find((u) => u.id === a.user_id)?.name}</> : a.project_name}</div>)}
              {open[g.id] && !allocsOf(g).length && <div className="sched-row small muted" style={{ display: 'flex', alignItems: 'center', paddingLeft: 40 }}>No allocations</div>}
            </Fragment>)}
          </div>
          <div>
            <div style={{ display: 'flex', height: 36, borderBottom: '1px solid var(--border)' }}>{dates.map((d) => <div key={d} style={{ width: W, textAlign: 'center', fontSize: 10, color: d === todayIso() ? 'var(--accent)' : 'var(--muted)', background: [0, 6].includes(dow(d)) ? '#fafafc' : '' }}>{'SMTWTFS'[dow(d)]}<br /><b>{d.slice(8)}</b></div>)}</div>
            {groups.map((g) => (<Fragment key={g.id}>
              <div className="sched-row" style={{ width: N * W, background: 'repeating-linear-gradient(90deg, transparent 0 35px, #f2f3f7 35px 36px)' }}
                onDoubleClick={(e) => { const i = Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left) / W); setForm({ [g.key]: g.id, start_date: dates[i], end_date: dates[Math.min(N - 1, i + 4)], hours: 8 }) }}>
                {(rows || []).filter((a) => a[g.key] === g.id).map((a) => { const b = bar(a); if (!b) return null; const other = by === 'projects' ? people.find((u) => u.id === a.user_id)?.name : a.project_name
                  return <div key={a.id} className="alloc-bar" style={{ ...b, background: by === 'projects' ? (a.project_color || '#4461d7') : (projects.find((p) => p.id === a.project_id)?.color || '#4461d7') }} onClick={() => setForm({ ...a, hours: a.minutes_per_day / 60 })}>{other} · {hrs(a.minutes_per_day)}/d</div> })}
              </div>
              {open[g.id] && allocsOf(g).map((a) => { const b = bar(a)
                return <div key={a.id} className="sched-row" style={{ width: N * W, background: 'repeating-linear-gradient(90deg, transparent 0 35px, #f7f8fb 35px 36px)' }}>{b && <div className="alloc-bar" style={{ ...b, background: '#8ea2ef' }} onClick={() => setForm({ ...a, hours: a.minutes_per_day / 60 })}>{hrs(a.minutes_per_day)}/d{a.note ? ` · ${a.note}` : ''}</div>}</div> })}
              {open[g.id] && !allocsOf(g).length && <div className="sched-row" style={{ width: N * W }} />}
            </Fragment>))}
          </div>
        </div>
      </div>
      <div className="muted small" style={{ marginTop: 8 }}>Tip: double-click a row to add an allocation on that day.</div>
      {form && <FormModal title={form.id ? 'Edit allocation' : 'Add allocation'} initial={form} onClose={() => setForm(null)} onSubmit={save}
        fields={[{ key: 'user_id', label: 'Person', type: 'person', required: true, half: true }, { key: 'project_id', label: 'Project', type: 'project', required: true, half: true },
          { key: 'start_date', label: 'Start', type: 'date', required: true, half: true }, { key: 'end_date', label: 'End', type: 'date', required: true, half: true },
          { key: 'hours', label: 'Hours per day', type: 'number', half: true }, { key: 'note', label: 'Note', half: true }]}>
        {form.id && <button className="btn" style={{ color: 'var(--danger)' }} onClick={() => { remove(form.id); setForm(null) }}><Trash2 size={14} />Delete allocation</button>}
      </FormModal>}
    </>
  )
}

/* ---------- Portfolio boards ---------- */
function Portfolio() {
  const { rows, create, update, remove } = useRows('portfolio')
  const { projects } = useUi()
  const [sel, setSel] = useState(null)
  const [form, setForm] = useState(false)
  const [drag, setDrag] = useState(null)
  const [over, setOver] = useState(null)
  const board = rows?.find((b) => b.id === sel) || rows?.[0]
  const cols = board?.columns || []
  const placed = new Set(cols.flatMap((c) => c.project_ids))
  const saveCols = (c) => update(board.id, { columns: c })
  const move = (pid, cid) => saveCols(cols.map((c) => ({ ...c, project_ids: c.id === cid ? [...c.project_ids.filter((x) => x !== pid), pid] : c.project_ids.filter((x) => x !== pid) })))
  const addCol = () => { const name = prompt('Column name'); if (name) saveCols([...cols, { id: Date.now(), name, color: '#4461d7', project_ids: [] }]) }
  const card = (p) => p && <div key={p.id} className="pcard" draggable onDragStart={() => setDrag(p.id)}><div className="row" style={{ gap: 6 }}><span className="dot" style={{ background: p.color }} /><Link to={`/projects/${p.id}`}><b className="small">{p.name}</b></Link></div>
    {p.client && <div className="muted small">{p.client.name}</div>}<div style={{ marginTop: 6 }}><Meter value={p.completed_count || 0} max={p.task_count || 1} tone="green" /></div></div>
  return (
    <>
      <div className="tw-toolbar"><h2>Portfolio</h2>
        {rows?.length > 0 && <select className="input" style={{ width: 200, height: 32 }} value={board?.id} onChange={(e) => setSel(Number(e.target.value))}>{rows.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
        <span className="spacer" />{board && <><button className="btn" onClick={addCol}><Plus size={14} />Add column</button><button className="icon-btn" onClick={() => confirm('Delete this board?') && remove(board.id)}><Trash2 size={15} /></button></>}
        <button className="btn primary" onClick={() => setForm(true)}><Plus size={15} />Add board</button></div>
      {rows && !rows.length && <EmptyState icon={Kanban} title="Create Your First Board" text="Use columns and cards to organize your projects." action={<button className="btn primary" onClick={() => setForm(true)}><Plus size={15} />Add board</button>} />}
      {board && <div className="pboard">
        <div className={`pcol ${over === 'none' ? 'drop' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver('none') }} onDrop={() => { saveCols(cols.map((c) => ({ ...c, project_ids: c.project_ids.filter((x) => x !== drag) }))); setOver(null) }}>
          <div className="pcol-head">Not on board <span className="muted small">{projects.length - placed.size}</span></div>
          {projects.filter((p) => !placed.has(p.id)).map(card)}</div>
        {cols.map((c) => (
          <div key={c.id} className={`pcol ${over === c.id ? 'drop' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(c.id) }} onDragLeave={() => setOver(null)} onDrop={() => { move(drag, c.id); setOver(null) }}>
            <div className="pcol-head"><span className="dot" style={{ background: c.color }} />{c.name}<span className="muted small">{c.project_ids.length}</span><span className="spacer" style={{ flex: 1 }} /><button className="icon-btn" onClick={() => saveCols(cols.filter((x) => x.id !== c.id))}><Trash2 size={13} /></button></div>
            {c.project_ids.map((id) => card(projects.find((p) => p.id === id)))}
          </div>))}
      </div>}
      {form && <FormModal title="Add board" onClose={() => setForm(false)} onSubmit={async (v) => { const b = await create({ name: v.name, columns: ['Planning', 'In progress', 'Review', 'Done'].map((n, i) => ({ id: i + 1, name: n, color: ['#94a3b8', '#4461d7', '#f0a500', '#22b573'][i], project_ids: [] })) }); setSel(b.id) }}
        fields={[{ key: 'name', label: 'Board name', required: true, autoFocus: true }]} />}
    </>
  )
}

/* ---------- Chart (project timeline) ---------- */
function ChartTab() {
  const { data } = useData('/projects?status=active')
  const list = (data || []).filter((p) => p.start_date || p.end_date)
  const min = list.length ? list.map((p) => p.start_date || p.end_date).sort()[0] : todayIso()
  const max = list.length ? list.map((p) => p.end_date || p.start_date).sort().slice(-1)[0] : addDays(todayIso(), 30)
  const span = Math.max(1, (new Date(max) - new Date(min)) / 864e5)
  const months = useMemo(() => { const out = []; const d = new Date(min.slice(0, 7) + '-01T00:00:00'); while (iso(d) <= max) { out.push(iso(d)); d.setMonth(d.getMonth() + 1) } return out }, [min, max])
  const pos = (s) => `${Math.max(0, ((new Date(s) - new Date(min)) / 864e5 / span) * 100)}%`
  return (
    <>
      <div className="tw-toolbar"><h2>Project timeline</h2><span className="muted small">{list.length} projects with dates</span></div>
      {!list.length ? <EmptyState icon={CalendarRange} title="No project dates yet" text="Give projects a start and end date to see them on the chart." /> : (
        <div className="card" style={{ padding: 12 }}>
          <div style={{ display: 'flex', marginLeft: 220, position: 'relative', height: 22 }}>{months.map((m) => <span key={m} className="muted small" style={{ position: 'absolute', left: pos(m) }}>{new Date(m + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}</span>)}</div>
          {list.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', height: 36, borderBottom: '1px solid var(--row-line)' }}>
              <Link to={`/projects/${p.id}`} className="small ellipsis" style={{ width: 220, paddingRight: 10 }}><b>{p.name}</b></Link>
              <div style={{ flex: 1, position: 'relative', height: 20 }}>
                <div style={{ position: 'absolute', left: pos(todayIso()), top: -8, bottom: -8, width: 1, background: 'var(--danger)' }} />
                <div title={`${p.start_date || '?'} → ${p.end_date || '?'}`} style={{ position: 'absolute', left: pos(p.start_date || p.end_date), width: `calc(${pos(p.end_date || p.start_date)} - ${pos(p.start_date || p.end_date)} + 6px)`, height: 20, borderRadius: 6, background: p.color, opacity: .85 }}>
                  <div style={{ width: `${p.task_count ? (p.completed_count / p.task_count) * 100 : 0}%`, height: '100%', background: 'rgba(0,0,0,.18)', borderRadius: 6 }} /></div>
              </div>
            </div>))}
        </div>)}
    </>
  )
}

export { api, qs }
