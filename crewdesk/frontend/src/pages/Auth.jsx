import { useState } from 'react'
import { useEffect } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api, setToken } from '../lib/api'

function AuthShell({ title, children }) {
  return (
    <div className="auth-wrap auth-bg">
      <div className="auth-card">
        <div className="brand"><img src="/logo.svg" width="32" alt="" />Crewdesk</div>
        <h2 style={{ marginBottom: 16 }}>{title}</h2>
        {children}
      </div>
      <div className="auth-tagline">Plan projects, track time and deliver together.</div>
    </div>
  )
}

export function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  if (user) return <Navigate to="/" replace />
  const submit = async (e) => {
    e.preventDefault()
    try { await login(email, password); navigate('/') } catch (e) { setErr(e.message) }
  }
  return (
    <AuthShell title="Sign in">
      {err && <div className="error">{err}</div>}
      <form onSubmit={submit}>
        <div className="field"><label>Email</label><input className="input" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>Password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>Sign in</button>
      </form>
      <p className="small muted" style={{ marginTop: 16 }}>No account? <Link to="/register" style={{ color: 'var(--accent)' }}>Create one</Link></p>
    </AuthShell>
  )
}

export function Register() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [err, setErr] = useState('')
  if (user) return <Navigate to="/" replace />
  const submit = async (e) => {
    e.preventDefault()
    try { await register(f.name, f.email, f.password); navigate('/') } catch (e) { setErr(e.message) }
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <AuthShell title="Create your account">
      {err && <div className="error">{err}</div>}
      <form onSubmit={submit}>
        <div className="field"><label>Full name</label><input className="input" autoFocus value={f.name} onChange={set('name')} /></div>
        <div className="field"><label>Email</label><input className="input" type="email" value={f.email} onChange={set('email')} /></div>
        <div className="field"><label>Password (6+ characters)</label><input className="input" type="password" value={f.password} onChange={set('password')} /></div>
        <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>Create account</button>
      </form>
      <p className="small muted" style={{ marginTop: 16 }}>Already have an account? <Link to="/login" style={{ color: 'var(--accent)' }}>Sign in</Link></p>
    </AuthShell>
  )
}

// /invite/:token — an invited person chooses their password and is signed in
export function AcceptInvite() {
  const { token } = useParams()
  const { user, setUser, logout } = useAuth()
  const navigate = useNavigate()
  const [inv, setInv] = useState(null)
  const [f, setF] = useState({ name: '', password: '', confirm: '' })
  const [err, setErr] = useState('')
  const [bad, setBad] = useState('')
  useEffect(() => {
    api.get(`/invites/${token}`).then((r) => { setInv(r); setF((x) => ({ ...x, name: r.name })) }).catch((e) => setBad(e.message))
  }, [token])
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (f.password.length < 6) return setErr('Password must be at least 6 characters')
    if (f.password !== f.confirm) return setErr("Passwords don't match")
    try {
      const r = await api.post(`/invites/${token}/accept`, { name: f.name, password: f.password })
      setToken(r.token); setUser(r.user); navigate('/')
    } catch (e) { setErr(e.message) }
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  if (bad) return (
    <AuthShell title="Invite not found">
      <p className="muted">{bad}. If you've already set your password, just sign in.</p>
      <Link to="/login" className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>Go to sign in</Link>
    </AuthShell>)
  if (!inv) return <AuthShell title="Loading your invite…"><p className="muted">One moment…</p></AuthShell>
  return (
    <AuthShell title="Join Crewdesk">
      <p className="muted" style={{ marginTop: -6 }}>{inv.invited_by ? `${inv.invited_by} invited you` : 'You were invited'}{inv.client ? ` as part of ${inv.client}` : ''}{inv.project_count ? ` to ${inv.project_count} project${inv.project_count === 1 ? '' : 's'}` : ''}. Choose a password to finish setting up your account.</p>
      {user && user.email !== inv.email && <div className="error">You're signed in as {user.email}. Accepting this invite will sign you in as {inv.email} instead. <a href="#" onClick={(e) => { e.preventDefault(); logout() }}>Sign out now</a></div>}
      {err && <div className="error">{err}</div>}
      <form onSubmit={submit}>
        <div className="field"><label>Email</label><input className="input" value={inv.email} disabled /></div>
        <div className="field"><label>Your name</label><input className="input" value={f.name} onChange={set('name')} /></div>
        <div className="field"><label>Password (6+ characters)</label><input className="input" type="password" autoFocus value={f.password} onChange={set('password')} /></div>
        <div className="field"><label>Confirm password</label><input className="input" type="password" value={f.confirm} onChange={set('confirm')} /></div>
        <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>Accept invite</button>
      </form>
    </AuthShell>
  )
}
