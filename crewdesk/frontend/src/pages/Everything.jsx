// "Everything" (More › Everything): Milestones, Comments, Forms, Risks, Notebooks, Files, Messages, Links.
// Every tab also works inside a project (pass projectId) for the project "More…" tabs.
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  LayoutGrid, Flag, MessageSquare, ClipboardList, AlertTriangle, BookOpen, Paperclip, Mail, Link2, Plus, Pencil,
  Trash2, CheckCircle2, Circle, Download, ExternalLink, Upload, Eye, Send, ToggleLeft, ToggleRight, ListPlus,
  Smile, MoreVertical, MoreHorizontal, Search, ArrowDownUp, List, Table2, ChevronDown,
} from 'lucide-react'
import { api, getToken } from '../lib/api'
import { useAuth } from '../lib/auth'
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
const dayLabel = (iso) => { const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z'); const t = new Date(); const y = new Date(Date.now() - 864e5)
  return d.toDateString() === t.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) }
const byDay = (rows) => rows.reduce((g, r) => { const k = dayLabel(r.created_at); (g[k] = g[k] || []).push(r); return g }, {})
const EMOJI = ['👍', '❤️', '🎉', '😄', '👀', '✅']

export function Reactions({ kind, refId, all, reload }) {
  const { user } = useAuth()
  const mine = (all || []).filter((x) => x.kind === kind && x.ref_id === String(refId))
  const counts = EMOJI.map((e) => [e, mine.filter((x) => x.emoji === e)]).filter(([, l]) => l.length)
  const toggle = async (e) => { const own = mine.find((x) => x.emoji === e && x.user_id === user.id); if (own) await api.del(`/r/reactions/${own.id}`); else await api.post('/r/reactions', { kind, ref_id: String(refId), emoji: e }); reload() }
  return (
    <span className="row" style={{ gap: 4 }} onClick={(e) => e.stopPropagation()}>
      {counts.map(([e, l]) => <button key={e} className={`react-chip ${l.some((x) => x.user_id === user.id) ? 'on' : ''}`} title={l.map((x) => x.user?.name).join(', ')} onClick={() => toggle(e)}>{e} {l.length}</button>)}
      <Menu trigger={<button className="react-add" title="Add reaction"><Smile size={15} /></button>}>
        <div className="row" style={{ gap: 2, padding: 4 }}>{EMOJI.map((e) => <button key={e} style={{ fontSize: 18, width: 34 }} onClick={() => toggle(e)}>{e}</button>)}</div>
      </Menu>
    </span>
  )
}

