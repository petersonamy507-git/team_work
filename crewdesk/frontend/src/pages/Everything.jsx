// "Everything" (More › Everything): Milestones, Comments, Forms, Risks, Notebooks, Files, Messages, Links.
// Every tab also works inside a project (pass projectId) for the project "More…" tabs.
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  LayoutGrid, Flag, MessageSquare, ClipboardList, AlertTriangle, BookOpen, Paperclip, Mail, Link2, Plus, Pencil,
  Trash2, CheckCircle2, Circle, Download, ExternalLink, Upload, Eye, Send, ToggleLeft, ToggleRight, ListPlus,
} from 'lucide-react'
import { api } from '../lib/api'
import { useData, useUi } from '../lib/ui-context'
import { fmtDate, timeAgo } from '../lib/format'
import { Avatar, Menu, Modal } from '../components/ui'
import { Section, DataTable, EmptyState, FormModal, Pill, PersonChip, useRows, AskAiButton } from '../components/Kit'

export const EVERYTHING_TABS = [
  ['milestones', 'Milestones', Flag], ['comments', 'Comments', MessageSquare], ['forms', 'Forms', ClipboardList],
  ['risks', 'Risks', AlertTriangle], ['notebooks', 'Notebooks', BookOpen], ['files', 'Files', Paperclip],
  ['messages', 'Messages', Mail], ['links', 'Links', Link2],
]

export default function Everything() {
  const { tab = 'milestones' } = useParams()
  const C = TAB_COMPONENTS[tab] || MilestonesTab
  return (
    <Section icon={LayoutGrid} title="Everything" tabs={EVERYTHING_TABS.map(([k, l]) => ({ to: `/everything/${k}`, label: l }))}>
      <C />
    </Section>
  )
}

const ProjectCell = (r) => r.project_name ? <Link to={`/projects/${r.project_id}`} onClick={(e) => e.stopPropagation()} className="muted">{r.project_name}</Link> : '—'

/* ---------------- Milestones ---------------- */
export function MilestonesTab({ projectId }) {
  const { projects, refresh, notify } = useUi()
  const { data } = useData(projectId ? `/projects/${projectId}/milestones` : '/milestones?status=all')
  const [f, setF] = useState('all')
  const [form, setForm] = useState(null)
  const pname = (id) => projects.find((p) => p.id === id)?.name
  const rows = (data || []).map((m) => ({ ...m, project_name: pname(m.project_id) }))
  const counts = { all: rows.length, upcoming: rows.filter((m) => !m.completed && !m.late).length, late: rows.filter((m) => m.late).length, completed: rows.filter((m) => m.completed).length }
  const shown = rows.filter((m) => f === 'all' || (f === 'completed' ? m.completed : f === 'late' ? m.late : !m.completed && !m.late))
  const save = async (v) => {
    const body = { name: v.name, description: v.description, due_date: v.due_date || null, owner_id: v.owner_id || null }
    if (form.id) await api.patch(`/milestones/${form.id}`, body)
    else await api.post(`/projects/${v.project_id || projectId}/milestones`, body)
    notify(form.id ? 'Milestone updated' : 'Milestone added'); refresh()
  }
  const toggle = async (m) => { await api.patch(`/milestones/${m.id}`, { completed: !m.completed }); refresh() }
  const del = async (m) => { if (confirm(`Delete milestone "${m.name}"?`)) { await api.del(`/milestones/${m.id}`); refresh() } }
  return (
    <>
      <div className="tw-toolbar"><h2>{projectId ? 'Milestones' : 'All Milestones'}</h2><span className="spacer" />
        <button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add milestone</button></div>
      <div className="wtabs">{[['all', 'All'], ['upcoming', 'Upcoming'], ['late', 'Late'], ['completed', 'Completed']].map(([k, l]) => (
        <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}<span className="n">{counts[k]}</span></button>))}</div>
      <DataTable rows={data ? shown : null} search={(m) => m.name + (m.project_name || '')}
        empty={<EmptyState icon={Flag} title="No Milestones" text="There are no milestones" action={<button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add the First Milestone</button>} />}
        columns={[
          { key: 'done', label: '', nosort: true, width: 30, render: (m) => <button className="star-btn" onClick={(e) => { e.stopPropagation(); toggle(m) }}>{m.completed ? <CheckCircle2 size={18} color="#22b573" /> : <Circle size={18} />}</button> },
          { key: 'name', label: 'Milestone', render: (m) => <b style={{ textDecoration: m.completed ? 'line-through' : '' }}>{m.name}</b> },
          ...(projectId ? [] : [{ key: 'project_name', label: 'Project', render: ProjectCell }]),
          { key: 'due_date', label: 'Due date', render: (m) => m.due_date ? <span style={{ color: m.late ? 'var(--danger)' : '' }}>{fmtDate(m.due_date, { day: 'numeric', month: 'short', year: 'numeric' })}</span> : '—' },
          { key: 'owner', label: 'Responsible', render: (m) => <PersonChip user={m.owner} />, sort: (m) => m.owner?.name },
          { key: 'progress', label: 'Tasks', render: (m) => `${m.completed_count || 0}/${m.task_count || 0}` },
          { key: 'status', label: 'Status', render: (m) => m.completed ? <Pill tone="green">Completed</Pill> : m.late ? <Pill tone="red">Late</Pill> : <Pill tone="amber">Upcoming</Pill> },
          { key: 'a', label: '', nosort: true, render: (m) => <span className="act"><button className="icon-btn" onClick={(e) => { e.stopPropagation(); setForm(m) }}><Pencil size={14} /></button><button className="icon-btn" onClick={(e) => { e.stopPropagation(); del(m) }}><Trash2 size={14} /></button></span> },
        ]} onRow={(m) => setForm(m)} />
      {form && <FormModal title={form.id ? 'Edit milestone' : 'Add milestone'} initial={{ ...form, owner_id: form.owner?.id }} onClose={() => setForm(null)} onSubmit={save}
        fields={[{ key: 'name', label: 'Milestone name', required: true, autoFocus: true },
          ...(!projectId && !form.id ? [{ key: 'project_id', label: 'Project', type: 'project', required: true }] : []),
          { key: 'due_date', label: 'Due date', type: 'date', half: true }, { key: 'owner_id', label: 'Responsible', type: 'person', half: true },
          { key: 'description', label: 'Description', type: 'textarea' }]} />}
    </>
  )
}

