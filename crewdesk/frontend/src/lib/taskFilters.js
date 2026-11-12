// Shared task filter state, labels and query building (Tasks area and My work).

export const EMPTY_FILTERS = {
  assignee: [], created_by: [], project_id: [], priority: [], status: [], tags: [], exclude_tags: [],
  client_id: [], owner_id: [], due: '', due_from: '', due_to: '', start_from: '', start_to: '',
  followed: false, not_blocked: false, untagged: false, starred: false, started_today: false, no_subtasks: false,
  completed: '', // '' open only | 'both' incomplete + completed | 'only' completed only
  mine: false, // "Created by me" quick filter
}

export const DUE_OPTIONS = [
  ['', 'Anytime'], ['late', 'Late'], ['today', 'Today'], ['yesterday', 'Yesterday'], ['tomorrow', 'Tomorrow'],
  ['nodate', 'No due date'], ['week', 'Next 7 days'], ['next14', 'Next 14 days'], ['next30', 'Next 30 days'],
  ['thisweek', 'This week'], ['lastweek', 'Last week'], ['nextweek', 'Next week'], ['thismonth', 'This month'],
  ['custom', 'Custom date range'],
]

export const SORTS = {
  start: 'Start Date', due: 'Due Date', created: 'Date Added', project: 'Project', priority: 'Priority',
  client: 'Company', created_by: 'Created By',
}

export const withFilters = (saved) => ({ ...EMPTY_FILTERS, ...(saved || {}) })

export function activeFilterCount(f) {
  const lists = ['assignee', 'created_by', 'project_id', 'priority', 'status', 'tags', 'exclude_tags', 'client_id', 'owner_id']
  const flags = ['followed', 'not_blocked', 'untagged', 'starred', 'started_today', 'no_subtasks', 'mine']
  return lists.reduce((n, k) => n + (f[k]?.length ? 1 : 0), 0) + flags.reduce((n, k) => n + (f[k] ? 1 : 0), 0)
    + (f.due && f.due !== 'custom' ? 1 : 0) + (f.due_from || f.due_to ? 1 : 0) + (f.start_from || f.start_to ? 1 : 0)
    + (f.completed ? 1 : 0)
}

/** Turn filter state into /api/tasks query params. */
export function filterParams(f, { userId } = {}) {
  let status = f.completed === 'only' ? 'completed' : f.completed === 'both' ? 'all' : 'open'
  if (f.status.length) status = f.status.join(',')
  const createdBy = f.mine && userId ? [...new Set([...f.created_by, String(userId)])] : f.created_by
  return {
    status,
    assignee: f.assignee.join(','), created_by: createdBy.join(','), project_id: f.project_id.join(','),
    priority: f.priority.join(','), tags: f.tags.join(','), exclude_tags: f.exclude_tags.join(','),
    client_id: f.client_id.join(','), owner_id: f.owner_id.join(','),
    due: f.due === 'custom' ? '' : f.due, due_from: f.due_from, due_to: f.due_to,
    start_from: f.start_from, start_to: f.start_to,
    followed: f.followed ? 'true' : '', not_blocked: f.not_blocked ? 'true' : '', untagged: f.untagged ? 'true' : '',
    starred: f.starred ? 'true' : '',
  }
}

export function toCSV(tasks) {
  const cols = [['Task', (t) => t.title], ['Project', (t) => t.project_name], ['Task list', (t) => t.tasklist_name],
    ['Assignees', (t) => t.assignees.map((a) => a.name).join('; ')], ['Stage', (t) => t.status],
    ['Priority', (t) => t.priority], ['Start date', (t) => t.start_date], ['Due date', (t) => t.due_date],
    ['Progress', (t) => t.progress], ['Estimated minutes', (t) => t.estimate_minutes], ['Logged minutes', (t) => t.logged_minutes],
    ['Tags', (t) => t.tags.join('; ')], ['Created by', (t) => t.created_by?.name], ['Task ID', (t) => t.id]]
  const esc = (v) => { v = v ?? ''; v = String(v); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v }
  return [cols.map((c) => c[0]).join(','), ...tasks.map((t) => cols.map((c) => esc(c[1](t))).join(','))].join('\n')
}

export function downloadText(name, text, type = 'text/csv') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
