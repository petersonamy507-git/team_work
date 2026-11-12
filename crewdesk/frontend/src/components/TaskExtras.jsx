import { useEffect, useState } from 'react'
import { Plus, Trash2, ArrowUp, ArrowDown, Settings2, Search as SearchIcon } from 'lucide-react'
import { api, qs } from '../lib/api'
import { useUi } from '../lib/ui-context'
import { dueState, PROJECT_COLORS } from '../lib/format'
import { AvatarStack, Modal, Empty } from './ui'
import { CheckButton } from './TaskRow'
import { Popover, PriorityFlag } from './TaskPickers'
import { InlineAdd, shortDate } from './TaskList'

/* ---------------- custom fields ---------------- */
let fieldCache = null
const listeners = new Set()
export function reloadFields() { return api.get('/custom-fields').then((f) => { fieldCache = f; listeners.forEach((l) => l(f)) }) }
export function useCustomFields() {
  const [fields, setFields] = useState(fieldCache || [])
  useEffect(() => { listeners.add(setFields); if (!fieldCache) reloadFields(); return () => listeners.delete(setFields) }, [])
  return fields
}

/** Editor for one custom field value; commits on change/blur. */
export function FieldEditor({ field, value, onChange, compact }) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => setV(value ?? ''), [value])
  const cls = `input ${compact ? 'sm cell-input' : 'sm'}`
  switch (field.kind) {
    case 'checkbox': return <input type="checkbox" checked={v === 'true'} onChange={(e) => onChange(e.target.checked ? 'true' : null)} />
    case 'dropdown': return (
      <select className={`select ${compact ? 'sm cell-input' : 'sm'}`} value={v} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{compact ? '—' : 'Choose…'}</option>{field.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    )
    case 'date': return <input type="date" className={cls} value={v} onChange={(e) => onChange(e.target.value || null)} />
    case 'number': return <input type="number" className={cls} value={v} placeholder={compact ? '—' : ''} onChange={(e) => setV(e.target.value)} onBlur={() => String(v) !== String(value ?? '') && onChange(v === '' ? null : v)} />
    default: return <input type={field.kind === 'url' ? 'url' : 'text'} className={cls} value={v} placeholder={compact ? '—' : field.kind === 'url' ? 'https://' : 'Add a value'} onChange={(e) => setV(e.target.value)} onBlur={() => v !== (value ?? '') && onChange(v || null)} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} />
  }
}

export function CustomFieldsTab({ task, setTask }) {
  const fields = useCustomFields()
  const [manage, setManage] = useState(false)
  const save = async (fid, value) => setTask(await api.put(`/tasks/${task.id}/custom`, { values: { [fid]: value } }))
  return (
    <div className="sp-section">
      {!fields.length ? <p className="muted small">No custom fields yet. Add fields like "Client reference" or "Channel" and fill them on every task.</p> : (
        <div className="cf-grid">
          {fields.map((f) => (
            <label key={f.id} className="cf-row"><span className="muted">{f.name}</span>
              <span>{f.kind === 'url' && task.custom?.[f.id] ? <span className="row" style={{ gap: 6 }}><FieldEditor field={f} value={task.custom?.[f.id]} onChange={(v) => save(f.id, v)} /><a href={task.custom[f.id]} target="_blank" rel="noreferrer" className="accent small">Open</a></span> : <FieldEditor field={f} value={task.custom?.[f.id]} onChange={(v) => save(f.id, v)} />}</span>
            </label>
          ))}
        </div>
      )}
      <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setManage(true)}><Settings2 size={13} />Manage custom fields</button>
      {manage && <FieldManager onClose={() => setManage(false)} />}
    </div>
  )
}

