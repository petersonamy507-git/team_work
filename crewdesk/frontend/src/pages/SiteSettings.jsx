// Settings (Teamwork /app/settings/*): General, Projects, Subscription, Currencies, Time, Logo, Working hours,
// Appearance, Integrations, plus My details. Values are stored in /api/settings (site) and /api/prefs (user).
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Settings as Cog, Check, Upload, Search, Plug, MessageCircle, Folder, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useUi } from '../lib/ui-context'
import { PROJECT_COLORS } from '../lib/format'
import { Avatar } from '../components/ui'
import { Section, Pill } from '../components/Kit'

const TABS = [['general', 'General'], ['projects', 'Projects'], ['subscription', 'Subscription'], ['currencies', 'Currencies'], ['time', 'Time'], ['logo', 'Logo'],
  ['workinghours', 'Working hours'], ['appearance', 'Appearance'], ['integrations', 'Integrations'], ['profile', 'My details']]
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const INTEGRATIONS = [
  ['claude', 'Claude', 'Connect Claude to Crewdesk to manage projects, tasks and time from your conversation.', 'AI'],
  ['chatgpt', 'ChatGPT', 'Connect ChatGPT to Crewdesk to manage projects, tasks and time from your conversation.', 'AI'],
  ['copilot', 'Microsoft Copilot', 'Manage projects, tasks and time from Microsoft Copilot.', 'AI'],
  ['salesforce', 'Salesforce', 'Create Crewdesk projects automatically when an opportunity reaches a chosen stage.', 'CRM'],
  ['netsuite', 'NetSuite', 'Sync time logs to NetSuite on a project by project basis.', 'Finance'],
  ['quickbooks', 'QuickBooks Online', 'Send invoices and billable time to QuickBooks.', 'Finance'],
  ['xero', 'Xero', 'Export invoices to Xero.', 'Finance'],
  ['harvest', 'Harvest', 'Import time tracked in Harvest.', 'Time'],
  ['gcal', 'Google Calendar', 'Show Crewdesk tasks and milestones in Google Calendar.', 'Calendar'],
  ['outlook', 'Outlook Calendar', 'Show Crewdesk tasks and milestones in Outlook.', 'Calendar'],
  ['gdrive', 'Google Drive', 'Attach files from Google Drive to tasks and projects.', 'Files'],
  ['dropbox', 'Dropbox', 'Attach files from Dropbox.', 'Files'],
  ['onedrive', 'OneDrive', 'Attach files from OneDrive and SharePoint.', 'Files'],
  ['box', 'Box', 'Attach files from Box.', 'Files'],
  ['slack', 'Slack', 'Post task and project updates to Slack channels.', 'Communication'],
  ['teams', 'Microsoft Teams', 'Post task and project updates to Microsoft Teams.', 'Communication'],
]

function useSettings() {
  const [s, setS] = useState(null)
  const { notify } = useUi()
  useEffect(() => { api.get('/settings').then(setS) }, [])
  const save = async (patch, msg = 'Settings saved') => { try { setS(await api.patch('/settings', patch)); notify(msg) } catch (e) { notify(e.message) } }
  return [s, save]
}

function Field({ label, children, help }) { return <div className="set-field"><label>{label}</label><div>{children}{help && <div className="muted small" style={{ marginTop: 4 }}>{help}</div>}</div></div> }

function Form({ initial, fields, onSave }) {
  const [f, setF] = useState(initial)
  useEffect(() => setF(initial), [JSON.stringify(initial)]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="set-card">
      {fields.map(([k, label, type, opts, help]) => (
        <Field key={k} label={label} help={help}>
          {type === 'select' ? <select className="input" value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })}>{opts.map((o) => <option key={o}>{o}</option>)}</select>
            : type === 'bool' ? <label className="switch"><input type="checkbox" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /><i /></label>
              : type === 'textarea' ? <textarea className="input" rows={3} value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
                : <input className="input" type={type || 'text'} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}
        </Field>))}
      <button className="btn primary" onClick={() => onSave(f)}><Check size={14} />Save changes</button>
    </div>
  )
}

