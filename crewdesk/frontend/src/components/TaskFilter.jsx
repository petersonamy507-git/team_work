import { useEffect, useState } from 'react'
import { ChevronDown, Check, Filter, Bookmark, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import { useUi } from '../lib/ui-context'
import { PRIORITY } from '../lib/format'
import { EMPTY_FILTERS, DUE_OPTIONS, activeFilterCount, withFilters } from '../lib/taskFilters'
import { Avatar } from './ui'
import { Popover, STATUS, useAllTags } from './TaskPickers'

function MultiDrop({ label, options, value, onChange, search = true }) {
  const [q, setQ] = useState('')
  const shown = options.filter((o) => String(o.label).toLowerCase().includes(q.toLowerCase()))
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  return (
    <Popover width={230} trigger={<button type="button" className={`fdrop ${value.length ? 'on' : ''}`}>{label}{value.length > 0 && <span className="n">{value.length}</span>}<ChevronDown size={14} /></button>}>
      {search && options.length > 6 && <input className="input sm" autoFocus placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />}
      <div className="pop-list">
        {shown.map((o) => (
          <button type="button" key={o.value} className="pop-item" onClick={() => toggle(String(o.value))}>
            {o.icon}{o.label}{value.includes(String(o.value)) && <Check size={14} className="ok" />}
          </button>
        ))}
        {!shown.length && <div className="muted small" style={{ padding: 8 }}>Nothing to pick</div>}
      </div>
    </Popover>
  )
}

function DueDrop({ f, setF }) {
  const label = DUE_OPTIONS.find((o) => o[0] === f.due)?.[1]
  return (
    <Popover width={240} trigger={<button type="button" className={`fdrop ${f.due || f.due_from || f.due_to ? 'on' : ''}`}>{f.due ? label : 'Due date'}<ChevronDown size={14} /></button>}>
      {(close) => <>
        {DUE_OPTIONS.map(([k, l]) => (
          <button type="button" key={k} className="pop-item" onClick={() => { setF({ due: k, ...(k !== 'custom' ? { due_from: '', due_to: '' } : {}) }); if (k !== 'custom') close() }}>
            {l}{f.due === k && <Check size={14} className="ok" />}
          </button>
        ))}
        {f.due === 'custom' && (
          <div className="row" style={{ gap: 6, padding: 6 }}>
            <input type="date" className="input sm" value={f.due_from} onChange={(e) => setF({ due_from: e.target.value })} />
            <input type="date" className="input sm" value={f.due_to} onChange={(e) => setF({ due_to: e.target.value })} />
          </div>
        )}
      </>}
    </Popover>
  )
}

function SavedFilters({ f, onApply }) {
  const [views, setViews] = useState([])
  const load = () => api.get('/task-views').then(setViews).catch(() => {})
  useEffect(() => { load() }, [])
  const del = async (e, v) => { e.stopPropagation(); if (confirm(`Delete saved filter "${v.name}"?`)) { await api.del(`/task-views/${v.id}`); load() } }
  return (
    <Popover width={240} trigger={<button type="button" className="btn sm outline-accent"><Bookmark size={14} />Saved filters</button>}>
      {(close) => views.length ? views.map((v) => (
        <button type="button" key={v.id} className="pop-item" onClick={() => { onApply(withFilters(v.config.filters || v.config)); close() }}>
          <Bookmark size={14} /><span className="ellipsis" style={{ flex: 1 }}>{v.name}</span><Trash2 size={13} className="muted" onClick={(e) => del(e, v)} />
        </button>
      )) : <div className="muted small" style={{ padding: 8 }}>No saved filters yet. Set some filters and press Save filter.</div>}
    </Popover>
  )
}

/**
 * Teamwork-style filter popover: dropdown pickers, quick filters, option checkboxes,
 * saved filters, clear all and save filter.
 */
export default function TaskFilter({ f, setF, variant = 'tasks', align = 'right' }) {
  const { people, projects, notify } = useUi()
  const tags = useAllTags()
  const [clients, setClients] = useState([])
  useEffect(() => { api.get('/clients').then(setClients).catch(() => {}) }, [])
  const n = activeFilterCount(f)
  const set = (patch) => setF({ ...f, ...patch })
  const peopleOpts = people.map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size={18} /> }))
  const save = async () => {
    const name = prompt('Name this filter')
    if (!name?.trim()) return
    await api.post('/task-views', { name: name.trim(), config: { filters: f } })
    notify('Filter saved')
  }
  const quick = [
    ['Completed tasks', f.completed === 'only', () => set({ completed: f.completed === 'only' ? '' : 'only' })],
    ['Incomplete + completed tasks', f.completed === 'both', () => set({ completed: f.completed === 'both' ? '' : 'both' })],
    ['Created by me', f.mine, () => set({ mine: !f.mine })],
    ['Late tasks', f.due === 'late', () => set({ due: f.due === 'late' ? '' : 'late' })],
    ['Due this week', f.due === 'thisweek', () => set({ due: f.due === 'thisweek' ? '' : 'thisweek' })],
    ['Due next week', f.due === 'nextweek', () => set({ due: f.due === 'nextweek' ? '' : 'nextweek' })],
  ]
  const checks = [
    ['not_blocked', 'Only show tasks that are not blocked'],
    ...(variant === 'mywork' ? [['started_today', "Include tasks that have started in 'Today' section"], ['no_subtasks', 'Do not show sub-tasks']] : []),
    ['untagged', 'Only show untagged tasks'],
    ['starred', 'Only tasks from starred projects'],
    ['followed', 'Only tasks I follow'],
  ]
  return (
    <Popover align={align} width={440} className="filter-pop" trigger={
      <button className={`tb-btn ${n ? 'on' : ''}`}><Filter size={15} />Filter{n > 0 && <span className="badge">{n}</span>}</button>
    }>
      <div className="fp-title">Filters</div>
      <div className="fdrops">
        <MultiDrop label="Tags" options={tags.map((t) => ({ value: t.name, label: t.name }))} value={f.tags} onChange={(v) => set({ tags: v })} />
        <DueDrop f={f} setF={set} />
        <MultiDrop label="Priority" search={false} options={['high', 'medium', 'low', 'none'].map((k) => ({ value: k, label: k === 'none' ? 'No priority' : PRIORITY[k].label, icon: <span className="dot" style={{ background: PRIORITY[k].color }} /> }))} value={f.priority} onChange={(v) => set({ priority: v })} />
        <MultiDrop label="Stages" search={false} options={Object.entries(STATUS).map(([k, s]) => ({ value: k, label: s.label, icon: <span className="dot" style={{ background: s.color }} /> }))} value={f.status} onChange={(v) => set({ status: v })} />
        <MultiDrop label="Projects" options={projects.map((p) => ({ value: p.id, label: p.name, icon: <span className="dot" style={{ background: p.color }} /> }))} value={f.project_id} onChange={(v) => set({ project_id: v })} />
        {variant !== 'mywork' && <MultiDrop label="Assignees" options={[{ value: 'me', label: 'Me' }, ...peopleOpts, { value: 'none', label: 'Unassigned' }]} value={f.assignee} onChange={(v) => set({ assignee: v })} />}
        <MultiDrop label="Created By" options={peopleOpts} value={f.created_by} onChange={(v) => set({ created_by: v })} />
        {variant !== 'mywork' && <MultiDrop label="Client" options={clients.map((c) => ({ value: c.id, label: c.name }))} value={f.client_id} onChange={(v) => set({ client_id: v })} />}
        {variant !== 'mywork' && <MultiDrop label="Project owner" options={peopleOpts} value={f.owner_id} onChange={(v) => set({ owner_id: v })} />}
        <MultiDrop label="Exclude tags" options={tags.map((t) => ({ value: t.name, label: t.name }))} value={f.exclude_tags} onChange={(v) => set({ exclude_tags: v })} />
      </div>
      {variant !== 'mywork' && <>
        <div className="fp-sub">Quick filters</div>
        <div className="fquick">{quick.map(([l, on, fn]) => <button type="button" key={l} className={`qf ${on ? 'on' : ''}`} onClick={fn}>{l}</button>)}</div>
      </>}
      <div className="fchecks">
        {checks.map(([k, l]) => <label key={k}><input type="checkbox" checked={!!f[k]} onChange={(e) => set({ [k]: e.target.checked })} />{l}</label>)}
      </div>
      <div className="fp-foot">
        <SavedFilters f={f} onApply={(nf) => setF(nf)} />
        <span style={{ flex: 1 }} />
        <button type="button" className="btn sm ghost" onClick={() => setF({ ...EMPTY_FILTERS })}>Clear all</button>
        <button type="button" className="btn sm primary" onClick={save} disabled={!n}>Save filter</button>
      </div>
    </Popover>
  )
}

