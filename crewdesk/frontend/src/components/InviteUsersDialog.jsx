// Teamwork-style "Invite users" dialog: 1 Add details › 2 Choose projects › 3 Send invite.
// Creates the users (tied to a client), adds them to the chosen projects with the chosen permissions and
// returns a one-time invite link per person (emailed when SMTP is set up, otherwise copied from here).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Info, Search, X, Mail, User, ChevronDown, Lock, Eye, EyeOff } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/ui-context'
import '../invite-users.css'

const STEPS = ['Add details', 'Choose projects', 'Send invite']
const WORDS = ['no one', 'one person', 'two people', 'three people', 'four people', 'five people', 'six people', 'seven people', 'eight people', 'nine people', 'ten people']
const peopleWord = (n) => WORDS[n] || `${n} people`
const blank = () => ({ first_name: '', last_name: '', email: '', password: '' })
const filled = (r) => r.first_name.trim() || r.last_name.trim() || r.email.trim() || r.password
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())

function Checkbox({ checked, indeterminate, onChange, label, disabled }) {
  const ref = useRef()
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate && !checked }, [indeterminate, checked])
  return (
    <label className={`iu-check ${disabled ? 'disabled' : ''}`}>
      <input ref={ref} type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label && <span>{label}</span>}
    </label>
  )
}

