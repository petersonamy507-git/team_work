import { Link } from 'react-router-dom'
import { useData } from '../lib/ui-context'
import { fmtDateTime } from '../lib/format'
import { Avatar, Empty, Loading } from '../components/ui'

export default function ActivityPage({ embedded }) {
  const { data } = useData('/activity')
  return (
    <div className={embedded ? '' : 'page'} style={{ maxWidth: 900 }}>
      {!embedded && <div className="page-head"><h1>Activity</h1></div>}
      <div className="card">{!data ? <Loading /> : data.length === 0 ? <Empty title="Nothing has happened yet" /> : data.map((a) => (
        <div key={a.id} className="task-row"><Avatar user={a.user} size={26} />
          <span style={{ flex: 1 }}><b>{a.user?.name}</b> {a.action}{a.project_name && <> in <Link to={`/projects/${a.project_id}`} style={{ color: 'var(--accent)' }}>{a.project_name}</Link></>}</span>
          <span className="muted small">{fmtDateTime(a.created_at)}</span></div>))}</div>
    </div>
  )
}
