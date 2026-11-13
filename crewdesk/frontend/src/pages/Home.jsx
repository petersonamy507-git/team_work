// Home (Teamwork /app/home): greeting, dashboard tabs (+), Add widget library, widget menus (filter, rename, duplicate, delete)
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, MoreVertical, Trash2, Pencil, MessageSquare, Copy, Filter, Search, X, RotateCcw, GripVertical, ArrowLeftRight, HeartPulse, CheckCircle2, Clock, DollarSign, AlertTriangle, List, FileCheck2, Code2 } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useData, useUi } from '../lib/ui-context'
import { Menu, Modal } from '../components/ui'
import { FormModal, useRows } from '../components/Kit'
import { WIDGETS, CATEGORIES, WidgetBody } from '../components/Widgets'

const DEFAULT = ['time_distribution', 'projects_by_health', 'unread', 'delegated', 'logged_weekday', 'milestones', 'late_by_project', 'assignee_status']
const MYWORK = ['my_tasks', 'my_calendar', 'personal_tasks', 'activity']
let seq = Date.now()
const mk = (key, project_id) => ({ id: `w${seq++}`, key, ...(project_id ? { project_id } : {}) })
// stored widgets used to be plain keys; normalise to objects
const norm = (list) => (list || []).map((w) => (typeof w === 'string' ? { id: w, key: w } : w)).filter((w) => WIDGETS[w.key])

