// Client view pieces (Teamwork's experience for a signed-in client user):
// "no access" page, My projects grid grouped by company, Theme + Sidebar appearance, theme applier.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Info, Sun, Moon, Monitor, Palette, LayoutGrid, ArrowDownUp, Filter as FilterIcon, ChevronDown } from 'lucide-react'
import { api } from '../lib/api'
import { useData, useUi } from '../lib/ui-context'
import { Avatar } from './ui'
import { timeAgo } from '../lib/format'

export function NoAccess() {
  return (
    <div className="cv-noaccess">
      <span className="cv-cone"><svg viewBox="0 0 64 64" width="56" height="56"><path d="M27 8h10l14 44H13z" fill="#7b8ff0" /><path d="M23 22h18l2.6 8H20.4zM18.6 36h26.8l2.6 8H16z" fill="#fff" /><rect x="8" y="50" width="48" height="6" rx="3" fill="#6a7ee6" /></svg></span>
      <b>You do not have access to this page</b>
    </div>
  )
}

/* ---------- Theme (Light / Dark / System default) + Sidebar (light / dark) ---------- */
export function applyAppearance(p) {
  const root = document.documentElement
  const theme = p?.theme || 'light'
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  root.dataset.theme = dark ? 'dark' : 'light'
  root.dataset.sidebar = p?.sidebar === 'dark' ? 'dark' : 'light'
}

export function useAppearance() {
  useEffect(() => {
    let prefs = null
    api.get('/prefs').then((p) => { prefs = p; applyAppearance(p) }).catch(() => {})
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const on = () => prefs && applyAppearance(prefs)
    mq?.addEventListener?.('change', on)
    return () => mq?.removeEventListener?.('change', on)
  }, [])
}

function Mini({ dark, side, split }) {
  const sb = side ?? dark
  return (
    <span className={`cv-mini ${dark ? 'dark' : ''}`}>
      <i className="top" />
      <i className={`side ${sb ? 'dark' : ''}`}><em style={{ width: '70%', background: '#4461d7' }} /><em /><em style={{ width: '55%' }} /><em style={{ width: '65%' }} /></i>
      <i className="main"><em style={{ width: '30%' }} /><em /><em /><em /></i>
      {split && <i className="split" />}
    </span>
  )
}

export function ThemeSettings() {
  const [p, setP] = useState(null)
  const { notify } = useUi()
  useEffect(() => { api.get('/prefs').then(setP) }, [])
  if (!p) return null
  const set = async (k, v) => { const n = await api.patch('/prefs', { [k]: v }); setP(n); applyAppearance(n); notify('Appearance saved') }
  const theme = p.theme || 'light'
  const side = p.sidebar || 'light'
  return (
    <div className="cv-appearance">
      <h3>Theme</h3>
      <p className="muted">Match your device's system setting, or choose light or dark mode manually. Only you will see these changes.</p>
      <div className="cv-choices">
        {[['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'System default', Monitor]].map(([k, l, I]) => (
          <button key={k} className={theme === k ? 'on' : ''} onClick={() => set('theme', k)}>
            <span className="cv-lbl"><I size={13} />{l}</span><Mini dark={k === 'dark'} split={k === 'system'} side={k === 'dark' ? true : false} />
          </button>))}
      </div>
      <h3>Sidebar</h3>
      <p className="muted">Choose a color theme for the sidebar. You can preview the options below before saving this preference.</p>
      <div className="cv-choices">
        {[['light', 'Light sidebar'], ['dark', 'Dark sidebar']].map(([k, l]) => (
          <button key={k} className={side === k ? 'on' : ''} onClick={() => set('sidebar', k)}>
            <span className="cv-lbl"><Palette size={13} />{l}</span><Mini dark={false} side={k === 'dark'} />
          </button>))}
      </div>
    </div>
  )
}

