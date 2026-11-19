// Client view (Teamwork's experience for a signed-in client user): which pages a client may open.
export const isClient = (u) => u?.role === 'client'

// Home widgets Teamwork gives a client by default
export const CLIENT_HOME_WIDGETS = ['tasks', 'unread', 'milestones', 'projects', 'private_notes']
// My work tabs a client has
export const CLIENT_MYWORK_TABS = ['tasks', 'projects', 'activity']
// Project tabs a client sees (Teamwork: Dashboard, List, Board, Table, Timeline, then More…)
export const CLIENT_PROJECT_TABS = [['', 'Dashboard'], ['tasks', 'List'], ['board', 'Board'], ['table', 'Table'], ['timeline', 'Timeline']]
export const CLIENT_PROJECT_MORE = [['files', 'Files'], ['x/forms', 'Forms'], ['x/tickets', 'Tickets'], ['milestones', 'Milestones'], ['messages', 'Messages'],
  ['x/comments', 'Comments'], ['x/notebooks', 'Notebooks'], ['x/links', 'Links'], ['x/proofs', 'Proofs']]

const ALLOWED = [
  /^\/$/, /^\/my-work\/?$/, /^\/work\/(tasks|projects|activity)\/?$/, /^\/inbox/, /^\/projects\/?$/,
  /^\/projects\/\d+(\/(tasks|board|table|timeline|files|messages(\/\d+)?|milestones|people|activity|overview|x\/(comments|forms|tickets|notebooks|links|proofs)))?\/?$/,
  /^\/tasks\/\d+\/?$/, /^\/planning\/chart\/?$/, /^\/proofs\/?$/, /^\/settings\/appearance\/?$/,
]

export function clientCanOpen(user, pathname, search = '') {
  if (!isClient(user)) return true
  const own = pathname.match(/^\/people\/person\/(\d+)/)
  if (own) return Number(own[1]) === user.id
  if (/^\/my-work/.test(pathname)) {
    const tab = new URLSearchParams(search).get('tab') || 'tasks'
    if (!CLIENT_MYWORK_TABS.includes(tab)) return false
  }
  return ALLOWED.some((r) => r.test(pathname))
}
