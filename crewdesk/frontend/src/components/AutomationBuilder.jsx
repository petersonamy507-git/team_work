// Create automation (Teamwork /app/automations/new): "When this happens" card -> "Then perform this action" card(s),
// trigger settings, project scope, conditions, multiple actions and the "Automation summary" footer.
// Rules are saved to /api/r/automations with everything in `config` (see backend app/automation_engine.py).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  X, ArrowRight, Zap, ChevronDown, Search, Check, Plus, Trash2, Info, AlertTriangle, Flag, User, Users, Tag as TagIcon,
  CalendarDays, Clock, Columns3, ListChecks, MessageSquare, Eye, Copy, CircleCheck, Hourglass, Percent, Bell, Globe,
  Hash, Slack, Milestone, FolderPlus, Pencil, Type, RotateCcw, GitBranch, LayoutTemplate, FileText, Paperclip,
  UserPlus, UserMinus, Timer, Repeat, Building2, Briefcase, Unlock,
} from 'lucide-react'
import { api } from '../lib/api'
import { useUi } from '../lib/ui-context'
import '../automation-builder.css'

// ------------------------------------------------------------------ static option lists (Teamwork's wording)
const PRIOS = [['none', 'None', '#8b93a7'], ['low', 'Low', '#2fa36b'], ['medium', 'Medium', '#e8a317'], ['high', 'High', '#d9363e']]
const STATUSES = [['backlog', 'Backlog'], ['new', 'To do'], ['in_progress', 'In progress'], ['completed', 'Completed']]
const TAG_COLORS = ['#d9363e', '#f08c2e', '#e8b417', '#9bc53d', '#2fa36b', '#2bb3b1', '#3a7bd5', '#8e6bd8', '#d85ca8', '#9aa1b2', '#1f2433', '#9b6a4b']
const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']]
const SET_OPS = [['any_of', 'is any of'], ['all_of', 'is all of'], ['not_any_of', 'is not any of'], ['not_all_of', 'is not all of'], ['set', 'is set'], ['not_set', 'is not set']]
const NUM_OPS = [['eq', 'is equal to'], ['ne', 'is not equal to'], ['lt', 'is less than'], ['gt', 'is greater than'], ['le', 'is less than or equal to'], ['ge', 'is greater than or equal to'], ['set', 'is set'], ['not_set', 'is not set']]
const COND_FIELDS = [
  ['assignee', 'Assignee', 'people', SET_OPS], ['priority', 'Priority', 'prio', SET_OPS], ['tag', 'Tag', 'tags', SET_OPS],
  ['progress', 'Progress', 'percent', NUM_OPS], ['time_estimate', 'Time estimate', 'minutes', NUM_OPS],
  ['logged_time', 'Logged time', 'minutes', [...NUM_OPS.slice(0, 6), ['added', 'is added']]], ['follower', 'Follower', 'people', SET_OPS],
  ['trigger_user', 'Trigger user', 'people', [['any_of', 'is any of'], ['not_any_of', 'is not any of']]],
  ['task_list', 'Task list', 'tasklists', [['any_of', 'is any of'], ['not_any_of', 'is not any of']]],
  ['start_date', 'Start date', 'date', NUM_OPS.slice(0, 7)], ['due_date', 'Due date', 'date', NUM_OPS.slice(0, 7)],
  ['stage', 'Stage', 'stages', [['any_of', 'is any of'], ['not_any_of', 'is not any of'], ['set', 'is set'], ['not_set', 'is not set']]],
  ['task_name', 'Task name', 'contains', null], ['task_description', 'Task description', 'contains', null],
  ['project_name', 'Project name', 'contains', null], ['is_blocked', 'Is blocked', 'bool', null], ['is_completed', 'Is completed', 'bool', null],
  ['is_subtask', 'Is subtask', 'bool', null], ['has_desk_tickets', 'Has Desk tickets', 'bool', null], ['has_reminders', 'Has reminders', 'bool', null],
  ['created_by', 'Created by', 'person', [['eq', 'is equal to'], ['ne', 'is not equal to']]], ['tasklist_name', 'Task list name', 'contains', null],
  ['comments', 'Comments', 'comments', [['any_contains', 'any contains text'], ['last_contains', 'last contains text'], ['has_any', 'has any comments'], ['has_none', 'has no comments'], ['more_than', 'has more than'], ['less_than', 'has less than'], ['from', 'has comments from']]],
  ['attachments', 'Attachments', 'attachments', [['name_contains', 'any name contains text'], ['has_any', 'has any attachments'], ['has_none', 'has no attachments'], ['more_than', 'has more than'], ['less_than', 'has less than']]],
  ['custom_field', 'Custom field', 'custom', [['eq', 'is equal to'], ['contains', 'contains'], ['set', 'is set'], ['not_set', 'is not set']]],
]
const PEOPLE_MODES = [['selected', 'Select people'], ['trigger_user', 'User who completed trigger'], ['project_owner', 'Project owner'], ['task_creator', 'Task creator']]
const NOTIFY_MODES = [['selected', 'Selected people'], ['project_owner', 'Project owner'], ['task_assignees', 'Task assignees'], ['task_followers', 'Task followers'], ['task_creator', 'Task creator'], ['trigger_user', 'User who completed trigger']]
const DATE_MODES = [['days_after', 'Days after trigger date'], ['on_trigger', 'On trigger date'], ['choose', 'Choose date'], ['remove', 'Remove date'], ['from_start', 'Start date - from the task'], ['from_due', 'Due date - from the task']]
const TRIG_ICONS = {
  task_created: Plus, task_completed: CircleCheck, stage_changed: Columns3, list_changed: ListChecks, task_inactive: Timer,
  due_arrives: CalendarDays, start_arrives: CalendarDays, due_changed: CalendarDays, start_changed: CalendarDays, name_changed: Type,
  task_updated: Pencil, description_changed: FileText, task_unblocked: Unlock, tag_added: TagIcon, tag_removed: TagIcon,
  custom_field_changed: Hash, estimate_exceeds: Hourglass, time_exceeds: Clock, time_logged: Clock, time_removed: Clock,
  assignee_added: UserPlus, assignee_removed: UserMinus, progress_exceeds: Percent, comment_added: MessageSquare, priority_changed: Flag,
  every_day: Repeat, people_added: UserPlus, people_removed: UserMinus, project_company_changed: Building2, project_owner_changed: User,
}
const ACT_ICONS = {
  add_comment: MessageSquare, add_followers: Eye, assign: User, set_status: Columns3, move_list: ListChecks, copy_list: Copy,
  set_start: CalendarDays, set_due: CalendarDays, add_tag: TagIcon, add_task: Plus, add_subtask: GitBranch, add_from_template: LayoutTemplate,
  complete: CircleCheck, set_estimate: Hourglass, log_time: Clock, set_priority: Flag, set_name: Type, set_description: FileText,
  set_progress: Percent, set_custom_field: Hash, uncomplete: RotateCcw, add_milestone: Milestone, create_project: FolderPlus,
  notify: Bell, http_request: Globe, chat_message: MessageSquare, slack_message: Slack,
}
const DATE_TRIGGERS = ['due_arrives', 'start_arrives', 'milestone_due_arrives', 'project_start_arrives', 'project_end_arrives']
const NO_PROJECT_SCOPE = ['every_day', 'project_added', 'project_portfolio_changed', 'project_updated', 'project_name_changed', 'project_description_changed',
  'project_category_changed', 'project_owner_changed', 'project_company_changed', 'project_confirmed', 'project_completed', 'project_start_arrives',
  'project_end_arrives', 'project_tag_added', 'project_tag_removed', 'people_added', 'people_removed', 'project_start_changed', 'project_end_changed']
const NO_TARGET = ['notify', 'http_request', 'chat_message', 'slack_message', 'create_project', 'add_milestone', 'add_task']
const toMin = (s) => { // "2.5h", "2h 30m", "90m", "1:30" -> minutes
  s = String(s || '').trim().toLowerCase(); if (!s) return 0
  if (/^\d+:\d{1,2}$/.test(s)) { const [h, m] = s.split(':'); return +h * 60 + +m }
  let t = 0; const h = s.match(/([\d.]+)\s*h/); const m = s.match(/([\d.]+)\s*m/)
  if (h) t += parseFloat(h[1]) * 60; if (m) t += parseFloat(m[1]); if (!h && !m && !isNaN(+s)) t = +s * 60
  return Math.round(t)
}
const fmtMin = (m) => { m = +m || 0; if (!m) return ''; const h = Math.floor(m / 60); const r = m % 60; return h && r ? `${h}h ${r}m` : h ? `${h}h` : `${r}m` }
const initials = (n) => (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()

// ------------------------------------------------------------------ small building blocks
function useOutside(ref, open, close) {
  useEffect(() => {
    if (!open) return
    const h = (e) => !ref.current?.contains(e.target) && close()
    const k = (e) => e.key === 'Escape' && (e.stopPropagation(), close())
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k, true)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k, true) }
  }, [open])
}

