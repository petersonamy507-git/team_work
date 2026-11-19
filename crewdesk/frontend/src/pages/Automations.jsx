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
import AutomationBuilder from '../components/AutomationBuilder'

const TRIG_ICON = { assignee_added: User, progress_exceeds: Percent, every_day: CalendarClock, task_created: Plus, task_completed: CircleCheck, stage_changed: Columns3, tag_added: Tag, time_logged: Clock, time_exceeds: Clock,
  assignee_changed: User, due_arrives: CalendarDays, due_changed: CalendarDays, progress_changed: Percent, priority_changed: Flag, comment_added: MessageSquare }
const ACT_ICON = { notify: Bell, assign: User, add_tag: Tag, set_priority: Flag, move_list: ListChecks, copy_list: Copy, add_task: Plus, add_subtask: GitBranch,
  complete: CircleCheck, set_due: CalendarClock, set_start: CalendarClock, set_progress: Percent, add_comment: MessageCircle, add_followers: Eye,
  set_estimate: Hourglass, set_status: Columns3, log_time: Clock }
const CATS = [
  ['featured', 'Featured', Rocket, null], ['create', 'Create', Plus, ['task_created']], ['stages', 'Stages', Columns3, ['stage_changed', 'task_completed']],
  ['tags', 'Tags', Tag, ['tag_added']], ['time', 'Time', Clock, ['time_exceeds', 'time_logged']], ['assignees', 'Assignees', User, ['assignee_added']],
  ['dates', 'Dates', CalendarDays, ['due_changed', 'due_arrives']], ['progress', 'Progress', Percent, ['progress_exceeds']],
  ['priority', 'Priority', Flag, ['priority_changed']], ['comments', 'Comments', MessageSquare, ['comment_added']],
]
const FEATURED = [['due_arrives', 'notify'], ['time_logged', 'notify'], ['task_created', 'assign'], ['tag_added', 'move_list'], ['task_completed', 'add_task'], ['due_arrives', 'set_priority'], ['task_completed', 'log_time']]
const SKIP = { task_completed: ['complete'], due_changed: ['set_due'], due_arrives: ['set_due'], tag_added: [], priority_changed: ['set_priority'], progress_exceeds: ['set_progress'], stage_changed: [], assignee_added: [] }
const TPL_ACTIONS = ['notify', 'assign', 'add_tag', 'set_priority', 'move_list', 'copy_list', 'add_task', 'add_subtask', 'complete', 'set_due', 'set_start', 'set_progress', 'add_comment', 'add_followers', 'set_estimate', 'set_status', 'log_time']

function Card({ t, a, meta, onClick }) {
  const TI = TRIG_ICON[t] || Plus; const AI = ACT_ICON[a] || Bell
  return (
    <button className="auto-card" onClick={onClick}>
      <span className="row" style={{ gap: 8 }}><span className="auto-ic in"><TI size={15} /></span><ArrowRight size={14} className="muted" /><span className="auto-ic out"><AI size={15} /></span></span>
      <span>When <b>{meta.triggers[t]}</b>, <b>{meta.actions[a]}</b></span>
    </button>
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
    CATS.slice(1).forEach(([k, , , trigs]) => { out[k] = trigs.flatMap((t) => TPL_ACTIONS.filter((a) => !(SKIP[t] || []).includes(a)).map((a) => [t, a])) })
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
            <a style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setBuild({ trigger: 'due_arrives', config: { trigger_cfg: { at: '09:00' }, projects: 'all', actions: [{ type: 'notify', cfg: { people_mode: 'selected', people: [user.id], title: 'Due today: {Task name}', message: '{Task name} in {Task project} is due today' } }] } })}><Plus size={13} /> Create custom automation</a></div>}
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
              <div style={{ flex: 1 }}><b>{r.name}</b><div className="muted small">When {meta.triggers[r.trigger] || r.trigger}{r.trigger_value ? ` (${r.trigger_value})` : ''}{r.config?.conditions?.length ? ' and condition is true' : ''}, {(r.config?.actions?.length ? r.config.actions.map((x) => meta.actions[x.type] || x.type).join(', ') : meta.actions[r.action] || r.action)} · {Array.isArray(r.config?.projects) ? `${r.config.projects.length} project${r.config.projects.length === 1 ? '' : 's'}` : r.project_name || 'All projects'}{r.description ? ` · ${r.description}` : ''} · ran {r.run_count} times{r.last_run_at ? `, last ${timeAgo(r.last_run_at)}` : ''}</div></div>
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
      {build && <AutomationBuilder initial={build} meta={meta} onClose={() => setBuild(null)} onSaved={() => { autos.reload(); setTab('manage') }} />}
    </div>
  )
}
