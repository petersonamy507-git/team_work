// Plan & Insights › Finance: Rates, Budgets, Invoices, Expenses (Teamwork /app/finance/*)
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { DollarSign, Plus, Trash2, Receipt, Wallet, PiggyBank, Calculator, Download, Clock, Search, Zap } from 'lucide-react'
import { api } from '../lib/api'
import { useData, useUi } from '../lib/ui-context'
import { Modal } from '../components/ui'
import { fmtDate } from '../lib/format'
import { Section, DataTable, EmptyState, FormModal, Pill, PersonChip, useRows, money, hrs, Meter, toCSV } from '../components/Kit'
import { downloadText } from '../lib/taskFilters'

const TABS = [{ to: '/finance/rates', label: 'Rates' }, { to: '/finance/budgets', label: 'Budgets' }, { to: '/finance/invoices', label: 'Invoices' }, { to: '/finance/expenses', label: 'Expenses' }]

export default function Finance({ projectId }) {
  const { tab = 'budgets' } = useParams()
  const C = { rates: RatesTab, budgets: BudgetsTab, invoices: InvoicesTab, expenses: ExpensesTab }[tab] || BudgetsTab
  if (projectId) return <ProjectFinance projectId={projectId} />
  return <Section icon={DollarSign} title="Finance" tabs={TABS}><C /></Section>
}

function ProjectFinance({ projectId }) {
  const [t, setT] = useState('budgets')
  const C = { budgets: BudgetsTab, invoices: InvoicesTab, expenses: ExpensesTab }[t]
  return (<><div className="wtabs">{[['budgets', 'Budgets'], ['invoices', 'Invoices'], ['expenses', 'Expenses']].map(([k, l]) => <button key={k} className={t === k ? 'on' : ''} onClick={() => setT(k)}>{l}</button>)}</div><C projectId={projectId} /></>)
}

