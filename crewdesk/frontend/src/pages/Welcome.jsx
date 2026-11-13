// Welcome (Teamwork /app/welcome/the-fundamentals): personalised checklist, journey sections, quick actions.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, ChevronDown, ChevronUp, UserPlus, Building2, Folder, CheckSquare, Clock, CircleCheck, Circle, BookOpen, LifeBuoy, Video, X } from 'lucide-react'
import { api } from '../lib/api'
import { useUi } from '../lib/ui-context'

export const JOURNEY = [
  ['tour', 'Take a tour', [
    ['delivery', 'Delivering projects on time and on budget', '/projects'], ['budget', 'Budget and profitability tracking', '/finance/budgets'],
    ['status', 'Real-time project status visibility', '/reports/view/project-health'], ['workload', 'Live workload and capacity planning', '/planning/workload'],
    ['forecast', 'Resource forecasting for future projects', '/planning/schedule']]],
  ['ai', 'Work smarter with AI', [['ask', 'Ask AI what to focus on today', '/ai/ask?prompt=What%20should%20I%20focus%20on%20today%3F'], ['teammate', 'Set up an AI teammate', '/ai/teammates'], ['skill', 'Save an AI skill', '/ai/skills']]],
  ['tools', 'Connect your tools', [['integrations', 'Turn on an integration', '/settings/integrations']]],
]
const ALL = JOURNEY.flatMap(([, , items]) => items.map((i) => i[0]))

export function usePrefsChecklist() {
  const [done, setDone] = useState(null)
  useEffect(() => { api.get('/prefs').then((p) => setDone(p.welcome_done || [])) }, [])
  const mark = async (k) => { const next = [...new Set([...(done || []), k])]; setDone(next); await api.patch('/prefs', { welcome_done: next }) }
  const unmark = async (k) => { const next = (done || []).filter((x) => x !== k); setDone(next); await api.patch('/prefs', { welcome_done: next }) }
  return { done: done || [], loaded: !!done, mark, unmark }
}

export default function Welcome() {
  const navigate = useNavigate()
  const { setQuickAdd } = useUi()
  const { done, mark, unmark } = usePrefsChecklist()
  const [open, setOpen] = useState('tour')
  const go = (k, to) => { mark(k); navigate(to) }
  return (
    <div className="tw-page"><div className="tw-body" style={{ maxWidth: 1080 }}>
      <h1 style={{ fontSize: 32, fontWeight: 500, margin: '10px 0 20px' }}>Welcome to Crewdesk</h1>
      <div className="wel-card row" style={{ gap: 24 }}>
        <div><div style={{ fontSize: 30 }}>{done.length} / {ALL.length}</div><div className="muted small">steps done</div></div>
        <div style={{ flex: 1, borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted small">Checklist progress</span><b className="small" style={{ color: 'var(--accent)' }}>{done.length} / {ALL.length}</b></div>
          <div className="kit-meter" style={{ marginTop: 8 }}><div style={{ width: `${(done.length / ALL.length) * 100}%` }} /></div>
        </div>
        <button className="btn primary" onClick={() => navigate('/settings/subscription')}><ArrowUpRight size={15} />Browse plans</button>
      </div>
      <div className="muted small" style={{ fontWeight: 600, margin: '24px 0 8px' }}>START HERE WITH YOUR PERSONALISED PLAN ↓</div>
      <div className="wel-card wel-split">
        <div style={{ flex: 1, padding: 24 }}>
          <h2 style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.3 }}>Balance your team's workload with confidence</h2>
          <p className="muted" style={{ marginTop: 14, lineHeight: 1.6 }}>Here are some areas to explore in Crewdesk that will help you see capacity in real time, forecast resourcing, and keep delivery on time and on budget.</p>
        </div>
        <div className="wel-journey">
          <div className="muted small" style={{ fontWeight: 600, marginBottom: 10 }}>YOUR JOURNEY</div>
          {JOURNEY.map(([k, title, items]) => { const n = items.filter((i) => done.includes(i[0])).length
            return (
              <div key={k} className="wel-sec">
                <div className="row" style={{ cursor: 'pointer', gap: 12 }} onClick={() => setOpen(open === k ? null : k)}>
                  {n === items.length ? <CircleCheck size={22} color="#22b573" /> : <Circle size={22} className="muted" />}
                  <div style={{ flex: 1 }}><b>{title}</b><div className="small" style={{ color: 'var(--accent)' }}>{n} of {items.length} done</div></div>
                  {open === k ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
                {open === k && items.map(([ik, label, to]) => (
                  <div key={ik} className="row wel-item">
                    <input type="checkbox" checked={done.includes(ik)} onChange={() => (done.includes(ik) ? unmark(ik) : mark(ik))} />
                    <span style={{ flex: 1, textDecoration: done.includes(ik) ? 'line-through' : '' }}>{label}</span>
                    <a style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => go(ik, to)}>Start <ArrowRight size={14} /></a>
                  </div>))}
              </div>) })}
        </div>
      </div>
      <div className="wel-card row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
        <b className="muted" style={{ marginRight: 8 }}>QUICK ACTIONS</b>
        <button className="btn outline-accent" onClick={() => navigate('/people/teams')}><UserPlus size={15} />Add team</button>
        <button className="btn outline-accent" onClick={() => navigate('/clients?new=1')}><Building2 size={15} />Create client</button>
        <button className="btn outline-accent" onClick={() => setQuickAdd('project')}><Folder size={15} />Create project</button>
        <button className="btn outline-accent" onClick={() => setQuickAdd('task')}><CheckSquare size={15} />Add task</button>
        <button className="btn outline-accent" onClick={() => setQuickAdd('time')}><Clock size={15} />Log time</button>
      </div>
      <h3 style={{ margin: '28px 0 10px' }}>Resources</h3>
      <div className="dash-grid">
        {[[Video, 'Educational webinars', 'Short videos on planning, time and reporting.', '/reports/all'], [BookOpen, 'Help docs', 'How every Crewdesk section works.', '/settings/integrations'], [LifeBuoy, 'Contact support', 'Ask your Crewdesk administrator.', '/people/people']].map(([I, t, d, to]) => (
          <div key={t} className="widget" style={{ minHeight: 110, cursor: 'pointer' }} onClick={() => navigate(to)}><I size={20} color="#4461d7" /><b style={{ marginTop: 8 }}>{t}</b><span className="muted small">{d}</span></div>))}
      </div>
    </div></div>
  )
}

/** Floating "Getting started" button shown until the checklist is complete */
export function GettingStarted() {
  const navigate = useNavigate()
  const { done, loaded } = usePrefsChecklist()
  const [hide, setHide] = useState(() => { try { return localStorage.getItem('cd_gs_hide') === '1' } catch { return false } })
  if (!loaded || hide || done.length >= ALL.length) return null
  return (
    <div className="gs-btn"><button onClick={() => navigate('/welcome')}><CircleCheck size={17} />Getting started <span className="gs-n">{ALL.length - done.length}</span></button>
      <button className="gs-x" title="Hide" onClick={() => { setHide(true); try { localStorage.setItem('cd_gs_hide', '1') } catch { /* ignore */ } }}><X size={13} /></button></div>
  )
}