/* ---------- My work › My projects (client): grid grouped by company ---------- */
export function ClientProjects() {
  const { data } = useData('/projects?status=active')
  const { data: acts } = useData('/activity')
  const { refresh } = useUi()
  const navigate = useNavigate()
  const [letter, setLetter] = useState('')
  const [pick, setPick] = useState(false)
  const [order, setOrder] = useState('asc')
  const [tabs, setTabs] = useState({})
  const list = useMemo(() => (data || []).filter((p) => !letter || p.name.toUpperCase().startsWith(letter))
    .sort((a, b) => (order === 'asc' ? 1 : -1) * a.name.localeCompare(b.name)), [data, letter, order])
  const groups = list.reduce((g, p) => { const k = p.client?.name || 'No company'; (g[k] = g[k] || []).push(p); return g }, {})
  const letters = [...new Set((data || []).map((p) => p.name[0].toUpperCase()))].sort()
  const star = async (e, p) => { e.stopPropagation(); await api.patch(`/projects/${p.id}`, { name: p.name, is_starred: !p.is_starred }).catch(() => {}); refresh() }
  const last = (pid) => (acts || []).find((a) => a.project_id === pid)
  return (
    <>
      <div className="tw-toolbar">
        <h2>My projects</h2><span className="spacer" />
        <button className="tb-btn"><LayoutGrid size={14} />Grid<ChevronDown size={13} /></button>
        <button className="tb-btn" title={order === 'asc' ? 'A to Z' : 'Z to A'} onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}><ArrowDownUp size={14} /></button>
        <button className="tb-btn" onClick={() => setPick(!pick)}><FilterIcon size={14} />Filter</button>
      </div>
      <div className="cv-letter">Starting with <a onClick={() => setPick(!pick)}>{letter || 'any character'}</a>
        {pick && <span className="cv-letters"><button className={!letter ? 'on' : ''} onClick={() => { setLetter(''); setPick(false) }}>Any</button>
          {letters.map((l) => <button key={l} className={letter === l ? 'on' : ''} onClick={() => { setLetter(l); setPick(false) }}>{l}</button>)}</span>}
      </div>
      {data && !list.length && <div className="kit-empty"><b>No projects</b><span>Projects you've been added to will appear here.</span></div>}
      {Object.entries(groups).map(([co, ps]) => (
        <div key={co} className="cv-group">
          <h4>{co}</h4>
          <div className="cv-grid">{ps.map((p) => { const t = tabs[p.id] || 'about'; const a = last(p.id)
            return (
              <div key={p.id} className="cv-card" onClick={() => navigate(`/projects/${p.id}/tasks`)}>
                <div className="cv-card-head">
                  <button className="cv-star" title={p.is_starred ? 'Unstar' : 'Star'} onClick={(e) => star(e, p)}><Star size={14} fill={p.is_starred ? '#f0b400' : '#9aa0b5'} color={p.is_starred ? '#f0b400' : '#9aa0b5'} /></button>
                  <div style={{ flex: 1, minWidth: 0 }}><b>{p.name}</b><span className="muted">({co})</span></div>
                  {p.owner ? <Avatar user={p.owner} size={22} /> : <span className="cv-noowner" />}
                </div>
                <div className="cv-card-tabs" onClick={(e) => e.stopPropagation()}>
                  <button className={t === 'about' ? 'on' : ''} onClick={() => setTabs({ ...tabs, [p.id]: 'about' })}>About</button>
                  <button className={t === 'insights' ? 'on' : ''} onClick={() => setTabs({ ...tabs, [p.id]: 'insights' })}>Insights</button>
                </div>
                <div className="cv-card-body">
                  {t === 'about' ? <>
                    <div>{a ? <><b>{a.user?.name}</b> {a.action} <span className="muted small">· {timeAgo(a.created_at)}</span></> : 'This project has no recent update.'}</div>
                    {p.description && <div className="cv-desc"><Info size={12} />{p.description}</div>}
                  </> : <div className="cv-insights">
                    <div><b>{p.task_count - p.completed_count}</b><span>Open tasks</span></div>
                    <div><b>{p.completed_count}</b><span>Completed</span></div>
                    <div><b style={{ color: p.late_count ? 'var(--danger)' : undefined }}>{p.late_count}</b><span>Late</span></div>
                    <div><b>{p.progress}%</b><span>Progress</span></div>
                  </div>}
                </div>
              </div>) })}</div>
        </div>))}
    </>
  )
}
