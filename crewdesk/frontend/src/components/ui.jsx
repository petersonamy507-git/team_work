import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Inbox } from 'lucide-react'
import { PRIORITY, HEALTH, fmtDate, dueState } from '../lib/format'

export function Avatar({ user, size = 28 }) {
  if (!user) return <span className="avatar" style={{ width: size, height: size, background: '#cbd5e1', fontSize: size * 0.4 }}>?</span>
  const initials = user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span className="avatar" title={user.name} style={{ width: size, height: size, background: user.color || '#6366f1', fontSize: size * 0.4 }}>
      {initials}
    </span>
  )
}

export function AvatarStack({ users = [], max = 4, size = 26 }) {
  return (
    <span className="avatar-stack">
      {users.slice(0, max).map((u) => <Avatar key={u.id} user={u} size={size} />)}
      {users.length > max && <span className="avatar" style={{ width: size, height: size, background: '#94a3b8', fontSize: size * 0.38 }}>+{users.length - max}</span>}
    </span>
  )
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Empty({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="empty">
      <Icon size={40} />
      <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
      {text && <div className="small">{text}</div>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  )
}

export function Progress({ value }) {
  return <div className="progress"><div style={{ width: `${value || 0}%` }} /></div>
}

export function PriorityPill({ p }) {
  if (!p || p === 'none') return null
  const x = PRIORITY[p]
  return <span className="pill" style={{ background: x.color + '22', color: x.color }}>{x.label}</span>
}

export function HealthPill({ h }) {
  const x = HEALTH[h || 'none']
  return <span className="pill"><span className="dot" style={{ background: x.color }} />{x.label}</span>
}

export function Due({ task }) {
  if (!task.due_date) return null
  const s = dueState(task)
  return <span className={`due ${s}`}>{s === 'today' ? 'Today' : fmtDate(task.due_date)}</span>
}

export function Loading() {
  return <div className="empty">Loading…</div>
}

// Dropdown menu rendered in a portal with fixed positioning, so it is never cut off by
// scrolling tables, sidebars or the window edge (flips left/up when there is no room).
export function Menu({ trigger, children }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const ref = useRef()
  const menuRef = useRef()
  useEffect(() => {
    if (!open) return
    const h = (e) => !ref.current?.contains(e.target) && !menuRef.current?.contains(e.target) && setOpen(false)
    const close = (e) => { if (menuRef.current?.contains(e.target)) return; setOpen(false) }
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', h)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', h); window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); window.removeEventListener('keydown', esc) }
  }, [open])
  useLayoutEffect(() => {
    if (!open || !ref.current || !menuRef.current) return
    const t = ref.current.getBoundingClientRect()
    const m = menuRef.current.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight, pad = 8
    // triggers on the left half open to the right, on the right half open to the left
    let left = t.left + t.width / 2 < vw / 2 ? t.left : t.right - m.width
    left = Math.max(pad, Math.min(left, vw - m.width - pad))
    let top = t.bottom + 4
    if (top + m.height > vh - pad && t.top - m.height - 4 > pad) top = t.top - m.height - 4 // flip up
    top = Math.max(pad, Math.min(top, vh - m.height - pad))
    setPos({ left, top })
  }, [open])
  return (
    <span className="rel" ref={ref}>
      <span onClick={(e) => { e.stopPropagation(); setPos(null); setOpen(!open) }}>{trigger}</span>
      {open && createPortal(
        <div ref={menuRef} className="menu menu-float" style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999, maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' }}
          onMouseDown={(e) => e.stopPropagation()} onClick={() => setOpen(false)}>{children}</div>, document.body)}
    </span>
  )
}

export function Bars({ data, labels, format = (v) => v, color }) {
  const max = Math.max(1, ...data)
  return (
    <div className="bars">
      {data.map((v, i) => (
        <div className="bar" key={i}>
          <span className="v">{v ? format(v) : ''}</span>
          <div className="fill" style={{ height: `${(v / max) * 100}%`, background: color }} />
          <span className="x">{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}

export function Donut({ items, size = 140, thickness = 22, center }) {
  const total = items.reduce((a, b) => a + b.value, 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eceef5" strokeWidth={thickness} />
      {total > 0 && items.map((it, i) => {
        const len = (it.value / total) * c
        const el = (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={it.color} strokeWidth={thickness}
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        )
        offset += len
        return el
      })}
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize="18" fontWeight="700" fill="#1e2133">{center ?? total}</text>
    </svg>
  )
}

export function Toast({ text, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [text, onDone])
  return <div className="toast">{text}</div>
}
