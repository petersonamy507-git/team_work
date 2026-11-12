import { Check, MessageSquare, ListTree } from 'lucide-react'
import { api } from '../lib/api'
import { useUi } from '../lib/ui-context'
import { Avatar, Due, PriorityPill } from './ui'

export function CheckButton({ task, onChange }) {
  const { refresh, notify } = useUi()
  const done = task.status === 'completed'
  const toggle = async (e) => {
    e.stopPropagation()
    await api.patch(`/tasks/${task.id}`, { status: done ? 'new' : 'completed' })
    if (!done) notify('Task completed')
    onChange ? onChange() : refresh()
  }
  return (
    <button className={`check ${done ? 'on' : ''}`} onClick={toggle} title={done ? 'Reopen' : 'Complete'}>
      {done && <Check size={12} strokeWidth={3} />}
    </button>
  )
}

export default function TaskRow({ task, showProject, onChange, draggable, onDragStart }) {
  const { openTask } = useUi()
  return (
    <div className={`task-row ${task.status === 'completed' ? 'done' : ''}`} draggable={draggable} onDragStart={onDragStart}>
      <CheckButton task={task} onChange={onChange} />
      <span className="title" onClick={() => openTask(task.id)}>{task.title}</span>
      <span className="meta">
        {task.tags?.map((t) => <span className="tag" key={t}>{t}</span>)}
        {task.subtask_count > 0 && <span className="pill"><ListTree size={12} />{task.subtask_count}</span>}
        {showProject && <span className="pill">{task.project_name}</span>}
        <PriorityPill p={task.priority} />
        <Due task={task} />
        <Avatar user={task.assignee} size={24} />
      </span>
    </div>
  )
}