const money2 = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0)
function RateInput({ value, onSave }) {
  return <input className="sheet-input" style={{ width: 110, textAlign: 'right' }} type="number" min="0" step="0.01" defaultValue={value} onBlur={(e) => Number(e.target.value) !== value && onSave(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} />
}
function RatesTab() {
  const [kind, setKind] = useState('people')
  const { data, reload } = useData('/finance/rates')
  const roles = useRows('roles')
  const { notify } = useUi()
  const [form, setForm] = useState(null)
  const [sel, setSel] = useState([])
  const save = async (uid, k, v) => { await api.post(`/finance/rates/${uid}`, { [k]: v }); notify('Rate saved'); reload() }
  const people = kind === 'people'
  return (
    <>
      <div className="tw-toolbar">
        <div className="chips"><button className={people ? 'on' : ''} onClick={() => setKind('people')}>People</button><button className={!people ? 'on' : ''} onClick={() => setKind('roles')}>Roles</button></div>
        <span className="small">{people ? `${data?.length ?? 0} people` : `${roles.rows?.length ?? 0} roles`}</span>
        <span className="spacer" />
        {!people && <button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add role</button>}
      </div>
      {people ? (
        <DataTable rows={data} rowKey="user_id" search={(r) => r.user.name} selectable selected={sel} setSelected={setSel}
          columns={[
            { key: 'user', label: 'Name', sort: (r) => r.user.name, render: (r) => <PersonChip user={r.user} /> },
            { key: 'billable_rate', label: 'Billable rate', align: 'right', render: (r) => <span title={money2(r.billable_rate)}><RateInput value={r.billable_rate} onSave={(v) => save(r.user_id, 'billable_rate', v)} /></span> },
            { key: 'cost_rate', label: 'Cost rate', align: 'right', render: (r) => <RateInput value={r.cost_rate} onSave={(v) => save(r.user_id, 'cost_rate', v)} /> },
            { key: 'margin', label: 'Margin', sort: (r) => r.billable_rate - r.cost_rate, render: (r) => r.billable_rate ? <Pill tone={r.billable_rate > r.cost_rate ? 'green' : 'red'}>{Math.round(((r.billable_rate - r.cost_rate) / r.billable_rate) * 100)}%</Pill> : '—' },
          ]} />
      ) : (
        <DataTable rows={roles.rows} search={(r) => r.name}
          empty={<EmptyState icon={Search} title="No roles found" text="Add a role to set its default billable and cost rate." action={<button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add role</button>} />}
          columns={[
            { key: 'name', label: 'Role', render: (r) => <b>{r.name}</b> },
            { key: 'billable_rate', label: 'Billable rate', align: 'right', render: (r) => <RateInput value={r.billable_rate} onSave={(v) => roles.update(r.id, { billable_rate: v })} /> },
            { key: 'cost_rate', label: 'Cost rate', align: 'right', render: (r) => <RateInput value={r.cost_rate} onSave={(v) => roles.update(r.id, { cost_rate: v })} /> },
            { key: 'members', label: 'People', nosort: true, render: (r) => (r.members.length ? `${r.members.length} people` : '—') },
            { key: 'a', label: '', nosort: true, render: (r) => <span className="act"><button className="icon-btn" onClick={() => confirm(`Delete role ${r.name}?`) && roles.remove(r.id)}><Trash2 size={14} /></button></span> },
          ]} />)}
      {form && <FormModal title="Add role" onClose={() => setForm(null)} onSubmit={(v) => roles.create(v)}
        fields={[{ key: 'name', label: 'Role name', required: true, autoFocus: true }, { key: 'billable_rate', label: 'Billable rate (per hour)', type: 'number', half: true }, { key: 'cost_rate', label: 'Cost rate (per hour)', type: 'number', half: true }, { key: 'member_ids', label: 'People', type: 'people' }]} />}
    </>
  )
}

function BudgetsTab({ projectId }) {
  const { data, reload } = useData('/finance/budgets')
  const { create, update, remove } = useRows('budgets', { project_id: -1 })
  const [sp] = useSearchParams()
  const [form, setForm] = useState(sp.get('new') ? { type: 'financial' } : null)
  const { projects } = useUi()
  const [active, setActive] = useState(true)
  const budgetRows = (data || []).filter((b) => !projectId || b.project_id === projectId)
  const pOf = (id) => projects.find((p) => p.id === id)
  const rows = (projectId ? budgetRows : projects.filter((p) => !active || p.status === 'active').map((p) => budgetRows.find((b) => b.project_id === p.id) || { id: `p${p.id}`, project_id: p.id, project_name: p.name, none: true }))
    .map((b) => ({ ...b, owner: b.owner || pOf(b.project_id)?.owner, client_name: b.client_name || pOf(b.project_id)?.client?.name }))
  const fmt = (b, v) => (b.type === 'time' ? hrs(v) : money(v))
  const save = async (v) => {
    const body = { ...v, project_id: v.project_id || form.project_id || projectId, amount: v.type === 'time' ? Math.round(Number(v.amount) * 60) : Number(v.amount) }
    form.id ? await update(form.id, body) : await create(body); reload()
  }
  return (
    <>
      <div className="tw-toolbar"><span className="small">{rows.length} projects</span><span className="spacer" />
        {!projectId && <button className={`tb-btn ${active ? 'on' : ''}`} onClick={() => setActive(!active)}><Zap size={14} />{active ? 'Active' : 'All'}</button>}
        <button className="btn primary" onClick={() => setForm({ type: 'financial' })}><Plus size={15} />Add budget</button></div>
      <DataTable rows={data ? rows : null} search={(b) => b.project_name}
        empty={<EmptyState icon={PiggyBank} title="No budgets yet" text="Track project budgets in real time: total, used and remaining, so you catch overruns early." action={<button className="btn primary" onClick={() => setForm({ type: 'financial' })}><Plus size={15} />Add budget</button>} />}
        columns={[
          ...(projectId ? [] : [{ key: 'project_name', label: 'Project name', render: (b) => <b>{b.project_name}</b> }, { key: 'client_name', label: 'Client', render: (b) => <b>{b.client_name || '—'}</b> }]),
          { key: 'type', label: 'Budget name', render: (b) => (b.none ? <span className="muted">—</span> : <Pill tone={b.type === 'time' ? 'purple' : 'blue'}>{b.type === 'time' ? 'Time budget' : 'Financial budget'}</Pill>) },
          { key: 'owner', label: 'Owner', sort: (b) => b.owner?.name, render: (b) => <PersonChip user={b.owner} /> },
          { key: 'amount', label: 'Budget', render: (b) => (b.none ? '—' : fmt(b, b.amount)) },
          { key: 'used', label: 'Used', render: (b) => (b.none ? '—' : fmt(b, b.used)) },
          { key: 'remaining', label: 'Remaining', render: (b) => (b.none ? '—' : <span style={{ color: b.remaining < 0 ? 'var(--danger)' : '' }}>{fmt(b, b.remaining)}</span>) },
          { key: 'pct', label: 'Progress', render: (b) => b.none ? '—' : <div className="row" style={{ gap: 8 }}><div style={{ width: 120 }}><Meter value={b.used} max={b.amount} tone={b.pct >= 100 ? 'over' : b.pct >= b.notify_pct ? '' : 'green'} /></div>{b.pct}%</div> },
          { key: 'period', label: 'Period', render: (b) => b.none ? '—' : b.start_date ? `${fmtDate(b.start_date)} – ${b.end_date ? fmtDate(b.end_date) : 'ongoing'}` : 'Project lifetime' },
          { key: 'a', label: '', nosort: true, render: (b) => <span className="act" onClick={(e) => e.stopPropagation()}>{b.none ? <button className="btn sm" onClick={() => setForm({ type: 'financial', project_id: b.project_id })}><Plus size={13} />Add budget</button> : <button className="icon-btn" onClick={async () => { if (confirm('Delete this budget?')) { await remove(b.id); reload() } }}><Trash2 size={14} /></button>}</span> },
        ]} onRow={(b) => setForm(b.none ? { type: 'financial', project_id: b.project_id } : { ...b, amount: b.type === 'time' ? b.amount / 60 : b.amount })} />
      {form && <FormModal title={form.id ? 'Edit budget' : 'Add budget'} initial={form} onClose={() => setForm(null)} onSubmit={save}
        fields={[...(!projectId && !form.id && !form.project_id ? [{ key: 'project_id', label: 'Project', type: 'project', required: true }] : []),
          { key: 'type', label: 'Budget type', type: 'select', required: true, half: true, options: [['financial', 'Financial (money)'], ['time', 'Time (hours)']] },
          { key: 'amount', label: 'Amount (money or hours)', type: 'number', required: true, half: true },
          { key: 'start_date', label: 'Start date', type: 'date', half: true }, { key: 'end_date', label: 'End date', type: 'date', half: true },
          { key: 'notify_pct', label: 'Notify when used (%)', type: 'number', default: 80 }]} />}
    </>
  )
}

const INV_TONE = { draft: 'gray', open: 'blue', paid: 'green', overdue: 'red' }
function InvoicesTab({ projectId }) {
  const { rows, create, update, remove, reload } = useRows('invoices', projectId ? { project_id: projectId } : {})
  const [form, setForm] = useState(null)
  const [status, setStatus] = useState('all')
  const today = new Date().toISOString().slice(0, 10)
  const list = (rows || []).map((i) => ({ ...i, status: i.status === 'open' && i.due_date && i.due_date < today ? 'overdue' : i.status }))
  const shown = list.filter((i) => status === 'all' || i.status === status)
  const totals = ['open', 'overdue', 'paid'].map((s) => [s, list.filter((i) => i.status === s).reduce((a, b) => a + b.amount, 0)])
  const save = async (v) => {
    const body = { ...v, project_id: v.project_id || projectId }
    const inv = form.id ? await update(form.id, body) : await create(body)
    if (v.pricing === 'time' && !form.id) { await api.post(`/finance/invoices/${inv.id}/from-time`); reload() }
    return inv
  }
  return (
    <>
      <div className="dash-grid" style={{ marginBottom: 14 }}>{totals.map(([s, v]) => (
        <div key={s} className="widget" style={{ minHeight: 0 }}><div className="muted small" style={{ textTransform: 'capitalize' }}>{s}</div><div style={{ fontSize: 22, fontWeight: 700 }}>{money(v)}</div></div>))}</div>
      <div className="tw-toolbar">
        <span className="small">{shown.length} invoice{shown.length === 1 ? '' : 's'}</span>
        <div className="chips">{['all', 'draft', 'open', 'overdue', 'paid'].map((s) => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)} style={{ textTransform: 'capitalize' }}>{s}</button>)}</div>
        <span className="spacer" />
        <button className="tb-btn" onClick={() => downloadText('invoices.csv', toCSV(shown.map((i) => ({ Invoice: i.number, Project: i.project_name, Issued: i.issue_date, Due: i.due_date, Status: i.status, Amount: i.amount }))))}><Download size={14} />Export</button>
        <button className="btn primary" onClick={() => setForm({ status: 'open', issue_date: today })}><Plus size={15} />Add invoice</button></div>
      <DataTable rows={rows ? shown : null} search={(i) => i.number + (i.description || '') + i.project_name}
        empty={<EmptyState icon={Receipt} title="No invoices yet" text="Create invoices from billable time and expenses so you can track paid and overdue invoices." action={<button className="btn primary" onClick={() => setForm({ status: 'open', issue_date: today })}><Plus size={15} />Add invoice</button>} />}
        columns={[
          { key: 'number', label: 'Invoice no.', render: (i) => <b>{i.number}</b> },
          ...(projectId ? [] : [{ key: 'project_name', label: 'Project' }]),
          { key: 'issue_date', label: 'Issue date', render: (i) => fmtDate(i.issue_date, { day: 'numeric', month: 'short', year: 'numeric' }) || '—' },
          { key: 'due_date', label: 'Due date', render: (i) => <span style={{ color: i.status === 'overdue' ? 'var(--danger)' : '' }}>{fmtDate(i.due_date, { day: 'numeric', month: 'short', year: 'numeric' }) || '—'}</span> },
          { key: 'created_by', label: 'Last edited by', render: (i) => <PersonChip user={i.created_by} /> },
          { key: 'description', label: 'Notes', render: (i) => <span className="ellipsis" style={{ maxWidth: 240, display: 'inline-block' }}>{i.description || '—'}</span> },
          { key: 'status', label: 'Status', render: (i) => <Pill tone={INV_TONE[i.status]}>{i.status}</Pill> },
          { key: 'amount', label: 'Amount', align: 'right', render: (i) => <b>{money(i.amount, i.currency)}</b> },
          { key: 'a', label: '', nosort: true, render: (i) => <span className="act" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn" title="Calculate from billable time" onClick={async () => { await api.post(`/finance/invoices/${i.id}/from-time`); reload() }}><Calculator size={14} /></button>
            {i.status !== 'paid' && <button className="icon-btn" title="Mark paid" onClick={() => update(i.id, { status: 'paid' })}><Wallet size={14} /></button>}
            <button className="icon-btn" onClick={() => confirm('Delete invoice?') && remove(i.id)}><Trash2 size={14} /></button></span> },
        ]} onRow={(i) => setForm({ ...i, status: rows.find((r) => r.id === i.id).status })} />
      {form && <InvoiceModal invoice={form} projectId={projectId} onClose={() => setForm(null)} onSave={save} />}
    </>
  )
}