export default function SiteSettings() {
  const { tab = 'general' } = useParams()
  const [s, save] = useSettings()
  const { user } = useAuth()
  if (!s) return <Section icon={Cog} title="Settings" tabs={TABS.map(([k, l]) => ({ to: `/settings/${k}`, label: l }))}><div className="muted">Loading…</div></Section>
  const admin = user.role === 'admin'
  const g = (k, d) => s[k] ?? d
  const body = {
    general: <Form initial={g('general', { site_name: 'Crewdesk', company: '', date_format: 'DD/MM/YYYY', time_format: '12 hour', week_start: 'Monday', language: 'English', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
      onSave={(v) => save({ general: v })} fields={[['site_name', 'Site name'], ['company', 'Company name'], ['language', 'Language', 'select', ['English', 'Urdu', 'Arabic', 'French', 'German', 'Spanish']],
        ['timezone', 'Time zone'], ['date_format', 'Date format', 'select', ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']], ['time_format', 'Time format', 'select', ['12 hour', '24 hour']], ['week_start', 'Week starts on', 'select', ['Monday', 'Sunday', 'Saturday']]]} />,
    projects: <Form initial={g('projects', { default_view: 'List', health_required: false, allow_client_comments: true, task_ids: false, default_workflow: 'Backlog, To do, In progress, Done' })}
      onSave={(v) => save({ projects: v })} fields={[['default_view', 'Default project view', 'select', ['Dashboard', 'List', 'Board', 'Table']], ['default_workflow', 'Default workflow stages', 'text', null, 'Comma separated'],
        ['health_required', 'Ask for project health updates', 'bool'], ['allow_client_comments', 'Let client users comment', 'bool'], ['task_ids', 'Show task IDs', 'bool']]} />,
    currencies: <Form initial={g('currencies', { default: 'USD', symbol_position: 'Before amount', decimals: '2' })}
      onSave={(v) => save({ currencies: v })} fields={[['default', 'Default currency', 'select', ['USD', 'EUR', 'GBP', 'PKR', 'AED', 'CAD', 'AUD', 'INR', 'SAR']], ['symbol_position', 'Symbol position', 'select', ['Before amount', 'After amount']], ['decimals', 'Decimal places', 'select', ['0', '2']]]} />,
    time: <Form initial={g('time', { approvals: true, require_description: false, default_billable: true, rounding: 'None', lock_after_days: '' })}
      onSave={(v) => save({ time: v })} fields={[['approvals', 'Time approvals', 'bool'], ['default_billable', 'New time is billable by default', 'bool'], ['require_description', 'Require a description', 'bool'],
        ['rounding', 'Round logged time', 'select', ['None', 'Up to 5 minutes', 'Up to 15 minutes', 'Up to 30 minutes']], ['lock_after_days', 'Lock time entries after (days)', 'number']]} />,
    logo: <LogoTab s={s} save={save} />,
    workinghours: <WorkingHours s={s} save={save} />,
    appearance: <Appearance />,
    integrations: <Integrations s={s} save={save} />,
    subscription: <Subscription />,
    profile: <MyDetails />,
  }[tab]
  return (
    <Section icon={Cog} title="Settings" tabs={TABS.map(([k, l]) => ({ to: `/settings/${k}`, label: l }))}>
      {!admin && !['appearance', 'profile', 'integrations', 'subscription'].includes(tab) && <div className="muted small" style={{ marginBottom: 10 }}>Only administrators can change site settings.</div>}
      {body}
    </Section>
  )
}

function LogoTab({ s, save }) {
  const [img, setImg] = useState(s.logo?.data || '')
  const pick = (e) => { const f = e.target.files[0]; if (!f) return; if (f.size > 300000) return alert('Please choose an image under 300 KB'); const r = new FileReader(); r.onload = () => setImg(r.result); r.readAsDataURL(f) }
  return (
    <div className="set-card">
      <Field label="Site logo" help="Shown in the top bar. PNG or SVG, under 300 KB.">
        <div className="row" style={{ gap: 14 }}><div className="logo-prev">{img ? <img src={img} alt="logo" /> : <img src="/logo.svg" alt="Crewdesk" />}</div>
          <label className="btn"><Upload size={14} />Choose image<input type="file" accept="image/*" hidden onChange={pick} /></label>
          {img && <button className="btn" onClick={() => setImg('')}>Use default</button>}</div>
      </Field>
      <button className="btn primary" onClick={() => save({ logo: { data: img } }, 'Logo saved, reload to see it in the top bar')}><Check size={14} />Save logo</button>
    </div>
  )
}

function WorkingHours({ s, save }) {
  const init = s.working_hours || Object.fromEntries(DAYS.map((d, i) => [d, i < 5 ? 8 : 0]))
  const [h, setH] = useState(init)
  return (
    <div className="set-card">
      <div className="muted small" style={{ marginBottom: 10 }}>Default working hours per day, used for capacity in Resourcing and timesheets.</div>
      {DAYS.map((d) => <Field key={d} label={d}><input className="input" type="number" min="0" max="24" step="0.5" style={{ width: 100 }} value={h[d]} onChange={(e) => setH({ ...h, [d]: Number(e.target.value) })} /> <span className="muted small">hours</span></Field>)}
      <div className="small" style={{ margin: '6px 0 12px' }}>Total: <b>{Object.values(h).reduce((a, b) => a + Number(b || 0), 0)}h</b> per week</div>
      <button className="btn primary" onClick={() => save({ working_hours: h })}><Check size={14} />Save working hours</button>
    </div>
  )
}

function Appearance() {
  const [p, setP] = useState(null)
  const { notify } = useUi()
  useEffect(() => { api.get('/prefs').then(setP) }, [])
  if (!p) return null
  const set = async (k, v) => { setP(await api.patch('/prefs', { [k]: v })); notify('Appearance saved') ; document.documentElement.style.setProperty('--accent', k === 'accent' ? v : (p.accent || '#4461d7')) }
  return (
    <div className="set-card">
      <Field label="Accent colour"><div className="row" style={{ gap: 6 }}>{['#4461d7', ...PROJECT_COLORS].map((c) => <button key={c} onClick={() => set('accent', c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: (p.accent || '#4461d7') === c ? '3px solid #0b0f1f' : 0 }} />)}</div></Field>
      <Field label="Density"><select className="input" style={{ width: 200 }} value={p.density || 'Comfortable'} onChange={(e) => set('density', e.target.value)}><option>Comfortable</option><option>Compact</option></select></Field>
      <Field label="Start page"><select className="input" style={{ width: 200 }} value={p.start_page || 'Home'} onChange={(e) => set('start_page', e.target.value)}><option>Home</option><option>My work</option><option>Inbox</option><option>Projects</option></select></Field>
    </div>
  )
}

function Integrations({ s, save }) {
  const [q, setQ] = useState('')
  const on = s.integrations || {}
  return (
    <>
      <div className="tw-toolbar"><span className="muted">No app is an island. Turn on the integrations your team uses.</span><span className="spacer" />
        <label className="kit-search" style={{ border: '1px solid #cfd3e0', borderRadius: 9999 }}><Search size={14} /><input placeholder="Search integrations" value={q} onChange={(e) => setQ(e.target.value)} /></label></div>
      {[['crewdesk-chat', 'Crewdesk Chat', 'Team collaboration: channels and direct messages, built in.', 'Built in', '/chat'], ['ai', 'Crewdesk AI', 'Ask AI about your projects, tasks and time, built in.', 'Built in', '/ai/ask']].map(([k, n, d, c, to]) => (
        <IntCard key={k} name={n} text={d} tag={c} icon={k === 'ai' ? Sparkles : MessageCircle} action={<a className="btn primary" href={to}>Open</a>} />))}
      {INTEGRATIONS.filter(([, n, d]) => (n + d).toLowerCase().includes(q.toLowerCase())).map(([k, n, d, c]) => (
        <IntCard key={k} name={n} text={d} tag={c} icon={Plug} enabled={on[k]}
          action={<button className={`btn ${on[k] ? '' : 'primary'}`} onClick={() => save({ integrations: { ...on, [k]: !on[k] } }, on[k] ? `${n} turned off` : `${n} turned on`)}>{on[k] ? 'Turn off' : 'Turn on'}</button>} />))}
    </>
  )
}
function IntCard({ name, text, tag, icon: I, action, enabled }) {
  return <div className="int-card"><span className="int-ic"><I size={20} /></span><div style={{ flex: 1 }}><div className="row" style={{ gap: 8 }}><b style={{ fontSize: 16 }}>{name}</b><span className="new-badge">{tag}</span>{enabled && <Pill tone="green">On</Pill>}</div><div className="muted" style={{ marginTop: 4 }}>{text}</div></div>{action}</div>
}

function Subscription() {
  const { people } = useUi()
  const navigate = useNavigate()
  const [sub, setSub] = useState('plan')
  return (
    <>
      <div className="chips" style={{ marginBottom: 12 }}>{[['plan', 'Plan management'], ['billing', 'Billing management'], ['history', 'Invoice history']].map(([k, l]) => <button key={k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>{l}</button>)}</div>
      {sub === 'plan' && <>
        <div className="set-card" style={{ padding: 0 }}>
          <div className="row" style={{ padding: '14px 18px', background: '#f7f8fb', borderBottom: '1px solid var(--border)' }}><img src="/logo.svg" alt="" style={{ width: 22 }} /><b style={{ fontSize: 17 }}>Crewdesk - Self-hosted</b></div>
          <div className="row" style={{ padding: 18, gap: 40, flexWrap: 'wrap' }}>
            <div><div className="muted small">Seats</div><b>{people.filter((p) => p.is_active).length} active seats</b></div>
            <div><div className="muted small">Storage</div><b>Your server</b></div><div><div className="muted small">Plan</div><b>All features included</b></div><div><div className="muted small">Price</div><b>Free</b></div>
          </div>
        </div>
        <h3 style={{ margin: '18px 0 10px' }}>Crewdesk products</h3>
        <div className="dash-grid">
          {[['Chat', 'Team collaboration', '/chat'], ['AI', 'Ask anything about your work', '/ai/ask'], ['Proofs', 'Reviews and approvals', '/proofs']].map(([n, d, to]) => (
            <div key={n} className="widget" style={{ minHeight: 120 }}><div className="row" style={{ justifyContent: 'space-between' }}><b>{n}</b><a style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => navigate(to)}>Go to {n} ↗</a></div><div className="muted small">{d}</div></div>))}
        </div>
      </>}
      {sub !== 'plan' && <div className="set-card"><div className="muted">Crewdesk runs on your own server, so there is no billing or invoice history.</div></div>}
      <Folder size={0} />
    </>
  )
}

export function MyDetails() {
  const { user, setUser } = useAuth()
  const { notify } = useUi()
  const [f, setF] = useState({ name: user.name, title: user.title || '', phone: user.phone || '', color: user.color, password: '' })
  const save = async () => {
    const body = { name: f.name, title: f.title, color: f.color, phone: f.phone }
    if (f.password) body.password = f.password
    const u = await api.patch(`/people/${user.id}`, body)
    setUser(u); setF({ ...f, password: '' }); notify('Profile saved')
  }
  return (
    <div className="set-card">
      <div className="row" style={{ gap: 12, marginBottom: 14 }}><Avatar user={{ ...user, ...f }} size={52} /><div><b style={{ fontSize: 17 }}>{f.name}</b><div className="muted small">{user.email}</div></div></div>
      <Field label="Full name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Job title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      <Field label="Avatar colour"><div className="row" style={{ gap: 6 }}>{PROJECT_COLORS.map((c) => <button key={c} onClick={() => setF({ ...f, color: c })} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: f.color === c ? '3px solid #0b0f1f' : 0 }} />)}</div></Field>
      <Field label="New password" help="Leave blank to keep your current password."><input className="input" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
      <button className="btn primary" onClick={save}><Check size={14} />Save changes</button>
    </div>
  )
}
