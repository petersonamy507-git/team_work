import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useParams, Link } from 'react-router-dom'
import { CheckCircle2, ChevronDown, ChevronRight, MoreVertical, Plus, Check, Settings2, Layers, CheckSquare, Download, Search as SearchIcon, Workflow } from 'lucide-react'
import { useData, useUi } from '../lib/ui-context'
import { useAuth } from '../lib/auth'
import { api, qs } from '../lib/api'
import { fmtDate, fmtMinutes, dueState, todayISO, PRIORITY } from '../lib/format'
import { EMPTY_FILTERS, withFilters, filterParams, toCSV, downloadText } from '../lib/taskFilters'
import { Avatar, AvatarStack, Empty, Loading, Progress } from '../components/ui'
import { CheckButton } from '../components/TaskRow'
import { Popover, PeoplePicker, PriorityFlag, PriorityPicker, StatusPill, STATUS } from '../components/TaskPickers'
import TaskFilter, { ActiveFilters } from '../components/TaskFilter'
import { useCustomFields, FieldEditor, FieldManager, useWorkflows, WorkflowManager, WorkflowBoard } from '../components/TaskExtras'
import { TaskLine, InlineAdd, BulkBar, SearchBox, ScopeToggle, SortMenu, AddTaskSplit, StagePicker, shortDate, Crumbs } from '../components/TaskList'

const STORE = 'cd_tasks_area_v2'
const TABS = [['', 'Tasks'], ['board', 'Board'], ['table', 'Table'], ['completed', 'Completed tasks']]
const TABLE_COLS = {
  assignees: 'Assignee', due_date: 'Due date', priority: 'Priority', progress: 'Progress', estimate: 'Estimated time',
  logged: 'Logged time', tags: 'Tags', project: 'Project', start_date: 'Start date', status: 'Stage', tasklist: 'Task list',
  created_by: 'Created by', created_at: 'Date added', updated_at: 'Last updated',
}
const DEFAULT_COLS = ['assignees', 'due_date', 'priority', 'progress', 'estimate', 'logged', 'tags', 'project']
const GROUPS = { tasklist: 'Task list', project: 'Project', assignee: 'Assignee', status: 'Stage', priority: 'Priority', due: 'Due date', none: 'No grouping' }

function loadPrefs() {
  const d = { scope: 'everyone', sort: 'start', order: 'desc', filters: { ...EMPTY_FILTERS }, columns: DEFAULT_COLS, group: 'tasklist', groupOrder: 'asc' }
  try { const s = JSON.parse(localStorage.getItem(STORE)); return s ? { ...d, ...s, filters: withFilters(s.filters) } : d } catch { return d }
}

/* group tasks for list and table views */
function groupBy(tasks, by, order = 'asc') {
  if (by === 'none') return [{ key: 'all', label: 'All tasks', tasks, ctx: {} }]
  const map = new Map()
  const put = (key, meta, t) => { if (!map.has(key)) map.set(key, { key, ...meta, tasks: [] }); map.get(key).tasks.push(t) }
  const today = todayISO()
  for (const t of tasks) {
    if (by === 'tasklist') put(t.tasklist_id, { label: t.tasklist_name || 'No task list', project: t.project_name, project_id: t.project_id, client: t.client_name, ctx: { project_id: t.project_id, tasklist_id: t.tasklist_id } }, t)
    else if (by === 'project') put(t.project_id, { label: t.project_name, client: t.client_name, project_id: t.project_id, color: t.project_color, ctx: { project_id: t.project_id } }, t)
    else if (by === 'assignee') {
      if (!t.assignees.length) put('none', { label: 'Unassigned', rank: 'zzz', ctx: { assignee_ids: [] } }, t)
      else t.assignees.forEach((a) => put(a.id, { label: a.name, user: a, ctx: { assignee_ids: [a.id] } }, t))
    } else if (by === 'status') put(t.status, { label: STATUS[t.status]?.label, color: STATUS[t.status]?.color, rank: Object.keys(STATUS).indexOf(t.status), ctx: { status: t.status } }, t)
    else if (by === 'priority') put(t.priority || 'none', { label: t.priority === 'none' ? 'No priority' : PRIORITY[t.priority]?.label, color: PRIORITY[t.priority || 'none'].color, rank: ['high', 'medium', 'low', 'none'].indexOf(t.priority || 'none'), ctx: { priority: t.priority } }, t)
    else if (by === 'due') {
      const b = !t.due_date ? ['nodate', 'No due date', 4] : t.due_date < today ? ['late', 'Late', 0] : t.due_date === today ? ['today', 'Today', 1] : t.due_date <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) ? ['week', 'Next 7 days', 2] : ['later', 'Later', 3]
      put(b[0], { label: b[1], rank: b[2], ctx: {} }, t)
    }
  }
  const out = [...map.values()]
  out.sort((a, b) => (a.rank !== undefined ? a.rank - b.rank : String(a.label).localeCompare(String(b.label))))
  return order === 'desc' ? out.reverse() : out
}

