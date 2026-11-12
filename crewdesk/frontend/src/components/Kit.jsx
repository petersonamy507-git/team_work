// Shared building blocks for the Teamwork-parity sections (page header with tabs, hero empty states,
// generic data table, schema-driven form modal, and the useRows CRUD hook).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Search, ArrowUpDown, Filter, Sparkles, X } from 'lucide-react'
import { api, qs } from '../lib/api'
import { useUi } from '../lib/ui-context'
import { Avatar, Modal } from './ui'

/** CRUD over /api/r/<kind> */
export function useRows(kind, params = {}) {
  const { version, notify } = useUi()
  const [rows, setRows] = useState(null)
  const key = JSON.stringify(params)
  const reload = useCallback(() => {
    api.get(`/r/${kind}${qs(params)}`).then(setRows).catch((e) => notify(e.message))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, key])
  useEffect(() => { reload() }, [reload, version])
  const create = async (body) => { const r = await api.post(`/r/${kind}`, { ...(params.project_id > 0 ? { project_id: params.project_id } : {}), ...body, ...(params.scope ? { scope: params.scope } : {}) }); reload(); return r }
  const update = async (id, body) => { const r = await api.patch(`/r/${kind}/${id}`, body); reload(); return r }
  const remove = async (id) => { await api.del(`/r/${kind}/${id}`); reload() }
  return { rows, setRows, reload, create, update, remove }
}

/** Teamwork page frame: breadcrumb-free header with icon, title, tab row and right-side actions */
export function Section({ icon: Icon, title, tabs, right, children, flush }) {
  return (
    <div className="tw-page">
      <div className="tw-head">
        <h1>{Icon && <Icon size={20} />}{title}</h1>
        {tabs && <nav className="tw-tabs">{tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            {t.label}{t.badge && <span className="new-badge">{t.badge}</span>}
          </NavLink>))}</nav>}
        <span className="spacer" />
        {right && <div className="kit-head-right">{right}</div>}
      </div>
      <div className={flush ? 'tw-flush' : 'tw-body'}>{children}</div>
    </div>
  )
}

/** Big centred intro used by Teamwork on feature landing pages */
export function Hero({ icon: Icon, title, text, children, badge }) {
  return (
    <div className="kit-hero">
      {Icon && <div className="kit-hero-icon"><Icon size={26} /></div>}
      <h2>{title}</h2>
      {badge && <div className="kit-badge">{badge}</div>}
      {text && <p>{text}</p>}
      {children && <div className="kit-hero-actions">{children}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="kit-empty">
      {Icon && <div className="kit-empty-icon"><Icon size={30} /></div>}
      <b>{title}</b>
      {text && <span>{text}</span>}
      {action}
    </div>
  )
}

export const AskAiButton = ({ onClick }) => (
  <button className="btn ai-outline" onClick={onClick}><Sparkles size={15} />Ask AI</button>
)

export function Pill({ tone = 'gray', children }) {
  return <span className={`kit-pill ${tone}`}>{children}</span>
}

export const money = (n, cur = 'USD') => (n == null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n))
export const hrs = (m) => { m = Math.round(m || 0); const h = Math.floor(m / 60); const r = m % 60; return r ? `${h}h ${r}m` : `${h}h` }

/** Sortable / searchable table. columns: [{key,label,render?,sort?,width?,align?}] */
export function DataTable({ columns, rows, onRow, search, toolbar, empty, rowKey = 'id', selectable, selected, setSelected }) {
  const keyOf = (r) => (typeof rowKey === 'function' ? rowKey(r) : r[rowKey])
  const [q, setQ] = useState('')
  const [sort, setSort] = useState(null)
  const list = useMemo(() => {
    let r = rows || []
    if (q && search) r = r.filter((x) => search(x).toLowerCase().includes(q.toLowerCase()))
    if (sort) {
      const col = columns.find((c) => c.key === sort.key)
      const val = col?.sort || ((x) => x[sort.key])
      r = [...r].sort((a, b) => { const A = val(a) ?? ''; const B = val(b) ?? ''; return (A > B ? 1 : A < B ? -1 : 0) * sort.dir })
    }
    return r
  }, [rows, q, sort, columns, search])
  const toggleAll = () => setSelected(selected.length === list.length ? [] : list.map(keyOf))
  return (
    <div className="kit-table-wrap">
      {(search || toolbar) && (
        <div className="tw-toolbar">
          {toolbar}
          <span className="spacer" />
          {search && <label className="kit-search"><Search size={14} /><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />{q && <X size={13} onClick={() => setQ('')} />}</label>}
        </div>
      )}
      {rows && list.length === 0 ? (empty || <div className="muted small" style={{ padding: 20 }}>Nothing here yet.</div>) : (
        <div className="kit-scroll">
          <table className="kit-table">
            <thead><tr>
              {selectable && <th style={{ width: 34 }}><input type="checkbox" checked={!!list.length && selected.length === list.length} onChange={toggleAll} /></th>}
              {columns.map((c) => (
                <th key={c.key} style={{ width: c.width, textAlign: c.align }} onClick={() => c.nosort || setSort(sort?.key === c.key ? { key: c.key, dir: -sort.dir } : { key: c.key, dir: 1 })}>
                  {c.label}{!c.nosort && c.label && <ArrowUpDown size={11} className="sort-ic" />}
                </th>))}
            </tr></thead>
            <tbody>
              {!rows && <tr><td colSpan={columns.length + 1} className="muted">Loading…</td></tr>}
              {list.map((r) => (
                <tr key={keyOf(r)} onClick={() => onRow?.(r)} className={onRow ? 'click' : ''}>
                  {selectable && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.includes(keyOf(r))} onChange={() => setSelected(selected.includes(keyOf(r)) ? selected.filter((x) => x !== keyOf(r)) : [...selected, keyOf(r)])} /></td>}
                  {columns.map((c) => <td key={c.key} style={{ textAlign: c.align }}>{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>)}
                </tr>))}
            </tbody>
          </table>
        </div>)}
    </div>
  )
}

