// Automations (Teamwork /app/automations): Templates (categories + "When … , Then …" cards), Manage, Usage, Create automation
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Rocket, Plus, Columns3, Tag, Clock, User, CalendarDays, Percent, Flag, MessageSquare, Bell, ListChecks, Copy, CircleCheck,
  CalendarClock, Eye, Hourglass, GitBranch, MessageCircle, Search, X, Bot, Trash2, Pencil, MoreVertical, ArrowRight, Play,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useData, useUi } from '../lib/ui-context'
import { timeAgo } from '../lib/format'
import { Menu, Modal } from '../components/ui'
import { EmptyState, Pill, useRows } from '../components/Kit'

const TRIG_ICON = { task_created: Plus, task_completed: CircleCheck, stage_changed: Columns3, tag_added: Tag, time_logged: Clock, time_exceeds: Clock,
  assignee_changed: User, due_arrives: CalendarDays, due_changed: CalendarDays, progress_changed: Percent, priority_changed: Flag, comment_added: MessageSquare }
const ACT_ICON = { notify: Bell, assign: User, add_tag: Tag, set_priority: Flag, move_list: ListChecks, copy_list: Copy, add_task: Plus, add_subtask: GitBranch,
  complete: CircleCheck, set_due: CalendarClock, set_start: CalendarClock, set_progress: Percent, add_comment: MessageCircle, add_followers: Eye,
  set_estimate: Hourglass, set_status: Columns3, log_time: Clock }
const CATS = [
  ['featured', 'Featured', Rocket, null], ['create', 'Create', Plus, ['task_created']], ['stages', 'Stages', Columns3, ['stage_changed', 'task_completed']],
  ['tags', 'Tags', Tag, ['tag_added']], ['time', 'Time', Clock, ['time_exceeds', 'time_logged']], ['assignees', 'Assignees', User, ['assignee_changed']],
  ['dates', 'Dates', CalendarDays, ['due_changed', 'due_arrives']], ['progress', 'Progress', Percent, ['progress_changed']],
  ['priority', 'Priority', Flag, ['priority_changed']], ['comments', 'Comments', MessageSquare, ['comment_added']],
]
const FEATURED = [['due_arrives', 'notify'], ['time_logged', 'notify'], ['task_created', 'assign'], ['tag_added', 'move_list'], ['task_completed', 'add_task'], ['due_arrives', 'set_priority'], ['task_completed', 'log_time']]
const SKIP = { task_completed: ['complete'], due_changed: ['set_due'], due_arrives: ['set_due'], tag_added: [], priority_changed: ['set_priority'], progress_changed: ['set_progress'], stage_changed: [], assignee_changed: [] }
const STAGES = [['backlog', 'Backlog'], ['new', 'To do'], ['in_progress', 'In progress'], ['completed', 'Completed']]
const PRIOS = [['high', 'High'], ['medium', 'Medium'], ['low', 'Low'], ['none', 'None']]

function Card({ t, a, meta, onClick }) {
  const TI = TRIG_ICON[t] || Plus; const AI = ACT_ICON[a] || Bell
  return (
    <button className="auto-card" onClick={onClick}>
      <span className="row" style={{ gap: 8 }}><span className="auto-ic in"><TI size={15} /></span><ArrowRight size={14} className="muted" /><span className="auto-ic out"><AI size={15} /></span></span>
      <span>When <b>{meta.triggers[t]}</b>, <b>{meta.actions[a]}</b></span>
    </button>
  )
}