// popovers are position:fixed so they never get cut off by the scrolling builder body; they flip up near the bottom
function usePop(ref, open, width, alignRight) {
  const [st, setSt] = useState(null)
  useLayoutEffect(() => {
    if (!open) { setSt(null); return }
    const place = () => {
      const r = ref.current?.getBoundingClientRect()
      if (!r) return
      const w = width || Math.max(r.width, 220)
      const vh = window.innerHeight
      const below = vh - r.bottom - 10
      const above = r.top - 10
      const up = below < 240 && above > below
      let left = alignRight ? r.right - w : r.left
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8))
      setSt({ position: 'fixed', left, width: w, right: 'auto', maxHeight: Math.max(140, Math.min(320, up ? above : below)),
        ...(up ? { top: 'auto', bottom: vh - r.top + 4 } : { top: r.bottom + 4 }) })
    }
    place()
    window.addEventListener('scroll', place, true); window.addEventListener('resize', place)
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place) }
  }, [open])
  return st || { position: 'fixed', left: -9999, top: 0, opacity: 0 } // still focusable, so the search box gets autoFocus
}

function Av({ u }) { return <span className="ab-av">{u?.avatar_url ? <img src={u.avatar_url} alt="" /> : initials(u?.name)}</span> }

// Searchable dropdown. options: [{value,label,group,icon,hint,color}]
function Dd({ value, options, onChange, placeholder = 'Select an option', search = true, multi = false, empty = 'No options', render, icon: BtnIcon, footer }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef()
  useOutside(ref, open, () => { setOpen(false); setQ('') })
  const vals = multi ? (value || []) : value
  const shown = options.filter((o) => !q || String(o.label).toLowerCase().includes(q.toLowerCase()))
  const sel = multi ? options.filter((o) => vals.map(String).includes(String(o.value))) : options.find((o) => String(o.value) === String(value))
  let lastGroup = null
  const pick = (o) => {
    if (multi) { const s = vals.map(String); onChange(s.includes(String(o.value)) ? vals.filter((v) => String(v) !== String(o.value)) : [...vals, o.value]) }
    else { onChange(o.value); setOpen(false); setQ('') }
  }
  const SelIcon = !multi && sel?.icon
  const popStyle = usePop(ref, open)
  return (
    <div className="ab-dd" ref={ref}>
      <button type="button" className={`ab-dd-btn ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
        {BtnIcon && <BtnIcon size={14} className="chev" />}
        <span className="val">{render ? render(sel) : multi
          ? (sel.length ? sel.map((o) => o.label).join(', ') : <span className="ph">{placeholder}</span>)
          : sel ? <>{SelIcon && <SelIcon size={14} style={{ color: sel.color }} />}{sel.label}</> : <span className="ph">{placeholder}</span>}</span>
        <ChevronDown size={14} className="chev" />
      </button>
      {open && <div className="ab-pop" style={popStyle}>
        {search && <label className="ab-search"><Search size={13} /><input autoFocus placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></label>}
        {!shown.length && <div className="ab-empty">{empty}</div>}
        {shown.map((o) => {
          const head = o.group && o.group !== lastGroup ? <div className="grp">{o.group}</div> : null
          lastGroup = o.group
          const on = multi ? vals.map(String).includes(String(o.value)) : String(o.value) === String(value)
          const I = o.icon
          return <div key={`${o.group}-${o.value}`}>{head}
            <button type="button" className={`ab-opt ${on ? 'sel' : ''}`} onClick={() => pick(o)}>
              {I && <I size={14} style={{ color: o.color || '#6b7280' }} />}<span>{o.label}{o.hint && <small>{o.hint}</small>}</span>{on && <Check size={14} className="check" />}
            </button></div>
        })}
        {footer}
      </div>}
    </div>
  )
}

function Field({ label, req, children, hint }) {
  return <div className="ab-field"><label>{label}{req && <i> *</i>}</label>{children}{hint && <div className="muted small" style={{ marginTop: 4 }}>{hint}</div>}</div>
}

function Note({ kind, children }) {
  const I = kind === 'warn' ? AlertTriangle : Info
  return <div className={`ab-info ${kind || ''}`}><I size={14} /><div>{children}</div></div>
}

// People picker: "Anyone" + people list with avatars, or a closed "Choose people" link
function People({ value = [], onChange, anyone = true, placeholder = 'Choose people', single }) {
  const { people } = useUi()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef()
  useOutside(ref, open, () => setOpen(false))
  const ids = (value || []).map(Number)
  const active = people.filter((p) => p.is_active !== false && (!q || p.name.toLowerCase().includes(q.toLowerCase())))
  const toggle = (id) => { if (single) { onChange([id]); setOpen(false); return } onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]) }
  const chosen = people.filter((p) => ids.includes(p.id))
  const popStyle = usePop(ref, open, 260)
  return (
    <div className="ab-dd" ref={ref}>
      {!!chosen.length && <div className="ab-chips">{chosen.map((p) => <span key={p.id} className="ab-chip"><Av u={p} />{p.name}<button type="button" onClick={() => onChange(ids.filter((x) => x !== p.id))}><X size={12} /></button></span>)}</div>}
      <button type="button" className="ab-link" style={{ color: '#6b7280' }} onClick={() => setOpen(!open)}><span className="ab-av" style={{ background: '#eef1f8', color: '#8b93a7' }}><User size={12} /></span>{placeholder}</button>
      {open && <div className="ab-pop" style={popStyle}>
        <label className="ab-search"><Search size={13} /><input autoFocus placeholder="People, roles, teams, or clients" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        {anyone && !single && <button type="button" className={`ab-opt ${!ids.length ? 'sel' : ''}`} onClick={() => onChange([])}><span className="ab-av" style={{ background: '#eef1f8' }}><Users size={12} /></span>Anyone{!ids.length && <Check size={14} className="check" />}</button>}
        {active.map((p) => <button type="button" key={p.id} className={`ab-opt ${ids.includes(p.id) ? 'sel' : ''}`} onClick={() => toggle(p.id)}><Av u={p} />{p.name}{ids.includes(p.id) && <Check size={14} className="check" />}</button>)}
        {!active.length && <div className="ab-empty">No people found</div>}
      </div>}
    </div>
  )
}

function Tags({ value = [], onChange }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(TAG_COLORS[6])
  const [known, setKnown] = useState([])
  const ref = useRef()
  useOutside(ref, open, () => setOpen(false))
  useEffect(() => { if (open && !known.length) api.get('/tags').then((r) => setKnown((r || []).map((t) => (typeof t === 'string' ? t : t.name)).filter(Boolean))).catch(() => {}) }, [open])
  const add = (t) => { t = t.trim(); if (t && !value.includes(t)) onChange([...value, t]); setName('') }
  const popStyle = usePop(ref, open, 240)
  const matches = known.filter((t) => !value.includes(t) && (!name || t.toLowerCase().includes(name.toLowerCase()))).slice(0, 8)
  return (
    <div className="ab-dd" ref={ref}>
      {!!value.length && <div className="ab-chips">{value.map((t) => <span key={t} className="ab-chip"><span className="sw" style={{ background: color }} />{t}<button type="button" onClick={() => onChange(value.filter((x) => x !== t))}><X size={12} /></button></span>)}</div>}
      <button type="button" className="ab-link" onClick={() => setOpen(!open)}><Plus size={13} />Add tag</button>
      {open && <div className="ab-pop ab-tagpop" style={popStyle}>
        <input className="ab-input" autoFocus placeholder="Tag name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add(name))} />
        {matches.map((t) => <button type="button" key={t} className="ab-opt" onClick={() => add(t)}><TagIcon size={13} />{t}</button>)}
        <div className="ab-label" style={{ marginTop: 8 }}>Tag color</div>
        <div className="ab-colors">{TAG_COLORS.map((c) => <button type="button" key={c} className={c === color ? 'on' : ''} style={{ background: c }} onClick={() => setColor(c)} />)}</div>
        <button type="button" className="btn primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!name.trim()} onClick={() => add(name)}>Create new tag</button>
      </div>}
    </div>
  )
}

function Contains({ value = [''], onChange, label = 'Contains' }) {
  const list = value.length ? value : ['']
  return <Field label={label}>
    {list.map((v, i) => <div key={i} className="ab-row" style={{ marginBottom: 6 }}><input className="ab-input" value={v} onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))} />
      <button type="button" className="ab-del ab-fixed" title="Delete" onClick={() => onChange(list.filter((_, j) => j !== i))}><Trash2 size={14} /></button></div>)}
    <button type="button" className="ab-link" onClick={() => onChange([...list, ''])}><Plus size={13} />Add option</button>
  </Field>
}

function Duration({ value, onChange, placeholder = '2.5h or 2h 30m' }) {
  const [txt, setTxt] = useState(fmtMin(value))
  return <div className="ab-row"><Clock size={14} className="ab-fixed muted" style={{ position: 'absolute', marginLeft: 9 }} /><input className="ab-input" style={{ paddingLeft: 28 }} placeholder={placeholder} value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={() => { const m = toMin(txt); onChange(m); setTxt(fmtMin(m)) }} /></div>
}

function Slider({ value = 0, onChange }) {
  return <div className="ab-slider"><span style={{ width: 34 }}>{value || 0}%</span><input type="range" min="0" max="100" step="5" value={value || 0} onChange={(e) => onChange(+e.target.value)} /></div>
}

// Text with the "+" placeholder menu ({Task name}, {Name} ...)
function PhText({ value, onChange, placeholder, area, placeholders }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const inp = useRef()
  useOutside(ref, open, () => setOpen(false))
  const insert = (p) => {
    const el = inp.current; const v = value || ''
    const at = el ? el.selectionStart ?? v.length : v.length
    onChange(v.slice(0, at) + `{${p}}` + v.slice(at)); setOpen(false)
  }
  const Tag = area ? 'textarea' : 'input'
  const popStyle = usePop(ref, open, 240, true)
  return <div className="ab-ph" ref={ref}>
    <Tag ref={inp} className="ab-input" style={{ paddingRight: 32 }} placeholder={placeholder} value={value || ''} onChange={(e) => onChange(e.target.value)} rows={area ? 3 : undefined} />
    <button type="button" className="ab-plus" title="Insert a value from the trigger" onClick={() => setOpen(!open)}><Plus size={13} /></button>
    {open && <div className="ab-pop" style={popStyle}>{Object.entries(placeholders || {}).map(([g, items]) => <div key={g}><div className="grp">{g}</div>
      {items.map((p) => <button type="button" key={p} className="ab-opt" onClick={() => insert(p)}>{p}</button>)}</div>)}</div>}
  </div>
}

function Toggle({ checked, onChange, title }) {
  return <label className="ab-toggle" title={title}><input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} /><i /></label>
}

function Check2({ checked, onChange, children }) {
  return <label className="ab-check"><input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />{children}</label>
}

// lookups shared by all cards
function useLookups() {
  const [d, setD] = useState({ workflows: [], fields: [], templates: [], channels: [], categories: [], clients: [] })
  useEffect(() => {
    const get = (url, k, f = (x) => x) => api.get(url).then((r) => setD((o) => ({ ...o, [k]: f(r) || [] }))).catch(() => {})
    get('/workflows', 'workflows'); get('/custom-fields', 'fields'); get('/r/templates', 'templates')
    get('/chat/channels', 'channels', (r) => (r.channels || r || []).filter((c) => !c.is_dm))
    get('/r/categories', 'categories'); get('/clients', 'clients', (r) => r.clients || r)
  }, [])
  return d
}

const listCache = {}
function useTaskLists(pid) {
  const [lists, setLists] = useState(listCache[pid] || [])
  useEffect(() => {
    if (!pid) { setLists([]); return }
    if (listCache[pid]) { setLists(listCache[pid]); return }
    api.get(`/projects/${pid}/tasklists`).then((r) => { listCache[pid] = r.tasklists || r || []; setLists(listCache[pid]) }).catch(() => {})
  }, [pid])
  return lists
}

function ProjectPick({ value, onChange, multi, placeholder = 'Select projects' }) {
  const { projects } = useUi()
  return <Dd multi={multi} value={value} onChange={onChange} placeholder={placeholder} icon={Briefcase}
    options={projects.map((p) => ({ value: p.id, label: p.name, group: p.client_name || 'Projects' }))} empty="No projects" />
}

function ListPick({ pid, value, onChange, multi }) {
  const lists = useTaskLists(pid)
  return <Dd multi={multi} value={value} onChange={onChange} placeholder={pid ? 'Task list' : 'Select a project first'} icon={ListChecks}
    options={lists.map((l) => ({ value: l.id, label: l.name }))} empty={pid ? 'No task lists' : 'Select a project first'} />
}

function TaskPick({ pid, value, onChange }) {
  const [tasks, setTasks] = useState([])
  useEffect(() => { if (pid) api.get(`/tasks?project_id=${pid}&limit=200`).then((r) => setTasks(r.tasks || r || [])).catch(() => {}) }, [pid])
  return <Dd value={value} onChange={onChange} placeholder="Task" options={tasks.map((t) => ({ value: t.id, label: t.title }))}
    empty={<><CircleCheck size={22} /><div><b>No incomplete tasks</b></div><div>Tasks that are incomplete will show here</div></>} />
}

function prioOptions(withAny) {
  return [...(withAny ? [{ value: '', label: 'Any', icon: Flag }] : []), ...PRIOS.map(([k, l, c]) => ({ value: k, label: l, icon: Flag, color: c }))]
}

// "Days after trigger date / On trigger date / Choose date / Remove date / Start date - from the task / Due date - from the task"
function DateOpts({ cfg, set, prefix = '', label, req, noRemove, taskDates = true }) {
  const k = (x) => prefix + x
  const mode = cfg[k('mode')]
  const modes = DATE_MODES.filter(([m]) => (!noRemove || m !== 'remove') && (taskDates || !m.startsWith('from_')))
  return <>
    <Field label={label} req={req}><Dd value={mode || ''} onChange={(v) => set({ [k('mode')]: v })} search={false} placeholder="Select option" options={modes.map(([v, l]) => ({ value: v, label: l }))} /></Field>
    {mode === 'days_after' && <div className="ab-field"><div className="ab-row"><input className="ab-input ab-fixed" style={{ width: 70 }} type="number" min="0" value={cfg[k('days')] ?? 1} onChange={(e) => set({ [k('days')]: e.target.value })} /><span className="ab-fixed small">Day</span></div></div>}
    {mode === 'choose' && <Field label="Select date"><input className="ab-input" type="date" value={cfg[k('date')] || ''} onChange={(e) => set({ [k('date')]: e.target.value })} /></Field>}
    {(mode === 'from_start' || mode === 'from_due') && <div className="ab-field"><div className="ab-row">
      <input className="ab-input ab-fixed" style={{ width: 60 }} type="number" min="0" value={cfg[k('days')] ?? 0} onChange={(e) => set({ [k('days')]: e.target.value })} />
      <Dd search={false} value={cfg[k('unit')] || 'day'} onChange={(v) => set({ [k('unit')]: v })} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }]} />
      <Dd search={false} value={cfg[k('dir')] || 'before'} onChange={(v) => set({ [k('dir')]: v })} options={[{ value: 'before', label: 'Before' }, { value: 'after', label: 'After' }]} />
    </div></div>}
    {mode && !['remove', 'choose'].includes(mode) && <Check2 checked={cfg[k('skip_weekends')]} onChange={(v) => set({ [k('skip_weekends')]: v })}>Skip weekends</Check2>}
  </>
}

// ------------------------------------------------------------------ When card: trigger-specific settings
function TriggerFields({ trigger, tc, setTc, scopePid, lk }) {
  const set = (o) => setTc({ ...tc, ...o })
  const { people } = useUi()
  if (DATE_TRIGGERS.includes(trigger)) {
    return <>
      {tc.offset == null
        ? <button type="button" className="ab-link" style={{ marginBottom: 8 }} onClick={() => set({ offset: 1, unit: 'day', dir: 'before' })}><Plus size={13} />Add before or after date</button>
        : <div className="ab-field"><div className="ab-row">
          <input className="ab-input ab-fixed" style={{ width: 54 }} type="number" min="0" value={tc.offset} onChange={(e) => set({ offset: e.target.value })} />
          <Dd search={false} value={tc.unit || 'day'} onChange={(v) => set({ unit: v })} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }]} />
          <Dd search={false} value={tc.dir || 'before'} onChange={(v) => set({ dir: v })} options={[{ value: 'before', label: 'Before' }, { value: 'after', label: 'After' }]} />
          <button type="button" className="ab-del ab-fixed" onClick={() => { const { offset, unit, dir, ...rest } = tc; setTc(rest) }}><Trash2 size={14} /></button></div></div>}
      <div className="ab-field"><div className="ab-row"><span className="ab-fixed small">at</span><input className="ab-input" type="time" value={tc.at || '09:00'} onChange={(e) => set({ at: e.target.value })} /></div></div>
    </>
  }
  switch (trigger) {
    case 'task_created':
      return <Field label="Added via" req><Dd search={false} value={tc.added_via || 'any'} onChange={(v) => set({ added_via: v })} options={[{ value: 'any', label: 'Any' }, { value: 'forms', label: 'Forms' }]} /></Field>
    case 'stage_changed': {
      const mode = tc.mode || 'workflow'
      const wf = lk.workflows.find((w) => String(w.id) === String(tc.workflow_id))
      const stageOpts = mode === 'workflow' ? (wf?.stages || []).map((s) => ({ value: s.id, label: s.name })) : STATUSES.map(([v, l]) => ({ value: v, label: l }))
      return <>
        <div className="ab-modes">
          <button type="button" className={mode === 'project' ? 'on' : ''} onClick={() => set({ mode: 'project', from: [], to: [] })}><b>Project</b>Project stage changes will only affect the project that you've selected</button>
          <button type="button" className={mode === 'workflow' ? 'on' : ''} onClick={() => set({ mode: 'workflow', from: [], to: [] })}><b>Workflow</b>Workflow stage changes will affect projects that belong to the workflow</button>
        </div>
        {mode === 'workflow' && <Field label="Workflow"><Dd value={tc.workflow_id || ''} onChange={(v) => set({ workflow_id: v, from: [], to: [] })} placeholder="Select workflow" options={lk.workflows.map((w) => ({ value: w.id, label: w.name }))} empty="No workflows yet (Settings › Workflows)" /></Field>}
        <div className="ab-label">Stage <i>*</i></div>
        <Field label="From"><Dd multi value={tc.from || []} onChange={(v) => set({ from: v })} placeholder="Any" options={stageOpts} /></Field>
        <Field label="To"><Dd multi value={tc.to || []} onChange={(v) => set({ to: v })} placeholder="Any" options={stageOpts} /></Field>
      </>
    }
    case 'list_changed':
      return <Field label="Task list" req>{scopePid ? <ListPick multi pid={scopePid} value={tc.tasklist_ids || []} onChange={(v) => set({ tasklist_ids: v })} /> : <Note>Select one project below to choose specific task lists.</Note>}</Field>
    case 'task_inactive':
      return <>
        <Field label="For" req><div className="ab-row"><input className="ab-input ab-fixed" style={{ width: 60 }} type="number" min="1" value={tc.for ?? 1} onChange={(e) => set({ for: e.target.value })} />
          <Dd search={false} value={tc.unit || 'day'} onChange={(v) => set({ unit: v })} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }]} /></div></Field>
        <Note kind="warn">Existing tasks won't be affected by this trigger until they have been interacted with.</Note>
      </>
    case 'name_changed': case 'description_changed': case 'project_name_changed': case 'project_description_changed':
      return <Contains value={tc.contains || ['']} onChange={(v) => set({ contains: v })} />
    case 'tag_added': case 'tag_removed': case 'milestone_tag_added': case 'milestone_tag_removed': case 'project_tag_added': case 'project_tag_removed':
      return <Field label="Tags"><Tags value={tc.tags || []} onChange={(v) => set({ tags: v })} /></Field>
    case 'custom_field_changed':
      return <Field label="Custom field" req><Dd value={tc.field_id || ''} onChange={(v) => set({ field_id: v })} placeholder="Choose field" options={lk.fields.map((f) => ({ value: f.id, label: f.name }))} /></Field>
    case 'estimate_exceeds':
      return <Field label="Hours and minutes" req><Duration value={tc.minutes} onChange={(v) => set({ minutes: v })} placeholder="0h 0m" /></Field>
    case 'time_exceeds':
      return <>
        <div className="ab-field"><div className="ab-row"><Dd search={false} value={tc.mode || 'exceeds'} onChange={(v) => set({ mode: v })} options={[{ value: 'exceeds', label: 'Exceeds' }, { value: 'percent', label: 'Reaches a percent of' }]} /><span className="ab-fixed small muted" style={{ width: 70 }}>Task's estimated time</span></div></div>
        {(tc.mode || 'exceeds') === 'exceeds' ? <Field label="Hours and minutes" req><Duration value={tc.minutes} onChange={(v) => set({ minutes: v })} placeholder="0h 0m" /></Field> : <div className="ab-field"><Slider value={tc.percent} onChange={(v) => set({ percent: v })} /></div>}
        <Check2 checked={tc.billable_only} onChange={(v) => set({ billable_only: v })}>Billable only</Check2>
      </>
    case 'time_logged': case 'time_removed':
      return <Check2 checked={tc.billable_only} onChange={(v) => set({ billable_only: v })}>Billable only</Check2>
    case 'assignee_added': case 'assignee_removed': case 'milestone_assignee_added': case 'milestone_assignee_removed':
      return <Field label="Assignee"><People value={tc.people || []} onChange={(v) => set({ people: v })} placeholder="Choose assignee" /></Field>
    case 'people_added': case 'people_removed':
      return <Field label="People"><People value={tc.people || []} onChange={(v) => set({ people: v })} /></Field>
    case 'progress_exceeds':
      return <div className="ab-field"><Slider value={tc.percent} onChange={(v) => set({ percent: v })} /></div>
    case 'comment_added': case 'milestone_comment_added':
      return <><Field label="Author"><People value={tc.authors || []} onChange={(v) => set({ authors: v })} placeholder="Choose author" /></Field><Contains value={tc.contains || ['']} onChange={(v) => set({ contains: v })} /></>
    case 'priority_changed':
      return <div className="ab-row">
        <Field label="From" req><Dd search={false} multi value={tc.from || []} onChange={(v) => set({ from: v })} placeholder="Any" options={prioOptions()} /></Field>
        <Field label="To" req><Dd search={false} multi value={tc.to || []} onChange={(v) => set({ to: v })} placeholder="Any" options={prioOptions()} /></Field></div>
    case 'project_category_changed': case 'project_owner_changed': case 'project_company_changed': case 'project_portfolio_changed': {
      const opts = trigger === 'project_category_changed' ? lk.categories.map((c) => ({ value: c.id, label: c.name }))
        : trigger === 'project_owner_changed' ? people.map((p) => ({ value: p.id, label: p.name }))
          : trigger === 'project_company_changed' ? lk.clients.map((c) => ({ value: c.id, label: c.name })) : []
      return <>
        {trigger === 'project_portfolio_changed' && <Field label="Portfolio board"><Dd value="" onChange={() => {}} placeholder="Select portfolio board" options={[]} empty="No boards" /></Field>}
        <div className="ab-row"><Field label="From" req><Dd multi value={tc.from || []} onChange={(v) => set({ from: v })} placeholder="Any" options={opts} /></Field>
          <Field label="To" req><Dd multi value={tc.to || []} onChange={(v) => set({ to: v })} placeholder="Any" options={opts} /></Field></div>
      </>
    }
    case 'milestone_list_attached': case 'milestone_list_detached':
      return <Field label="Task lists">{scopePid ? <ListPick multi pid={scopePid} value={tc.tasklist_ids || []} onChange={(v) => set({ tasklist_ids: v })} /> : <Note>Select one project to choose specific task lists. Otherwise, this automation runs for any task list.</Note>}</Field>
    case 'every_day':
      return <>
        <Field label="On" req><div className="ab-days">{DAYS.map(([k, l]) => { const days = tc.days || ['mon', 'tue', 'wed', 'thu', 'fri']; const on = days.includes(k)
          return <button type="button" key={k} className={on ? 'on' : ''} onClick={() => set({ days: on ? days.filter((d) => d !== k) : [...days, k] })}>{l}</button> })}</div></Field>
        <Field label="At" req><input className="ab-input" type="time" value={tc.at || '09:00'} onChange={(e) => set({ at: e.target.value })} /></Field>
      </>
    default:
      return null
  }
}

// ------------------------------------------------------------------ conditions
function ConditionCard({ c, onChange, onDelete, scopePid, lk }) {
  const def = COND_FIELDS.find(([k]) => k === c.field)
  const set = (o) => onChange({ ...c, ...o })
  const kind = def?.[2]
  const ops = def?.[3]
  const v = c.value
  let valueUi = null
  const needsValue = !['set', 'not_set', 'has_any', 'has_none', 'added'].includes(c.op)
  if (def && needsValue) {
    if (kind === 'people') valueUi = <People value={v || []} onChange={(x) => set({ value: x })} anyone={false} placeholder={c.field === 'assignee' ? 'Choose assignee' : c.field === 'follower' ? 'Choose followers' : 'Choose people'} />
    else if (kind === 'person') valueUi = <People single value={v || []} onChange={(x) => set({ value: x })} anyone={false} placeholder="Choose creator" />
    else if (kind === 'prio') valueUi = <Dd multi search={false} value={v || []} onChange={(x) => set({ value: x })} options={prioOptions()} placeholder="Choose priority" />
    else if (kind === 'tags') valueUi = <Field label="Tags" req><Tags value={v || []} onChange={(x) => set({ value: x })} /></Field>
    else if (kind === 'percent') valueUi = <Slider value={v} onChange={(x) => set({ value: x })} />
    else if (kind === 'minutes') valueUi = <Field label="Hours and minutes" req><Duration value={v} onChange={(x) => set({ value: x })} /></Field>
    else if (kind === 'stages') valueUi = <Dd multi search={false} value={v || []} onChange={(x) => set({ value: x })} options={STATUSES.map(([a, b]) => ({ value: a, label: b }))} placeholder="Choose stage" />
    else if (kind === 'tasklists') valueUi = scopePid ? <ListPick multi pid={scopePid} value={v || []} onChange={(x) => set({ value: x })} />
      : <Note kind="err">The task list condition is only available when one project is selected. Please have one project selected to use this condition.</Note>
    else if (kind === 'date') {
      const dv = v || { source: 'date' }
      valueUi = <>
        <Dd search value={dv.source || 'date'} onChange={(x) => set({ value: { ...dv, source: x } })} options={[{ value: 'trigger', label: 'Trigger date' }, { value: 'date', label: 'Select date' }]} />
        {(dv.source || 'date') === 'date' && <div style={{ marginTop: 8 }}><Field label="Select date"><input className="ab-input" type="date" value={dv.date || new Date().toISOString().slice(0, 10)} onChange={(e) => set({ value: { ...dv, date: e.target.value } })} /></Field></div>}
      </>
    } else if (kind === 'contains') valueUi = <Contains value={v || ['']} onChange={(x) => set({ value: x })} />
    else if (kind === 'bool') valueUi = <div className="ab-seg">{[[true, 'True'], [false, 'False']].map(([b, l]) => <button type="button" key={l} className={(v ?? true) === b ? 'on' : ''} onClick={() => set({ value: b })}>{l}</button>)}</div>
    else if (kind === 'comments') valueUi = ['more_than', 'less_than'].includes(c.op) ? <input className="ab-input" type="number" min="0" value={v ?? 0} onChange={(e) => set({ value: e.target.value })} />
      : c.op === 'from' ? <People value={v || []} onChange={(x) => set({ value: x })} anyone={false} /> : <Contains value={Array.isArray(v) ? v : ['']} onChange={(x) => set({ value: x })} />
    else if (kind === 'attachments') valueUi = ['more_than', 'less_than'].includes(c.op) ? <input className="ab-input" type="number" min="0" value={v ?? 0} onChange={(e) => set({ value: e.target.value })} />
      : <Contains value={Array.isArray(v) ? v : ['']} onChange={(x) => set({ value: x })} />
    else if (kind === 'custom') {
      const cv = v && typeof v === 'object' && !Array.isArray(v) ? v : {}
      valueUi = <><Field label="Custom field" req><Dd value={cv.field_id || ''} onChange={(x) => set({ value: { ...cv, field_id: x } })} placeholder="Choose field" options={lk.fields.map((f) => ({ value: f.id, label: f.name }))} /></Field>
        {!['set', 'not_set'].includes(c.op) && <Field label="Value"><input className="ab-input" value={cv.value || ''} onChange={(e) => set({ value: { ...cv, value: e.target.value } })} /></Field>}</>
    }
  } else if (def && kind === 'custom') {
    const cv = v && typeof v === 'object' && !Array.isArray(v) ? v : {}
    valueUi = <Field label="Custom field" req><Dd value={cv.field_id || ''} onChange={(x) => set({ value: { ...cv, field_id: x } })} placeholder="Choose field" options={lk.fields.map((f) => ({ value: f.id, label: f.name }))} /></Field>
  }
  return <div className="ab-card">
    <div className="ab-cond-title">Condition<button type="button" className="ab-del" title="Delete condition" onClick={onDelete}><Trash2 size={14} /></button></div>
    <div className="ab-field"><Dd value={c.field || ''} onChange={(x) => { const d = COND_FIELDS.find(([k]) => k === x); onChange({ field: x, op: d?.[3]?.[0]?.[0] || 'contains', value: d?.[2] === 'bool' ? true : undefined }) }}
      placeholder="Select condition" options={COND_FIELDS.map(([k, l]) => ({ value: k, label: l }))} /></div>
    {ops && <div className="ab-field"><Dd value={c.op} onChange={(x) => set({ op: x })} options={ops.map(([a, b]) => ({ value: a, label: b }))} /></div>}
    {valueUi && <div className="ab-field">{kind === 'contains' || kind === 'tags' || kind === 'minutes' ? valueUi : valueUi}</div>}
  </div>
}

// ------------------------------------------------------------------ Then card: action settings
function ActionFields({ a, setCfg, lk, meta, scopePid, trigEntity }) {
  const cfg = a.cfg || {}
  const set = (o) => setCfg({ ...cfg, ...o })
  const ph = meta.placeholders
  const peopleMode = (label, modes = PEOPLE_MODES, key = 'people', modeKey = 'people_mode') => <>
    <Field label={label} req><Dd search={false} value={cfg[modeKey] || 'selected'} onChange={(v) => set({ [modeKey]: v })} placeholder="Select people" options={modes.map(([v, l]) => ({ value: v, label: l }))} /></Field>
    {(cfg[modeKey] || 'selected') === 'selected' && <div className="ab-field"><People value={cfg[key] || []} onChange={(v) => set({ [key]: v })} anyone={false} /></div>}
  </>
  const location = (withTask) => <>
    <Field label="Project" req><ProjectPick value={cfg.project_id || ''} onChange={(v) => set({ project_id: v, tasklist_id: '', task_id: '' })} placeholder="Project" /></Field>
    <Field label="Task list" req><ListPick pid={cfg.project_id} value={cfg.tasklist_id || ''} onChange={(v) => set({ tasklist_id: v })} /></Field>
    {withTask && <Field label="Task" req><TaskPick pid={cfg.project_id} value={cfg.parent_id || ''} onChange={(v) => set({ parent_id: v })} /></Field>}
  </>
  switch (a.type) {
    case 'add_comment':
      return <Field label="Comment" req><PhText area value={cfg.comment} onChange={(v) => set({ comment: v })} placeholder="Write your comment here" placeholders={ph} /></Field>
    case 'add_followers': case 'assign':
      return <>
        <Field label="Option" req><Dd search={false} value={cfg.option || 'add'} onChange={(v) => set({ option: v })} options={(a.type === 'assign' ? [['add', 'Add'], ['remove', 'Remove'], ['reassign', 'Reassign']] : [['add', 'Add'], ['remove', 'Remove'], ['replace', 'Replace with']]).map(([v, l]) => ({ value: v, label: l }))} /></Field>
        {peopleMode('People')}
        {a.type === 'assign' && <Note>If the assignee does not have access to the task, this action will be skipped</Note>}
      </>
    case 'set_status': {
      const mode = cfg.mode || 'workflow'
      const wf = lk.workflows.find((w) => String(w.id) === String(cfg.workflow_id))
      return <>
        <div className="ab-modes">
          <button type="button" className={mode === 'project' ? 'on' : ''} onClick={() => set({ mode: 'project' })}><b>Project</b>Project stage changes will only affect the project that you've selected</button>
          <button type="button" className={mode === 'workflow' ? 'on' : ''} onClick={() => set({ mode: 'workflow' })}><b>Workflow</b>Workflow stage changes will affect projects that belong to the workflow</button>
        </div>
        {mode === 'workflow' ? <>
          <Field label="Workflow"><Dd value={cfg.workflow_id || ''} onChange={(v) => set({ workflow_id: v, stage_id: '' })} placeholder="Select workflow" options={lk.workflows.map((w) => ({ value: w.id, label: w.name }))} empty="No workflows yet" /></Field>
          <Field label="Stage" req><Dd value={cfg.stage_id || ''} onChange={(v) => set({ stage_id: v })} placeholder="Select stage" options={(wf?.stages || []).map((s) => ({ value: s.id, label: s.name }))} empty="Select a workflow first" /></Field>
        </> : <Field label="Stage" req><Dd search={false} value={cfg.stage || ''} onChange={(v) => set({ stage: v })} placeholder="Select stage" options={STATUSES.map(([v, l]) => ({ value: v, label: l }))} /></Field>}
      </>
    }
    case 'move_list': case 'copy_list':
      return location(false)
    case 'set_start': case 'set_due':
      return <DateOpts cfg={cfg} set={set} label={a.type === 'set_start' ? 'Start date' : 'Due date'} req />
    case 'add_tag':
      return <>
        <Field label="Option" req><Dd search={false} value={cfg.option || 'add'} onChange={(v) => set({ option: v })} options={[['add', 'Add'], ['remove', 'Remove'], ['replace', 'Replace']].map(([v, l]) => ({ value: v, label: l }))} /></Field>
        <Field label="Tags" req><Tags value={cfg.tags || []} onChange={(v) => set({ tags: v })} /></Field>
      </>
    case 'add_task':
      return <>
        <Field label="Project" req><ProjectPick value={cfg.project_id || ''} onChange={(v) => set({ project_id: v, tasklist_id: '' })} placeholder={trigEntity === 'task' ? 'Project from trigger' : 'Project'} /></Field>
        <Field label="Task list"><ListPick pid={cfg.project_id} value={cfg.tasklist_id || ''} onChange={(v) => set({ tasklist_id: v })} /></Field>
        <Field label="Task name" req><PhText value={cfg.name} onChange={(v) => set({ name: v })} placeholder="Write your task name here" placeholders={ph} /></Field>
        <Field label="Task description"><PhText area value={cfg.description} onChange={(v) => set({ description: v })} placeholder="Write your task description here" placeholders={ph} /></Field>
        <Field label="Priority"><Dd search={false} value={cfg.priority || 'none'} onChange={(v) => set({ priority: v })} options={prioOptions()} /></Field>
        {peopleMode('Assignees', PEOPLE_MODES, 'assignees', 'assignees_mode')}
      </>
    case 'add_subtask':
      return <>
        <Field label="Parent task" req><Dd search={false} value={cfg.parent_mode || 'trigger'} onChange={(v) => set({ parent_mode: v })} options={[{ value: 'trigger', label: 'Trigger task', hint: trigEntity === 'task' ? undefined : 'Trigger not compatible with operation' }, { value: 'location', label: 'Select a location' }]} /></Field>
        {cfg.parent_mode === 'location' && location(true)}
        <Field label="Subtask name" req><PhText value={cfg.name} onChange={(v) => set({ name: v })} placeholder="Write your task name here" placeholders={ph} /></Field>
        <Field label="Subtask description"><PhText area value={cfg.description} onChange={(v) => set({ description: v })} placeholder="Write your task description here" placeholders={ph} /></Field>
        <DateOpts cfg={cfg} set={set} prefix="start_" label="Start date" noRemove />
        <DateOpts cfg={cfg} set={set} prefix="due_" label="Due date" noRemove />
        <Field label="Priority"><Dd search={false} value={cfg.priority || 'none'} onChange={(v) => set({ priority: v })} options={prioOptions()} /></Field>
        <Field label="Tags"><Tags value={cfg.tags || []} onChange={(v) => set({ tags: v })} /></Field>
        <Field label="Estimated time"><Duration value={cfg.estimate} onChange={(v) => set({ estimate: v })} /></Field>
        {peopleMode('Assignees', PEOPLE_MODES, 'assignees', 'assignees_mode')}
        {peopleMode('Followers', PEOPLE_MODES, 'followers', 'followers_mode')}
        <Check2 checked={cfg.notify} onChange={(v) => set({ notify: v })}>Notify assignees and followers</Check2>
        <Note kind="warn">If the assignee or follower doesn't have access to the task, this action will be skipped.</Note>
      </>
    case 'add_from_template':
      return <>
        <Field label="Template" req><Dd value={cfg.template_id || ''} onChange={(v) => set({ template_id: v })} placeholder="Select a template" options={lk.templates.map((t) => ({ value: t.id, label: t.name }))}
          empty={<><LayoutTemplate size={26} /><div>You have no task list templates</div><a className="ab-link" href="/templates">Create template</a></>} /></Field>
        <Field label="Location" req><Dd search={false} value={cfg.location || ''} onChange={(v) => set({ location: v })} placeholder="Select option" options={[{ value: 'select', label: 'Select a location' }, { value: 'trigger', label: 'Trigger task' }]} /></Field>
        {cfg.location === 'select' && location(false)}
        <Check2 checked={cfg.notify} onChange={(v) => set({ notify: v })}>Notify assignees and followers</Check2>
        <Check2 checked={cfg.skip_weekends} onChange={(v) => set({ skip_weekends: v })}>Skip weekends</Check2>
        <Note>If the assignee or follower does not have access to the task, then task will be unassigned and the follower will not be added</Note>
      </>
    case 'set_estimate':
      return <>
        <Field label="Options" req><Dd search={false} value={cfg.option || 'set'} onChange={(v) => set({ option: v })} options={[['set', 'Set estimated time'], ['increase', 'Increase estimated time'], ['reduce', 'Reduce estimated time']].map(([v, l]) => ({ value: v, label: l }))} /></Field>
        <Field label="Time" req><Dd search={false} value={cfg.time_mode || 'select'} onChange={(v) => set({ time_mode: v })} options={[{ value: 'select', label: 'Select time' }, { value: 'logged', label: 'Logged time' }]} /></Field>
        {(cfg.time_mode || 'select') === 'select' ? <div className="ab-field"><Duration value={cfg.minutes} onChange={(v) => set({ minutes: v })} placeholder="0h 0m" /></div> : <Note>The logged time on the task will be used when the automation runs.</Note>}
      </>
    case 'log_time':
      return <>
        <Field label="Time log location" req><Dd search value={cfg.location || 'task'} onChange={(v) => set({ location: v })} options={[['task', 'Task from trigger'], ['project', 'Project from trigger'], ['select_task', 'Select task'], ['select_project', 'Select project']].map(([v, l]) => ({ value: v, label: l }))} /></Field>
        {cfg.location === 'select_task' && <><Field label="Project"><ProjectPick value={cfg.project_id || ''} onChange={(v) => set({ project_id: v })} placeholder="Project" /></Field><Field label="Task"><TaskPick pid={cfg.project_id} value={cfg.task_id || ''} onChange={(v) => set({ task_id: v })} /></Field></>}
        {cfg.location === 'select_project' && <Field label="Project"><ProjectPick value={cfg.project_id || ''} onChange={(v) => set({ project_id: v })} placeholder="Project" /></Field>}
        <Field label="Time to log" req><Dd search={false} value={cfg.time_mode || 'choose'} onChange={(v) => set({ time_mode: v })} options={[{ value: 'choose', label: 'Choose time' }, { value: 'estimate', label: 'Trigger task estimate' }]} /></Field>
        {(cfg.time_mode || 'choose') === 'choose' && <Field label="Hours and minutes" req><Duration value={cfg.minutes} onChange={(v) => set({ minutes: v })} /></Field>}
        <Check2 checked={cfg.billable} onChange={(v) => set({ billable: v })}>Billable</Check2>
        <Field label="Tracked for" req><Dd search value={cfg.tracked_for || ''} onChange={(v) => set({ tracked_for: v })} placeholder="Who to log time for?" options={[['select', 'Select people'], ['assignees', 'Task assignees'], ['trigger_user', 'User who completed trigger']].map(([v, l]) => ({ value: v, label: l }))} /></Field>
        {cfg.tracked_for === 'select' && <div className="ab-field"><People value={cfg.people || []} onChange={(v) => set({ people: v })} anyone={false} /></div>}
        <Field label="Description"><PhText area value={cfg.description} onChange={(v) => set({ description: v })} placeholder="Add a description" placeholders={ph} /></Field>
        <Field label="Tags"><Tags value={cfg.tags || []} onChange={(v) => set({ tags: v })} /></Field>
      </>
    case 'set_priority':
      return <Field label="Priority" req><Dd search={false} value={cfg.priority || 'none'} onChange={(v) => set({ priority: v })} options={prioOptions()} /></Field>
    case 'set_name':
      return <Field label="Task name" req><PhText area value={cfg.name} onChange={(v) => set({ name: v })} placeholder="Write your task name here" placeholders={ph} /></Field>
    case 'set_description':
      return <Field label="Task description" req><PhText area value={cfg.description} onChange={(v) => set({ description: v })} placeholder="Write your task description here" placeholders={ph} /></Field>
    case 'set_progress':
      return <>
        <Field label="Options" req><Dd search={false} value={cfg.option || 'set'} onChange={(v) => set({ option: v })} options={[['set', 'Set progress to'], ['increase', 'Increase progress by'], ['decrease', 'Decrease progress by']].map(([v, l]) => ({ value: v, label: l }))} /></Field>
        <Field label="Progress" req><Slider value={cfg.percent} onChange={(v) => set({ percent: v })} /></Field>
      </>
    case 'set_custom_field':
      return <>
        <Field label="Custom field" req><Dd value={cfg.field_id || ''} onChange={(v) => set({ field_id: v })} placeholder="Choose field" options={lk.fields.map((f) => ({ value: f.id, label: f.name }))} /></Field>
        {cfg.field_id && <Field label="Value"><PhText value={cfg.value} onChange={(v) => set({ value: v })} placeholders={ph} /></Field>}
      </>
    case 'add_milestone':
      return <>
        <Field label="Milestone name" req><PhText value={cfg.name} onChange={(v) => set({ name: v })} placeholder="Write your milestone name here" placeholders={ph} /></Field>
        <Field label="Project" req><Dd search={false} value={cfg.project_mode || ''} onChange={(v) => set({ project_mode: v })} placeholder="Select an option" options={[{ value: 'trigger', label: 'Project from trigger', hint: trigEntity === 'none' ? 'Trigger not compatible with operation' : undefined }, { value: 'choose', label: 'Choose project' }]} /></Field>
        {cfg.project_mode === 'choose' && <div className="ab-field"><ProjectPick value={cfg.project_id || ''} onChange={(v) => set({ project_id: v, tasklist_ids: [] })} placeholder="Project" /></div>}
        <Field label="Task lists"><ListPick multi pid={cfg.project_mode === 'choose' ? cfg.project_id : scopePid} value={cfg.tasklist_ids || []} onChange={(v) => set({ tasklist_ids: v })} /></Field>
        <DateOpts cfg={cfg} set={set} prefix="due_" label="Due date" req noRemove taskDates={trigEntity === 'task'} />
        <Field label="Milestone description"><PhText area value={cfg.description} onChange={(v) => set({ description: v })} placeholder="Write your milestone description here" placeholders={ph} /></Field>
        <Field label="Tags"><Tags value={cfg.tags || []} onChange={(v) => set({ tags: v })} /></Field>
        {peopleMode('Assignees', PEOPLE_MODES, 'assignees', 'assignees_mode')}
      </>
    case 'create_project':
      return <>
        <Field label="Type" req><Dd search={false} value={cfg.type || 'confirmed'} onChange={(v) => set({ type: v })} options={[{ value: 'confirmed', label: 'Confirmed' }, { value: 'tentative', label: 'Tentative' }]} /></Field>
        <Field label="Project template"><Dd value={cfg.template_id || ''} onChange={(v) => set({ template_id: v })} placeholder="Select a project template" options={lk.templates.map((t) => ({ value: t.id, label: t.name, group: 'Custom' }))}
          empty={<><LayoutTemplate size={26} /><div><b>No custom templates</b></div><div>Once you create some custom templates, they will be shown here</div></>} /></Field>
        <Field label="Project name" req><PhText value={cfg.name} onChange={(v) => set({ name: v })} placeholder="Add project name" placeholders={ph} /></Field>
        <Field label="Project description"><PhText area value={cfg.description} onChange={(v) => set({ description: v })} placeholder="Add project description" placeholders={ph} /></Field>
        <Field label="Workflow"><Dd value={cfg.workflow_id || ''} onChange={(v) => set({ workflow_id: v })} placeholder="Select workflow" options={lk.workflows.map((w) => ({ value: w.id, label: w.name }))} empty="No workflows" /></Field>
        {peopleMode('Project owner', PEOPLE_MODES, 'owner', 'owner_mode')}
        <Field label="Tags"><Tags value={cfg.tags || []} onChange={(v) => set({ tags: v })} /></Field>
        <Check2 checked={cfg.skip_weekends ?? true} onChange={(v) => set({ skip_weekends: v })}>Skip weekends</Check2>
      </>
    case 'notify':
      return <>
        {peopleMode('People', trigEntity === 'task' ? NOTIFY_MODES : NOTIFY_MODES.filter(([m]) => !m.startsWith('task_')))}
        <Field label="Title" req><PhText value={cfg.title} onChange={(v) => set({ title: v })} placeholder="Message title" placeholders={ph} /></Field>
        <Field label="Message" req><PhText area value={cfg.message} onChange={(v) => set({ message: v })} placeholder="Write your message..." placeholders={ph} /></Field>
        <Check2 checked={cfg.skip_trigger_user} onChange={(v) => set({ skip_trigger_user: v })}>Skip person if they triggered the automation</Check2>
      </>
    case 'http_request': {
      const headers = cfg.headers?.length ? cfg.headers : [['', '']]
      const method = cfg.method || 'POST'
      return <>
        <Field label="URL" req><input className="ab-input" placeholder="https://example.com" value={cfg.url || ''} onChange={(e) => set({ url: e.target.value })} /></Field>
        <Field label="HTTP method" req><Dd search={false} value={method} onChange={(v) => set({ method: v })} options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({ value: m, label: m }))} /></Field>
        <Field label="Headers">{headers.map((h, i) => <div key={i} className="ab-row" style={{ marginBottom: 6 }}>
          <input className="ab-input" placeholder="Key" value={h[0]} onChange={(e) => set({ headers: headers.map((x, j) => (j === i ? [e.target.value, x[1]] : x)) })} />
          <input className="ab-input" placeholder="Value" value={h[1]} onChange={(e) => set({ headers: headers.map((x, j) => (j === i ? [x[0], e.target.value] : x)) })} />
          <button type="button" className="ab-del ab-fixed" title="Delete header" onClick={() => set({ headers: headers.filter((_, j) => j !== i) })}><Trash2 size={14} /></button></div>)}
          <button type="button" className="ab-link" onClick={() => set({ headers: [...headers, ['', '']] })}><Plus size={13} />Add header</button></Field>
        {!['GET', 'DELETE'].includes(method) && <Field label="Payload"><PhText area value={cfg.payload} onChange={(v) => set({ payload: v })} placeholder="Write your payload here..." placeholders={ph} /></Field>}
        <Note>HTTP request action allows creation of highly customizable integrations with both internal and external domains.</Note>
      </>
    }
    case 'chat_message':
      return <>
        <Field label="Channel" req><Dd value={cfg.channel_id || ''} onChange={(v) => set({ channel_id: v })} placeholder="Select channel" options={lk.channels.map((c) => ({ value: c.id, label: `# ${c.name}` }))} empty="No chat channels yet" /></Field>
        <Field label="Message" req><PhText area value={cfg.message} onChange={(v) => set({ message: v })} placeholder="Write your message..." placeholders={ph} /></Field>
      </>
    case 'slack_message':
      return <>
        <Field label="Slack incoming webhook URL" req hint="In Slack: Apps › Incoming Webhooks › Add to a channel, then paste the URL here."><input className="ab-input" placeholder="https://hooks.slack.com/services/…" value={cfg.webhook_url || ''} onChange={(e) => set({ webhook_url: e.target.value })} /></Field>
        <Field label="Message" req><PhText area value={cfg.message} onChange={(v) => set({ message: v })} placeholder="Write your message..." placeholders={ph} /></Field>
      </>
    default:
      return null
  }
}

// ------------------------------------------------------------------ summary sentence (footer)
function summaryParts(f, meta) {
  const tl = meta.triggers[f.trigger] || ''
  const tc = f.trigger_cfg || {}
  const short = tl.replace(/^(Task|Milestone|Project) (?=(due|start|end|tag|time|assignee|comment|custom|estimated|logged|progress|priority|stage) )/i, '')
  let when = short.charAt(0).toUpperCase() + short.slice(1)
  if (f.trigger === 'task_inactive') when = `Task inactive for ${tc.for || 1} ${tc.unit || 'day'}`
  if (f.trigger === 'priority_changed' || f.trigger === 'stage_changed') when = `${f.trigger === 'priority_changed' ? 'Priority' : 'Stage'} changes from ${(tc.from || []).join(', ') || 'any'} to ${(tc.to || []).join(', ') || 'any'}`
  if (f.trigger === 'every_day') { const d = tc.days || ['mon', 'tue', 'wed', 'thu', 'fri']; when = `Every ${d.length === 7 ? 'day' : d.map((x) => x[0].toUpperCase() + x.slice(1)).join(', ')} at ${tc.at || '09:00'}` }
  if (f.trigger === 'progress_exceeds') when = `Progress exceeds ${tc.percent || 0}%`
  const pre = DATE_TRIGGERS.includes(f.trigger) && tc.offset != null ? `${tc.offset} ${tc.unit || 'day'}${+tc.offset === 1 ? '' : 's'} ${tc.dir || 'before'} ` : ''
  const acts = (f.actions || []).map((a) => {
    const l = meta.actions[a.type] || a.type; const c = a.cfg || {}
    if (a.type === 'set_priority') return [`Change priority`, ` to ${c.priority || 'none'}`]
    if (a.type === 'notify') return ['Notify', c.people_mode && c.people_mode !== 'selected' ? ` ${NOTIFY_MODES.find(([m]) => m === c.people_mode)?.[1].toLowerCase()}` : '']
    if (a.type === 'set_progress') return [`${c.option === 'increase' ? 'Increase' : c.option === 'decrease' ? 'Decrease' : 'Change'} progress`, ` ${c.option === 'set' || !c.option ? 'to' : 'by'} ${c.percent || 0}%`]
    if (a.type === 'set_estimate') return ['Set estimated time', ` to ${c.time_mode === 'logged' ? 'logged time' : fmtMin(c.minutes) || '0 hrs, 0 mins'}`]
    if (a.type === 'http_request') return ['Send HTTP request', ` to ${c.url || '______'}`]
    if (a.type === 'add_tag') return [`${c.option === 'remove' ? 'Remove' : c.option === 'replace' ? 'Replace' : 'Add'} tags`, ` ${(c.tags || []).join(', ') || '______'}`]
    return [l.replace(/^Change task /, 'Change ').replace(/^Add task comment$/, 'Add comment'), '']
  })
  return { pre, when, cond: (f.conditions || []).length > 0, acts }
}

// ------------------------------------------------------------------ the builder
const blankAction = (type = 'set_priority') => ({ type, cfg: type === 'set_priority' ? { priority: 'none' } : {} })

export default function AutomationBuilder({ initial = {}, meta, onClose, onSaved }) {
  const { notify } = useUi()
  const lk = useLookups()
  const [f, setF] = useState(() => {
    const c = initial.config || {}
    const firstAction = initial.action || 'set_priority'
    return {
      id: initial.id, name: initial.name || '', description: initial.description || '', is_active: initial.is_active ?? true,
      trigger: initial.trigger || 'due_arrives',
      trigger_cfg: c.trigger_cfg || (initial.trigger_value ? { legacy: initial.trigger_value } : {}),
      projects: c.projects ?? (initial.project_id ? [initial.project_id] : 'all'),
      conditions: c.conditions || [],
      actions: c.actions?.length ? c.actions : [initial.action_value ? { type: firstAction, cfg: { legacy: initial.action_value } } : blankAction(firstAction)],
    }
  })
  const [showDesc, setShowDesc] = useState(!!f.description)
  const [saving, setSaving] = useState(false)
  const set = (o) => setF((x) => ({ ...x, ...o }))
  const trig = meta.triggers_list.find((t) => t.key === f.trigger) || { entity: 'task' }
  const scopePid = Array.isArray(f.projects) && f.projects.length === 1 ? f.projects[0] : null
  const showScope = !NO_PROJECT_SCOPE.includes(f.trigger)
  const trigOpts = meta.triggers_list.map((t) => ({ value: t.key, label: t.label, group: t.group, icon: TRIG_ICONS[t.key] || (t.group === 'Milestone' ? Milestone : t.group === 'Project' ? Briefcase : Zap) }))
  const actOpts = meta.actions_list.map((a) => ({ value: a.key, label: a.label, group: a.group, icon: ACT_ICONS[a.key] || Zap }))
  const sum = useMemo(() => summaryParts(f, meta), [f, meta])
  const sumText = `${sum.pre}When ${sum.when}${sum.cond ? ' and condition is true' : ''}, ${sum.acts.map(([a, b]) => a + b).join(', ')}`

  const validate = () => {
    if (showScope && Array.isArray(f.projects) && !f.projects.length) return 'Select at least one project or choose All projects'
    for (const a of f.actions) {
      const c = a.cfg || {}
      if (c.legacy !== undefined) continue
      if (['move_list', 'copy_list'].includes(a.type) && !c.tasklist_id) return 'Choose a task list for the action'
      if (a.type === 'notify' && (!c.title || !c.message)) return 'Notify people needs a title and a message'
      if (a.type === 'notify' && (c.people_mode || 'selected') === 'selected' && !(c.people || []).length) return 'Choose who to notify'
      if (a.type === 'http_request' && !/^https?:\/\//.test(c.url || '')) return 'Enter a URL starting with http:// or https://'
      if (a.type === 'add_comment' && !c.comment) return 'Write the comment to add'
      if (a.type === 'chat_message' && !c.channel_id) return 'Choose a chat channel'
      if (a.type === 'set_custom_field' && !c.field_id) return 'Choose a custom field'
      if (a.type === 'add_from_template' && !c.template_id) return 'Choose a template'
      if (a.type === 'create_project' && !c.name) return 'Enter a project name'
      if (a.type === 'add_milestone' && (!c.name || !c.project_mode || !c.due_mode)) return 'Add milestone needs a name, a project and a due date'
      if (a.type === 'add_subtask' && !c.name) return 'Enter the subtask name'
      if (['set_start', 'set_due'].includes(a.type) && !c.mode) return 'Choose the date option'
    }
    return null
  }
  const save = async () => {
    const err = validate()
    if (err) return notify(err)
    setSaving(true)
    const body = {
      name: f.name.trim() || sumText.slice(0, 200), description: f.description || null, is_active: f.is_active,
      trigger: f.trigger, action: f.actions[0]?.type || 'notify', project_id: null, trigger_value: null, action_value: null,
      config: { trigger_cfg: f.trigger_cfg, projects: showScope ? f.projects : 'all', conditions: trig.entity === 'task' ? f.conditions.filter((c) => c.field) : [], actions: f.actions },
    }
    try {
      f.id ? await api.patch(`/r/automations/${f.id}`, body) : await api.post('/r/automations', body)
      notify(f.id ? 'Automation updated' : 'Automation created'); onSaved?.(); onClose()
    } catch (e) { notify(e.message || 'Could not save'); setSaving(false) }
  }
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])

  return (
    <div className="ab-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ab-modal" role="dialog" aria-label="Create automation">
        <div className="ab-head"><h2>{f.id ? 'Edit automation' : 'Create automation'}</h2><button className="icon-btn" title="Close" onClick={onClose}><X size={18} /></button></div>
        <div className="ab-body">
          <div className="ab-flow">
            {/* When */}
            <div className="ab-col">
              <div className="ab-card">
                <div className="ab-card-head"><span className="ab-dot when"><Zap size={16} /></span><div><b>When</b><small>this happens</small></div></div>
                <Field label="Trigger" req><Dd value={f.trigger} onChange={(v) => set({ trigger: v, trigger_cfg: {}, conditions: meta.triggers_list.find((t) => t.key === v)?.entity === 'task' ? f.conditions : [] })} options={trigOpts} /></Field>
                <TriggerFields trigger={f.trigger} tc={f.trigger_cfg} setTc={(tc) => set({ trigger_cfg: tc })} scopePid={scopePid} lk={lk} />
                {showScope && <Field label="Project" req>
                  <div className="ab-radio">
                    <label><input type="radio" checked={f.projects === 'all'} onChange={() => set({ projects: 'all' })} />All projects</label>
                    <label><input type="radio" checked={f.projects !== 'all'} onChange={() => set({ projects: [] })} />Select projects</label>
                  </div>
                  {f.projects !== 'all' && <ProjectPick multi value={f.projects} onChange={(v) => set({ projects: v })} />}
                </Field>}
              </div>
              {trig.entity === 'task' && f.conditions.map((c, i) => <ConditionCard key={i} c={c} scopePid={scopePid} lk={lk}
                onChange={(nc) => set({ conditions: f.conditions.map((x, j) => (j === i ? nc : x)) })} onDelete={() => set({ conditions: f.conditions.filter((_, j) => j !== i) })} />)}
              {(trig.entity === 'task' || f.trigger === 'every_day') && trig.entity === 'task' &&
                <div className="ab-under"><button type="button" className="ab-link" onClick={() => set({ conditions: [...f.conditions, { field: '', op: 'any_of' }] })}><Plus size={13} />Add condition</button></div>}
            </div>
            <ArrowRight size={22} className="ab-arrow" />
            {/* Then */}
            <div className="ab-col">
              {f.actions.map((a, i) => (
                <div key={i} className="ab-card">
                  <div className="ab-card-head"><span className="ab-dot then"><Zap size={16} /></span><div><b>Then</b><small>perform this action</small></div>
                    {f.actions.length > 1 && <button type="button" className="ab-del" title="Remove action" onClick={() => set({ actions: f.actions.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>}</div>
                  <Field label="Action" req><Dd value={a.type} onChange={(v) => set({ actions: f.actions.map((x, j) => (j === i ? blankAction(v) : x)) })} options={actOpts} /></Field>
                  {a.cfg?.legacy !== undefined
                    ? <Note>This action was set up before the new builder (value: {String(a.cfg.legacy) || 'none'}). Pick the action again to change its settings.</Note>
                    : <ActionFields a={a} meta={meta} lk={lk} scopePid={scopePid} trigEntity={trig.entity} setCfg={(cfg) => set({ actions: f.actions.map((x, j) => (j === i ? { ...x, cfg } : x)) })} />}
                  {!NO_TARGET.includes(a.type) && trig.entity === 'task' && <div className="ab-target" style={{ width: 170 }}>
                    <Dd search={false} value={a.cfg?.target || ''} placeholder="Select a target" onChange={(v) => set({ actions: f.actions.map((x, j) => (j === i ? { ...x, cfg: { ...x.cfg, target: v } } : x)) })}
                      options={[{ value: 'trigger', label: 'Trigger task' }, { value: 'parent', label: 'Parent task' }, { value: 'subtasks', label: 'Subtasks' }]} /></div>}
                </div>))}
              <div className="ab-under"><button type="button" className="ab-link" title="Run more than one action when the trigger happens" onClick={() => set({ actions: [...f.actions, blankAction('notify')] })}><Plus size={13} />Add action <Info size={12} /></button></div>
            </div>
          </div>
        </div>
        <div className="ab-foot">
          <div className="ab-sum">
            <div className="lbl">Automation summary</div>
            <div className="line"><Toggle checked={f.is_active} onChange={(v) => set({ is_active: v })} title={f.is_active ? 'On' : 'Off'} />
              <span>{sum.pre}When <b>{sum.when}</b>{sum.cond ? ' and condition is true' : ''}, {sum.acts.map(([a, b], i) => <span key={i}>{i ? ', ' : ''}<b>{a}</b>{b}</span>)}</span></div>
            {showDesc ? <textarea className="ab-input" rows={2} placeholder="Describe what this automation is for" value={f.description} onChange={(e) => set({ description: e.target.value })} />
              : <button type="button" className="ab-link" style={{ color: '#6b7280', fontSize: 12 }} onClick={() => setShowDesc(true)}><Plus size={12} />Add description</button>}
          </div>
          <input className="ab-input" style={{ width: 220 }} placeholder="Name (optional)" value={f.name} onChange={(e) => set({ name: e.target.value })} title="Automation name; the summary is used when empty" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={saving} onClick={save}>{f.id ? 'Save' : 'Create'}</button>
        </div>
      </div>
    </div>
  )
}
