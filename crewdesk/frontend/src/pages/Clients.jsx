// Manage › Clients (Teamwork /app/clients): expandable rows with projects, task completion, health, budgets
import { Fragment, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Building2, Pencil, Trash2, ChevronRight, ChevronDown, Search, Download, MoreHorizontal, Globe } from 'lucide-react'
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
  const rows = (data || []).filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name) * sort)
  const del = async (c) => { if (confirm(`Delete client ${c.name}? Projects keep existing without a client.`)) { await api.del(`/clients/${c.id}`); refresh() } }
  const save = async (v) => { const body = { ...v, owner_id: v.owner_id || null }; form.id ? await api.patch(`/clients/${form.id}`, body) : await api.post('/clients', body); notify(form.id ? 'Client updated' : 'Client added'); refresh() }
  return (
    <Section icon={Building2} title="Clients" right={<>
      <label className="kit-search"><Search size={14} /><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <button className="tb-btn" onClick={() => downloadText('clients.csv', toCSV(rows.map((c) => ({ Client: c.name, Owner: c.owner?.name || '', Projects: c.project_count, 'Task completion': `${c.completion}%`, Health: c.health || '', Website: c.website || '', Email: c.email || '', Phone: c.phone || '' }))))}><Download size={14} />Export</button>
      <button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add client</button></>}>
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
      {form && <FormModal title={form.id ? 'Edit client' : 'Add client'} initial={{ ...form, owner_id: form.owner_id || '' }} onClose={() => setForm(null)} onSubmit={save}
        fields={[{ key: 'name', label: 'Company name', required: true, autoFocus: true }, { key: 'owner_id', label: 'Client owner', type: 'person', half: true }, { key: 'industry', label: 'Industry', half: true },
          { key: 'website', label: 'Website', half: true }, { key: 'email', label: 'Email', half: true }, { key: 'phone', label: 'Phone', half: true }, { key: 'address', label: 'Address', half: true }]} />}
    </Section>
  )
}