function ExpensesTab({ projectId }) {
  const { rows, create, update, remove } = useRows('expenses', projectId ? { project_id: projectId } : {})
  const invoices = useRows('invoices', projectId ? { project_id: projectId } : {}).rows
  const [form, setForm] = useState(null)
  const [which, setWhich] = useState('all')
  const list = (rows || []).filter((e) => which === 'all' || (which === 'invoiced' ? e.invoice_id : !e.invoice_id))
  const total = list.reduce((a, b) => a + b.cost, 0)
  const save = (v) => (form.id ? update(form.id, v) : create({ ...v, project_id: v.project_id || projectId }))
  return (
    <>
      <div className="tw-toolbar"><span className="small">{list.length} expense{list.length === 1 ? '' : 's'}</span><span className="muted small">· Total {money(total)}</span><span className="spacer" />
        <select className="input" style={{ width: 150, height: 32 }} value={which} onChange={(e) => setWhich(e.target.value)}><option value="all">All expenses</option><option value="invoiced">Invoiced</option><option value="not">Not invoiced</option></select><button className="btn primary" onClick={() => setForm({ date: new Date().toISOString().slice(0, 10) })}><Plus size={15} />Add expense</button></div>
      <DataTable rows={rows ? list : null} search={(e) => e.name + (e.description || '')}
        empty={<EmptyState icon={Calculator} title="Track expenses" text="Add expenses to track against your budget" action={<button className="btn outline-accent" onClick={() => setForm({})}><Plus size={15} />Add expenses</button>} />}
        columns={[
          { key: 'name', label: 'Expense', render: (e) => <b>{e.name}</b> },
          ...(projectId ? [] : [{ key: 'project_name', label: 'Project' }]),
          { key: 'date', label: 'Date', render: (e) => fmtDate(e.date, { day: 'numeric', month: 'short', year: 'numeric' }) || '—' },
          { key: 'created_by', label: 'Added by', render: (e) => <PersonChip user={e.created_by} /> },
          { key: 'invoice_id', label: 'Invoice', render: (e) => invoices?.find((i) => i.id === e.invoice_id)?.number || <span className="muted">Not invoiced</span> },
          { key: 'cost', label: 'Cost', align: 'right', render: (e) => <b>{money(e.cost)}</b> },
          { key: 'a', label: '', nosort: true, render: (e) => <span className="act" onClick={(ev) => ev.stopPropagation()}><button className="icon-btn" onClick={() => confirm('Delete expense?') && remove(e.id)}><Trash2 size={14} /></button></span> },
        ]} onRow={(e) => setForm(e)} />
      {form && <FormModal title={form.id ? 'Edit expense' : 'Add expense'} initial={form} onClose={() => setForm(null)} onSubmit={save}
        fields={[{ key: 'name', label: 'Name', required: true, autoFocus: true }, ...(!projectId && !form.id ? [{ key: 'project_id', label: 'Project', type: 'project', required: true }] : []),
          { key: 'date', label: 'Date', type: 'date', half: true }, { key: 'cost', label: 'Cost', type: 'number', required: true, half: true },
          { key: 'invoice_id', label: 'Add to invoice', type: 'select', options: (invoices || []).map((i) => [i.id, `${i.number} · ${i.project_name}`]) },
          { key: 'description', label: 'Description', type: 'textarea' }]} />}
    </>
  )
}