export default function InviteUsersDialog({ onClose, onDone, defaultClientId = null, defaultProjectIds = [] }) {
  const { user } = useAuth()
  const { data: clients } = useData('/clients')
  const { data: projects } = useData('/projects')
  const [step, setStep] = useState(0)
  const [rows, setRows] = useState([blank()])
  const [clientId, setClientId] = useState(defaultClientId ? String(defaultClientId) : '')
  const [userType, setUserType] = useState('member')
  const [picked, setPicked] = useState(new Set(defaultProjectIds))
  const [q, setQ] = useState('')
  const [permission, setPermission] = useState('default')
  const [canAddUsers, setCanAddUsers] = useState(false)
  const [canCreateProjects, setCanCreateProjects] = useState(false)
  const [message, setMessage] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(null)
  const [showPw, setShowPw] = useState(false)

  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  // always keep one empty row at the end so several people can be invited at once
  const setRow = (i, k, v) => setRows((rs) => {
    const next = rs.map((r, j) => (j === i ? { ...r, [k]: v } : r))
    if (filled(next[next.length - 1])) next.push(blank())
    return next
  })
  const removeRow = (i) => setRows((rs) => { const next = rs.filter((_, j) => j !== i); return next.length && !filled(next[next.length - 1]) ? next : [...next, blank()] })
  const people = rows.filter(filled)
  const isAdmin = user?.role === 'admin'

  const groups = useMemo(() => {
    const list = (projects || []).filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()))
    const by = new Map()
    for (const p of list) {
      const key = p.client?.name || 'No client'
      if (!by.has(key)) by.set(key, [])
      by.get(key).push(p)
    }
    return [...by.entries()].sort((a, b) => (a[0] === 'No client') - (b[0] === 'No client') || a[0].localeCompare(b[0]))
  }, [projects, q])
  const allIds = (projects || []).map((p) => p.id)
  const allPicked = allIds.length > 0 && allIds.every((id) => picked.has(id))
  const toggle = (ids, on) => setPicked((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n })

  const next = () => {
    setErr('')
    if (step === 0) {
      if (!people.length) return setErr('Add at least one person to invite')
      const bad = people.find((r) => !emailOk(r.email))
      if (bad) return setErr(`${bad.email.trim() || `${bad.first_name} ${bad.last_name}`.trim()} needs a valid email address`)
      const emails = people.map((r) => r.email.trim().toLowerCase())
      const shortPw = people.find((r) => r.password && r.password.length < 6)
      if (shortPw) return setErr(`The password for ${shortPw.email.trim()} must be at least 6 characters`)
      const dup = emails.find((e, i) => emails.indexOf(e) !== i)
      if (dup) return setErr(`${dup} is listed twice`)
      if (userType === 'client' && !clientId) return setErr('Client users must belong to a client')
    }
    setStep((s) => s + 1)
  }

  const send = async () => {
    setErr(''); setBusy(true)
    try {
      const r = await api.post('/invites', {
        people: people.map((p) => ({ first_name: p.first_name.trim(), last_name: p.last_name.trim(), email: p.email.trim(), password: p.password || null })),
        client_id: clientId ? Number(clientId) : null, user_type: userType, project_ids: [...picked],
        permission, can_add_users: canAddUsers, can_create_projects: canCreateProjects,
        message: message.trim() || null, origin: window.location.origin,
      })
      setResult(r); onDone?.(r)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const copy = async (text, key) => {
    try { await navigator.clipboard.writeText(text) } catch {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove()
    }
    setCopied(key); setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="overlay iu-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="iu-modal" role="dialog" aria-label="Invite users">
        <div className="iu-head">
          <h2>{result ? 'Invites sent' : 'Invite users'}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>

        {!result && <ol className="iu-steps">
          {STEPS.map((label, i) => (
            <li key={label} className={i < step ? 'done' : i === step ? 'active' : ''}>
              <span className="iu-dot">{i < step ? <Check size={15} strokeWidth={3} /> : i + 1}</span>
              <span className="iu-label">{label}</span>
            </li>))}
        </ol>}

        <div className="iu-body">
          {err && <div className="iu-error">{err}</div>}

          {result ? <InviteResult result={result} rows={people} copy={copy} copied={copied} /> : step === 0 ? (<>
            <h3>Who would you like to invite?</h3>
            <div className="iu-rows">
              {rows.map((r, i) => (
                <div className="iu-row" key={i}>
                  <label className="iu-cell"><User size={17} /><input placeholder="First name" value={r.first_name} autoFocus={i === 0} onChange={(e) => setRow(i, 'first_name', e.target.value)} /></label>
                  <label className="iu-cell"><input placeholder="Last name" value={r.last_name} onChange={(e) => setRow(i, 'last_name', e.target.value)} /></label>
                  <label className="iu-cell"><Mail size={17} /><input type="email" placeholder="Email address" value={r.email} onChange={(e) => setRow(i, 'email', e.target.value)} /></label>
                  <label className="iu-cell iu-pw" title="Optional. Set a password and they can sign in straight away with their email and this password. Leave it blank to give them an invite link instead."><Lock size={16} /><input type={showPw ? 'text' : 'password'} autoComplete="new-password" placeholder="Password" value={r.password} onChange={(e) => setRow(i, 'password', e.target.value)} />
                    {i === 0 && <button type="button" className="iu-eye" tabIndex={-1} title={showPw ? 'Hide passwords' : 'Show passwords'} onClick={(e) => { e.preventDefault(); setShowPw((v) => !v) }}>{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>}</label>
                  {i < rows.length - 1 ? <button className="iu-row-x" title="Remove" tabIndex={-1} onClick={() => removeRow(i)}><X size={14} /></button> : <span />}
                </div>))}
            </div>
            <h3>Which client should they belong to?</h3>
            <div className="iu-pair">
              <div className={`iu-select-wrap ${clientId ? 'has-value' : ''}`}>
                {clientId && <span className="iu-float">Client</span>}
                <select className="iu-select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">Client</option>
                  {(clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {clientId && <button className="iu-clear" title="Clear" onClick={() => setClientId('')}><X size={10} strokeWidth={3} /></button>}
                <ChevronDown className="iu-chev" size={16} />
              </div>
              <div className="iu-type">
                <div className="iu-select-wrap">
                  <select className="iu-select" value={userType} onChange={(e) => setUserType(e.target.value)}>
                    <option value="member">Standard user</option>
                    <option value="client">Client user</option>
                  </select>
                  <ChevronDown className="iu-chev" size={16} />
                </div>
                <span className="iu-info" tabIndex={0}><Info size={16} />
                  <span className="iu-tip"><b>Standard user</b> works on projects with your team and sees everything in the projects they're added to.<br /><b>Client user</b> belongs to a client and only sees that client's projects and what's shared with them.</span>
                </span>
              </div>
            </div>
          </>) : step === 1 ? (<>
            <h3>Add the user to the selected projects</h3>
            <div className="iu-proj-bar">
              <Checkbox checked={allPicked} indeterminate={picked.size > 0} onChange={(on) => toggle(allIds, on)} label="All projects" />
              <div className="iu-search"><Search size={15} /><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            </div>
            <div className="iu-proj-list">
              {!projects && <div className="muted small">Loading projects…</div>}
              {projects && !groups.length && <div className="muted small">{q ? 'No projects match your search' : 'There are no projects yet'}</div>}
              {groups.map(([name, list]) => {
                const ids = list.map((p) => p.id)
                const n = ids.filter((id) => picked.has(id)).length
                return (
                  <div className="iu-group" key={name}>
                    <div className="iu-group-head"><Checkbox checked={n === ids.length} indeterminate={n > 0} onChange={(on) => toggle(ids, on)} label={name} /></div>
                    {list.map((p) => <div className="iu-proj" key={p.id}><Checkbox checked={picked.has(p.id)} onChange={(on) => toggle([p.id], on)} label={p.name} /></div>)}
                  </div>)
              })}
            </div>
            <h3>Permissions</h3>
            <div className="iu-perm-row">
              <div className="iu-select-wrap iu-perm" title={permission === 'admin' ? 'Administrators can see and manage everything on the site, including people and settings.'
                : permission === 'project_admin' ? 'Project administrators can manage the selected projects, including deleting them.'
                : 'They can view and work on the projects they are added to.'}>
                <select className="iu-select" value={permission} onChange={(e) => setPermission(e.target.value)}>
                  <option value="default">Default</option>
                  <option value="project_admin">Project administrator</option>
                  {isAdmin && <option value="admin">Administrator</option>}
                </select>
                <ChevronDown className="iu-chev" size={16} />
              </div>
              <Checkbox checked={canAddUsers || permission === 'admin'} disabled={permission === 'admin'} onChange={setCanAddUsers} label="Can add users" />
              <Checkbox checked={canCreateProjects || permission === 'admin'} disabled={permission === 'admin'} onChange={setCanCreateProjects} label="Can create projects" />
            </div>
          </>) : (<>
            <h3>Welcome message to send (optional)</h3>
            <textarea className="iu-msg" rows={4} autoFocus value={message} onChange={(e) => setMessage(e.target.value)} />
          </>)}
        </div>

        <div className="iu-foot">
          {result ? <><span className="spacer" /><button className="iu-pill" onClick={onClose}>Done</button></> : <>
            <button className="iu-text-btn" onClick={onClose}>Close</button>
            {step > 0 && <button className="iu-text-btn" onClick={() => { setErr(''); setStep((s) => s - 1) }}>Back</button>}
            <span className="spacer" />
            {step < 2 ? <button className="iu-pill" onClick={next}>Next</button>
              : <button className="iu-pill" disabled={busy} onClick={send}>{busy ? 'Sending…' : `Send invite${people.length === 1 ? '' : 's'} to ${peopleWord(people.length)}`}</button>}
          </>}
        </div>
      </div>
    </div>
  )
}

function InviteResult({ result, rows, copy, copied }) {
  const list = result.invited || []
  const withPw = list.filter((p) => p.password_set)
  const withLink = list.filter((p) => !p.password_set)
  const pwOf = (email) => rows.find((r) => r.email.trim().toLowerCase() === email)?.password || ''
  const details = (p) => `Hi ${p.name.split(' ')[0]}, you've been added to Crewdesk.\nSign in at: ${p.login_url}\nEmail: ${p.email}\nPassword: ${pwOf(p.email)}`
  return (<>
    <p className="iu-done-lead"><span className="iu-done-tick"><Check size={16} strokeWidth={3} /></span>
      {list.length === 1 ? `${list[0].name} has been added.` : `${list.length} people have been added.`}</p>
    {withPw.length > 0 && <>
      <p className="muted small" style={{ marginTop: 0 }}>{withPw.length === 1 ? 'They can' : 'These people can'} sign in now with their email and the password you set. Send them their sign-in details:</p>
      <div className="iu-links">
        {withPw.map((p) => (
          <div className="iu-link-row" key={p.id}>
            <div className="iu-link-who"><b>{p.name}</b><span className="muted small">{p.email}</span></div>
            <input className="input" readOnly value={p.login_url} onFocus={(e) => e.target.select()} />
            <button className="btn" onClick={() => copy(details(p), p.id)}>{copied === p.id ? <><Check size={14} />Copied</> : <><Copy size={14} />Copy details</>}</button>
            <a className="icon-btn" title="Open in your email app" href={`mailto:${p.email}?subject=${encodeURIComponent('Your Crewdesk sign-in')}&body=${encodeURIComponent(details(p))}`}><Mail size={15} /></a>
          </div>))}
      </div>
    </>}
    {withLink.length > 0 && <>
      <p className="muted small" style={{ marginTop: withPw.length ? 16 : 0 }}>
        {result.email_enabled ? 'An invite email with their sign-up link is on its way. You can also share the link yourself:'
          : 'Email isn\'t set up for Crewdesk yet, so send each person their link (by email, chat, etc.). They open it, choose a password and they\'re in.'}
      </p>
      <div className="iu-links">
        {withLink.map((p) => (
          <div className="iu-link-row" key={p.id}>
            <div className="iu-link-who"><b>{p.name}</b><span className="muted small">{p.email}</span></div>
            <input className="input" readOnly value={p.invite_url} onFocus={(e) => e.target.select()} />
            <button className="btn" onClick={() => copy(p.invite_url, p.id)}>{copied === p.id ? <><Check size={14} />Copied</> : <><Copy size={14} />Copy link</>}</button>
            <a className="icon-btn" title="Open in your email app" href={`mailto:${p.email}?subject=${encodeURIComponent('You\'re invited to Crewdesk')}&body=${encodeURIComponent(`Hi ${p.name.split(' ')[0]},\n\nYou've been invited to Crewdesk. Choose your password here:\n${p.invite_url}`)}`}><Mail size={15} /></a>
          </div>))}
      </div>
      {withLink.length > 1 && <button className="btn sm" style={{ marginTop: 10 }} onClick={() => copy(withLink.map((p) => `${p.name} <${p.email}>: ${p.invite_url}`).join('\n'), 'all')}>{copied === 'all' ? 'Copied' : 'Copy all links'}</button>}
    </>}
  </>)
}
