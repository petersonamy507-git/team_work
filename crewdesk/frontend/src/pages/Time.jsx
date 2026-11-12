import { useState } from 'react'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useData, useUi } from '../lib/ui-context'
import { fmtMinutes, fmtDate } from '../lib/format'
import { qs } from '../lib/api'
import { Loading } from '../components/ui'
import { TimeForm } from '../components/QuickAdd'
import { TimeTable } from './Project'

const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

export default function TimePage({ embedded }) {
  const { people, projects } = useUi()
  const [tab, setTab] = useState('timesheet')
  const [week, setWeek] = useState(null)
  const [form, setForm] = useState(null)
  const [f, setF] = useState({ user_id: 'me', project_id: '', start: '', end: '', billable: '' })
  const sheet = useData(`/time/timesheet${week ? `?week_of=${week}` : ''}`, [week])
  const entries = useData(`/time${qs(f)}`, [JSON.stringify(f)])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const s = sheet.data
  const total = (entries.data || []).reduce((a, b) => a + b.minutes, 0)
  return (
    <div className={embedded ? '' : 'page'}>
      <div className="page-head">{!embedded && <h1>Time</h1>}<span className="spacer" /><button className="btn primary" onClick={() => setForm({})}><Plus size={16} />Log time</button></div>
      <div className="tabs">
        <button className={`tab ${tab === 'timesheet' ? 'active' : ''}`} onClick={() => setTab('timesheet')}>My timesheet</button>
        <button className={`tab ${tab === 'entries' ? 'active' : ''}`} onClick={() => setTab('entries')}>Time entries</button>
      </div>
      {tab === 'timesheet' ? (!s ? <Loading /> : (
        <>
          <div className="page-head">
            <button className="icon-btn" onClick={() => setWeek(addDays(s.start, -7))}><ChevronLeft size={18} /></button>
            <h3>{fmtDate(s.start, { day: 'numeric', month: 'short' })} – {fmtDate(s.end, { day: 'numeric', month: 'short', year: 'numeric' })}</h3>
            <button className="icon-btn" onClick={() => setWeek(addDays(s.start, 7))}><ChevronRight size={18} /></button>
            <button className="btn sm" onClick={() => setWeek(null)}>This week</button>
          </div>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Project</th>{s.days.map((d) => <th key={d} style={{ textAlign: 'center' }}>{fmtDate(d, { weekday: 'short', day: 'numeric' })}</th>)}<th style={{ textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>
                {s.rows.length === 0 && <tr><td colSpan={9} className="muted" style={{ textAlign: 'center', padding: 30 }}>No time this week. Log some with the button above.</td></tr>}
                {s.rows.map((r) => (
                  <tr key={r.project_id}><td><b>{r.project_name}</b></td>
                    {r.days.map((m, i) => <td key={i} style={{ textAlign: 'center' }} className={m ? '' : 'muted'}>{m ? fmtMinutes(m) : '–'}</td>)}
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtMinutes(r.days.reduce((a, b) => a + b, 0))}</td></tr>
                ))}
                {s.rows.length > 0 && <tr><td><b>Total</b></td>{s.days.map((_, i) => <td key={i} style={{ textAlign: 'center', fontWeight: 600 }}>{fmtMinutes(s.rows.reduce((a, r) => a + r.days[i], 0))}</td>)}
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMinutes(s.rows.reduce((a, r) => a + r.days.reduce((x, y) => x + y, 0), 0))}</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )) : (
        <>
          <div className="card card-body row" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
            <select className="select" style={{ width: 170 }} value={f.user_id} onChange={set('user_id')}><option value="me">Me</option><option value="all">Everyone</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <select className="select" style={{ width: 200 }} value={f.project_id} onChange={set('project_id')}><option value="">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <input type="date" className="input" style={{ width: 160 }} value={f.start} onChange={set('start')} />
            <span className="muted">to</span>
            <input type="date" className="input" style={{ width: 160 }} value={f.end} onChange={set('end')} />
            <select className="select" style={{ width: 150 }} value={f.billable} onChange={set('billable')}><option value="">Billable or not</option><option value="true">Billable</option><option value="false">Non-billable</option></select>
            <span className="spacer" style={{ flex: 1 }} /><b>Total {fmtMinutes(total)}</b>
          </div>
          <div className="card" style={{ overflowX: 'auto' }}>{!entries.data ? <Loading /> : <TimeTable entries={entries.data} onEdit={setForm} />}</div>
        </>
      )}
      {form && <TimeForm entry={form.id ? form : null} onDone={() => setForm(null)} onCancel={() => setForm(null)} />}
    </div>
  )
}
