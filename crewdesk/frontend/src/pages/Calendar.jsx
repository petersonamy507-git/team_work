// More › Calendar (Teamwork /app/calendar): Month / Week / Day views, Add event, filter
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Filter, CalendarDays, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { useData, useUi } from '../lib/ui-context'
import { Menu } from '../components/ui'
import { FormModal } from '../components/Kit'

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const weekNo = (d) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y) / 864e5 + 1) / 7) }

export default function CalendarPage({ embedded }) {
  const { openTask, refresh, notify } = useUi()
  const [cursor, setCursor] = useState(() => new Date())
  const [mode, setMode] = useState('month')
  const [mine, setMine] = useState(!!embedded)
  const [show, setShow] = useState({ tasks: true, milestones: true, events: true })
  const [form, setForm] = useState(null)
  const [ev, setEv] = useState(null)
  let days
  if (mode === 'month') { const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1); const s = new Date(first); s.setDate(1 - ((first.getDay() + 6) % 7)); days = Array.from({ length: 42 }, (_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d }) }
  else if (mode === 'week') { const s = new Date(cursor); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); days = Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d }) }
  else days = [new Date(cursor)]
  const { data } = useData(`/calendar?start=${iso(days[0])}&end=${iso(days[days.length - 1])}&mine=${mine}`, [iso(days[0]), mode, mine])
  const today = iso(new Date())
  const shift = (n) => { const d = new Date(cursor); if (mode === 'month') d.setMonth(d.getMonth() + n); else d.setDate(d.getDate() + n * (mode === 'week' ? 7 : 1)); setCursor(d) }
  const items = (k) => [
    ...(show.milestones ? (data?.milestones || []).filter((m) => m.due_date === k).map((m) => ({ id: 'm' + m.id, label: `⚑ ${m.name}`, color: '#8b5cf6' })) : []),
    ...(show.events ? (data?.events || []).filter((e) => e.date === k).map((e) => ({ id: 'e' + e.id, label: `${e.start_time ? e.start_time + ' ' : ''}${e.title}`, color: '#0ea5e9', time: e.start_time, end: e.end_time, ev: e })) : []),
    ...(show.tasks ? (data?.tasks || []).filter((t) => t.due_date === k).map((t) => ({ id: 't' + t.id, label: t.title, color: t.status === 'completed' ? '#94a3b8' : k < today ? '#e2445c' : '#4461d7', task: t })) : []),
  ]
  const click = (it) => (it.task ? openTask(it.task.id) : it.ev ? setEv(it.ev) : null)
  const title = mode === 'month' ? cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : mode === 'week' ? `${days[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
      : cursor.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const hours = Array.from({ length: 15 }, (_, i) => i + 7)
  return (
    <div className={embedded ? '' : 'tw-page'}>
      <div className="tw-body">
        <div className="tw-toolbar"><h2 style={{ fontSize: 20 }}>{title}</h2><span className="spacer" />
          <Menu trigger={<button className={`tb-btn ${mine || !show.tasks || !show.events || !show.milestones ? 'on' : ''}`}><Filter size={14} />Filter</button>}>
            <button onClick={() => setMine(!mine)}>{mine ? '✓ ' : ''}Only my tasks</button>
            {Object.keys(show).map((k) => <button key={k} onClick={() => setShow({ ...show, [k]: !show[k] })} style={{ textTransform: 'capitalize' }}>{show[k] ? '✓ ' : ''}{k}</button>)}
          </Menu>
          <button className="btn primary" onClick={() => setForm({ date: today })}><Plus size={15} />Add event</button></div>
        <div className="tw-toolbar">
          <button className="icon-btn" onClick={() => shift(-1)}><ChevronLeft size={16} /></button><button className="btn sm" onClick={() => setCursor(new Date())}>Today</button><button className="icon-btn" onClick={() => shift(1)}><ChevronRight size={16} /></button>
          <span className="spacer" />
          <div className="chips">{['month', 'week', 'day'].map((m) => <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)} style={{ textTransform: 'capitalize' }}>{m}</button>)}</div>
        </div>
        {mode === 'month' ? (
          <div className="cal-grid">
            <div className="hd" />{WD.map((d) => <div className="hd" key={d}>{d}</div>)}
            {days.map((d, i) => { const k = iso(d); const list = items(k)
              return [i % 7 === 0 && <div key={'w' + k} className="wk">{weekNo(d)}</div>,
                <div key={k} className={`day ${d.getMonth() !== cursor.getMonth() ? 'other' : ''} ${k === today ? 'today' : ''} ${d.getDay() % 6 === 0 ? 'weekend' : ''}`} onDoubleClick={() => setForm({ date: k })}>
                  <div className="num"><span>{d.getDate()}</span></div>
                  {list.slice(0, 4).map((it) => <div key={it.id} className="cal-ev" style={{ background: it.color, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); click(it) }}>{it.label}</div>)}
                  {list.length > 4 && <div className="muted small" onClick={() => { setCursor(d); setMode('day') }}>+{list.length - 4} more</div>}
                </div>] })}
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <div className="cal-week" style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}>
              <div className="hr" style={{ height: 'auto' }} />{days.map((d) => <div key={iso(d)} className="hd" style={{ padding: 8, textAlign: 'center', borderBottom: '1px solid var(--border)', color: iso(d) === today ? 'var(--accent)' : '' }}><b>{WD[(d.getDay() + 6) % 7]} {d.getDate()}</b>
                <div>{items(iso(d)).filter((it) => !it.time).map((it) => <div key={it.id} className="cal-ev" style={{ background: it.color, cursor: 'pointer', textAlign: 'left' }} onClick={() => click(it)}>{it.label}</div>)}</div></div>)}
              {hours.map((h) => [<div key={'h' + h} className="hr">{String(h).padStart(2, '0')}:00</div>,
                ...days.map((d) => <div key={iso(d) + h} className="slot" onDoubleClick={() => setForm({ date: iso(d), start_time: `${String(h).padStart(2, '0')}:00`, end_time: `${String(h + 1).padStart(2, '0')}:00` })}>
                  {items(iso(d)).filter((it) => it.time && Number(it.time.slice(0, 2)) === h).map((it) => <div key={it.id} className="cal-ev" style={{ background: it.color, cursor: 'pointer' }} onClick={() => click(it)}>{it.label}</div>)}</div>)])}
            </div>
          </div>)}
        <div className="muted small" style={{ marginTop: 8 }}><CalendarDays size={12} /> Double-click a day or time slot to add an event.</div>
      </div>
      {form && <FormModal title="Add event" initial={form} onClose={() => setForm(null)} onSubmit={async (v) => { await api.post('/events', { ...v, project_id: v.project_id || null }); notify('Event added'); refresh() }}
        fields={[{ key: 'title', label: 'Title', required: true, autoFocus: true }, { key: 'date', label: 'Date', type: 'date', required: true },
          { key: 'start_time', label: 'Start time', placeholder: '09:00', half: true }, { key: 'end_time', label: 'End time', placeholder: '10:00', half: true },
          { key: 'project_id', label: 'Project', type: 'project' }, { key: 'description', label: 'Description', type: 'textarea', rows: 3 }]} />}
      {ev && <FormModal title={ev.title} initial={ev} submitLabel="Delete event" onClose={() => setEv(null)} onSubmit={async () => { await api.del(`/events/${ev.id}`); notify('Event deleted'); refresh() }}
        fields={[]}><div className="muted">{ev.date} {ev.start_time && `· ${ev.start_time}${ev.end_time ? '–' + ev.end_time : ''}`}</div><p style={{ marginTop: 8 }}>{ev.description}</p><Trash2 size={0} /></FormModal>}
    </div>
  )
}