export function CommentsTab({ projectId }) {
  const { data, reload } = useData('/everything/comments')
  const reacts = useRows('reactions')
  const { openTask, notify } = useUi()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [order, setOrder] = useState(-1)
  const rows = (data || []).filter((c) => (!projectId || c.project_id === projectId) && (c.body + c.on).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.created_at > b.created_at ? 1 : -1) * order)
  const open = (c) => (c.kind === 'task' ? openTask(Number(c.link.split('/').pop())) : navigate(c.link))
  const del = async (c) => { if (!confirm('Delete this comment?')) return; await api.del(c.kind === 'task' ? `/comments/${c.id.slice(1)}` : `/message-replies/${c.id.slice(1)}`); notify('Comment deleted'); reload() }
  return (
    <>
      <div className="tw-toolbar"><h2>{projectId ? 'Comments' : 'All Comments'}</h2><span className="spacer" />
        <label className="kit-search"><Search size={14} /><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <button className="tb-btn" title="Sort" onClick={() => setOrder(-order)}><ArrowDownUp size={14} />{order < 0 ? 'Newest' : 'Oldest'}</button></div>
      {data && !rows.length ? <EmptyState icon={MessageSquare} title="No comments yet" text="Comments on tasks and messages will show up here." /> : Object.entries(byDay(rows)).map(([day, list]) => (
        <div key={day}><div className="ev-day">{day}</div>
          {list.map((c) => (
            <div key={c.id} className="ev-item" onClick={() => open(c)}>
              <Avatar user={c.user} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div><b>{c.user?.name}</b> {c.project_name && <span className="muted small">({c.project_name})</span>}</div>
                <div className="muted small">{c.project_name} › {c.kind === 'task' ? 'Task' : 'Message'}: {c.on}</div>
                <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{c.body.length > 300 ? c.body.slice(0, 300) + '…' : c.body}</div>
              </div>
              <div className="ev-side">
                <span className="muted small">{timeAgo(c.created_at)}</span>
                <span className="row" style={{ gap: 4 }}><Reactions kind={c.kind} refId={c.id} all={reacts.rows} reload={reacts.reload} />
                  <span onClick={(e) => e.stopPropagation()}><Menu trigger={<button className="react-add"><MoreVertical size={15} /></button>}>
                    <button onClick={() => open(c)}><ExternalLink size={14} />Open</button>
                    <button onClick={() => { navigator.clipboard?.writeText(window.location.origin + c.link); notify('Link copied') }}><Link2 size={14} />Copy link</button>
                    <button style={{ color: 'var(--danger)' }} onClick={() => del(c)}><Trash2 size={14} />Delete</button>
                  </Menu></span></span>
              </div>
            </div>))}
        </div>))}
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
const fsize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const FTYPE = (name) => { const e = (name.split('.').pop() || '').toLowerCase()
  return ['pdf'].includes(e) ? ['#d93a3a', 'PDF'] : ['doc', 'docx'].includes(e) ? ['#2f6fdb', 'W'] : ['xls', 'xlsx', 'csv'].includes(e) ? ['#1f8a4c', 'X'] : ['ppt', 'pptx'].includes(e) ? ['#d2691e', 'P'] : ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(e) ? ['#8b5cf6', 'IMG'] : ['zip', 'rar'].includes(e) ? ['#64748b', 'ZIP'] : ['#94a3b8', 'T'] }
export function FilesTab({ projectId }) {
  const { data, reload } = useData(projectId ? `/projects/${projectId}/files` : '/everything/files')
  const { projects, notify, refresh } = useUi()
  const [pid, setPid] = useState(projectId || '')
  const [q, setQ] = useState('')
  const [view, setView] = useState('list')
  const input = useRef()
  const navigate = useNavigate()
  const rows = (data || []).map((f) => ({ ...f, name: f.name || f.original_name, project_name: f.project_name || projects.find((p) => p.id === f.project_id)?.name, user: f.user || f.uploaded_by }))
    .filter((f) => f.name.toLowerCase().includes(q.toLowerCase()))
  const groups = projectId
    ? Object.entries(rows.reduce((g, f) => { const k = f.name[0].toUpperCase(); (g[k] = g[k] || []).push(f); return g }, {})).sort()
    : Object.entries(rows.reduce((g, f) => { const k = f.project_name || 'Other'; (g[k] = g[k] || []).push(f); return g }, {})).sort()
  const upload = async (e) => {
    const files = [...e.target.files]
    if (!pid) return notify('Choose a project first')
    for (const file of files) { const fd = new FormData(); fd.append('file', file); await api.upload(`/projects/${pid}/files`, fd) }
    e.target.value = ''; notify(`${files.length} file(s) uploaded`); reload(); refresh()
  }
  const del = async (f) => { if (confirm(`Delete ${f.name}?`)) { await api.del(`/files/${f.id}`); reload() } }
  const preview = async (f) => {
    const res = await fetch(`/api/files/${f.id}/download`, { headers: { Authorization: `Bearer ${getToken()}` } })
    window.open(URL.createObjectURL(await res.blob()), '_blank')
  }
  return (
    <>
      <div className="tw-toolbar"><h2>{projectId ? 'Files' : 'All Files'}</h2><span className="spacer" />
        <label className="kit-search"><Search size={14} /><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <div className="scope-toggle"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={14} /></button><button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}><Table2 size={14} /></button></div>
        {!projectId && <select className="input" style={{ width: 200, height: 32 }} value={pid} onChange={(e) => setPid(e.target.value)}><option value="">Upload to project…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
        <button className="btn primary" onClick={() => (pid ? input.current.click() : notify('Choose a project first'))}><Upload size={15} />Upload files</button>
        <input ref={input} type="file" multiple hidden onChange={upload} /></div>
      {data && !rows.length && <EmptyState icon={Paperclip} title="No files yet" text="Files uploaded to projects and tasks appear here." />}
      {view === 'table' ? <DataTable rows={rows} columns={[
        { key: 'name', label: 'File name', render: (f) => <b>{f.name}</b> }, ...(projectId ? [] : [{ key: 'project_name', label: 'Project', render: ProjectCell }]),
        { key: 'size', label: 'Size', render: (f) => fsize(f.size) }, { key: 'user', label: 'Uploaded by', render: (f) => <PersonChip user={f.user} /> },
        { key: 'created_at', label: 'Date', render: (f) => fmtDate(f.created_at, { day: 'numeric', month: 'short', year: 'numeric' }) }]} onRow={preview} />
        : groups.map(([g, list]) => (
          <div key={g} style={{ marginBottom: 10 }}>
            <div className="ev-day">{projectId ? g : <>{g} <span className="muted small" style={{ fontWeight: 400 }}>– {list[0].client_name || projects.find((p) => p.id === list[0].project_id)?.client?.name || ''}</span></>}</div>
            {list.map((f) => { const [c, t] = FTYPE(f.name)
              return (
                <div key={f.id} className="file-row">
                  <span className="file-ic" style={{ background: c }}>{t}</span>
                  <div style={{ flex: 1, minWidth: 0 }}><b className="ellipsis" style={{ display: 'block' }}>{f.name}</b><span className="muted small">by {f.user?.name || 'someone'}, {timeAgo(f.created_at)} – {fsize(f.size)}</span></div>
                  <button className="round-btn" title="Preview" onClick={() => preview(f)}><Search size={14} /></button>
                  <button className="round-btn" title="Download" onClick={() => api.download(`/files/${f.id}/download`, f.name)}><Download size={14} /></button>
                  <Menu trigger={<button className="round-btn"><ChevronDown size={14} /></button>}>
                    <button onClick={() => preview(f)}><Eye size={14} />Preview</button>
                    <button onClick={() => api.download(`/files/${f.id}/download`, f.name)}><Download size={14} />Download</button>
                    {!projectId && <button onClick={() => navigate(`/projects/${f.project_id}/files`)}><ExternalLink size={14} />Go to project</button>}
                    <button style={{ color: 'var(--danger)' }} onClick={() => del(f)}><Trash2 size={14} />Delete</button>
                  </Menu>
                </div>) })}
          </div>))}
    </>
  )
}

/* ---------------- Messages ---------------- */
export function MessagesTab() {
  const { data, reload } = useData('/everything/messages')
  const { projects, notify } = useUi()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState(false)
  const rows = (data || []).filter((m) => (m.title + m.body).toLowerCase().includes(q.toLowerCase()))
  const client = (pid) => projects.find((p) => p.id === pid)?.client?.name
  const del = async (m) => { if (confirm(`Delete message "${m.title}"?`)) { await api.del(`/messages/${m.id}`); notify('Message deleted'); reload() } }
  return (
    <>
      <div className="tw-toolbar"><h2>All Messages</h2><span className="spacer" />
        <label className="kit-search"><Search size={14} /><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select className="input" style={{ width: 130, height: 32 }} value={expanded ? 'e' : 'c'} onChange={(e) => setExpanded(e.target.value === 'e')}><option value="c">Collapsed</option><option value="e">Expanded</option></select></div>
      {data && !rows.length && <EmptyState icon={Mail} title="No messages yet" text="Messages posted in projects appear here." />}
      {Object.entries(byDay(rows)).map(([day, list]) => (
        <div key={day}><div className="ev-day">{day}</div>
          {list.map((m) => (
            <div key={m.id} className="ev-item" onClick={() => navigate(`/projects/${m.project_id}/messages/${m.id}`)}>
              <Avatar user={m.user} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{m.title}</b>
                <div className="muted small">{m.user?.name} in <span className="dot" style={{ background: '#cbd5e1' }} /> No category ({m.project_name}{client(m.project_id) ? ` — ${client(m.project_id)}` : ''}){m.replies ? ` · ${m.replies} replies` : ''}</div>
                {expanded && <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{m.body}</div>}
              </div>
              <div className="ev-side" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <span className="muted small">{new Date(m.created_at + 'Z').toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                <span onClick={(e) => e.stopPropagation()}><Menu trigger={<button className="round-btn"><MoreHorizontal size={15} /></button>}>
                  <button onClick={() => navigate(`/projects/${m.project_id}/messages/${m.id}`)}><ExternalLink size={14} />Open</button>
                  <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/projects/${m.project_id}/messages/${m.id}`); notify('Link copied') }}><Link2 size={14} />Copy link</button>
                  <button style={{ color: 'var(--danger)' }} onClick={() => del(m)}><Trash2 size={14} />Delete</button>
                </Menu></span>
              </div>
            </div>))}
        </div>))}
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