export function FilterButton({ count, onClick }) {
  return <button className={`tb-btn ${count ? 'on' : ''}`} onClick={onClick}><Filter size={14} />Filter{count ? ` (${count})` : ''}</button>
}

export function PersonChip({ user }) {
  if (!user) return <span className="muted">—</span>
  return <span className="kit-person"><Avatar user={user} size={22} />{user.name}</span>
}

/**
 * Schema-driven modal form. fields: [{key,label,type:'text'|'textarea'|'number'|'date'|'select'|'project'|'person'|'people'|'checkbox'|'color'|'url', options, required, placeholder, half}]
 */
export function FormModal({ title, fields, initial = {}, onSubmit, onClose, submitLabel = 'Save', wide, children, onChange }) {
  const { projects, people, notify } = useUi()
  const [f, setF] = useState(() => {
    const o = {}
    fields.forEach((x) => { o[x.key] = initial[x.key] ?? (x.type === 'people' ? [] : x.type === 'checkbox' ? false : x.default ?? '') })
    return o
  })
  const [busy, setBusy] = useState(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onChange?.(f) }, [f])
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const submit = async () => {
    const miss = fields.find((x) => x.required && (f[x.key] === '' || f[x.key] == null))
    if (miss) return notify(`${miss.label} is required`)
    setBusy(true)
    try { await onSubmit(f); onClose() } catch (e) { notify(e.message) } finally { setBusy(false) }
  }
  const input = (x) => {
    const v = f[x.key]
    switch (x.type) {
      case 'textarea': return <textarea className="input" rows={x.rows || 4} value={v || ''} placeholder={x.placeholder} onChange={(e) => set(x.key, e.target.value)} />
      case 'number': return <input className="input" type="number" value={v ?? ''} min={x.min} max={x.max} onChange={(e) => set(x.key, e.target.value)} />
      case 'date': return <input className="input" type="date" value={v || ''} onChange={(e) => set(x.key, e.target.value)} />
      case 'color': return <input className="input" type="color" value={v || '#4461d7'} onChange={(e) => set(x.key, e.target.value)} style={{ height: 36, padding: 2 }} />
      case 'checkbox': return <label className="kit-check"><input type="checkbox" checked={!!v} onChange={(e) => set(x.key, e.target.checked)} />{x.text || x.label}</label>
      case 'select': return <select className="input" value={v ?? ''} onChange={(e) => set(x.key, e.target.value)}>{!x.required && <option value="">—</option>}{x.options.map((o) => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>)}</select>
      case 'project': return <select className="input" value={v ?? ''} onChange={(e) => set(x.key, e.target.value ? Number(e.target.value) : '')}><option value="">Select a project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      case 'person': return <select className="input" value={v ?? ''} onChange={(e) => set(x.key, e.target.value ? Number(e.target.value) : '')}><option value="">Nobody</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      case 'people': return (
        <div className="kit-people">{people.map((p) => (
          <label key={p.id} className={v.includes(p.id) ? 'on' : ''}><input type="checkbox" checked={v.includes(p.id)} onChange={() => set(x.key, v.includes(p.id) ? v.filter((i) => i !== p.id) : [...v, p.id])} /><Avatar user={p} size={20} />{p.name}</label>))}</div>)
      default: return <input className="input" type={x.type === 'url' ? 'url' : 'text'} value={v || ''} placeholder={x.placeholder} autoFocus={x.autoFocus} onChange={(e) => set(x.key, e.target.value)} />
    }
  }
  return (
    <Modal title={title} wide={wide} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy} onClick={submit}>{submitLabel}</button></>}>
      <div className="kit-form">
        {fields.map((x) => (
          <div key={x.key} className={`field ${x.half ? 'half' : ''}`}>
            {x.type !== 'checkbox' && <label>{x.label}{x.required && <span className="req">*</span>}</label>}
            {input(x)}
            {x.help && <div className="muted small">{x.help}</div>}
          </div>))}
        {children}
      </div>
    </Modal>
  )
}

export function Confirm(text) { return window.confirm(text) }

/** Simple horizontal bar row used in widgets/reports */
export function Meter({ value, max, tone }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0
  return <div className="kit-meter"><div className={tone || (pct > 100 ? 'over' : '')} style={{ width: `${pct}%` }} /></div>
}

export function toCSV(rows) {
  if (!rows?.length) return ''
  const cols = Object.keys(rows[0])
  const esc = (v) => { v = v ?? ''; v = String(v); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}