/** Small removable chips that summarise the active filters under a toolbar. */
export function ActiveFilters({ f, setF }) {
  const { people, projects } = useUi()
  const name = (id) => (id === 'me' ? 'Me' : id === 'none' ? 'Unassigned' : people.find((u) => String(u.id) === String(id))?.name || id)
  const chips = []
  const multi = (k, label, fmt = (v) => v) => f[k].forEach((v) => chips.push([`${label}: ${fmt(v)}`, () => setF({ ...f, [k]: f[k].filter((x) => x !== v) })]))
  multi('assignee', 'Assignee', name)
  multi('project_id', 'Project', (v) => projects.find((p) => String(p.id) === v)?.name || v)
  multi('priority', 'Priority', (v) => PRIORITY[v]?.label)
  multi('status', 'Stage', (v) => STATUS[v]?.label)
  multi('tags', 'Tag')
  multi('exclude_tags', 'Not tagged')
  multi('created_by', 'Created by', name)
  multi('owner_id', 'Project owner', name)
  multi('client_id', 'Client')
  if (f.due && f.due !== 'custom') chips.push([`Due: ${DUE_OPTIONS.find((o) => o[0] === f.due)?.[1]}`, () => setF({ ...f, due: '' })])
  if (f.due_from || f.due_to) chips.push([`Due ${f.due_from || '…'} – ${f.due_to || '…'}`, () => setF({ ...f, due: '', due_from: '', due_to: '' })])
  if (f.completed) chips.push([f.completed === 'only' ? 'Completed tasks' : 'Incomplete + completed', () => setF({ ...f, completed: '' })])
  const flags = { mine: 'Created by me', not_blocked: 'Not blocked', untagged: 'Untagged', starred: 'Starred projects', followed: 'Following', started_today: 'Started tasks in Today', no_subtasks: 'No sub-tasks' }
  Object.entries(flags).forEach(([k, l]) => f[k] && chips.push([l, () => setF({ ...f, [k]: false })]))
  if (!chips.length) return null
  return (
    <div className="filter-chips">
      {chips.map(([l, rm], i) => <span key={i} className="fchip">{l}<X size={12} onClick={rm} /></span>)}
      <button className="btn sm ghost" onClick={() => setF({ ...EMPTY_FILTERS })}>Clear all</button>
    </div>
  )
}