/* ---------------- Comments ---------------- */
export function CommentsTab({ projectId }) {
  const { data } = useData('/everything/comments')
  const { openTask } = useUi()
  const navigate = useNavigate()
  const rows = (data || []).filter((c) => !projectId || c.project_id === projectId)
  return (
    <>
      <div className="tw-toolbar"><h2>{projectId ? 'Comments' : 'All Comments'}</h2></div>
      {data && !rows.length ? <EmptyState icon={MessageSquare} title="No comments yet" text="Comments on tasks and messages will show up here." /> : (
        <div>{rows.map((c) => (
          <div key={c.id} className="twrow" style={{ alignItems: 'flex-start', padding: '12px 10px' }} onClick={() => (c.kind === 'task' ? openTask(Number(c.link.split('/').pop())) : navigate(c.link))}>
            <Avatar user={c.user} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="small"><b>{c.user?.name}</b> <span className="muted">commented on {c.kind}</span> <b>{c.on}</b>{!projectId && c.project_name && <span className="muted"> · {c.project_name}</span>}</div>
              <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{c.body}</div>
            </div>
            <span className="muted small">{timeAgo(c.created_at)}</span>
          </div>))}</div>)}
    </>
  )
}

/* ---------------- Forms ---------------- */
const FIELD_TYPES = [['text', 'Short text'], ['textarea', 'Long text'], ['number', 'Number'], ['date', 'Date'], ['email', 'Email'], ['select', 'Dropdown']]

