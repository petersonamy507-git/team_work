import { useState } from 'react'
import { Flag } from 'lucide-react'
import { useData } from '../lib/ui-context'
import { Empty, Loading } from '../components/ui'
import { MilestoneRow } from './Project'

export default function Milestones() {
  const [status, setStatus] = useState('upcoming')
  const { data } = useData(`/milestones?status=${status}`, [status])
  return (
    <div className="page">
      <div className="page-head"><h1>Milestones</h1><span className="spacer" />
        <div className="seg">{['upcoming', 'completed', 'all'].map((s) => <button key={s} className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div></div>
      <div className="card">{!data ? <Loading /> : data.length === 0 ? <Empty icon={Flag} title="No milestones" text="Add milestones from a project's Milestones tab" /> : data.map((m) => <MilestoneRow key={m.id} m={m} showProject />)}</div>
    </div>
  )
}
