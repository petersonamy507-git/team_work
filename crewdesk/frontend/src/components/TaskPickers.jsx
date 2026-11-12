import { useEffect, useRef, useState } from 'react'
import { Check, X, Plus, Flag } from 'lucide-react'
import { useUi } from '../lib/ui-context'
import { api } from '../lib/api'
import { PRIORITY } from '../lib/format'
import { Avatar, AvatarStack } from './ui'

/** A click-to-open popover anchored under its trigger. */
export function Popover({ trigger, children, align = 'left', width = 240, className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  useEffect(() => {
    if (!open) return
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const k = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [open])
  return (
    <span className={`rel ${className}`} ref={ref} onClick={(e) => e.stopPropagation()}>
      <span onClick={() => setOpen(!open)} style={{ display: 'inline-flex' }}>{trigger}</span>
      {open && (
        <div className="popover" style={{ [align]: 0, width }}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </span>
  )
}

/** Multi-select people picker with search. value = array of user ids. */
export function PeoplePicker({ value = [], onChange, trigger, title = 'Assign to', allowNone = true }) {
  const { people } = useUi()
  const [q, setQ] = useState('')
  const shown = people.filter((p) => p.is_active !== false && p.name.toLowerCase().includes(q.toLowerCase()))
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  const selected = people.filter((p) => value.includes(p.id))
  return (
    <Popover width={260} trigger={trigger || (
      <button className="cell-btn" type="button">
        {selected.length ? <><AvatarStack users={selected} size={22} max={3} />{selected.length === 1 && <span className="ellipsis">{selected[0].name}</span>}</>
          : <span className="muted">Anyone</span>}
      </button>
    )}>
      <div className="pop-title">{title}</div>
      <input className="input sm" autoFocus placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="pop-list">
        {allowNone && <button type="button" className="pop-item" onClick={() => onChange([])}><span className="avatar" style={{ width: 22, height: 22, background: '#cbd5e1', fontSize: 9 }}>–</span>Anyone (unassigned){!value.length && <Check size={14} className="ok" />}</button>}
        {shown.map((p) => (
          <button type="button" key={p.id} className="pop-item" onClick={() => toggle(p.id)}>
            <Avatar user={p} size={22} /><span className="ellipsis">{p.name}</span>
            {value.includes(p.id) && <Check size={14} className="ok" />}
          </button>
        ))}
      </div>
    </Popover>
  )
}

export function PriorityFlag({ p, showLabel }) {
  if (!p || p === 'none') return showLabel ? <span className="muted">None</span> : null
  const x = PRIORITY[p]
  return <span className="prio" style={{ color: x.color }} title={`${x.label} priority`}><Flag size={13} fill={x.color} />{showLabel && x.label}</span>
}

export function PriorityPicker({ value, onChange }) {
  return (
    <Popover width={170} trigger={<button type="button" className="cell-btn"><PriorityFlag p={value} showLabel /></button>}>
      {(close) => ['high', 'medium', 'low', 'none'].map((k) => (
        <button type="button" key={k} className="pop-item" onClick={() => { onChange(k); close() }}>
          <PriorityFlag p={k} showLabel />{k === 'none' && <span>None</span>}{value === k && <Check size={14} className="ok" />}
        </button>
      ))}
    </Popover>
  )
}

// workflow stages, in board order
export const STATUS = {
  backlog: { label: 'Backlog', color: '#94a3b8' },
  new: { label: 'To do', color: '#ec4899' },
  in_progress: { label: 'In progress', color: '#f59e0b' },
  completed: { label: 'Completed', color: '#10b981' },
}

export function StatusPill({ s }) {
  const x = STATUS[s] || STATUS.new
  return <span className="status-pill"><span className="dot" style={{ background: x.color }} />{x.label}</span>
}

export function StatusPicker({ value, onChange }) {
  return (
    <Popover width={170} trigger={<button type="button" className="cell-btn"><StatusPill s={value} /></button>}>
      {(close) => Object.keys(STATUS).map((k) => (
        <button type="button" key={k} className="pop-item" onClick={() => { onChange(k); close() }}>
          <StatusPill s={k} />{value === k && <Check size={14} className="ok" />}
        </button>
      ))}
    </Popover>
  )
}

let tagCache = null
export function useAllTags() {
  const [tags, setTags] = useState(tagCache || [])
  useEffect(() => { api.get('/tags').then((t) => { tagCache = t; setTags(t) }).catch(() => {}) }, [])
  return tags
}

/** Tag chips with add / remove and suggestions from tags used elsewhere. */
export function TagEditor({ value = [], onChange }) {
  const all = useAllTags()
  const [q, setQ] = useState('')
  const add = (t) => { t = t.trim(); if (t && !value.includes(t)) onChange([...value, t]); setQ('') }
  const sugg = all.map((t) => t.name).filter((t) => !value.includes(t) && t.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
  return (
    <span className="tag-editor">
      {value.map((t) => <span className="tag" key={t}>{t}<X size={11} className="x" onClick={() => onChange(value.filter((x) => x !== t))} /></span>)}
      <Popover width={220} trigger={<button type="button" className="icon-btn sm" title="Add tag"><Plus size={14} /></button>}>
        {(close) => (
          <>
            <input className="input sm" autoFocus placeholder="Add or create a tag" value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(q); close() } }} />
            <div className="pop-list">
              {sugg.map((t) => <button type="button" key={t} className="pop-item" onClick={() => { add(t); close() }}><span className="tag">{t}</span></button>)}
              {q.trim() && !all.some((t) => t.name === q.trim()) && <button type="button" className="pop-item" onClick={() => { add(q); close() }}><Plus size={14} />Create "{q.trim()}"</button>}
              {!sugg.length && !q && <div className="muted small" style={{ padding: 8 }}>Type to create a tag</div>}
            </div>
          </>
        )}
      </Popover>
    </span>
  )
}
