import { useEffect, useState } from 'react'
import { X, Calendar, Hourglass, Flag, Lock, Unlock, Tag, Link2, Bell, Eye, Percent, ChevronDown, Check, UserPlus } from 'lucide-react'
import { api } from '../lib/api'
import { useUi } from '../lib/ui-context'
import { useAuth } from '../lib/auth'
import { parseDuration, fmtDate, todayISO } from '../lib/format'
import { AvatarStack, Modal } from './ui'
import { Popover, PeoplePicker, PriorityFlag, TagEditor } from './TaskPickers'
import { useCustomFields, FieldEditor, FieldManager } from './TaskExtras'

const EMPTY = { custom: {}, title: '', description: '', assignee_ids: [], start_date: '', due_date: '', estimate: '', priority: 'none', is_private: false, tags: [], follower_ids: [], depends_on: [], reminders: [], progress: 0, repeat: '' }

/** Teamwork-style "Add task" dialog: project + task list, Details / Advanced options / Custom fields. */
export default function AddTaskDialog({ projectId, tasklistId, defaults = {}, onDone, onCancel }) {
  const { projects, refresh, notify } = useUi()
  const { user } = useAuth()
  const [pid, setPid] = useState(projectId || defaults.project_id || '')
  const [lid, setLid] = useState(tasklistId || defaults.tasklist_id || '')
  const [lists, setLists] = useState([])
  const [tab, setTab] = useState('details')
  const [f, setF] = useState({ ...EMPTY, assignee_ids: defaults.assignee_ids || [user.id], due_date: defaults.due_date || '' })
  const [notifyEmail, setNotifyEmail] = useState(false)
  const [err, setErr] = useState('')
  const [depQ, setDepQ] = useState('')
  const [depRes, setDepRes] = useState([])
  const [rem, setRem] = useState('')
  const fields = useCustomFields()
  const [manageFields, setManageFields] = useState(false)
  const set = (patch) => setF((x) => ({ ...x, ...patch }))

  useEffect(() => {
    if (!pid) return setLists([])
    api.get(`/projects/${pid}/tasklists`).then((l) => { setLists(l); if (!l.some((x) => String(x.id) === String(lid))) setLid(l[0]?.id || '') })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid])
  useEffect(() => {
    if (depQ.trim().length < 2) return setDepRes([])
    const t = setTimeout(() => api.get(`/tasks?q=${encodeURIComponent(depQ)}&status=all&limit=8`).then(setDepRes), 200)
    return () => clearTimeout(t)
  }, [depQ])

  const submit = async (another) => {
    if (!pid) return setErr('Select a project')
    if (!f.title.trim()) return setErr('Give the task a name')
    try {
      await api.post(`/projects/${pid}/tasks`, {
        title: f.title.trim(), description: f.description || null, tasklist_id: lid ? +lid : null,
        assignee_ids: f.assignee_ids, start_date: f.start_date || null, due_date: f.due_date || null,
        estimate_minutes: parseDuration(f.estimate) || null, priority: f.priority, is_private: f.is_private,
        tags: f.tags.join(', ') || null, follower_ids: f.follower_ids, depends_on_ids: f.depends_on.map((d) => d.id),
        custom: f.custom, reminders: f.reminders, progress: f.progress, repeat: f.repeat || null, notify: notifyEmail,
        status: defaults.status || undefined,
      })
      notify('Task created'); refresh()
      if (another) { setF({ ...EMPTY, assignee_ids: f.assignee_ids }); setErr('') } else onDone?.()
    } catch (e) { setErr(e.message) }
  }

  const footer = (
    <>
      <button className="btn ghost" onClick={onCancel} style={{ marginRight: 'auto' }}>Cancel</button>
      <span className="split-btn">
        <button className="btn primary" onClick={() => submit(false)}>Create task</button>
        <Popover align="right" width={200} trigger={<button className="btn primary caret"><ChevronDown size={14} /></button>}>
          {(c) => <button className="pop-item" onClick={() => { c(); submit(true) }}>Create and add another</button>}
        </Popover>
      </span>
    </>
  )

  return (
    <Modal title="Add task" onClose={onCancel} footer={footer} wide>
      {err && <div className="error">{err}</div>}
      <div className="field"><label>Select a project *</label>
        <select className="select" value={pid} onChange={(e) => setPid(e.target.value)} disabled={!!projectId}>
          <option value="">Project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></div>
      <div className="field"><label>Select a task list</label>
        <select className="select" value={lid} onChange={(e) => setLid(e.target.value)} disabled={!pid}>
          {!lists.length && <option value="">Task list</option>}{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select></div>
      <div className="seg full" style={{ margin: '4px 0 16px' }}>
        {[['details', 'Details'], ['advanced', 'Advanced options'], ['custom', 'Custom fields']].map(([k, l]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'details' && <>
        <div className="field"><label>Task name</label>
          <input className="input" autoFocus value={f.title} onChange={(e) => set({ title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && submit(false)} /></div>
        <div className="atd-grid">
          <div><div className="atd-k">Assignee</div>
            <PeoplePicker value={f.assignee_ids} onChange={(v) => set({ assignee_ids: v })}
              trigger={<button type="button" className="fld"><AssigneeLabel ids={f.assignee_ids} /></button>} /></div>
          <div><div className="atd-k">Dates</div>
            <Popover width={250} trigger={<button type="button" className={`fld ${f.start_date || f.due_date ? 'set' : ''}`}><Calendar size={14} />{f.start_date || f.due_date ? `${f.start_date ? fmtDate(f.start_date) : '…'} – ${f.due_date ? fmtDate(f.due_date) : '…'}` : 'No dates'}</button>}>
              <div className="field"><label>Start date</label><input type="date" className="input sm" value={f.start_date} onChange={(e) => set({ start_date: e.target.value })} /></div>
              <div className="field"><label>Due date</label><input type="date" className="input sm" value={f.due_date} onChange={(e) => set({ due_date: e.target.value })} /></div>
            </Popover></div>
          <div><div className="atd-k">Estimated time</div>
            <Popover width={200} trigger={<button type="button" className={`fld ${f.estimate ? 'set' : ''}`}><Hourglass size={14} />{f.estimate || 'No estimate'}</button>}>
              {(c) => <form onSubmit={(e) => { e.preventDefault(); c() }}><input className="input sm" autoFocus placeholder="e.g. 2h 30m" value={f.estimate} onChange={(e) => set({ estimate: e.target.value })} /></form>}
            </Popover></div>
          <div><div className="atd-k">Priority</div>
            <Popover width={170} trigger={<button type="button" className={`fld ${f.priority !== 'none' ? 'set' : ''}`}>{f.priority !== 'none' ? <PriorityFlag p={f.priority} showLabel /> : <><Flag size={14} />No priority</>}</button>}>
              {(c) => ['high', 'medium', 'low', 'none'].map((k) => <button type="button" key={k} className="pop-item" onClick={() => { set({ priority: k }); c() }}><PriorityFlag p={k} showLabel />{k === 'none' && 'None'}{f.priority === k && <Check size={14} className="ok" />}</button>)}
            </Popover></div>
          <div><div className="atd-k">Privacy</div>
            <button type="button" className={`fld ${f.is_private ? 'set' : ''}`} onClick={() => set({ is_private: !f.is_private })}>{f.is_private ? <><Lock size={14} />Private</> : <><Unlock size={14} />No privacy</>}</button></div>
          <div><div className="atd-k">Tags</div>
            <Popover width={260} trigger={<button type="button" className={`fld ${f.tags.length ? 'set' : ''}`}><Tag size={14} />{f.tags.length ? f.tags.map((t) => <span className="tag" key={t}>{t}</span>) : 'No tags'}</button>}>
              <TagEditor value={f.tags} onChange={(tags) => set({ tags })} />
            </Popover></div>
        </div>
        <textarea className="textarea" placeholder="Add a description" value={f.description} onChange={(e) => set({ description: e.target.value })} style={{ marginTop: 16 }} />
        <label className="row small" style={{ marginTop: 12, gap: 6 }}><input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />Notify assignees</label>
      </>}

      {tab === 'advanced' && (
        <div className="atd-grid">
          <div><div className="atd-k">Dependencies</div>
            <Popover width={300} trigger={<button type="button" className={`fld ${f.depends_on.length ? 'set' : ''}`}><Link2 size={14} />{f.depends_on.length ? `${f.depends_on.length} dependenc${f.depends_on.length > 1 ? 'ies' : 'y'}` : 'No dependencies'}</button>}>
              <div className="pop-title">Waits on</div>
              {f.depends_on.map((d) => <div key={d.id} className="pop-item">{d.title}<X size={13} className="ok" onClick={() => set({ depends_on: f.depends_on.filter((x) => x.id !== d.id) })} /></div>)}
              <input className="input sm" placeholder="Search tasks…" value={depQ} onChange={(e) => setDepQ(e.target.value)} />
              {depRes.map((r) => <button type="button" key={r.id} className="pop-item" onClick={() => { if (!f.depends_on.some((d) => d.id === r.id)) set({ depends_on: [...f.depends_on, { id: r.id, title: r.title }] }); setDepQ('') }}><span className="ellipsis" style={{ flex: 1 }}>{r.title}</span><span className="muted small">{r.project_name}</span></button>)}
            </Popover></div>
          <div><div className="atd-k">Reminders</div>
            <Popover width={260} trigger={<button type="button" className={`fld ${f.reminders.length ? 'set' : ''}`}><Bell size={14} />{f.reminders.length ? `${f.reminders.length} reminder${f.reminders.length > 1 ? 's' : ''}` : 'No reminders'}</button>}>
              {f.reminders.map((r) => <div key={r} className="pop-item">{r.replace('T', ' ')}<X size={13} className="ok" onClick={() => set({ reminders: f.reminders.filter((x) => x !== r) })} /></div>)}
              <input type="datetime-local" className="input sm" value={rem} onChange={(e) => setRem(e.target.value)} />
              <button type="button" className="btn sm primary" style={{ marginTop: 6 }} disabled={!rem} onClick={() => { set({ reminders: [...f.reminders, rem] }); setRem('') }}>Add reminder</button>
            </Popover></div>
          <div><div className="atd-k">Followers</div>
            <PeoplePicker title="Followers" allowNone={false} value={f.follower_ids} onChange={(v) => set({ follower_ids: v })}
              trigger={<button type="button" className={`fld ${f.follower_ids.length ? 'set' : ''}`}><Eye size={14} />{f.follower_ids.length ? `${f.follower_ids.length} follower${f.follower_ids.length > 1 ? 's' : ''}` : 'No followers'}</button>} /></div>
          <div><div className="atd-k">Progress</div>
            <span className="fld set"><Percent size={14} />{f.progress}%<input type="range" min="0" max="100" step="10" value={f.progress} onChange={(e) => set({ progress: +e.target.value })} style={{ flex: 1 }} /></span></div>
          <div><div className="atd-k">Set to repeat</div>
            <select className="select sm" value={f.repeat} onChange={(e) => set({ repeat: e.target.value })}>
              <option value="">Not set</option><option value="daily">Every day</option><option value="weekly">Every week</option><option value="monthly">Every month</option>
            </select></div>
        </div>
      )}

      {tab === 'custom' && <>
        {!fields.length && <p className="muted">No custom fields have been set up yet.</p>}
        <div className="cf-grid">
          {fields.map((fld) => <label key={fld.id} className="cf-row"><span className="muted">{fld.name}</span><FieldEditor field={fld} value={f.custom[fld.id]} onChange={(v) => set({ custom: { ...f.custom, [fld.id]: v } })} /></label>)}
        </div>
        <button type="button" className="btn sm" style={{ marginTop: 10 }} onClick={() => setManageFields(true)}>Manage custom fields</button>
        {manageFields && <FieldManager onClose={() => setManageFields(false)} />}
      </>}
    </Modal>
  )
}

function AssigneeLabel({ ids }) {
  const { people } = useUi()
  const sel = people.filter((p) => ids.includes(p.id))
  if (!sel.length) return <><UserPlus size={14} />Anyone</>
  return <><AvatarStack users={sel} size={20} max={3} />{sel.length === 1 ? sel[0].name : `${sel.length} people`}</>
}

export function MilestoneForm({ onDone, onCancel }) {
  const { projects, people, refresh, notify } = useUi()
  const { user } = useAuth()
  const [f, setF] = useState({ project_id: '', name: '', due_date: todayISO(), owner_id: user.id, description: '' })
  const [err, setErr] = useState('')
  const submit = async () => {
    if (!f.project_id || !f.name.trim()) return setErr('Pick a project and name the milestone')
    try {
      await api.post(`/projects/${f.project_id}/milestones`, { name: f.name.trim(), due_date: f.due_date || null, owner_id: f.owner_id ? +f.owner_id : null, description: f.description || null })
      notify('Milestone added'); refresh(); onDone?.()
    } catch (e) { setErr(e.message) }
  }
  return (
    <Modal title="Add milestone" onClose={onCancel} footer={<><button className="btn" onClick={onCancel}>Cancel</button><button className="btn primary" onClick={submit}>Add milestone</button></>}>
      {err && <div className="error">{err}</div>}
      <div className="field"><label>Project</label><select className="select" value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}><option value="">Choose…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div className="field"><label>Milestone name</label><input className="input" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="row">
        <div className="field"><label>Due date</label><input type="date" className="input" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></div>
        <div className="field"><label>Responsible</label><select className="select" value={f.owner_id} onChange={(e) => setF({ ...f, owner_id: e.target.value })}>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      </div>
      <div className="field"><label>Description</label><textarea className="textarea" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
    </Modal>
  )
}

export function EventForm({ onDone, onCancel }) {
  const { projects, refresh, notify } = useUi()
  const [f, setF] = useState({ title: '', date: todayISO(), start_time: '', end_time: '', project_id: '', description: '' })
  const [err, setErr] = useState('')
  const submit = async () => {
    if (!f.title.trim()) return setErr('Give the event a title')
    try {
      await api.post('/events', { ...f, title: f.title.trim(), project_id: f.project_id ? +f.project_id : null, start_time: f.start_time || null, end_time: f.end_time || null, description: f.description || null })
      notify('Event added'); refresh(); onDone?.()
    } catch (e) { setErr(e.message) }
  }
  return (
    <Modal title="Add event" onClose={onCancel} footer={<><button className="btn" onClick={onCancel}>Cancel</button><button className="btn primary" onClick={submit}>Add event</button></>}>
      {err && <div className="error">{err}</div>}
      <div className="field"><label>Title</label><input className="input" autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div className="row">
        <div className="field"><label>Date</label><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div className="field"><label>Start</label><input type="time" className="input" value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} /></div>
        <div className="field"><label>End</label><input type="time" className="input" value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} /></div>
      </div>
      <div className="field"><label>Project (optional)</label><select className="select" value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}><option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div className="field"><label>Description</label><textarea className="textarea" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
    </Modal>
  )
}

