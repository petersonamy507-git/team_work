import { useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useUi } from '../lib/ui-context'
import { PROJECT_COLORS } from '../lib/format'
import { Avatar } from '../components/ui'

export default function SettingsPage() {
  const { user, setUser } = useAuth()
  const { notify } = useUi()
  const [f, setF] = useState({ name: user.name, title: user.title || '', color: user.color, password: '' })
  const save = async () => {
    const body = { name: f.name, title: f.title, color: f.color }
    if (f.password) body.password = f.password
    const u = await api.patch(`/people/${user.id}`, body)
    setUser(u); setF({ ...f, password: '' }); notify('Profile saved')
  }
  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="page-head"><Avatar user={{ ...user, ...f }} size={48} /><h1>Profile and settings</h1></div>
      <div className="card card-body">
        <div className="row"><div className="field"><label>Full name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label>Job title</label><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div></div>
        <div className="field"><label>Email</label><input className="input" value={user.email} disabled /></div>
        <div className="field"><label>Avatar color</label><div className="row">{PROJECT_COLORS.map((c) => <button key={c} onClick={() => setF({ ...f, color: c })} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: f.color === c ? '3px solid #1e2133' : 0 }} />)}</div></div>
        <div className="field"><label>New password (leave blank to keep)</label><input className="input" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <button className="btn primary" onClick={save}>Save changes</button>
      </div>
    </div>
  )
}
