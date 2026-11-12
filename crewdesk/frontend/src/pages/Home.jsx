// Home (Teamwork /app/home): greeting, dashboard tabs (+), Add widget library, widget menus (filter, rename, duplicate, delete)
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, MoreVertical, Trash2, Pencil, MessageSquare, Copy, Filter, Search, X, RotateCcw, GripVertical } from 'lucide-react'
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

function Library({ have, onAdd, onClose }) {
  const [cat, setCat] = useState(CATEGORIES[0])
  const [q, setQ] = useState('')
  const list = Object.entries(WIDGETS).filter(([, w]) => (q ? (w.name + w.text).toLowerCase().includes(q.toLowerCase()) : w.cat === cat))
  return (
    <Modal wide title="Add widget" onClose={onClose}>
      <div style={{ display: 'flex', gap: 16, minHeight: 420 }}>
        <div style={{ width: 170, flexShrink: 0 }} className="proj-cats"><div className="muted small" style={{ padding: '0 8px 6px' }}>Categories</div>
          {CATEGORIES.map((c) => <button key={c} className={!q && cat === c ? 'on' : ''} onClick={() => { setQ(''); setCat(c) }}>{c}</button>)}</div>
        <div style={{ flex: 1 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}><b>Widget library</b><label className="kit-search"><Search size={14} /><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />{q && <X size={13} onClick={() => setQ('')} />}</label></div>
          <div className="muted small" style={{ marginBottom: 8 }}>{q ? 'Search results' : cat}</div>
          <div className="widget-picker" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>{list.map(([k, w]) => (
            <button key={k} onClick={() => onAdd(k)}><b>{w.name}{have.includes(k) && <span className="kit-pill blue" style={{ marginLeft: 6, fontSize: 9 }}>ADDED</span>}</b><span>{w.text}</span><span style={{ color: 'var(--accent)', marginTop: 4 }}>+ Add</span></button>))}</div>
        </div>
      </div>
    </Modal>
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
  const board = dash.rows?.find((d) => d.id === cur) || dash.rows?.[0]
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
          <nav className="tw-tabs">{(dash.rows || []).map((d) => <a key={d.id} className={board?.id === d.id ? 'active' : ''} onClick={() => setCur(d.id)} onDoubleClick={() => setTabForm(d)}>{d.name}</a>)}
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