export function FieldManager({ onClose }) {
  const fields = useCustomFields()
  const { notify } = useUi()
  const [f, setF] = useState({ name: '', kind: 'text', options: '' })
  const add = async (e) => {
    e.preventDefault()
    if (!f.name.trim()) return
    try { await api.post('/custom-fields', { name: f.name, kind: f.kind, options: f.options.split(',').map((x) => x.trim()).filter(Boolean) }); setF({ name: '', kind: 'text', options: '' }); reloadFields() } catch (err) { notify(err.message) }
  }
  const edit = async (fld, patch) => { await api.patch(`/custom-fields/${fld.id}`, patch); reloadFields() }
  const del = async (fld) => { if (confirm(`Delete "${fld.name}" and its values on every task?`)) { await api.del(`/custom-fields/${fld.id}`); reloadFields() } }
  return (
    <Modal title="Custom fields" onClose={onClose} wide footer={<button className="btn primary" onClick={onClose}>Done</button>}>
      <p className="muted small" style={{ marginTop: 0 }}>Fields appear on every task, in the Add task dialog and as table columns.</p>
      {fields.map((fld) => (
        <div key={fld.id} className="row" style={{ marginBottom: 8 }}>
          <input className="input sm" defaultValue={fld.name} onBlur={(e) => e.target.value.trim() && e.target.value !== fld.name && edit(fld, { name: e.target.value })} />
          <select className="select sm" style={{ width: 130 }} value={fld.kind} onChange={(e) => edit(fld, { kind: e.target.value })}>
            {['text', 'number', 'date', 'dropdown', 'checkbox', 'url'].map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}
          </select>
          {fld.kind === 'dropdown' && <input className="input sm" placeholder="Options, comma separated" defaultValue={fld.options.join(', ')} onBlur={(e) => edit(fld, { options: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />}
          <button className="icon-btn" title="Delete field" onClick={() => del(fld)}><Trash2 size={15} /></button>
        </div>
      ))}
      <form className="row card" style={{ padding: 10, marginTop: 12 }} onSubmit={add}>
        <input className="input sm" placeholder="New field name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <select className="select sm" style={{ width: 130 }} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
          {['text', 'number', 'date', 'dropdown', 'checkbox', 'url'].map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}
        </select>
        {f.kind === 'dropdown' && <input className="input sm" placeholder="Options, comma separated" value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} />}
        <button className="btn sm primary"><Plus size={13} />Add field</button>
      </form>
    </Modal>
  )
}

/* ---------------- workflows ---------------- */
export function useWorkflows() {
  const [list, setList] = useState(null)
  const load = () => api.get('/workflows').then(setList)
  useEffect(() => { load() }, [])
  return [list, load]
}

export function WorkflowManager({ onClose, onChanged, focusId }) {
  const { projects, notify } = useUi()
  const [list, load] = useWorkflows()
  const [sel, setSel] = useState(focusId || null)
  const [name, setName] = useState('')
  useEffect(() => { if (list && !sel && list[0]) setSel(list[0].id) }, [list])
  const w = list?.find((x) => x.id === sel)
  const done = () => { load(); onChanged?.() }
  const create = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    const nw = await api.post('/workflows', { name, project_ids: [] })
    setName(''); setSel(nw.id); done()
  }
  const patchW = async (body) => { await api.patch(`/workflows/${w.id}`, body); done() }
  const stage = async (s, body) => { await api.patch(`/workflow-stages/${s.id}`, body); done() }
  const move = async (i, d) => { const ids = w.stages.map((s) => s.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]]; await api.post(`/workflows/${w.id}/stages/reorder`, { ids }); done() }
  const delStage = async (s) => { try { await api.del(`/workflow-stages/${s.id}`); done() } catch (e) { notify(e.message) } }
  return (
    <Modal title="Workflows" onClose={onClose} wide footer={<button className="btn primary" onClick={onClose}>Done</button>}>
      <div className="wf-wrap">
        <div className="wf-list">
          {list?.map((x) => <button key={x.id} className={`pop-item ${x.id === sel ? 'on' : ''}`} onClick={() => setSel(x.id)}>{x.name}<span className="muted small" style={{ marginLeft: 'auto' }}>{x.stages.length}</span></button>)}
          <form onSubmit={create} style={{ marginTop: 8 }}><input className="input sm" placeholder="+ New workflow" value={name} onChange={(e) => setName(e.target.value)} /></form>
        </div>
        <div className="wf-edit">
          {!w ? <p className="muted">Create a workflow to give a group of projects their own board stages.</p> : <>
            <div className="row" style={{ marginBottom: 12 }}>
              <input className="input" key={w.id} defaultValue={w.name} onBlur={(e) => e.target.value.trim() && e.target.value !== w.name && patchW({ name: e.target.value })} />
              <button className="icon-btn" title="Delete workflow" onClick={async () => { if (confirm(`Delete workflow "${w.name}"?`)) { await api.del(`/workflows/${w.id}`); setSel(null); done() } }}><Trash2 size={15} /></button>
            </div>
            <div className="atd-k">Stages</div>
            {w.stages.map((s, i) => (
              <div key={s.id} className="row" style={{ gap: 6, marginBottom: 6 }}>
                <Popover width={170} trigger={<button className="color-dot" style={{ background: s.color }} title="Colour" />}>
                  {(c) => <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>{[...PROJECT_COLORS, '#ec4899', '#94a3b8'].map((col) => <button key={col} className="color-dot" style={{ background: col }} onClick={() => { stage(s, { color: col }); c() }} />)}</div>}
                </Popover>
                <input className="input sm" defaultValue={s.name} onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && stage(s, { name: e.target.value })} />
                <label className="small row" style={{ gap: 4, whiteSpace: 'nowrap' }} title="Moving a task here completes it"><input type="checkbox" checked={s.is_done} onChange={(e) => stage(s, { is_done: e.target.checked })} />Completes task</label>
                <button className="icon-btn xs" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={13} /></button>
                <button className="icon-btn xs" disabled={i === w.stages.length - 1} onClick={() => move(i, 1)}><ArrowDown size={13} /></button>
                <button className="icon-btn xs" onClick={() => delStage(s)}><Trash2 size={13} /></button>
              </div>
            ))}
            <button className="btn sm" onClick={async () => { await api.post(`/workflows/${w.id}/stages`, { name: 'New stage' }); done() }}><Plus size={13} />Add stage</button>
            <div className="atd-k" style={{ marginTop: 16 }}>Projects using this workflow</div>
            <div className="wf-projects">
              {projects.map((p) => (
                <label key={p.id} className="check-item"><input type="checkbox" checked={w.project_ids.includes(p.id)} onChange={(e) => patchW({ project_ids: e.target.checked ? [...w.project_ids, p.id] : w.project_ids.filter((x) => x !== p.id) })} /><span className="dot" style={{ background: p.color }} />{p.name}</label>
              ))}
            </div>
          </>}
        </div>
      </div>
    </Modal>
  )
}

