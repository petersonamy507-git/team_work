// Plan & Insights › Reporting: All reports (library), Custom reports, Scheduled reports, report viewer
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BarChart3, Plus, Star, Search, Download, CalendarClock, Trash2, Pencil, FolderKanban, Gauge, Clock, Target, Receipt, PiggyBank, ListChecks, Flag, ArrowLeft } from 'lucide-react'
import { useData } from '../lib/ui-context'
import { Section, DataTable, EmptyState, FormModal, Hero, Pill, PersonChip, useRows, hrs, money, toCSV } from '../components/Kit'
import { downloadText } from '../lib/taskFilters'

const TABS = [{ to: '/reports/all', label: 'All reports' }, { to: '/reports/custom', label: 'Custom Reports' }, { to: '/reports/scheduled', label: 'Scheduled reports' }]

export const LIBRARY = [
  { key: 'project-health', name: 'Project health', icon: FolderKanban, color: '#e5ebff', fg: '#3c55bd', cats: ['recommended'], tags: ['Projects', 'Risk'], text: 'See status, due dates, and clients for every project so you can spot at-risk work early.' },
  { key: 'utilization', name: 'Utilization', icon: Gauge, color: '#efe5ff', fg: '#6b3fc2', cats: ['recommended', 'time'], tags: ['Capacity', 'Targets'], text: 'See available, logged, and estimated time for every person so you can balance team capacity.' },
  { key: 'time', name: 'Time', icon: Clock, color: '#fff1d6', fg: '#9a5b00', cats: ['recommended', 'time'], tags: ['Logged time', 'Billability'], text: 'See logged time across users, tasks, projects, and companies so you can bill accurately.' },
  { key: 'planned-vs-actual', name: 'Planned vs Actual', icon: Target, color: '#ffe5ec', fg: '#c0203a', cats: ['recommended', 'tasks'], tags: ['Delivery', 'Milestones'], text: 'Compare planned vs actual delivery across projects and tasks so you can catch slippage early.' },
  { key: 'invoice-status', name: 'Invoice status', icon: Receipt, color: '#dcf6e8', fg: '#127a47', cats: ['recommended', 'financial'], tags: ['Billing', 'Clients'], text: 'Track paid and outstanding invoices across every project so you can keep cash flow healthy.' },
  { key: 'budget-insights', name: 'Budget insights', icon: PiggyBank, color: '#dcf6e8', fg: '#127a47', cats: ['recommended', 'financial'], tags: ['Budget burn', 'Profit'], text: 'Track every project budget in real time: total, used, and remaining, so you catch overruns early.' },
  { key: 'tasks', name: 'Tasks', icon: ListChecks, color: '#e5ebff', fg: '#3c55bd', cats: ['tasks'], tags: ['Tasks', 'Status'], text: 'Every task created in the period with its assignee, status, priority and due date.' },
  { key: 'milestones', name: 'Milestones', icon: Flag, color: '#fff1d6', fg: '#9a5b00', cats: ['tasks'], tags: ['Milestones'], text: 'Upcoming, late and completed milestones across all projects.' },
]

export default function Reporting() {
  const { tab = 'all' } = useParams()
  const C = { all: AllReports, custom: CustomReports, scheduled: Scheduled }[tab] || AllReports
  return <Section icon={BarChart3} title="Reporting" tabs={TABS}><C /></Section>
}

