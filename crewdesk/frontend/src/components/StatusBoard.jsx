import { useState } from 'react'
import { api } from '../lib/api'
import { useUi } from '../lib/ui-context'
import { Avatar, Due, PriorityPill } from './ui'

const COLS = [['new', 'To do', '#94a3b8'], ['in_progress', 'In progress', '#3b82f6'], ['completed', 'Completed', '#10b981']]

export default function BoardByStatus({ tasks }) {
  const { openTask, refresh } = useUi()
  const [drag, setDrag] = useState(null)
  const [over, setOver] = useState(null)
  const drop = async (status) => {
    setOver(null)
    if (!drag || drag.status === status) return
    await api.patch(`/tasks/${drag.id}`, { status })
    refresh()
  }
  return (
    <div className="board">
      {COLS.map(([k, label, color]) => {
        const items = tasks.filter((t) => t.status === k)
        return (
          <div className="column" key={k}>
            <div className="column-head"><span className="dot" style={{ background: color }} />{label}<span className="badge grey">{items.length}</span></div>
            <div className={`column-body ${over === k ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(k) }} onDragLeave={() => setOver(null)} onDrop={() => drop(k)}>
              {items.map((t) => (
                <div key={t.id} className="bcard" draggable onDragStart={() => setDrag(t)} onClick={() => openTask(t.id)}>
                  <div className="t">{t.title}</div>
                  <div className="m"><span className="ellipsis" style={{ flex: 1 }}>{t.project_name}</span><PriorityPill p={t.priority} /><Due task={t} /><Avatar user={t.assignee} size={22} /></div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
