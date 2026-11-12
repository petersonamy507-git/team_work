// Plan & Insights › Reporting: All reports (library), Custom reports, Scheduled reports, report viewer
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BarChart3, Plus, Star, Search, Download, CalendarClock, Trash2, FolderKanban, Gauge, Clock, Target, Receipt, PiggyBank, ListChecks, Flag, ArrowLeft } from 'lucide-react'
import { useData } from '../lib/ui-context'
import { Section, DataTable, EmptyState, FormModal, Hero, Pill, useRows, hrs, money, toCSV } from '../components/Kit'
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
  const meta = LIBRARY.find((r) => r.key === kind) || { name: kind }
  const today = new Date().toISOString().slice(0, 10)
  const [range, setRange] = useState({ start: new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10), end: today })
  const [sched, setSched] = useState(false)
  const { data } = useData(`/reports/library/${kind}?start=${range.start}&end=${range.end}`, [range.start, range.end])
  const saved = useRows('saved-reports')
  const cols = data?.rows?.[0] ? Object.keys(data.rows[0]) : []
  const fmt = (c, v) => (data?.minutes?.includes(c) ? hrs(v) : data?.money?.includes(c) ? money(v) : c === 'Status' || c === 'Health' ? <Pill tone={{ completed: 'green', paid: 'green', good: 'green', Completed: 'green', overdue: 'red', Late: 'red', needs_attention: 'red', at_risk: 'amber', open: 'blue', Upcoming: 'amber' }[v] || 'gray'}>{String(v).replace('_', ' ')}</Pill> : v)
  return (
    <Section icon={BarChart3} title="Reporting" tabs={TABS}>
      <div className="tw-toolbar">
        <button className="tb-btn" onClick={() => navigate('/reports/all')}><ArrowLeft size={14} />Report library</button>
        <h2>{data?.title || meta.name}</h2><span className="spacer" />
        <input type="date" className="input" style={{ width: 150, height: 32 }} value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} />
        <input type="date" className="input" style={{ width: 150, height: 32 }} value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} />
        <button className="tb-btn" onClick={() => setSched(true)}><CalendarClock size={14} />Schedule</button>
        <button className="btn" onClick={() => downloadText(`${kind}.csv`, toCSV(data?.rows || []))}><Download size={14} />Export CSV</button>
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

function CustomReports() {
  const [sp] = useSearchParams()
  const { rows, create, remove } = useRows('saved-reports')
  const [form, setForm] = useState(sp.get('new') ? {} : null)
  const navigate = useNavigate()
  const list = (rows || []).filter((r) => r.kind === 'custom')
  return (
    <>
      {rows && !list.length && <Hero icon={BarChart3} title="Custom Reports" text="Build reports entirely from scratch, choosing the data source and the date range, so you only see the information you need."><button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Create new report</button></Hero>}
      {list.length > 0 && <>
        <div className="tw-toolbar"><h2>Custom reports</h2><span className="spacer" /><button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Create new report</button></div>
        <DataTable rows={list} search={(r) => r.name} onRow={(r) => navigate(`/reports/view/${r.report_type}`)}
          columns={[{ key: 'name', label: 'Report name', render: (r) => <b>{r.name}</b> },
            { key: 'report_type', label: 'Data source', render: (r) => LIBRARY.find((x) => x.key === r.report_type)?.name },
            { key: 'created_at', label: 'Created', render: (r) => r.created_at?.slice(0, 10) },
            { key: 'a', label: '', nosort: true, render: (r) => <span className="act" onClick={(e) => e.stopPropagation()}><button className="icon-btn" onClick={() => remove(r.id)}><Trash2 size={14} /></button></span> }]} />
      </>}
      {form && <FormModal title="Create custom report" onClose={() => setForm(null)} onSubmit={async (v) => { await create({ ...v, kind: 'custom' }); navigate(`/reports/view/${v.report_type}`) }}
        fields={[{ key: 'name', label: 'Report name', required: true, autoFocus: true, placeholder: 'Marketing Team' },
          { key: 'report_type', label: 'Data source', type: 'select', required: true, options: LIBRARY.map((r) => [r.key, r.name]) }]} />}
    </>
  )
}

function Scheduled() {
  const { rows, create, update, remove } = useRows('saved-reports')
  const [form, setForm] = useState(null)
  const list = (rows || []).filter((r) => r.kind === 'scheduled')
  const save = (v) => (form.id ? update(form.id, v) : create({ ...v, kind: 'scheduled' }))
  return (
    <>
      <div className="tw-toolbar"><h2>Scheduled reports</h2><span className="spacer" /><button className="btn primary" onClick={() => setForm({ frequency: 'weekly' })}><Plus size={15} />Schedule a report</button></div>
      <DataTable rows={rows ? list : null} search={(r) => r.name} onRow={(r) => setForm(r)}
        empty={<EmptyState icon={CalendarClock} title="No scheduled reports" text="Send any report by email on a daily, weekly or monthly schedule." action={<button className="btn primary" onClick={() => setForm({ frequency: 'weekly' })}><Plus size={15} />Schedule a report</button>} />}
        columns={[{ key: 'name', label: 'Name', render: (r) => <b>{r.name}</b> },
          { key: 'report_type', label: 'Report', render: (r) => LIBRARY.find((x) => x.key === r.report_type)?.name },
          { key: 'frequency', label: 'Frequency', render: (r) => <Pill tone="blue">{r.frequency}</Pill> },
          { key: 'recipients', label: 'Recipients' },
          { key: 'a', label: '', nosort: true, render: (r) => <span className="act" onClick={(e) => e.stopPropagation()}><button className="icon-btn" onClick={() => remove(r.id)}><Trash2 size={14} /></button></span> }]} />
      {form && <FormModal title={form.id ? 'Edit schedule' : 'Schedule a report'} initial={form} onClose={() => setForm(null)} onSubmit={save}
        fields={[{ key: 'name', label: 'Name', required: true }, { key: 'report_type', label: 'Report', type: 'select', required: true, options: LIBRARY.map((r) => [r.key, r.name]) },
          { key: 'frequency', label: 'Send', type: 'select', required: true, options: [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']] },
          { key: 'recipients', label: 'Recipients (emails, comma separated)', required: true }]} />}
    </>
  )
}