function Builder({ initial, meta, onClose, onSaved }) {
  const { people, projects, notify } = useUi()
  const [f, setF] = useState(() => ({ name: '', project_id: '', trigger: 'task_created', trigger_value: '', action: 'notify', action_value: '', is_active: true, ...initial }))
  const [lists, setLists] = useState([])
  useEffect(() => { const pid = f.project_id || projects[0]?.id; if (pid) api.get(`/projects/${pid}/tasklists`).then((r) => setLists(r.tasklists || r)).catch(() => {}) }, [f.project_id, projects])
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const ids = (f.action_value || '').split(',').filter(Boolean).map(Number)
  const toggleId = (id) => set('action_value', (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]).join(','))
  const autoName = `When ${meta.triggers[f.trigger]}${f.trigger_value ? ` (${f.trigger_value})` : ''}, ${meta.actions[f.action]}`
  const save = async () => {
    const body = { ...f, name: f.name.trim() || autoName, project_id: f.project_id || null }
    if (['notify', 'assign', 'add_followers'].includes(f.action) && f.action !== 'notify' && !ids.length) return notify('Choose at least one person')
    if (['move_list', 'copy_list', 'set_priority', 'set_status'].includes(f.action) && !f.action_value) return notify('Choose a value for the action')
    f.id ? await api.patch(`/r/automations/${f.id}`, body) : await api.post('/r/automations', body)
    notify(f.id ? 'Automation updated' : 'Automation created'); onSaved(); onClose()
  }
  const valueInput = () => {
    switch (f.action) {
      case 'notify': case 'assign': case 'add_followers':
        return <div className="kit-people">{people.filter((p) => p.is_active !== false).map((p) => <label key={p.id} className={ids.includes(p.id) ? 'on' : ''}><input type="checkbox" checked={ids.includes(p.id)} onChange={() => toggleId(p.id)} />{p.name}</label>)}
          {f.action === 'notify' && <div className="muted small" style={{ width: '100%' }}>Leave empty to notify the task's assignee.</div>}</div>
      case 'add_tag': return <input className="input" placeholder="Tag name (comma separate several)" value={f.action_value} onChange={(e) => set('action_value', e.target.value)} />
      case 'set_priority': return <select className="input" value={f.action_value} onChange={(e) => set('action_value', e.target.value)}><option value="">Choose priority</option>{PRIOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      case 'set_status': return <select className="input" value={f.action_value} onChange={(e) => set('action_value', e.target.value)}><option value="">Choose stage</option>{STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      case 'move_list': case 'copy_list': return <select className="input" value={f.action_value} onChange={(e) => set('action_value', e.target.value)}><option value="">Choose task list</option>{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
      case 'add_task': case 'add_subtask': return <input className="input" placeholder="Task name" value={f.action_value} onChange={(e) => set('action_value', e.target.value)} />
      case 'add_comment': return <textarea className="input" rows={3} placeholder="Comment text" value={f.action_value} onChange={(e) => set('action_value', e.target.value)} />
      case 'set_due': case 'set_start': return <span className="row" style={{ gap: 8 }}><input className="input" type="number" style={{ width: 100 }} value={f.action_value} onChange={(e) => set('action_value', e.target.value)} /><span className="muted small">days from the day it runs</span></span>
      case 'set_progress': return <span className="row" style={{ gap: 8 }}><input className="input" type="number" min="0" max="100" style={{ width: 100 }} value={f.action_value} onChange={(e) => set('action_value', e.target.value)} /><span className="muted small">%</span></span>
      case 'set_estimate': case 'log_time': return <span className="row" style={{ gap: 8 }}><input className="input" type="number" min="1" style={{ width: 100 }} value={f.action_value} onChange={(e) => set('action_value', e.target.value)} /><span className="muted small">minutes</span></span>
      default: return <span className="muted small">No settings needed.</span>
    }
  }
  const triggerValue = () => {
    if (f.trigger === 'stage_changed') return <select className="input" value={f.trigger_value} onChange={(e) => set('trigger_value', e.target.value)}><option value="">Any stage</option>{STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    if (f.trigger === 'priority_changed') return <select className="input" value={f.trigger_value} onChange={(e) => set('trigger_value', e.target.value)}><option value="">Any priority</option>{PRIOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    if (f.trigger === 'tag_added') return <input className="input" placeholder="Any tag (or type a tag name)" value={f.trigger_value} onChange={(e) => set('trigger_value', e.target.value)} />
    return null
  }
  return (
    <Modal wide title={f.id ? 'Edit automation' : 'Create automation'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>{f.id ? 'Save automation' : 'Create automation'}</button></>}>
      <div className="auto-build">
        <div className="field"><label>Name</label><input className="input" placeholder={autoName} value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="field"><label>Where</label><select className="input" value={f.project_id || ''} onChange={(e) => set('project_id', e.target.value ? Number(e.target.value) : '')}><option value="">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="auto-step"><span className="auto-ic in"><Play size={14} /></span><b>When</b>
          <select className="input" value={f.trigger} onChange={(e) => setF({ ...f, trigger: e.target.value, trigger_value: '' })}>{Object.entries(meta.triggers).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>{triggerValue()}</div>
        <div className="auto-step"><span className="auto-ic out"><Bot size={14} /></span><b>Then</b>
          <select className="input" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value, action_value: '' })}>{Object.entries(meta.actions).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div style={{ paddingLeft: 40 }}>{valueInput()}</div>
        <label className="kit-check" style={{ marginTop: 12 }}><input type="checkbox" checked={!!f.is_active} onChange={(e) => set('is_active', e.target.checked)} />Turn on now</label>
      </div>
    </Modal>
  )
}

export default function Automations() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { notify } = useUi()
  const { data: meta } = useData('/automations/meta')
  const autos = useRows('automations')
  const { data: usage, reload: reloadUsage } = useData('/automations/usage')
  const [tab, setTab] = useState('templates')
  const [cat, setCat] = useState('featured')
  const [q, setQ] = useState('')
  const [build, setBuild] = useState(null)
  const combos = useMemo(() => {
    if (!meta) return {}
    const out = { featured: FEATURED }
    CATS.slice(1).forEach(([k, , , trigs]) => { out[k] = trigs.flatMap((t) => Object.keys(meta.actions).filter((a) => !(SKIP[t] || []).includes(a)).map((a) => [t, a])) })
    return out
  }, [meta])
  if (!meta) return <div className="page">Loading…</div>
  const label = ([t, a]) => `When ${meta.triggers[t]}, ${meta.actions[a]}`.toLowerCase()
  const shownCats = CATS.filter(([k]) => !q || combos[k].some((c) => label(c).includes(q.toLowerCase())))
  const first = user.name.split(' ')[0]
  return (
    <div className="auto-shell">
      <div className="auto-head">
        <h2>Automations</h2>
        <nav className="tw-tabs" style={{ margin: '0 auto' }}>{[['templates', 'Templates'], ['manage', `Manage${autos.rows?.length ? ` (${autos.rows.length})` : ''}`], ['usage', 'Usage']].map(([k, l]) => <a key={k} className={tab === k ? 'active' : ''} onClick={() => { setTab(k); if (k === 'usage') reloadUsage(); if (k === 'manage') autos.reload() }}>{l}</a>)}</nav>
        <button className="icon-btn" title="Close" onClick={() => navigate(-1)}><X size={18} /></button>
      </div>
      {tab === 'templates' && <div className="auto-body">
        <div className="auto-cats"><div className="muted small" style={{ fontWeight: 700, margin: '4px 8px 8px', color: 'var(--text)' }}>Categories</div>
          {CATS.map(([k, l, I]) => <button key={k} className={cat === k ? 'on' : ''} onClick={() => { setCat(k); document.getElementById(`cat-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}><I size={16} />{l}</button>)}</div>
        <div className="auto-main">
          <div className="tw-toolbar" style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 2, paddingBottom: 8 }}><span className="spacer" />
            <label className="kit-search" style={{ border: '1px solid #cfd3e0', borderRadius: 9999, width: 240 }}><Search size={14} /><input placeholder="Search templates" value={q} onChange={(e) => setQ(e.target.value)} /></label>
            <button className="btn primary" onClick={() => setBuild({})}><Plus size={15} />Create automation</button></div>
          {!q && <div className="auto-banner"><Bot size={22} /><div style={{ fontSize: 18 }}>When <b>Due date arrives</b>, notify <b>{first}</b> via inbox</div>
            <a style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setBuild({ trigger: 'due_arrives', action: 'notify', action_value: String(user.id) })}><Plus size={13} /> Create custom automation</a></div>}
          {shownCats.map(([k, l, I]) => (
            <div key={k} id={`cat-${k}`} style={{ marginTop: 22 }}>
              <h3 className="row" style={{ gap: 8, fontSize: 18, marginBottom: 12 }}><I size={18} />{l}</h3>
              <div className="auto-grid">{combos[k].filter((c) => !q || label(c).includes(q.toLowerCase())).map(([t, a]) => <Card key={t + a} t={t} a={a} meta={meta} onClick={() => setBuild({ trigger: t, action: a })} />)}</div>
            </div>))}
        </div>
      </div>}
      {tab === 'manage' && <div className="auto-pad">
        <div className="tw-toolbar"><h3>Your automations</h3><span className="spacer" /><button className="btn primary" onClick={() => setBuild({})}><Plus size={15} />Create automation</button></div>
        {autos.rows && !autos.rows.length && <EmptyState icon={Bot} title="No automations yet" text="Pick a template or create your own to put busywork on autopilot." action={<button className="btn primary" onClick={() => setTab('templates')}>Browse templates</button>} />}
        {(autos.rows || []).map((r) => { const TI = TRIG_ICON[r.trigger] || Plus; const AI = ACT_ICON[r.action] || Bell
          return (
            <div key={r.id} className="int-card">
              <span className="row" style={{ gap: 6 }}><span className="auto-ic in"><TI size={15} /></span><ArrowRight size={13} className="muted" /><span className="auto-ic out"><AI size={15} /></span></span>
              <div style={{ flex: 1 }}><b>{r.name}</b><div className="muted small">When {meta.triggers[r.trigger] || r.trigger}{r.trigger_value ? ` (${r.trigger_value})` : ''}, {meta.actions[r.action] || r.action} · {r.project_name || 'All projects'} · ran {r.run_count} times{r.last_run_at ? `, last ${timeAgo(r.last_run_at)}` : ''}</div></div>
              <label className="switch" title={r.is_active ? 'On' : 'Off'}><input type="checkbox" checked={r.is_active} onChange={() => autos.update(r.id, { is_active: !r.is_active })} /><i /></label>
              <Menu trigger={<button className="icon-btn"><MoreVertical size={16} /></button>}>
                <button onClick={() => setBuild(r)}><Pencil size={14} />Edit</button>
                <button onClick={async () => { await api.post('/r/automations', { ...r, id: undefined, name: `${r.name} (copy)`, run_count: 0 }); autos.reload() }}><Copy size={14} />Duplicate</button>
                <button style={{ color: 'var(--danger)' }} onClick={() => confirm(`Delete "${r.name}"?`) && autos.remove(r.id)}><Trash2 size={14} />Delete</button>
              </Menu>
            </div>) })}
      </div>}
      {tab === 'usage' && <div className="auto-pad">
        <div className="dash-grid" style={{ marginBottom: 16 }}>
          {[['Runs this month', usage?.this_month], ['Runs in total', usage?.total], ['Active automations', usage?.active]].map(([l, v]) => <div key={l} className="widget" style={{ minHeight: 0 }}><span className="muted small">{l}</span><b style={{ fontSize: 26 }}>{v ?? '—'}</b></div>)}
        </div>
        <div className="tw-toolbar"><h3>Recent runs</h3><span className="spacer" /><button className="btn" onClick={async () => { await api.post('/automations/run-due'); reloadUsage(); notify('Checked due dates') }}>Check due dates now</button></div>
        {usage && !usage.runs.length && <EmptyState icon={Bot} title="No runs yet" text="Runs appear here each time an automation fires." />}
        {(usage?.runs || []).map((r) => <div key={r.id} className="twrow small"><Bot size={14} className="muted" /><b>{r.automation}</b><span className="muted">on</span><span>{r.task || '—'}</span><Pill>{r.result}</Pill><span className="muted row-end">{timeAgo(r.created_at)}</span></div>)}
      </div>}
      {build && <Builder initial={build} meta={meta} onClose={() => setBuild(null)} onSaved={() => { autos.reload(); setTab('manage') }} />}
    </div>
  )
}