export default function TasksArea() {
  const { tid } = useParams()
  const loc = useLocation()
  const tab = loc.pathname.split('/')[2] && isNaN(+loc.pathname.split('/')[2]) ? loc.pathname.split('/')[2] : ''
  const { openTask, refresh } = useUi()
  const { user } = useAuth()
  const [p, setP] = useState(loadPrefs)
  const [q, setQ] = useState('')
  const [qd, setQd] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [sel, setSel] = useState(new Set())
  useEffect(() => { localStorage.setItem(STORE, JSON.stringify(p)) }, [p])
  useEffect(() => { const t = setTimeout(() => setQd(q), 250); return () => clearTimeout(t) }, [q])
  useEffect(() => { if (tid) openTask(+tid) }, [tid, openTask])
  useEffect(() => { setSel(new Set()); setSelecting(false) }, [tab])
  const set = (patch) => setP((x) => ({ ...x, ...patch }))
  const setFilters = (filters) => set({ filters })

  const params = { ...filterParams(p.filters, { userId: user.id }), q: qd, limit: 1500 }
  if (p.scope === 'mine' && !p.filters.assignee.length) params.assignee = 'me'
  if (tab === 'completed') { params.status = 'completed'; params.sort = 'completed'; params.order = p.order }
  else if (tab === 'board' && !p.filters.completed && !p.filters.status.length) params.status = 'all'
  else { params.sort = p.sort; params.order = p.order }
  const { data, reload } = useData(`/tasks${qs(params)}`, [JSON.stringify(params)])
  const tasks = data || []
  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const more = (
    <Popover align="right" width={210} trigger={<button className="icon-btn"><MoreVertical size={17} /></button>}>
      {(close) => <>
        <button className="pop-item" onClick={() => { setSelecting(!selecting); setSel(new Set()); close() }}><CheckSquare size={14} />{selecting ? 'Stop selecting' : 'Select multiple tasks'}</button>
        <button className="pop-item" onClick={() => { setSelecting(true); setSel(new Set(tasks.map((t) => t.id))); close() }}><Settings2 size={14} />Bulk edit tasks</button>
        <button className="pop-item" onClick={() => { downloadText(`tasks-${todayISO()}.csv`, toCSV(tasks)); close() }}><Download size={14} />Export to CSV</button>
      </>}
    </Popover>
  )
  const filter = <TaskFilter f={p.filters} setF={setFilters} />
  const common = { tasks, reload, selecting, sel, toggleSel, setSel }

  return (
    <div className="tw-page">
      <Crumbs items={[['Home', '/'], ['Tasks', '/tasks'], [{ '': 'All active tasks', board: 'Board', table: 'Table', completed: 'Completed tasks' }[tab]]]} />
      <div className="tw-head">
        <h1><CheckCircle2 size={20} />Tasks</h1>
        <nav className="tw-tabs">
          {TABS.map(([k, l]) => <NavLink key={k} to={`/tasks${k ? '/' + k : ''}`} end className={() => (tab === k ? 'active' : '')}>{l}{k === 'table' && <span className="new-badge">NEW</span>}</NavLink>)}
        </nav>
      </div>
      <div className="tw-body">
        {tab === '' && <>
          <div className="tw-toolbar">
            <h2>All Active Tasks</h2><span className="spacer" />
            <SearchBox value={q} onChange={setQ} />
            <ScopeToggle value={p.scope} onChange={(scope) => set({ scope })} />
            <SortMenu sort={p.sort} order={p.order} onChange={(sort, order) => set({ sort, order })} />
            {filter}<AddTaskSplit />{more}
          </div>
          <ActiveFilters f={p.filters} setF={setFilters} />
          {!data ? <Loading /> : !tasks.length ? <NoTasks /> : <ListGroups {...common} />}
        </>}
        {tab === 'board' && <>
          <div className="tw-toolbar">
            <WorkflowPicker value={p.workflow} onChange={(workflow) => set({ workflow })} /><span className="spacer" />
            <SearchBox value={q} onChange={setQ} />{filter}
            <SortMenu sort={p.sort} order={p.order} onChange={(sort, order) => set({ sort, order })} />
            <AddTaskSplit />
          </div>
          <ActiveFilters f={p.filters} setF={setFilters} />
          {p.workflow ? <WorkflowBoard workflowId={p.workflow} params={{ q: qd, assignee: params.assignee, project_id: params.project_id, priority: params.priority, tags: params.tags, due: params.due }} onManage={() => window.dispatchEvent(new Event('cd-manage-workflows'))} />
            : !data ? <Loading /> : <StageBoard tasks={tasks} reload={reload} />}
        </>}
        {tab === 'table' && <>
          <div className="tw-toolbar">
            <span className="spacer" />
            <SearchBox value={q} onChange={setQ} />{filter}
            <ScopeToggle value={p.scope} onChange={(scope) => set({ scope })} />
            <Popover align="right" width={300} trigger={<button className="tb-btn"><Layers size={15} />Group</button>}>
              <div className="pop-title">Group by</div>
              <div className="row" style={{ gap: 6 }}>
                <select className="select sm" value={p.group} onChange={(e) => set({ group: e.target.value })}>{Object.entries(GROUPS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <select className="select sm" value={p.groupOrder} onChange={(e) => set({ groupOrder: e.target.value })}><option value="asc">Ascending</option><option value="desc">Descending</option></select>
              </div>
            </Popover>
            <AddTaskSplit />{more}
          </div>
          <ActiveFilters f={p.filters} setF={setFilters} />
          {!data ? <Loading /> : <TaskTable {...common} columns={p.columns} setColumns={(columns) => set({ columns })} group={p.group} groupOrder={p.groupOrder} />}
        </>}
        {tab === 'completed' && <>
          <div className="tw-toolbar">
            <h2>All Completed Tasks</h2><span className="spacer" />
            <SearchBox value={q} onChange={setQ} />
            <button className="tb-btn" title="Sort by completed date" onClick={() => set({ order: p.order === 'asc' ? 'desc' : 'asc' })}>Completed ({p.order === 'asc' ? 'oldest first' : 'newest first'})</button>
            {filter}
          </div>
          <ActiveFilters f={p.filters} setF={setFilters} />
          {!data ? <Loading /> : !tasks.length ? <Empty icon={CheckCircle2} title="No Completed Tasks Yet" text="There are no completed tasks that match your search." /> : <CompletedList tasks={tasks} reload={() => { reload(); refresh() }} />}
        </>}
      </div>
      {sel.size > 0 && <BulkBar ids={[...sel]} clear={() => setSel(new Set())} done={() => { setSel(new Set()); reload(); refresh() }} />}
    </div>
  )
}

function WorkflowPicker({ value, onChange }) {
  const [list, load] = useWorkflows()
  const [manage, setManage] = useState(false)
  useEffect(() => { const h = () => setManage(true); window.addEventListener('cd-manage-workflows', h); return () => window.removeEventListener('cd-manage-workflows', h) }, [])
  useEffect(() => { if (list && value && !list.some((w) => w.id === value)) onChange(null) }, [list])
  const cur = list?.find((w) => w.id === value)
  return <>
    <Popover width={240} trigger={<button className="tb-btn workflow-pill"><Workflow size={15} />Workflow: {cur ? cur.name : 'Default stages'}<ChevronDown size={14} /></button>}>
      {(c) => <>
        <button className="pop-item" onClick={() => { onChange(null); c() }}>Default stages{!value && <Check size={14} className="ok" />}</button>
        {list?.map((w) => <button key={w.id} className="pop-item" onClick={() => { onChange(w.id); c() }}>{w.name}<span className="muted small">{w.stages.length} stages</span>{value === w.id && <Check size={14} className="ok" />}</button>)}
        <div className="pop-sep" />
        <button className="pop-item" onClick={() => { setManage(true); c() }}><Settings2 size={14} />Manage workflows</button>
      </>}
    </Popover>
    {manage && <WorkflowManager focusId={value} onClose={() => { setManage(false); load() }} onChanged={load} />}
  </>
}

function NoTasks() {
  return <Empty icon={CheckCircle2} title="No tasks" text="No tasks could be found. Try changing your filters or add a task." action={<AddTaskSplit />} />
}

/* ---------- Tasks tab: groups by task list ---------- */
function ListGroups({ tasks, reload, selecting, sel, toggleSel, setSel }) {
  const groups = useMemo(() => groupBy(tasks, 'tasklist'), [tasks])
  const [closed, setClosed] = useState({})
  return <div className="tw-groups">{groups.map((g) => {
    const open = !closed[g.key]
    return (
      <div key={g.key} className="tw-group">
        <div className="tw-ghead">
          <button className="icon-btn xs" onClick={() => setClosed({ ...closed, [g.key]: open })}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
          {selecting && <input type="checkbox" className="sel-box" checked={g.tasks.every((t) => sel.has(t.id))} onChange={(e) => setSel((s) => { const n = new Set(s); g.tasks.forEach((t) => (e.target.checked ? n.add(t.id) : n.delete(t.id))); return n })} />}
          <b>{g.label}</b>
          <Link to={`/projects/${g.project_id}/tasks`} className="muted">{g.project}</Link>
          {g.client && <span className="muted">({g.client})</span>}
          <Popover width={200} trigger={<button className="icon-btn xs"><MoreVertical size={14} /></button>}>
            {(close) => <>
              <Link className="pop-item" to={`/projects/${g.project_id}/tasks`} onClick={close}>Open project</Link>
              <button className="pop-item" onClick={() => { setClosed({ ...closed, [g.key]: true }); close() }}>Collapse</button>
            </>}
          </Popover>
        </div>
        {open && <>
          {g.tasks.map((t) => <TaskLine key={t.id} t={t} reload={reload} selectable={selecting} selected={sel.has(t.id)} onSel={() => toggleSel(t.id)} />)}
          <InlineAdd ctx={g.ctx} onAdded={reload} />
        </>}
      </div>
    )
  })}</div>
}

/* ---------- Board tab: workflow stages ---------- */
function StageBoard({ tasks, reload }) {
  const { openTask, refresh } = useUi()
  const [drag, setDrag] = useState(null)
  const [over, setOver] = useState(null)
  const [adding, setAdding] = useState(null)
  const [colQ, setColQ] = useState({})
  const drop = async (k) => {
    setOver(null)
    if (!drag || drag.status === k) return
    await api.patch(`/tasks/${drag.id}`, { status: k })
    reload(); refresh()
  }
  return (
    <div className="board tw-board">
      {Object.entries(STATUS).map(([k, s]) => {
        const items = tasks.filter((t) => t.status === k && (!colQ[k] || t.title.toLowerCase().includes(colQ[k].toLowerCase())))
        return (
          <div className="column" key={k}>
            <div className="column-head">
              <span className="stage-chip"><span className="dot" style={{ background: s.color }} />{s.label}</span>
              <span className="muted small">{items.length}</span><span style={{ flex: 1 }} />
              <Popover align="right" width={200} trigger={<button className="icon-btn xs"><SearchIcon size={13} /></button>}>
                <input className="input sm" autoFocus placeholder={`Search ${s.label}`} value={colQ[k] || ''} onChange={(e) => setColQ({ ...colQ, [k]: e.target.value })} />
              </Popover>
              <button className="icon-btn xs" title="Add a task" onClick={() => setAdding(k)}><Plus size={14} /></button>
            </div>
            <div className={`column-body ${over === k ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(k) }} onDragLeave={() => setOver(null)} onDrop={() => drop(k)}>
              {adding === k ? <InlineAdd ctx={{ status: k }} onAdded={() => { reload(); setAdding(null) }} /> : <button className="add-row center" onClick={() => setAdding(k)}><Plus size={14} />Add a task</button>}
              {items.map((t) => {
                const ds = dueState(t)
                return (
                  <div key={t.id} className="bcard tw-card" draggable onDragStart={() => setDrag(t)} onDragEnd={() => setDrag(null)} onClick={() => openTask(t.id)}>
                    <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}><CheckButton task={t} onChange={() => { reload(); refresh() }} /><div className="t">{t.title}</div></div>
                    <div className="small muted ellipsis crumbs-line">{t.project_name}{t.tasklist_name && <> › {t.tasklist_name}</>}</div>
                    <div className="m">
                      {t.assignees.length > 0 && <AvatarStack users={t.assignees} size={20} max={3} />}
                      {t.tags.slice(0, 2).map((x) => <span className="tag" key={x}>{x}</span>)}
                      <span style={{ flex: 1 }} />
                      <PriorityFlag p={t.priority} />
                      {t.due_date && <span className={`dates ${ds}`}>Due {shortDate(t.due_date)}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- Table tab ---------- */
function DateCell({ value, cls = '', onChange }) {
  return (
    <label className={`date-cell ${cls}`}>
      {value ? shortDate(value) : <span className="muted">—</span>}
      <input type="date" value={value || ''} onChange={(e) => onChange(e.target.value || null)} />
    </label>
  )
}

function Cell({ k, t, patch, field }) {
  switch (k) {
    case 'assignees': return <PeoplePicker value={t.assignees.map((a) => a.id)} onChange={(ids) => patch({ assignee_ids: ids })} />
    case 'due_date': return <DateCell value={t.due_date} cls={dueState(t)} onChange={(v) => patch({ due_date: v })} />
    case 'start_date': return <DateCell value={t.start_date} onChange={(v) => patch({ start_date: v })} />
    case 'priority': return (
      <Popover width={160} trigger={<button className="cell-btn">{t.priority && t.priority !== 'none' ? <PriorityFlag p={t.priority} showLabel /> : <span className="muted">—</span>}</button>}>
        {(close) => ['high', 'medium', 'low', 'none'].map((k) => <button key={k} className="pop-item" onClick={() => { patch({ priority: k }); close() }}><PriorityFlag p={k} showLabel />{k === 'none' && 'None'}</button>)}
      </Popover>
    )
    case 'progress': return (
      <Popover width={200} trigger={<button className="progress-cell">{t.progress}%</button>}>
        {(close) => <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>{[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => <button key={v} className={`qf ${t.progress === v ? 'on' : ''}`} onClick={() => { patch({ progress: v }); close() }}>{v}%</button>)}</div>}
      </Popover>
    )
    case 'estimate': return <span className="muted">{t.estimate_minutes ? fmtMinutes(t.estimate_minutes) : '—'}</span>
    case 'logged': return <span className="muted">{t.logged_minutes ? fmtMinutes(t.logged_minutes) : '—'}</span>
    case 'tags': return t.tags.length ? <span className="ellipsis">{t.tags.map((x) => <span className="tag" key={x} style={{ marginRight: 4 }}>{x}</span>)}</span> : <span className="muted">—</span>
    case 'project': return <span className="proj-pill"><span className="dot" style={{ background: t.project_color }} />{t.project_name}</span>
    case 'status': return <StagePicker t={t} patch={patch} />
    case 'tasklist': return <span className="muted">{t.tasklist_name}</span>
    case 'created_by': return t.created_by ? <span className="row" style={{ gap: 6 }}><Avatar user={t.created_by} size={20} />{t.created_by.name}</span> : null
    case 'created_at': return <span className="muted">{fmtDate(t.created_at)}</span>
    case 'updated_at': return <span className="muted">{fmtDate(t.updated_at)}</span>
    default:
      if (k.startsWith('cf_') && field) return <FieldEditor compact field={field} value={t.custom?.[field.id]} onChange={(v) => api.put(`/tasks/${t.id}/custom`, { values: { [field.id]: v } })} />
      return null
  }
}

function TaskTable({ tasks, reload, selecting, sel, toggleSel, setSel, columns, setColumns, group, groupOrder }) {
  const { openTask, refresh } = useUi()
  const groups = useMemo(() => groupBy(tasks, group, groupOrder), [tasks, group, groupOrder])
  const [closed, setClosed] = useState({})
  const patch = (t) => async (body) => { await api.patch(`/tasks/${t.id}`, body); reload(); refresh() }
  const fields = useCustomFields()
  const [manageFields, setManageFields] = useState(false)
  const colLabel = (k) => (k.startsWith('cf_') ? fields.find((f) => `cf_${f.id}` === k)?.name : TABLE_COLS[k])
  const shown = columns.filter((k) => !k.startsWith('cf_') || fields.some((f) => `cf_${f.id}` === k))
  const colPicker = (
    <Popover align="right" width={200} trigger={<button className="icon-btn xs" title="Add or remove columns"><Plus size={15} /></button>}>
      <div className="pop-title">Columns</div>
      {[...Object.entries(TABLE_COLS), ...fields.map((f) => [`cf_${f.id}`, f.name])].map(([k, l]) => <label key={k} className="pop-item"><input type="checkbox" checked={columns.includes(k)} onChange={() => setColumns(columns.includes(k) ? columns.filter((x) => x !== k) : [...columns, k])} />{l}</label>)}
      <div className="pop-sep" />
      <button className="pop-item" onClick={() => setManageFields(true)}><Settings2 size={14} />Manage custom fields</button>
    </Popover>
  )
  return (
    <div className="table-wrap tw-table-wrap">
      <table className="table task-table tw-table">
        <thead><tr>
          {selecting && <th style={{ width: 30 }}><input type="checkbox" checked={tasks.length > 0 && tasks.every((t) => sel.has(t.id))} onChange={(e) => setSel(e.target.checked ? new Set(tasks.map((t) => t.id)) : new Set())} /></th>}
          <th className="name-col">Task name</th>
          {shown.map((k) => <th key={k}>{colLabel(k)}</th>)}
          <th style={{ width: 36 }}>{colPicker}</th>
        </tr></thead>
        <tbody>
          {groups.map((g) => {
            const open = !closed[g.key]
            return [
              group !== 'none' && (
                <tr key={'g' + g.key} className="group-row"><td colSpan={shown.length + 2 + (selecting ? 1 : 0)}>
                  <span className="row" style={{ gap: 8 }}>
                    <button className="icon-btn xs" onClick={() => setClosed({ ...closed, [g.key]: open })}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
                    {g.user && <Avatar user={g.user} size={20} />}{g.color && !g.user && <span className="dot" style={{ background: g.color }} />}
                    <b>{g.label}</b><span className="badge grey">{g.tasks.length}</span>
                    {(g.client || g.project) && group === 'tasklist' && <span className="muted small">{g.client ? `${g.client} › ` : ''}{g.project}</span>}
                  </span>
                </td></tr>
              ),
              ...(open ? g.tasks.map((t) => (
                <tr key={t.id} className={`${t.status === 'completed' ? 'done' : ''} ${sel.has(t.id) ? 'sel' : ''}`}>
                  {selecting && <td><input type="checkbox" checked={sel.has(t.id)} onChange={() => toggleSel(t.id)} /></td>}
                  <td className="name-col"><span className="row" style={{ gap: 8 }}><CheckButton task={t} onChange={() => { reload(); refresh() }} /><span className="tl-title link" onClick={() => openTask(t.id)}>{t.title}</span></span></td>
                  {shown.map((k) => <td key={k}><Cell k={k} t={t} patch={patch(t)} field={k.startsWith('cf_') ? fields.find((f) => `cf_${f.id}` === k) : null} /></td>)}
                  <td />
                </tr>
              )) : []),
              open && group !== 'none' && <tr key={'a' + g.key} className="add-tr"><td colSpan={shown.length + 2 + (selecting ? 1 : 0)}><InlineAdd ctx={g.ctx} onAdded={reload} /></td></tr>,
            ]
          })}
          {!tasks.length && <tr><td colSpan={shown.length + 2}><Empty title="No tasks" text="No tasks could be found" /></td></tr>}
        </tbody>
      </table>
      {manageFields && <FieldManager onClose={() => setManageFields(false)} />}
    </div>
  )
}

/* ---------- Completed tab ---------- */
function CompletedList({ tasks, reload }) {
  const { openTask } = useUi()
  const byDay = useMemo(() => {
    const m = new Map()
    tasks.forEach((t) => { const d = (t.completed_at || t.updated_at || '').slice(0, 10) || 'Earlier'; if (!m.has(d)) m.set(d, []); m.get(d).push(t) })
    return [...m.entries()]
  }, [tasks])
  const label = (d) => (d === 'Earlier' ? 'Earlier' : d === todayISO() ? 'Today' : d === new Date(Date.now() - 864e5).toISOString().slice(0, 10) ? 'Yesterday' : fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
  return byDay.map(([d, items]) => (
    <div className="tw-group" key={d}>
      <div className="tw-ghead"><b>{label(d)}</b><span className="badge grey">{items.length}</span></div>
      {items.map((t) => (
        <div key={t.id} className="twrow done" onClick={() => openTask(t.id)}>
          <CheckButton task={t} onChange={reload} />
          <AvatarStack users={t.assignees} size={22} max={2} />
          <span className="tw-title">{t.title}</span>
          <span className="muted small">{t.project_name}{t.tasklist_name ? ` › ${t.tasklist_name}` : ''}</span>
          <span className="row-end muted small">{t.completed_at ? `Completed ${fmtDate(t.completed_at)}` : 'Completed'}</span>
        </div>
      ))}
    </div>
  ))
}

