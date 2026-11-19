// Project › Tickets: requests and problems raised on a project (clients raise them, the team works them to resolution).
import { useState } from 'react'
import { Ticket, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useUi } from '../lib/ui-context'
import { fmtDate, timeAgo } from '../lib/format'
import { DataTable, EmptyState, FormModal, Pill, PersonChip, useRows } from './Kit'

export const TICKET_STATUS = { open: ['blue', 'Open'], in_progress: ['amber', 'In progress'], resolved: ['green', 'Resolved'], closed: ['gray', 'Closed'] }
const PRIORITY = { low: ['gray', 'Low'], normal: ['blue', 'Normal'], high: ['amber', 'High'], urgent: ['red', 'Urgent'] }
const TYPES = [['question', 'Question'], ['problem', 'Problem'], ['request', 'Request']]

export default function TicketsTab({ projectId }) {
  const { user } = useAuth()
  const client = user?.role === 'client'
  const { people } = useUi()
  const { rows, create, update, remove } = useRows('tickets', { project_id: projectId })
  const [form, setForm] = useState(null)
  const [show, setShow] = useState('active')
  const shown = (rows || []).filter((t) => show === 'all' || (show === 'active' ? ['open', 'in_progress'].includes(t.status) : ['resolved', 'closed'].includes(t.status)))
  const canEdit = (t) => !client || t.created_by_id === user.id
  const save = (v) => (form.id ? update(form.id, v) : create({ ...v, project_id: projectId }))
  const count = (k) => (rows || []).filter((t) => (k === 'active' ? ['open', 'in_progress'] : ['resolved', 'closed']).includes(t.status)).length
  return (
    <>
      <div className="tw-toolbar"><h2>Tickets</h2>
        <div className="chips" style={{ marginLeft: 12 }}>{[['active', `Active ${count('active')}`], ['done', `Resolved ${count('done')}`], ['all', 'All']].map(([k, l]) => <button key={k} className={show === k ? 'on' : ''} onClick={() => setShow(k)}>{l}</button>)}</div>
        <span className="spacer" /><button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add ticket</button></div>
      <DataTable rows={shown} search={(t) => t.subject + (t.description || '')}
        empty={<EmptyState icon={Ticket} title="No tickets" text={client ? 'Raise a ticket to ask a question, report a problem or make a request.' : 'Tickets raised on this project will show up here.'}
          action={<button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add ticket</button>} />}
        columns={[
          { key: 'id', label: '#', render: (t) => <span className="muted">#{t.id}</span> },
          { key: 'subject', label: 'Subject', render: (t) => <span className="row" style={{ gap: 8 }}><Ticket size={15} className="muted" /><b>{t.subject}</b></span> },
          { key: 'type', label: 'Type', render: (t) => TYPES.find((x) => x[0] === t.type)?.[1] || t.type },
          { key: 'priority', label: 'Priority', render: (t) => <Pill tone={PRIORITY[t.priority]?.[0]}>{PRIORITY[t.priority]?.[1] || t.priority}</Pill> },
          { key: 'status', label: 'Status', render: (t) => <Pill tone={TICKET_STATUS[t.status]?.[0]}>{TICKET_STATUS[t.status]?.[1] || t.status}</Pill> },
          { key: 'created_by', label: 'Raised by', render: (t) => <PersonChip user={t.created_by} /> },
          { key: 'assigned_user', label: 'Assigned to', render: (t) => (t.assigned_user ? <PersonChip user={t.assigned_user} /> : <span className="muted">—</span>) },
          { key: 'updated_at', label: 'Updated', render: (t) => <span title={fmtDate(t.updated_at)}>{timeAgo(t.updated_at || t.created_at)}</span> },
          { key: 'a', label: '', nosort: true, render: (t) => canEdit(t) && <span className="act" onClick={(e) => e.stopPropagation()}><button className="icon-btn" title="Delete" onClick={() => confirm('Delete this ticket?') && remove(t.id)}><Trash2 size={14} /></button></span> },
        ]} onRow={(t) => setForm(t)} />
      {form && <FormModal title={form.id ? `Ticket #${form.id}` : 'Add ticket'} initial={form} onClose={() => setForm(null)}
        submitLabel={form.id ? 'Save' : 'Raise ticket'}
        onSubmit={(v) => (form.id && !canEdit(form) && client ? null : save(v))}
        fields={[
          { key: 'subject', label: 'Subject', required: true, autoFocus: true },
          { key: 'type', label: 'Type', type: 'select', half: true, required: true, default: 'question', options: TYPES },
          { key: 'priority', label: 'Priority', type: 'select', half: true, required: true, default: 'normal', options: Object.entries(PRIORITY).map(([k, v]) => [k, v[1]]) },
          { key: 'description', label: 'Description', type: 'textarea', rows: 6 },
          ...(form.id ? [{ key: 'status', label: 'Status', type: 'select', half: true, required: true, options: Object.entries(TICKET_STATUS).map(([k, v]) => [k, v[1]]) }] : []),
          ...(!client ? [{ key: 'assigned_user_id', label: 'Assigned to', type: 'select', half: true, options: people.filter((p) => p.role !== 'client').map((p) => [p.id, p.name]) }] : []),
        ]} />}
    </>
  )
}