function Widget({ w, data, range, setRange, onChange, onRemove, onDuplicate, dragProps }) {
  const { projects } = useUi()
  const [rename, setRename] = useState(false)
  const def = WIDGETS[w.key]
  return (
    <div className={`widget ${def.wide ? 'wide' : ''}`} {...dragProps}>
      <div className="widget-head"><GripVertical size={14} className="muted" style={{ cursor: 'grab' }} /><h3>{w.title || def.name}</h3>
        <Menu trigger={<button className={`icon-btn ${w.project_id ? 'on' : ''}`} title="Apply widget filters"><Filter size={14} color={w.project_id ? 'var(--accent)' : undefined} /></button>}>
          <div className="muted small" style={{ padding: '6px 10px' }}>Project</div>
          <button onClick={() => onChange({ project_id: null })}>{!w.project_id ? '✓ ' : ''}All projects</button>
          {projects.map((p) => <button key={p.id} onClick={() => onChange({ project_id: p.id })}>{w.project_id === p.id ? '✓ ' : ''}{p.name}</button>)}
          {w.key === 'time_distribution' && <><div className="muted small" style={{ padding: '6px 10px' }}>Timeframe</div>{[[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']].map(([v, l]) => <button key={v} onClick={() => setRange(v)}>{range === v ? '✓ ' : ''}{l}</button>)}</>}
        </Menu>
        <Menu trigger={<button className="icon-btn" title="Options"><MoreVertical size={15} /></button>}>
          <button onClick={() => setRename(true)}><Pencil size={14} />Rename</button>
          <button onClick={onDuplicate}><Copy size={14} />Duplicate</button>
          {w.config && <button onClick={() => onChange({ config: null })}><RotateCcw size={14} />Reset content</button>}
          <button style={{ color: 'var(--danger)' }} onClick={onRemove}><Trash2 size={14} />Delete</button>
        </Menu></div>
      <div className="widget-body"><WidgetBody w={w} data={data} range={range} onConfig={(c) => onChange({ config: { ...(w.config || {}), ...c } })} /></div>
      {rename && <FormModal title="Rename widget" initial={{ title: w.title || def.name }} onClose={() => setRename(false)} onSubmit={(v) => onChange({ title: v.title })} fields={[{ key: 'title', label: 'Widget name', required: true, autoFocus: true }]} />}
    </div>
  )
}

const CAT_ICON = { 'Project health': HeartPulse, Tasks: CheckCircle2, Time: Clock, 'Revenue & invoicing': DollarSign, Risks: AlertTriangle, Activity: List, Proofs: FileCheck2, 'Embed & notes': Code2 }
const CAT_BG = { 'Project health': '#cdeafc', Tasks: '#e2dcfb', Time: '#cdeffa', 'Revenue & invoicing': '#d8f3e3', Risks: '#fde3dc', Activity: '#e2dcfb', Proofs: '#fbe2ef', 'Embed & notes': '#cdf1ef' }
const PREVIEW = { current_projects: 'num', late_projects: 'numred', projects_by_category: 'donut', projects_by_health: 'donut', budget_usage: 'ring', workflow_stages: 'donut', active_risks: 'donut',
  logged_by_project: 'donut', time_distribution: 'donut', my_logged: 'ring', logged_weekday: 'bars', my_logged_weekday: 'bars', billable_trend: 'bars', late_by_project: 'hbars', non_billable: 'num', profitability: 'num', embedded: 'embed', private_notes: 'note' }
function Preview({ k }) {
  const t = PREVIEW[k] || 'list'
  return (
    <div className="wp-doc">
      <i className="wp-line" style={{ width: '45%' }} />
      {t === 'num' && <div className="wp-num">13</div>}
      {t === 'numred' && <><div className="wp-num" style={{ color: '#e2667a' }}>8</div><div className="wp-bar"><i style={{ width: '40%', background: '#e2667a' }} /></div></>}
      {(t === 'donut' || t === 'ring') && <svg viewBox="0 0 42 42" className="wp-donut"><circle cx="21" cy="21" r="15.9" fill="none" stroke="#8ab4f8" strokeWidth={t === 'ring' ? 6 : 12} strokeDasharray="45 55" /><circle cx="21" cy="21" r="15.9" fill="none" stroke="#f28b82" strokeWidth={t === 'ring' ? 6 : 12} strokeDasharray="25 75" strokeDashoffset="-45" /><circle cx="21" cy="21" r="15.9" fill="none" stroke="#fdd663" strokeWidth={t === 'ring' ? 6 : 12} strokeDasharray="30 70" strokeDashoffset="-70" /></svg>}
      {t === 'bars' && <div className="wp-bars">{[40, 70, 55, 85, 30].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>}
      {t === 'hbars' && [80, 55, 35].map((w, i) => <div key={i} className="wp-bar"><i style={{ width: `${w}%`, background: '#f28b82' }} /></div>)}
      {t === 'list' && [0, 1, 2].map((i) => <div key={i} className="wp-row"><span className="wp-dot" style={{ background: ['#c7d7fb', '#fbd3c1', '#fbe7b4'][i] }} /><i className="wp-line" style={{ width: `${70 - i * 12}%` }} /></div>)}
      {t === 'embed' && <div className="wp-embed">▶</div>}
      {t === 'note' && [80, 65, 72, 40].map((w, i) => <i key={i} className="wp-line" style={{ width: `${w}%`, display: 'block', margin: '6px 0' }} />)}
    </div>
  )
}

function Library({ have, onAdd, onClose }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState(CATEGORIES[0])
  const scroll = (c) => { setCat(c); document.getElementById(`wl-${c}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const match = (w) => !q || (w.name + w.text).toLowerCase().includes(q.toLowerCase())
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wl-modal">
        <div className="wl-head"><h2>Add widget</h2><button className="icon-btn" onClick={onClose}><X size={20} /></button></div>
        <div className="wl-body">
          <div className="wl-cats"><b>Categories</b>{CATEGORIES.map((c) => { const I = CAT_ICON[c] || List; return <button key={c} className={cat === c && !q ? 'on' : ''} onClick={() => scroll(c)}><I size={17} />{c}</button> })}</div>
          <div className="wl-main">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6, position: 'sticky', top: 0, background: '#fff', zIndex: 2, padding: '4px 0 10px' }}><h3 style={{ fontSize: 20 }}>Widget library</h3>
              <label className="kit-search"><Search size={14} /><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />{q && <X size={13} onClick={() => setQ('')} />}</label></div>
            {CATEGORIES.map((c) => { const list = Object.entries(WIDGETS).filter(([, w]) => w.cat === c && match(w)); if (!list.length) return null; const I = CAT_ICON[c] || List
              return (
                <div key={c} id={`wl-${c}`} style={{ marginBottom: 24 }}>
                  <h4 className="row" style={{ gap: 8, fontSize: 17, margin: '8px 0 14px' }}><I size={17} className="muted" />{c}</h4>
                  <div className="wl-grid">{list.map(([k, w]) => (
                    <button key={k} className="wl-card" onClick={() => onAdd(k)}>
                      <div className="wl-prev" style={{ background: CAT_BG[c] || '#e2e8f6' }}><Preview k={k} />{have.includes(k) && <span className="wl-added">ADDED</span>}</div>
                      <span className="wl-logo">c<i>.</i></span>
                      <div className="wl-text"><b>{w.name}</b><span>{w.text}</span></div>
                    </button>))}</div>
                </div>) })}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Dashboard({ scope = 'home', header, defaults, projectId, compact, extraActions, hideBody }) {
  const [range, setRange] = useState(7)
  const { data } = useData(`/dashboard?range_days=${range}`, [range])
  const { notify } = useUi()
  const dash = useRows('dashboards', { scope })
  const [cur, setCur] = useState(null)
  const [picker, setPicker] = useState(false)
  const [tabForm, setTabForm] = useState(null)
  const [drag, setDrag] = useState(null)
  const creating = useRef(false)
  useEffect(() => {
    if (dash.rows && !dash.rows.length && !creating.current) { creating.current = true; dash.create({ scope, name: compact ? 'Summary' : 'Overview', widgets: (defaults || (scope === 'home' ? DEFAULT : MYWORK)).map((k) => mk(k, projectId)) }) }
  }, [dash.rows]) // eslint-disable-line react-hooks/exhaustive-deps
  const ordered = [...(dash.rows || [])].sort((x, y) => (x.position || 0) - (y.position || 0) || x.id - y.id)
  const board = ordered.find((d) => d.id === cur) || ordered[0]
  const moveTab = async (d, dir) => {
    const i = ordered.indexOf(d); const j = i + dir
    if (j < 0 || j >= ordered.length) return
    const next = [...ordered]; [next[i], next[j]] = [next[j], next[i]]
    await Promise.all(next.map((x, k) => (x.position !== k ? api.patch(`/r/dashboards/${x.id}`, { position: k }) : null)))
    dash.reload()
  }
  const widgets = norm(board?.widgets)
  const save = (w) => dash.update(board.id, { widgets: w })
  const patch = (id, p) => save(widgets.map((w) => (w.id === id ? { ...w, ...p } : w)))
  const drop = (id) => { if (!drag || drag === id) return; const w = [...widgets]; const from = w.findIndex((x) => x.id === drag); const [it] = w.splice(from, 1); w.splice(w.findIndex((x) => x.id === id), 0, it); save(w); setDrag(null) }
  const duplicateBoard = async () => { const d = await dash.create({ scope, name: `${board.name} (copy)`, widgets: widgets.map((w) => ({ ...w, id: mk(w.key).id })) }); setCur(d.id); notify('Dashboard duplicated') }
  return (
    <div className={compact ? '' : 'tw-page'}>
      <div className={compact ? '' : 'tw-head'} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, display: 'flex', borderBottom: compact ? '1px solid var(--border)' : undefined }}>
        {header}
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <nav className="tw-tabs dash-tabs">{ordered.slice(0, 4).map((d) => (
            <a key={d.id} className={board?.id === d.id ? 'active' : ''} onClick={() => setCur(d.id)} onDoubleClick={() => setTabForm(d)}>{d.name}
              {board?.id === d.id && <span onClick={(e) => e.stopPropagation()}><Menu trigger={<button className="tab-opt" title="Options"><MoreVertical size={14} /></button>}>
                <button onClick={() => setTabForm(d)}><Pencil size={14} />Rename</button>
                <button onClick={duplicateBoard}><Copy size={14} />Duplicate</button>
                <button disabled={ordered.indexOf(d) === 0} onClick={() => moveTab(d, -1)}><ArrowLeftRight size={14} />Move left</button>
                <button disabled={ordered.indexOf(d) === ordered.length - 1} onClick={() => moveTab(d, 1)}><ArrowLeftRight size={14} />Move right</button>
                {ordered.length > 1 && <button style={{ color: 'var(--danger)' }} onClick={() => { if (confirm(`Delete dashboard "${d.name}"?`)) { dash.remove(d.id); setCur(null) } }}><Trash2 size={14} />Delete dashboard</button>}
              </Menu></span>}</a>))}
            {ordered.length > 4 && <Menu trigger={<a className={ordered.slice(4).some((d) => d.id === board?.id) ? 'active' : ''}>More…</a>}>{ordered.slice(4).map((d) => <button key={d.id} onClick={() => setCur(d.id)}>{d.name}</button>)}</Menu>}
            <a title="Add dashboard" onClick={() => setTabForm({})}><Plus size={15} /></a></nav>
          <span style={{ flex: 1 }} />
          <div style={{ paddingBottom: 8, display: 'flex', gap: 6 }}>
            {extraActions}
            <button className={compact ? 'btn outline-accent' : 'btn primary'} onClick={() => setPicker(true)}><Plus size={15} />Add widget</button>
            <Menu trigger={<button className="icon-btn" title="Dashboard options"><MoreVertical size={16} /></button>}>
              {board && <button onClick={() => setTabForm(board)}><Pencil size={14} />Rename</button>}
              {board && <button onClick={duplicateBoard}><Copy size={14} />Duplicate</button>}
              {board && <button onClick={() => save((defaults || (scope === 'home' ? DEFAULT : MYWORK)).map((k) => mk(k, projectId)))}><RotateCcw size={14} />Reset widgets</button>}
              {board && dash.rows.length > 1 && <button style={{ color: 'var(--danger)' }} onClick={() => { if (confirm(`Delete dashboard "${board.name}"?`)) { dash.remove(board.id); setCur(null) } }}><Trash2 size={14} />Delete dashboard</button>}
            </Menu>
          </div>
        </div>
      </div>
      <div className={compact ? '' : 'tw-body'} style={compact ? { paddingTop: 14, display: hideBody ? 'none' : undefined } : undefined}>
        {!data || !board ? <div className="muted">Loading…</div> : !widgets.length ? (
          <div className="kit-empty"><b>This dashboard is empty</b><span>Add widgets to build your view.</span><button className="btn primary" onClick={() => setPicker(true)}><Plus size={15} />Add widget</button></div>) : (
          <div className="dash-grid">{widgets.map((w) => <Widget key={w.id} w={w} data={data} range={range} setRange={setRange}
            dragProps={{ draggable: true, onDragStart: () => setDrag(w.id), onDragOver: (e) => e.preventDefault(), onDrop: () => drop(w.id) }}
            onChange={(p) => patch(w.id, p)} onRemove={() => save(widgets.filter((x) => x.id !== w.id))}
            onDuplicate={() => { const i = widgets.findIndex((x) => x.id === w.id); const c = [...widgets]; c.splice(i + 1, 0, { ...w, id: mk(w.key).id }); save(c) }} />)}</div>)}
      </div>
      {picker && <Library have={widgets.map((w) => w.key)} onClose={() => setPicker(false)} onAdd={(k) => { save([...widgets, mk(k, projectId)]); notify(`${WIDGETS[k].name} added`) }} />}
      {tabForm && <FormModal title={tabForm.id ? 'Rename dashboard' : 'Add dashboard'} initial={tabForm} onClose={() => setTabForm(null)}
        onSubmit={async (v) => { if (tabForm.id) await dash.update(tabForm.id, { name: v.name }); else { const d = await dash.create({ scope, name: v.name, widgets: [] }); setCur(d.id) } }}
        fields={[{ key: 'name', label: 'Dashboard name', required: true, autoFocus: true }]} />}
    </div>
  )
}

export default function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return <Dashboard scope="home" header={<div style={{ paddingTop: 4 }}>
    <div className="row"><div className="muted small">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div><span style={{ flex: 1 }} /><button className="tb-btn" onClick={() => navigate('/inbox')}><MessageSquare size={13} />Feedback</button></div>
    <h1 style={{ fontSize: 24, paddingBottom: 6 }}>{greet}, {user.name.split(' ')[0]}</h1></div>} />
}