function FormBuilder({ form, projectId, onClose, save }) {
  const [title, setTitle] = useState(form.title || '')
  const [description, setDescription] = useState(form.description || '')
  const [pid, setPid] = useState(form.project_id || projectId || '')
  const [fields, setFields] = useState(form.fields || [{ label: 'Your name', type: 'text', required: true }, { label: 'Request details', type: 'textarea', required: true }])
  const { projects, notify } = useUi()
  const upd = (i, k, v) => setFields(fields.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  const submit = async () => {
    if (!title.trim()) return notify('Form title is required')
    if (!pid) return notify('Choose a project')
    await save({ title, description, project_id: pid, fields }); onClose()
  }
  return (
    <Modal wide title={form.id ? 'Edit form' : 'Create form'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={submit}>Save form</button></>}>
      <div className="field"><label>Form title</label><input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      {!projectId && <div className="field"><label>Project (submissions become tasks here)</label><select className="input" value={pid} onChange={(e) => setPid(Number(e.target.value))}><option value="">Select a project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
      <div className="field"><label>Description</label><textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <label className="small muted">Questions</label>
      {fields.map((x, i) => (
        <div key={i} className="row" style={{ gap: 8, margin: '6px 0' }}>
          <input className="input" value={x.label} onChange={(e) => upd(i, 'label', e.target.value)} placeholder="Question" />
          <select className="input" style={{ width: 140 }} value={x.type} onChange={(e) => upd(i, 'type', e.target.value)}>{FIELD_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          {x.type === 'select' && <input className="input" style={{ width: 180 }} placeholder="Options, comma separated" value={x.options || ''} onChange={(e) => upd(i, 'options', e.target.value)} />}
          <label className="kit-check small"><input type="checkbox" checked={!!x.required} onChange={(e) => upd(i, 'required', e.target.checked)} />Required</label>
          <button className="icon-btn" onClick={() => setFields(fields.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
        </div>))}
      <button className="add-row" onClick={() => setFields([...fields, { label: '', type: 'text' }])}><ListPlus size={15} />Add question</button>
    </Modal>
  )
}

function FillForm({ form, onClose }) {
  const [a, setA] = useState({})
  const { notify, refresh } = useUi()
  const submit = async () => {
    const miss = (form.fields || []).find((x) => x.required && !a[x.label])
    if (miss) return notify(`${miss.label} is required`)
    await api.post(`/forms/${form.id}/responses`, { answers: a }); notify('Response submitted, a task was created'); refresh(); onClose()
  }
  return (
    <Modal title={form.title} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={submit}><Send size={14} />Submit</button></>}>
      {form.description && <p className="muted" style={{ marginBottom: 10 }}>{form.description}</p>}
      {(form.fields || []).map((x) => (
        <div className="field" key={x.label}><label>{x.label}{x.required && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
          {x.type === 'textarea' ? <textarea className="input" rows={3} onChange={(e) => setA({ ...a, [x.label]: e.target.value })} />
            : x.type === 'select' ? <select className="input" onChange={(e) => setA({ ...a, [x.label]: e.target.value })}><option value="">—</option>{(x.options || '').split(',').map((o) => o.trim()).filter(Boolean).map((o) => <option key={o}>{o}</option>)}</select>
              : <input className="input" type={x.type === 'textarea' ? 'text' : x.type} onChange={(e) => setA({ ...a, [x.label]: e.target.value })} />}
        </div>))}
    </Modal>
  )
}

function Responses({ form, onClose }) {
  const { data } = useData(`/forms/${form.id}/responses`)
  const { openTask } = useUi()
  return (
    <Modal wide title={`Responses · ${form.title}`} onClose={onClose}>
      {!data?.length ? <div className="muted">No responses yet.</div> : data.map((r) => (
        <div key={r.id} className="card" style={{ padding: 12, marginBottom: 8 }}>
          <div className="muted small">{timeAgo(r.created_at)} {r.task_id && <a onClick={() => { onClose(); openTask(r.task_id) }} style={{ color: 'var(--accent)', cursor: 'pointer' }}>· open task</a>}</div>
          {Object.entries(r.answers).map(([k, v]) => <div key={k}><b>{k}:</b> {String(v)}</div>)}
        </div>))}
    </Modal>
  )
}

export function FormsTab({ projectId }) {
  const { rows, create, update, remove } = useRows('forms', projectId ? { project_id: projectId } : {})
  const [edit, setEdit] = useState(null)
  const [fill, setFill] = useState(null)
  const [resp, setResp] = useState(null)
  const save = (v) => (edit.id ? update(edit.id, v) : create(v))
  return (
    <>
      <div className="tw-toolbar"><h2>{projectId ? 'Forms' : 'All Forms'}</h2><span className="spacer" /><button className="btn primary" onClick={() => setEdit({})}><Plus size={15} />Create form</button></div>
      <DataTable rows={rows} search={(f) => f.title}
        empty={<EmptyState icon={ClipboardList} title="Get started with Forms" text="Create a form within a project to start collecting responses." action={<button className="btn primary" onClick={() => setEdit({})}><Plus size={15} />Create form</button>} />}
        columns={[
          { key: 'title', label: 'Form', render: (f) => <b>{f.title}</b> },
          ...(projectId ? [] : [{ key: 'project_name', label: 'Project', render: ProjectCell }]),
          { key: 'fields', label: 'Questions', render: (f) => (f.fields || []).length },
          { key: 'is_active', label: 'Status', render: (f) => f.is_active ? <Pill tone="green">Open</Pill> : <Pill>Closed</Pill> },
          { key: 'created_by', label: 'Created by', render: (f) => <PersonChip user={f.created_by} /> },
          { key: 'created_at', label: 'Created', render: (f) => fmtDate(f.created_at) },
          { key: 'a', label: '', nosort: true, render: (f) => (
            <span className="act" onClick={(e) => e.stopPropagation()}>
              <button className="icon-btn" title="Fill in" onClick={() => setFill(f)}><Send size={14} /></button>
              <button className="icon-btn" title="Responses" onClick={() => setResp(f)}><Eye size={14} /></button>
              <button className="icon-btn" title={f.is_active ? 'Close form' : 'Open form'} onClick={() => update(f.id, { is_active: !f.is_active })}>{f.is_active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}</button>
              <button className="icon-btn" onClick={() => setEdit(f)}><Pencil size={14} /></button>
              <button className="icon-btn" onClick={() => confirm('Delete this form?') && remove(f.id)}><Trash2 size={14} /></button>
            </span>) },
        ]} onRow={(f) => f.is_active && setFill(f)} />
      {edit && <FormBuilder form={edit} projectId={projectId} save={save} onClose={() => setEdit(null)} />}
      {fill && <FillForm form={fill} onClose={() => setFill(null)} />}
      {resp && <Responses form={resp} onClose={() => setResp(null)} />}
    </>
  )
}

/* ---------------- Risks ---------------- */
const IMPACT = { low: 'green', medium: 'amber', high: 'red' }
export function RisksTab({ projectId }) {
  const { rows, create, update, remove } = useRows('risks', projectId ? { project_id: projectId } : {})
  const [form, setForm] = useState(null)
  const [status, setStatus] = useState('open')
  const shown = (rows || []).filter((r) => status === 'all' || r.status === status)
  const score = (r) => Math.round((r.probability / 100) * ({ low: 1, medium: 2, high: 3 }[r.impact] || 2) * 33)
  const byImpact = ['high', 'medium', 'low'].map((k) => [k, (rows || []).filter((r) => r.impact === k && r.status === 'open').length])
  const save = (v) => (form.id ? update(form.id, v) : create(v))
  const fields = [
    { key: 'source', label: 'Risk source', required: true, autoFocus: true, placeholder: 'What might go wrong?' },
    ...(!projectId && !form?.id ? [{ key: 'project_id', label: 'Project', type: 'project', required: true }] : []),
    { key: 'probability', label: 'Probability', type: 'select', half: true, required: true, default: 50, options: [[10, 'Very low (10%)'], [30, 'Low (30%)'], [50, 'Medium (50%)'], [70, 'High (70%)'], [90, 'Very high (90%)']] },
    { key: 'impact', label: 'Impact', type: 'select', half: true, required: true, default: 'medium', options: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']] },
    { key: 'owner_id', label: 'Risk owner', type: 'person', half: true },
    { key: 'status', label: 'Status', type: 'select', half: true, required: true, default: 'open', options: [['open', 'Open'], ['closed', 'Closed']] },
    { key: 'impact_schedule', label: 'Schedule', type: 'checkbox', text: 'Affects the schedule', half: true },
    { key: 'impact_cost', label: 'Cost', type: 'checkbox', text: 'Affects the cost', half: true },
    { key: 'impact_performance', label: 'Performance', type: 'checkbox', text: 'Affects performance', half: true },
    { key: 'mitigation', label: 'Mitigation plan', type: 'textarea' },
  ]
  return (
    <>
      <div className="tw-toolbar"><h2>{projectId ? 'Risks' : 'All risks'}</h2><span className="spacer" />
        <div className="chips">{[['open', 'Open'], ['closed', 'Closed'], ['all', 'All']].map(([k, l]) => <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}</button>)}</div>
        <button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add risk</button></div>
      <div className="dash-grid" style={{ marginBottom: 16 }}>
        <div className="widget" style={{ minHeight: 160 }}><div className="widget-head"><h3>Open risks by impact</h3></div>
          {byImpact.map(([k, n]) => <div key={k} className="row" style={{ gap: 10, margin: '6px 0' }}><Pill tone={IMPACT[k]}>{k}</Pill><div style={{ flex: 1 }}><div className="kit-meter"><div style={{ width: `${rows?.length ? (n * 100) / rows.length : 0}%`, background: k === 'high' ? '#e2445c' : k === 'medium' ? '#f0a500' : '#22b573' }} /></div></div><b>{n}</b></div>)}</div>
        <div className="widget" style={{ minHeight: 160 }}><div className="widget-head"><h3>Risk matrix</h3></div>
          <div style={{ display: 'grid', gridTemplateColumns: '70px repeat(3,1fr)', gap: 4, fontSize: 12 }}>
            <span /><b className="muted">Low</b><b className="muted">Medium</b><b className="muted">High</b>
            {[90, 70, 50, 30, 10].map((p) => [<span key={p} className="muted">{p}%</span>, ...['low', 'medium', 'high'].map((i) => {
              const n = (rows || []).filter((r) => r.status === 'open' && r.probability === p && r.impact === i).length
              const heat = (p / 90) * ({ low: 1, medium: 2, high: 3 }[i])
              return <span key={p + i} style={{ height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: heat > 1.8 ? '#ffd5db' : heat > .9 ? '#ffefc7' : '#dff5e8', fontWeight: 600 }}>{n || ''}</span>
            })])}
          </div></div>
      </div>
      <DataTable rows={rows ? shown : null} search={(r) => r.source}
        empty={<EmptyState icon={AlertTriangle} title="No risks" text="The risk register allows you to forecast any problems that may arise throughout the life cycle of your project for other team members to be aware of." action={<button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add risk</button>} />}
        columns={[
          { key: 'source', label: 'Risk', render: (r) => <b>{r.source}</b> },
          ...(projectId ? [] : [{ key: 'project_name', label: 'Project', render: ProjectCell }]),
          { key: 'probability', label: 'Probability', render: (r) => `${r.probability}%` },
          { key: 'impact', label: 'Impact', render: (r) => <Pill tone={IMPACT[r.impact]}>{r.impact}</Pill> },
          { key: 'score', label: 'Result', sort: score, render: (r) => <b>{score(r)}</b> },
          { key: 'owner', label: 'Owner', render: (r) => <PersonChip user={r.owner} />, sort: (r) => r.owner?.name },
          { key: 'status', label: 'Status', render: (r) => <Pill tone={r.status === 'open' ? 'blue' : 'gray'}>{r.status}</Pill> },
          { key: 'a', label: '', nosort: true, render: (r) => <span className="act" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn" title={r.status === 'open' ? 'Close' : 'Reopen'} onClick={() => update(r.id, { status: r.status === 'open' ? 'closed' : 'open' })}><CheckCircle2 size={14} /></button>
            <button className="icon-btn" onClick={() => confirm('Delete this risk?') && remove(r.id)}><Trash2 size={14} /></button></span> },
        ]} onRow={(r) => setForm(r)} />
      {form && <FormModal title={form.id ? 'Edit risk' : 'Add risk'} fields={fields} initial={form} onClose={() => setForm(null)} onSubmit={save} />}
    </>
  )
}

/* ---------------- Notebooks ---------------- */
export function NotebooksTab({ projectId }) {
  const { rows, create, update, remove } = useRows('notebooks', projectId ? { project_id: projectId } : {})
  const [open, setOpen] = useState(null)
  const [form, setForm] = useState(null)
  const groups = useMemo(() => {
    const g = {}
    ;(rows || []).forEach((n) => { const k = projectId ? (n.category || 'General') : n.project_name; (g[k] = g[k] || []).push(n) })
    return Object.entries(g)
  }, [rows, projectId])
  const save = (v) => (form.id ? update(form.id, v) : create(v))
  return (
    <>
      <div className="tw-toolbar"><h2>{projectId ? 'Notebooks' : 'All Notebooks'}</h2><span className="spacer" /><button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add notebook</button></div>
      {rows && !rows.length && <EmptyState icon={BookOpen} title="No Notebooks Yet" text="No notebooks have been added yet." action={<button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add notebook</button>} />}
      {groups.map(([g, list]) => (
        <div key={g} className="tw-group"><div className="tw-ghead"><b>{g}</b><span className="muted small">{list.length}</span></div>
          {list.map((n) => (
            <div key={n.id} className="twrow" onClick={() => setOpen(n)}>
              <BookOpen size={16} className="muted" /><span className="tw-title"><b>{n.title}</b></span>
              {n.category && !projectId && <Pill>{n.category}</Pill>}
              <span className="row-end muted small" style={{ gap: 8 }}><PersonChip user={n.created_by} />{timeAgo(n.updated_at)}</span>
            </div>))}
        </div>))}
      {open && (
        <Modal wide title={open.title} onClose={() => setOpen(null)} footer={<>
          <button className="btn" onClick={() => { remove(open.id); setOpen(null) }} style={{ color: 'var(--danger)' }}><Trash2 size={14} />Delete</button>
          <span className="spacer" /><button className="btn primary" onClick={() => { setForm(open); setOpen(null) }}><Pencil size={14} />Edit</button></>}>
          <div className="muted small" style={{ marginBottom: 10 }}>{open.project_name} · {open.category || 'General'} · updated {timeAgo(open.updated_at)}</div>
          <div className="note-body">{open.body || <span className="muted">This notebook is empty.</span>}</div>
        </Modal>)}
      {form && <FormModal wide title={form.id ? 'Edit notebook' : 'Add notebook'} initial={form} onClose={() => setForm(null)} onSubmit={save}
        fields={[{ key: 'title', label: 'Title', required: true, autoFocus: true },
          ...(!projectId && !form.id ? [{ key: 'project_id', label: 'Project', type: 'project', required: true }] : []),
          { key: 'category', label: 'Category', half: true }, { key: 'is_private', label: 'Private', type: 'checkbox', text: 'Private notebook', half: true },
          { key: 'body', label: 'Content', type: 'textarea', rows: 14 }]} />}
    </>
  )
}

/* ---------------- Files ---------------- */
const fsize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
export function FilesTab({ projectId }) {
  const { data, reload } = useData(projectId ? `/projects/${projectId}/files` : '/everything/files')
  const { projects, notify, refresh } = useUi()
  const [pid, setPid] = useState(projectId || '')
  const input = useRef()
  const rows = (data || []).map((f) => ({ ...f, name: f.name || f.original_name, project_name: f.project_name || projects.find((p) => p.id === f.project_id)?.name }))
  const upload = async (e) => {
    const files = [...e.target.files]
    if (!pid) return notify('Choose a project first')
    for (const file of files) { const fd = new FormData(); fd.append('file', file); await api.upload(`/projects/${pid}/files`, fd) }
    e.target.value = ''; notify(`${files.length} file(s) uploaded`); reload(); refresh()
  }
  const del = async (f) => { if (confirm(`Delete ${f.name}?`)) { await api.del(`/files/${f.id}`); reload() } }
  return (
    <>
      <div className="tw-toolbar"><h2>{projectId ? 'Files' : 'All Files'}</h2><span className="spacer" />
        {!projectId && <select className="input" style={{ width: 200, height: 32 }} value={pid} onChange={(e) => setPid(e.target.value)}><option value="">Upload to project…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
        <button className="btn primary" onClick={() => (pid ? input.current.click() : notify('Choose a project first'))}><Upload size={15} />Upload files</button>
        <input ref={input} type="file" multiple hidden onChange={upload} /></div>
      <DataTable rows={data ? rows : null} search={(f) => f.name}
        empty={<EmptyState icon={Paperclip} title="No files yet" text="Files uploaded to projects and tasks appear here." />}
        columns={[
          { key: 'name', label: 'File name', render: (f) => <span className="row" style={{ gap: 8 }}><Paperclip size={15} className="muted" /><b>{f.name}</b></span> },
          ...(projectId ? [] : [{ key: 'project_name', label: 'Project', render: ProjectCell }]),
          { key: 'size', label: 'Size', render: (f) => fsize(f.size) },
          { key: 'user', label: 'Uploaded by', render: (f) => <PersonChip user={f.user || f.uploaded_by} /> },
          { key: 'created_at', label: 'Date', render: (f) => fmtDate(f.created_at, { day: 'numeric', month: 'short', year: 'numeric' }) },
          { key: 'a', label: '', nosort: true, render: (f) => <span className="act" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn" onClick={() => api.download(`/files/${f.id}/download`, f.name)}><Download size={14} /></button>
            <button className="icon-btn" onClick={() => del(f)}><Trash2 size={14} /></button></span> },
        ]} onRow={(f) => api.download(`/files/${f.id}/download`, f.name)} />
    </>
  )
}

/* ---------------- Messages ---------------- */
export function MessagesTab() {
  const { data } = useData('/everything/messages')
  const navigate = useNavigate()
  return (
    <>
      <div className="tw-toolbar"><h2>All Messages</h2></div>
      <DataTable rows={data} search={(m) => m.title + m.body}
        empty={<EmptyState icon={Mail} title="No messages yet" text="Messages posted in projects appear here." />}
        columns={[
          { key: 'title', label: 'Message', render: (m) => <div><b>{m.title}</b><div className="muted small ellipsis" style={{ maxWidth: 480 }}>{m.body}</div></div> },
          { key: 'project_name', label: 'Project', render: ProjectCell },
          { key: 'user', label: 'Posted by', render: (m) => <PersonChip user={m.user} />, sort: (m) => m.user?.name },
          { key: 'replies', label: 'Replies' },
          { key: 'created_at', label: 'Posted', render: (m) => timeAgo(m.created_at) },
        ]} onRow={(m) => navigate(`/projects/${m.project_id}/messages/${m.id}`)} />
    </>
  )
}

/* ---------------- Links ---------------- */
export function LinksTab({ projectId }) {
  const { rows, create, update, remove } = useRows('links', projectId ? { project_id: projectId } : {})
  const [form, setForm] = useState(null)
  const save = (v) => { let url = v.url.trim(); if (!/^https?:\/\//i.test(url)) url = 'https://' + url; return form.id ? update(form.id, { ...v, url }) : create({ ...v, url }) }
  return (
    <>
      <div className="tw-toolbar"><h2>{projectId ? 'Links' : 'All Links'}</h2><span className="spacer" /><button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add link</button></div>
      <DataTable rows={rows} search={(l) => l.title + l.url}
        empty={<EmptyState icon={Link2} title="No Links Yet" text="No links have been linked here yet." action={<button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add link</button>} />}
        columns={[
          { key: 'title', label: 'Title', render: (l) => <span className="row" style={{ gap: 8 }}><Link2 size={15} className="muted" /><b>{l.title}</b></span> },
          { key: 'url', label: 'URL', render: (l) => <a href={l.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--accent)' }}>{l.url.replace(/^https?:\/\//, '').slice(0, 50)} <ExternalLink size={11} /></a> },
          ...(projectId ? [] : [{ key: 'project_name', label: 'Project', render: ProjectCell }]),
          { key: 'category', label: 'Category', render: (l) => l.category || '—' },
          { key: 'created_by', label: 'Added by', render: (l) => <PersonChip user={l.created_by} /> },
          { key: 'a', label: '', nosort: true, render: (l) => <span className="act" onClick={(e) => e.stopPropagation()}><button className="icon-btn" onClick={() => confirm('Delete link?') && remove(l.id)}><Trash2 size={14} /></button></span> },
        ]} onRow={(l) => setForm(l)} />
      {form && <FormModal title={form.id ? 'Edit link' : 'Add link'} initial={form} onClose={() => setForm(null)} onSubmit={save}
        fields={[{ key: 'title', label: 'Title', required: true, autoFocus: true }, { key: 'url', label: 'URL', required: true, placeholder: 'https://' },
          ...(!projectId && !form.id ? [{ key: 'project_id', label: 'Project', type: 'project', required: true }] : []),
          { key: 'category', label: 'Category' }, { key: 'description', label: 'Description', type: 'textarea' }]} />}
    </>
  )
}

export const TAB_COMPONENTS = { milestones: MilestonesTab, comments: CommentsTab, forms: FormsTab, risks: RisksTab, notebooks: NotebooksTab, files: FilesTab, messages: MessagesTab, links: LinksTab }
export { AskAiButton, Menu }