/** Board for a named workflow: columns are the workflow's own stages. */
export function WorkflowBoard({ workflowId, params, onManage }) {
  const { openTask, refresh } = useUi()
  const [data, setData] = useState(null)
  const [drag, setDrag] = useState(null)
  const [over, setOver] = useState(null)
  const [colQ, setColQ] = useState({})
  const [adding, setAdding] = useState(null)
  const load = () => api.get(`/workflows/${workflowId}/board${qs(params)}`).then(setData)
  useEffect(() => { setData(null); load() }, [workflowId, JSON.stringify(params)])
  if (!data) return <div className="empty">Loading…</div>
  if (!data.project_ids.length) return <Empty title="No projects use this workflow yet" text="Pick the projects that should use these stages." action={<button className="btn primary" onClick={onManage}>Choose projects</button>} />
  const drop = async (s) => {
    setOver(null)
    if (!drag || drag.stage_id === s.id) return
    setData({ ...data, tasks: data.tasks.map((t) => (t.id === drag.id ? { ...t, stage_id: s.id } : t)) })
    await api.post(`/tasks/${drag.id}/stage`, { workflow_id: workflowId, stage_id: s.id })
    load(); refresh()
  }
  return (
    <div className="board tw-board">
      {data.stages.map((s) => {
        const items = data.tasks.filter((t) => t.stage_id === s.id && (!colQ[s.id] || t.title.toLowerCase().includes(colQ[s.id].toLowerCase())))
        return (
          <div className="column" key={s.id}>
            <div className="column-head">
              <span className="stage-chip"><span className="dot" style={{ background: s.color }} />{s.name}</span>
              <span className="muted small">{items.length}</span><span style={{ flex: 1 }} />
              <Popover align="right" width={200} trigger={<button className="icon-btn xs"><SearchIcon size={13} /></button>}>
                <input className="input sm" autoFocus placeholder={`Search ${s.name}`} value={colQ[s.id] || ''} onChange={(e) => setColQ({ ...colQ, [s.id]: e.target.value })} />
              </Popover>
              <button className="icon-btn xs" title="Add a task" onClick={() => setAdding(s.id)}><Plus size={14} /></button>
            </div>
            <div className={`column-body ${over === s.id ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(s.id) }} onDragLeave={() => setOver(null)} onDrop={() => drop(s)}>
              {adding === s.id ? <InlineAdd ctx={data.project_ids.length === 1 ? { project_id: data.project_ids[0] } : {}} onAdded={() => { load(); setAdding(null) }} />
                : <button className="add-row center" onClick={() => setAdding(s.id)}><Plus size={14} />Add a task</button>}
              {items.map((t) => (
                <div key={t.id} className="bcard tw-card" draggable onDragStart={() => setDrag(t)} onDragEnd={() => setDrag(null)} onClick={() => openTask(t.id)}>
                  <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}><CheckButton task={t} onChange={() => { load(); refresh() }} /><div className="t">{t.title}</div></div>
                  <div className="small muted ellipsis crumbs-line">{t.project_name}{t.tasklist_name && <> › {t.tasklist_name}</>}</div>
                  <div className="m">
                    {t.assignees.length > 0 && <AvatarStack users={t.assignees} size={20} max={3} />}
                    {t.tags.slice(0, 2).map((x) => <span className="tag" key={x}>{x}</span>)}
                    <span style={{ flex: 1 }} />
                    <PriorityFlag p={t.priority} />
                    {t.due_date && <span className={`dates ${dueState(t)}`}>Due {shortDate(t.due_date)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
