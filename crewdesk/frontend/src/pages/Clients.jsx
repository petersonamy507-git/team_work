// Manage › Clients (Teamwork /app/clients): expandable rows with projects, task completion, health, budgets
import { Fragment, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Building2, Pencil, Trash2, ChevronRight, ChevronDown, Search, Download, MoreHorizontal, Globe, MoreVertical, Upload, FileText, Sheet, Filter, CloudUpload, AtSign, X } from 'lucide-react'
import { Modal } from '../components/ui'
import { api } from '../lib/api'
import { useData, useUi } from '../lib/ui-context'
import { HealthPill, Menu } from '../components/ui'
import { Section, EmptyState, FormModal, PersonChip, money, hrs, toCSV } from '../components/Kit'
import { downloadText } from '../lib/taskFilters'

export default function Clients() {
  const { refresh, notify } = useUi()
  const { data } = useData('/clients/overview')
  const [sp] = useSearchParams()
  const [form, setForm] = useState(sp.get('new') ? {} : null)
  const [open, setOpen] = useState({})
  const [q, setQ] = useState('')
  const [sort, setSort] = useState(1)
  const [health, setHealth] = useState('')
  const [importing, setImporting] = useState(false)
  const rows = (data || []).filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) && (!health || c.health === health)).sort((a, b) => a.name.localeCompare(b.name) * sort)
  const del = async (c) => { if (confirm(`Delete client ${c.name}? Projects keep existing without a client.`)) { await api.del(`/clients/${c.id}`); refresh() } }
  const save = async (v) => { const body = { ...v, owner_id: v.owner_id || null }; form.id ? await api.patch(`/clients/${form.id}`, body) : await api.post('/clients', body); notify(form.id ? 'Client updated' : 'Client added'); refresh() }
  const exportPdf = () => {
    const w = window.open('', '_blank')
    const esc = (x) => String(x ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch])
    w.document.write(`<html><head><title>Clients</title><style>body{font-family:Inter,Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left;font-size:13px}th{color:#555}</style></head><body><h2>Clients</h2><table><tr><th>Client</th><th>Owner</th><th>Projects</th><th>Task completion</th><th>Health</th><th>Website</th><th>Email</th><th>Phone</th></tr>${rows.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.owner?.name)}</td><td>${c.project_count}</td><td>${c.completion}%</td><td>${esc((c.health || '').replace('_', ' '))}</td><td>${esc(c.website)}</td><td>${esc(c.email)}</td><td>${esc(c.phone)}</td></tr>`).join('')}</table></body></html>`)
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300)
  }
  return (
    <Section icon={Building2} title="Clients" right={<>
      <label className="kit-search"><Search size={14} /><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <Menu trigger={<button className={`tb-btn ${health ? 'on' : ''}`}><Filter size={14} />Filter{health ? ': ' + health.replace('_', ' ') : ''}</button>}>
        <div className="muted small" style={{ padding: '6px 10px' }}>Health</div>
        {[['', 'Any'], ['good', 'Good'], ['at_risk', 'At risk'], ['needs_attention', 'Needs attention']].map(([k, l]) => <button key={k} onClick={() => setHealth(k)}>{health === k ? '✓ ' : ''}{l}</button>)}
      </Menu>
      <button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add client</button>
      <Menu trigger={<button className="icon-btn" title="More options"><MoreVertical size={16} /></button>}>
        <div className="muted small" style={{ padding: '6px 10px' }}>Export · save as</div>
        <button onClick={exportPdf}><FileText size={14} color="#d93a3a" />PDF</button>
        <button onClick={() => api.download('/clients/export?format=csv', 'clients.csv')}><FileText size={14} color="#1f8a4c" />CSV</button>
        <button onClick={() => api.download('/clients/export?format=xlsx', 'clients.xlsx')}><Sheet size={14} color="#1f8a4c" />Excel</button>
        <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
        <button onClick={() => setImporting(true)}><Upload size={14} />Import</button>
      </Menu></>}>
      {data && !rows.length ? <EmptyState icon={Building2} title="No clients yet" text="Add the companies you work for to group their projects." action={<button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add client</button>} /> : (
        <div className="kit-scroll"><table className="kit-table">
          <thead><tr><th style={{ width: 28 }} /><th onClick={() => setSort(-sort)}>Client name {sort > 0 ? '↑' : '↓'}</th><th>Owner</th><th>Projects</th><th>Task completion</th><th>Health</th><th>Budget</th><th>Financial budgets</th><th>Time budgets</th><th /></tr></thead>
          <tbody>
            {!data && <tr><td colSpan={10} className="muted">Loading…</td></tr>}
            {rows.map((c) => (
              <Fragment key={c.id}>
                <tr className="click" onClick={() => c.project_count && setOpen({ ...open, [c.id]: !open[c.id] })}>
                  <td>{c.project_count > 0 && (open[c.id] ? <ChevronDown size={15} /> : <ChevronRight size={15} />)}</td>
                  <td><span className="row" style={{ gap: 8 }}><Building2 size={16} className="muted" /><b>{c.name}</b>{c.website && <a href={c.website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="muted"><Globe size={13} /></a>}</span></td>
                  <td><PersonChip user={c.owner} /></td>
                  <td>{c.project_count}</td>
                  <td><div style={{ background: '#f5f6f9', borderRadius: 6, padding: '6px 10px', minWidth: 110 }}><b className="small">{c.completion}%</b>{c.tasks_left > 0 && <div className="muted" style={{ fontSize: 11 }}>{c.tasks_left} tasks left</div>}</div></td>
                  <td>{c.health ? <HealthPill h={c.health} /> : '—'}</td>
                  <td>{c.budget ? money(c.budget) : '—'}</td>
                  <td>{c.budget ? money(c.budget) : '—'}</td>
                  <td>{c.time_budget ? hrs(c.time_budget) : '—'}</td>
                  <td onClick={(e) => e.stopPropagation()}><Menu trigger={<button className="icon-btn"><MoreHorizontal size={15} /></button>}>
                    <button onClick={() => setForm(c)}><Pencil size={14} />Edit client</button>
                    <button onClick={() => del(c)} style={{ color: 'var(--danger)' }}><Trash2 size={14} />Delete client</button></Menu></td>
                </tr>
                {open[c.id] && c.projects.map((p) => (
                  <tr key={`p${p.id}`} style={{ background: '#fafbfd' }}><td /><td colSpan={4} style={{ paddingLeft: 32 }}><Link to={`/projects/${p.id}`} style={{ color: 'var(--accent)' }}>{p.name}</Link> <span className="muted small">· {p.status}</span></td><td><HealthPill h={p.health} /></td><td colSpan={4} /></tr>))}
              </Fragment>))}
          </tbody>
        </table></div>)}
      {form && <ClientModal client={form} onClose={() => setForm(null)} onSave={save} />}
      {importing && <ImportClients onClose={() => setImporting(false)} onDone={refresh} />}
    </Section>
  )
}

const TABS = [['logo', 'Logo'], ['address', 'Address'], ['internal', 'Internal notes'], ['public', 'Client notes'], ['domains', 'Client domains']]
export function ClientModal({ client, onClose, onSave }) {
  const { people, notify } = useUi()
  const [f, setF] = useState({ name: '', website: '', email: '', phone: '', owner_id: '', address: '', address2: '', city: '', state: '', postcode: '', country: '', internal_notes: '', client_notes: '', logo: '', industry: '', ...client })
  const [tab, setTab] = useState('logo')
  const [domains, setDomains] = useState(() => (client.domains || '').split(',').filter(Boolean).concat(client.domains ? [] : ['']))
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const pick = (file) => { if (!file) return; if (file.size > 2_000_000) return notify('Logo must be under 2 MB'); const r = new FileReader(); r.onload = () => setF((x) => ({ ...x, logo: r.result })); r.readAsDataURL(file) }
  const submit = async () => {
    if (!f.name.trim()) return notify('Client name is required')
    setBusy(true)
    try { await onSave({ ...f, website: f.website && !/^https?:\/\//.test(f.website) ? 'https://' + f.website : f.website, domains: domains.map((d) => d.trim()).filter(Boolean).join(',') }); onClose() } catch (e) { notify(e.message) } finally { setBusy(false) }
  }
  const fl = (k, label, extra = {}) => <label className="fl-field"><span>{label}</span><input value={f[k] || ''} onChange={set(k)} placeholder=" " {...extra} /></label>
  return (
    <Modal title={client.id ? 'Edit client' : 'Add client'} onClose={onClose} footer={<><button className="btn link-btn" onClick={onClose}>Cancel</button><span style={{ flex: 1 }} /><button className="btn primary" disabled={busy} onClick={submit}>{client.id ? 'Save client' : 'Add client'}</button></>}>
      {fl('name', 'Client name *', { autoFocus: true })}
      {fl('website', 'Website', { placeholder: 'https://' })}
      {fl('email', 'Email')}
      {fl('phone', 'Phone')}
      <label className="fl-field"><span>Client owner</span><select value={f.owner_id || ''} onChange={(e) => setF({ ...f, owner_id: e.target.value ? Number(e.target.value) : '' })}><option value="">Nobody</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <div className="wtabs" style={{ marginTop: 8 }}>{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'logo' && (f.logo ? <div className="row" style={{ gap: 12, padding: '10px 0' }}><img src={f.logo} alt="logo" style={{ maxWidth: 90, maxHeight: 90, borderRadius: 8, border: '1px solid var(--border)' }} /><button className="btn" onClick={() => setF({ ...f, logo: '' })}><X size={13} />Remove</button></div> : (
        <label className="drop-zone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]) }}>
          <CloudUpload size={18} /> Drag and drop your file here. <span style={{ color: 'var(--accent)' }}>Browse files</span><span className="muted small" style={{ width: '100%', textAlign: 'center' }}>JPEG, JPG, PNG, GIF</span>
          <input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files[0])} /></label>))}
      {tab === 'address' && <div style={{ maxWidth: 380 }}>{fl('address', 'Line 1')}{fl('address2', 'Line 2')}{fl('city', 'City')}{fl('state', 'State')}{fl('postcode', 'Postcode')}{fl('country', 'Country')}</div>}
      {tab === 'internal' && <div><b className="small">Internal notes</b> <span className="muted small">(only your team sees these)</span><textarea className="input" rows={5} placeholder="Add a private note" value={f.internal_notes || ''} onChange={set('internal_notes')} /></div>}
      {tab === 'public' && <div><b className="small">Client notes</b> <span className="muted small">(visible to the client)</span><textarea className="input" rows={5} placeholder="Add a public note" value={f.client_notes || ''} onChange={set('client_notes')} /></div>}
      {tab === 'domains' && <div>
        <p className="small" style={{ margin: '6px 0 10px' }}>To correctly filter emails relating to this client, enter at least one domain.</p>
        {domains.map((d, i) => <div key={i} className="row" style={{ gap: 6, marginBottom: 6 }}><label className="fl-field" style={{ flex: 1, margin: 0 }}><span>Domain name</span><span className="row" style={{ gap: 4 }}><AtSign size={13} className="muted" /><input value={d} placeholder="e.g. myclient.com" onChange={(e) => setDomains(domains.map((x, j) => (j === i ? e.target.value : x)))} /></span></label>
          <button className="icon-btn" onClick={() => setDomains(domains.filter((_, j) => j !== i))}><Trash2 size={15} /></button></div>)}
        <button className="add-row" onClick={() => setDomains([...domains, ''])}><Plus size={14} />Add additional domain</button>
      </div>}
    </Modal>
  )
}

function ImportClients({ onClose, onDone }) {
  const { notify } = useUi()
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  const upload = async (file) => {
    if (!file) return
    if (!/\.(csv|xlsx)$/i.test(file.name)) return notify('Please choose a .csv or .xlsx file')
    setBusy(true)
    try { const fd = new FormData(); fd.append('file', file); const r = await api.upload('/clients/import', fd); setRes(r); onDone() } catch (e) { notify(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal wide title="Import clients" onClose={onClose}>
      {res ? <div style={{ padding: 30, textAlign: 'center' }}><h3>Imported {res.added} client{res.added === 1 ? '' : 's'}</h3>{res.skipped.length > 0 && <p className="muted">Skipped (already exist): {res.skipped.join(', ')}</p>}<button className="btn primary" style={{ marginTop: 12 }} onClick={onClose}>Done</button></div> : <>
        <label className="drop-zone big" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files[0]) }}>
          <CloudUpload size={44} className="muted" /><b style={{ width: '100%', textAlign: 'center' }}>{busy ? 'Importing…' : 'Click to upload or drag and drop'}</b>
          <span className="row" style={{ gap: 4 }}><span className="kit-pill gray">XLSX</span><span className="kit-pill gray">CSV</span></span>
          <input type="file" accept=".csv,.xlsx" hidden onChange={(e) => upload(e.target.files[0])} /></label>
        <p className="small" style={{ textAlign: 'center', marginTop: 16 }}><a style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => api.download('/clients/export?format=csv&sample=true', 'crewdesk-client-import-sample.csv')}>Download a sample file</a> to get started.</p>
      </>}
    </Modal>
  )
}
