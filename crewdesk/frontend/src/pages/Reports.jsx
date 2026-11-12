import { useState } from 'react'
import { Download } from 'lucide-react'
import { useData } from '../lib/ui-context'
import { fmtMinutes, fmtDate } from '../lib/format'
import { qs } from '../lib/api'
import { Avatar, Bars, HealthPill, Loading, Progress } from '../components/ui'

function csv(name, rows) {
  if (!rows.length) return
  const keys = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== 'object')
  const body = [keys.join(','), ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([body], { type: 'text/csv' }))
  a.download = name
  a.click()
}

export default function Reports() {
  const [tab, setTab] = useState('projects')
  const [range, setRange] = useState({ start: '', end: '' })
  const { data } = useData(`/reports${qs(range)}`, [range.start, range.end])
  return (
    <div className="page">
      <div className="page-head"><h1>Reports</h1><span className="spacer" />
        <input type="date" className="input" style={{ width: 160 }} value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} />
        <span className="muted">to</span>
        <input type="date" className="input" style={{ width: 160 }} value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} />
      </div>
      <div className="tabs">
        {[['projects', 'Project health'], ['utilization', 'Team utilization'], ['time', 'Time logged']].map(([k, l]) => <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {!data ? <Loading /> : <>
        <p className="muted small">{fmtDate(data.start, { day: 'numeric', month: 'short', year: 'numeric' })} – {fmtDate(data.end, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        {tab === 'projects' && (
          <div className="card" style={{ overflowX: 'auto' }}>
            <div className="card-head"><h3>Active projects</h3><span className="spacer" /><button className="btn sm" onClick={() => csv('projects-report.csv', data.projects)}><Download size={14} />CSV</button></div>
            <table className="table">
              <thead><tr><th>Project</th><th>Health</th><th style={{ width: 160 }}>Progress</th><th>Tasks</th><th>Late</th><th>Time</th><th>Billable</th><th>Budget used</th><th>End date</th></tr></thead>
              <tbody>{data.projects.map((p) => (
                <tr key={p.id}><td><span className="row"><span className="dot" style={{ background: p.color }} /><b>{p.name}</b></span></td><td><HealthPill h={p.health} /></td>
                  <td><div className="row"><div style={{ flex: 1 }}><Progress value={p.progress} /></div>{p.progress}%</div></td>
                  <td>{p.completed}/{p.tasks}</td><td>{p.late ? <span className="badge red">{p.late}</span> : 0}</td>
                  <td>{fmtMinutes(p.minutes)}</td><td>{fmtMinutes(p.billable_minutes)}</td>
                  <td>{p.budget_minutes ? `${Math.round((p.minutes / p.budget_minutes) * 100)}%` : '—'}</td><td className="muted">{fmtDate(p.end_date) || '—'}</td></tr>))}</tbody>
            </table>
          </div>
        )}
        {tab === 'utilization' && (
          <div className="card" style={{ overflowX: 'auto' }}>
            <div className="card-head"><h3>Workload per person</h3><span className="spacer" /><button className="btn sm" onClick={() => csv('utilization-report.csv', data.people)}><Download size={14} />CSV</button></div>
            <table className="table">
              <thead><tr><th>Person</th><th>Open tasks</th><th>Completed tasks</th><th>Estimated open work</th><th>Time logged</th><th style={{ width: 200 }}>Share of team time</th></tr></thead>
              <tbody>{(() => { const tot = Math.max(1, data.people.reduce((a, b) => a + b.minutes, 0)); return data.people.map((p) => (
                <tr key={p.id}><td><span className="row"><Avatar user={p} size={26} />{p.name}</span></td><td>{p.open_tasks}</td><td>{p.completed_tasks}</td>
                  <td>{fmtMinutes(p.estimated_open_minutes)}</td><td>{fmtMinutes(p.minutes)}</td>
                  <td><div className="row"><div style={{ flex: 1 }}><Progress value={(p.minutes / tot) * 100} /></div>{Math.round((p.minutes / tot) * 100)}%</div></td></tr>)) })()}</tbody>
            </table>
          </div>
        )}
        {tab === 'time' && (
          <div className="card"><div className="card-head"><h3>Team time per day</h3><span className="spacer" /><b>{fmtMinutes(data.daily.reduce((a, b) => a + b.minutes, 0))}</b></div>
            <div className="card-body" style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: data.daily.length * 28 }}>
                <Bars data={data.daily.map((d) => d.minutes)} labels={data.daily.map((d) => fmtDate(d.date, { day: 'numeric' }))} format={(v) => Math.round(v / 60) + 'h'} />
              </div>
            </div>
          </div>
        )}
      </>}
    </div>
  )
}
