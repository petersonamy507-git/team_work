export const todayISO = () => new Date().toISOString().slice(0, 10)

export function fmtDate(iso, opts = { day: 'numeric', month: 'short' }) {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  return d.toLocaleDateString(undefined, opts)
}

export function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z')
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function timeAgo(iso) {
  if (!iso) return ''
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z')
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return fmtDate(iso)
}

export function fmtMinutes(m) {
  m = Math.round(m || 0)
  const h = Math.floor(m / 60)
  const r = m % 60
  if (!h) return `${r}m`
  return r ? `${h}h ${r}m` : `${h}h`
}

export function parseDuration(str) {
  // accepts "1h 30m", "1.5", "90m", "1:30"
  if (!str) return 0
  str = String(str).trim().toLowerCase()
  if (/^\d+:\d{1,2}$/.test(str)) {
    const [h, m] = str.split(':').map(Number)
    return h * 60 + m
  }
  let total = 0
  const h = str.match(/([\d.]+)\s*h/)
  const m = str.match(/([\d.]+)\s*m/)
  if (h) total += parseFloat(h[1]) * 60
  if (m) total += parseFloat(m[1])
  if (!h && !m && !isNaN(parseFloat(str))) total = parseFloat(str) * 60
  return Math.round(total)
}

export function dueState(task) {
  if (!task.due_date || task.status === 'completed') return ''
  const t = todayISO()
  if (task.due_date < t) return 'late'
  if (task.due_date === t) return 'today'
  return ''
}

export const HEALTH = {
  good: { label: 'Good', color: '#10b981' },
  at_risk: { label: 'At risk', color: '#f59e0b' },
  needs_attention: { label: 'Needs attention', color: '#ef4444' },
  none: { label: 'Not set', color: '#cbd5e1' },
}

export const PRIORITY = {
  none: { label: 'None', color: '#cbd5e1' },
  low: { label: 'Low', color: '#10b981' },
  medium: { label: 'Medium', color: '#f59e0b' },
  high: { label: 'High', color: '#ef4444' },
}

export const PROJECT_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b']