function AllReports() {
  const [cat, setCat] = useState('recommended')
  const [q, setQ] = useState('')
  const [stars, setStars] = useState(() => { try { return JSON.parse(localStorage.getItem('cd_rep_stars') || '[]') } catch { return [] } })
  const navigate = useNavigate()
  const star = (k) => { const s = stars.includes(k) ? stars.filter((x) => x !== k) : [...stars, k]; setStars(s); try { localStorage.setItem('cd_rep_stars', JSON.stringify(s)) } catch { /* ignore */ } }
  const list = LIBRARY.filter((r) => (cat === 'all' || (cat === 'starred' ? stars.includes(r.key) : r.cats.includes(cat))) && r.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <div className="tw-toolbar"><h2>Report library</h2><span className="spacer" />
        <label className="kit-search"><Search size={14} /><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <button className="btn primary" onClick={() => navigate('/reports/custom?new=1')}><Plus size={15} />Create custom report</button></div>
      <div className="chips" style={{ marginBottom: 12 }}>{[['all', 'All'], ['starred', 'Starred'], ['recommended', 'Recommended'], ['financial', 'Financial'], ['time', 'Time & Utilization'], ['tasks', 'Tasks']].map(([k, l]) => <button key={k} className={cat === k ? 'on' : ''} onClick={() => setCat(k)}>{l}</button>)}</div>
      {!list.length ? <EmptyState icon={Star} title="No reports here" text="Star reports to keep them handy." /> : (
        <div className="rep-cards">{list.map((r) => (
          <div key={r.key} className="rep-card" onClick={() => navigate(`/reports/view/${r.key}`)}>
            <button className={`star ${stars.includes(r.key) ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); star(r.key) }}><Star size={15} fill={stars.includes(r.key) ? 'currentColor' : 'none'} /></button>
            <span className="ic" style={{ background: r.color, color: r.fg }}><r.icon size={16} /></span>
            <h4>{r.name}</h4><p>{r.text}</p><div className="tags">{r.tags.map((t) => <span key={t}>{t}</span>)}</div>
          </div>))}</div>)}
      <Hero icon={BarChart3} title="Custom Reports" text="Unlock the full power of reporting with Custom Reports. Build reports from scratch so you see only the most relevant information.">
        <button className="btn primary" onClick={() => navigate('/reports/custom?new=1')}><Plus size={15} />Create new report</button></Hero>
    </>
  )
}

export function ReportView() {
  const { kind } = useParams()
  const navigate = useNavigate()
  const [qp] = useSearchParams()
  const pick = qp.get('cols') ? qp.get('cols').split('|').filter(Boolean) : null
  const meta = LIBRARY.find((r) => r.key === kind) || { name: kind }
  const today = new Date().toISOString().slice(0, 10)
  const [range, setRange] = useState({ start: new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10), end: today })
  const [sched, setSched] = useState(false)
  const { data } = useData(`/reports/library/${kind}?start=${range.start}&end=${range.end}`, [range.start, range.end])
  const saved = useRows('saved-reports')
  const cols = data?.rows?.[0] ? Object.keys(data.rows[0]).filter((c) => !pick || pick.includes(c)) : []
  const fmt = (c, v) => (data?.minutes?.includes(c) ? hrs(v) : data?.money?.includes(c) ? money(v) : c === 'Status' || c === 'Health' ? <Pill tone={{ completed: 'green', paid: 'green', good: 'green', Completed: 'green', overdue: 'red', Late: 'red', needs_attention: 'red', at_risk: 'amber', open: 'blue', Upcoming: 'amber' }[v] || 'gray'}>{String(v).replace('_', ' ')}</Pill> : v)
  return (
    <Section icon={BarChart3} title="Reporting" tabs={TABS}>
      <div className="tw-toolbar">
        <button className="tb-btn" onClick={() => navigate('/reports/all')}><ArrowLeft size={14} />Report library</button>
        <h2>{qp.get('name') || data?.title || meta.name}</h2><span className="spacer" />
        <input type="date" className="input" style={{ width: 150, height: 32 }} value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} />
        <input type="date" className="input" style={{ width: 150, height: 32 }} value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} />
        <button className="tb-btn" onClick={() => setSched(true)}><CalendarClock size={14} />Schedule</button>
        <button className="btn" onClick={() => downloadText(`${kind}.csv`, toCSV((data?.rows || []).map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])))))}><Download size={14} />Export CSV</button>
      </div>
      <DataTable rows={data?.rows?.map((r, i) => ({ ...r, __i: i }))} rowKey="__i" search={(r) => Object.values(r).join(' ')}
        empty={<EmptyState icon={BarChart3} title="No data for this period" text="Try a wider date range." />}
        columns={cols.map((c) => ({ key: c, label: c, render: (r) => fmt(c, r[c]) }))} />
      {sched && <FormModal title={`Schedule "${meta.name}"`} initial={{ name: meta.name, frequency: 'weekly' }} onClose={() => setSched(false)}
        onSubmit={(v) => saved.create({ ...v, kind: 'scheduled', report_type: kind })}
        fields={[{ key: 'name', label: 'Name', required: true }, { key: 'frequency', label: 'Send', type: 'select', required: true, options: [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']] },
          { key: 'recipients', label: 'Recipients (emails, comma separated)', required: true }]} />}
    </Section>
  )
}

const REPORT_ON = [['utilization', 'Users'], ['project-health', 'Projects'], ['tasks', 'Tasks'], ['time', 'Time'], ['milestones', 'Milestones'], ['invoice-status', 'Invoices'], ['budget-insights', 'Budgets'], ['planned-vs-actual', 'Planned vs actual']]

function Builder({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [on, setOn] = useState(initial?.report_type || 'utilization')
  const { data } = useData(`/reports/library/${on}`, [on])
  const all = data?.rows?.[0] ? Object.keys(data.rows[0]) : []
  const [cols, setCols] = useState(initial?.config?.columns || null)
  const chosen = cols || all
  const toggle = (c) => setCols(chosen.includes(c) ? chosen.filter((x) => x !== c) : all.filter((x) => chosen.includes(x) || x === c))
  return (
    <div className="builder">
      <div className="builder-side">
        <label className="small"><b>Report name</b></label>
        <input className="input" autoFocus value={name} placeholder="Marketing Team" onChange={(e) => setName(e.target.value)} />
        <label className="small" style={{ marginTop: 14 }}><b>Report on</b></label>
        <select className="input" value={on} onChange={(e) => { setOn(e.target.value); setCols(null) }}>{REPORT_ON.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <label className="small" style={{ marginTop: 14 }}><b>Columns</b></label>
        {all.map((c) => <label key={c} className={`builder-col ${chosen.includes(c) ? 'on' : ''}`}><input type="checkbox" checked={chosen.includes(c)} onChange={() => toggle(c)} />{c}</label>)}
        {!all.length && <div className="muted small">No data yet for this source.</div>}
        <div className="row" style={{ gap: 8, marginTop: 16 }}><button className="btn" onClick={onCancel}>Cancel</button><button className="btn primary" disabled={!name.trim()} onClick={() => onSave({ name, report_type: on, config: { columns: chosen } })}>Save report</button></div>
      </div>
      <div className="builder-preview">
        <h2 style={{ fontSize: 22, marginBottom: 10 }}>{name || 'Untitled report'}</h2>
        <table className="kit-table"><thead><tr>{chosen.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{(data?.rows || []).slice(0, 12).map((r, i) => <tr key={i}>{chosen.map((c) => <td key={c}>{data.minutes?.includes(c) ? hrs(r[c]) : data.money?.includes(c) ? money(r[c]) : String(r[c] ?? '')}</td>)}</tr>)}</tbody></table>
      </div>
    </div>
  )
}

function CustomReports() {
  const [sp] = useSearchParams()
  const { rows, create, update, remove } = useRows('saved-reports')
  const [build, setBuild] = useState(sp.get('new') ? {} : null)
  const navigate = useNavigate()
  const list = (rows || []).filter((r) => r.kind === 'custom')
  const openR = (r) => navigate(`/reports/view/${r.report_type}?cols=${encodeURIComponent((r.config?.columns || []).join('|'))}&name=${encodeURIComponent(r.name)}`)
  if (build) return <Builder initial={build} onCancel={() => setBuild(null)} onSave={async (v) => { const r = build.id ? await update(build.id, v) : await create({ ...v, kind: 'custom' }); setBuild(null); openR(r) }} />
  return (
    <>
      {rows && !list.length && <Hero icon={BarChart3} title="Custom Reports" text="Unlock the full power of reporting with our Custom Reports feature. This allows you to build reports entirely from scratch ensuring you are viewing only the most relevant information."><button className="btn primary" onClick={() => setBuild({})}>Create new report</button></Hero>}
      {list.length > 0 && <>
        <div className="tw-toolbar"><h2>Custom reports</h2><span className="spacer" /><button className="btn primary" onClick={() => setBuild({})}><Plus size={15} />Create new report</button></div>
        <DataTable rows={list} search={(r) => r.name} onRow={openR}
          columns={[{ key: 'name', label: 'Report name', render: (r) => <b>{r.name}</b> },
            { key: 'report_type', label: 'Report on', render: (r) => REPORT_ON.find((x) => x[0] === r.report_type)?.[1] },
            { key: 'cols', label: 'Columns', render: (r) => (r.config?.columns || []).length },
            { key: 'created_at', label: 'Created', render: (r) => r.created_at?.slice(0, 10) },
            { key: 'a', label: '', nosort: true, render: (r) => <span className="act" onClick={(e) => e.stopPropagation()}><button className="icon-btn" title="Edit" onClick={() => setBuild(r)}><Pencil size={14} /></button><button className="icon-btn" onClick={() => remove(r.id)}><Trash2 size={14} /></button></span> }]} />
      </>}
    </>
  )
}

const DATA_FROM = ['Last week', 'Current week', 'Last month', 'Current month', 'Last 30 days']
function Scheduled() {
  const { rows, create, update, remove } = useRows('saved-reports')
  const [form, setForm] = useState(null)
  const list = (rows || []).filter((r) => r.kind === 'scheduled')
  const cfg = (r) => r.config || {}
  const save = (v) => {
    const body = { name: v.name, report_type: v.report_type, frequency: v.frequency, recipients: v.recipients, is_active: !!v.is_active, config: { send_out: v.send_out, until: v.until, data_from: v.data_from, format: v.format } }
    return form.id ? update(form.id, body) : create({ ...body, kind: 'scheduled' })
  }
  const fmtD = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
  return (
    <>
      {rows && !list.length && <Hero icon={CalendarClock} title="Scheduled Reports" text="Reduce manual work and deliver important updates on time. Schedule recurring reports to be sent straight to the inboxes of anyone who needs visibility on them."><button className="btn primary" onClick={() => setForm({ frequency: 'weekly', data_from: 'Last week', format: 'PDF', is_active: true })}><Plus size={15} />Schedule a report</button></Hero>}
      {list.length > 0 && <div className="tw-toolbar"><h2>Scheduled reports</h2><span className="spacer" /><button className="btn primary" onClick={() => setForm({ frequency: 'weekly', data_from: 'Last week', format: 'PDF', is_active: true })}><Plus size={15} />Schedule a report</button></div>}
      {list.length > 0 && <DataTable rows={list} search={(r) => r.name} onRow={(r) => setForm({ ...r, ...cfg(r) })}
        columns={[{ key: 'name', label: 'Name', render: (r) => <b>{r.name}</b> },
          { key: 'report_type', label: 'Source report', render: (r) => <b>{LIBRARY.find((x) => x.key === r.report_type)?.name || 'Custom report'}</b> },
          { key: 'recipients', label: 'Deliver to', render: (r) => <span className="small">{r.recipients}</span> },
          { key: 'send_out', label: 'Send out', sort: (r) => cfg(r).send_out, render: (r) => fmtD(cfg(r).send_out) },
          { key: 'frequency', label: 'Repeat every', render: (r) => ({ daily: 'Day', weekly: 'Week', monthly: 'Month' }[r.frequency] || r.frequency) },
          { key: 'until', label: 'Until', render: (r) => fmtD(cfg(r).until) },
          { key: 'data_from', label: 'Data from', render: (r) => cfg(r).data_from || '—' },
          { key: 'format', label: 'Format', render: (r) => <Pill tone={cfg(r).format === 'CSV' ? 'green' : 'red'}>{cfg(r).format || 'PDF'}</Pill> },
          { key: 'user', label: 'Creator', render: (r) => <PersonChip user={r.user} /> },
          { key: 'is_active', label: 'Active', render: (r) => <span onClick={(e) => e.stopPropagation()}><label className="switch"><input type="checkbox" checked={!!r.is_active} onChange={() => update(r.id, { is_active: !r.is_active })} /><i /></label></span> },
          { key: 'a', label: '', nosort: true, render: (r) => <span className="act" onClick={(e) => e.stopPropagation()}><button className="icon-btn" onClick={() => remove(r.id)}><Trash2 size={14} /></button></span> }]} />}
      {form && <FormModal title={form.id ? 'Edit schedule' : 'Schedule a report'} initial={form} onClose={() => setForm(null)} onSubmit={save}
        fields={[{ key: 'name', label: 'Name', required: true }, { key: 'report_type', label: 'Source report', type: 'select', required: true, options: LIBRARY.map((r) => [r.key, r.name]) },
          { key: 'recipients', label: 'Deliver to (emails, comma separated)', required: true },
          { key: 'send_out', label: 'Send out', type: 'date', half: true, default: new Date().toISOString().slice(0, 10) }, { key: 'frequency', label: 'Repeat every', type: 'select', required: true, half: true, options: [['daily', 'Day'], ['weekly', 'Week'], ['monthly', 'Month']] },
          { key: 'until', label: 'Until', type: 'date', half: true }, { key: 'data_from', label: 'Data from', type: 'select', half: true, options: DATA_FROM },
          { key: 'format', label: 'Format', type: 'select', half: true, options: ['PDF', 'CSV'] }, { key: 'is_active', label: 'Active', type: 'checkbox', text: 'Active', half: true }]} />}
    </>
  )
}