export { Clock }

const CURRENCIES = [['USD', 'US Dollar'], ['EUR', 'Euro'], ['GBP', 'British Pound'], ['PKR', 'Pakistani Rupee'], ['AED', 'UAE Dirham'], ['SAR', 'Saudi Riyal'], ['INR', 'Indian Rupee'], ['CAD', 'Canadian Dollar'], ['AUD', 'Australian Dollar']]
function InvoiceModal({ invoice, projectId, onClose, onSave }) {
  const { projects, notify } = useUi()
  const [f, setF] = useState({ project_id: projectId || '', number: '', issue_date: new Date().toISOString().slice(0, 10), due_date: '', currency: '', pricing: 'time', amount: '', po_number: '', description: '', status: 'open', ...invoice })
  const [adv, setAdv] = useState(!!(invoice.po_number || invoice.description))
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async () => {
    if (!f.project_id) return notify('Project is required')
    if (!String(f.number || '').trim()) return notify('Invoice no./ID is required')
    if (!f.issue_date) return notify('Issue date is required')
    if (!f.currency) return notify('Select a currency')
    if (f.pricing === 'fixed' && !f.amount) return notify('Enter the fixed price')
    setBusy(true)
    try { await onSave({ ...f, project_id: Number(f.project_id), amount: f.pricing === 'fixed' ? Number(f.amount) : (f.amount || 0), due_date: f.due_date || null }); onClose() } catch (e) { notify(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal title={invoice.id ? `Invoice ${invoice.number}` : 'Add invoice'} onClose={onClose} footer={<><button className="btn link-btn" onClick={onClose}>Cancel</button><span style={{ flex: 1 }} /><button className="btn primary" disabled={busy} onClick={submit}>{invoice.id ? 'Save invoice' : 'Add invoice'}</button></>}>
      {!projectId && <label className="fl-field"><span>Project *</span><select value={f.project_id} onChange={set('project_id')} disabled={!!invoice.id}><option value="">Project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
      <label className="fl-field" style={{ maxWidth: 260 }}><span>Invoice no./ID *</span><input value={f.number || ''} onChange={set('number')} placeholder="INV-001" /></label>
      <div className="row" style={{ gap: 12 }}>
        <label className="fl-field" style={{ flex: 1 }}><span>Issue date *</span><input type="date" value={f.issue_date || ''} onChange={set('issue_date')} /></label>
        <label className="fl-field" style={{ flex: 1 }}><span>Currency *</span><select value={f.currency} onChange={set('currency')}><option value="">Select a currency</option>{CURRENCIES.map(([k, l]) => <option key={k} value={k}>{k} – {l}</option>)}</select></label>
      </div>
      <label className="fl-field"><span>Pricing *</span><select value={f.pricing} onChange={set('pricing')}><option value="time">Price will be based on time & expenses</option><option value="fixed">Fixed price</option></select></label>
      {f.pricing === 'fixed' && <label className="fl-field" style={{ maxWidth: 260 }}><span>Fixed price *</span><input type="number" min="0" step="0.01" value={f.amount} onChange={set('amount')} /></label>}
      {invoice.id && <div className="row" style={{ gap: 12 }}>
        <label className="fl-field" style={{ flex: 1 }}><span>Due date</span><input type="date" value={f.due_date || ''} onChange={set('due_date')} /></label>
        <label className="fl-field" style={{ flex: 1 }}><span>Status</span><select value={f.status} onChange={set('status')}><option value="draft">Draft</option><option value="open">Open</option><option value="paid">Paid</option></select></label></div>}
      <button className="tb-btn" style={{ color: 'var(--muted)', margin: '4px 0 8px' }} onClick={() => setAdv(!adv)}>{adv ? '⌃' : '⌄'} Advanced options</button>
      {adv && <>
        <label className="fl-field" style={{ maxWidth: 260 }}><span>PO / reference no.</span><input value={f.po_number || ''} onChange={set('po_number')} /></label>
        <label className="fl-field"><span>Notes (displayed on invoice)</span><textarea rows={3} value={f.description || ''} onChange={set('description')} /></label>
      </>}
    </Modal>
  )
}
