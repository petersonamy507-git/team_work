import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

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
