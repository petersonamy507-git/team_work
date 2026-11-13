const TOKEN_KEY = 'crewdesk_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

// thin progress bar at the top while a save (POST/PATCH/DELETE) is in flight
let writes = 0
const mark = () => typeof document !== 'undefined' && document.documentElement.classList.toggle('api-busy', writes > 0)

async function request(method, url, body, isForm = false) {
  const write = method !== 'GET'
  if (write) { writes++; mark() }
  try { return await doRequest(method, url, body, isForm) } finally { if (write) { writes--; mark() } }
}

async function doRequest(method, url, body, isForm = false) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body && !isForm) headers['Content-Type'] = 'application/json'
  const res = await fetch(`/api${url}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })
  if (res.status === 401 && !url.startsWith('/auth/')) {
    setToken(null)
    window.location.href = '/login'
    return
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text()
  if (!res.ok) {
    const msg = typeof data === 'object' ? (Array.isArray(data.detail) ? data.detail.map((d) => d.msg).join(', ') : data.detail) : data
    throw new Error(msg || `Request failed (${res.status})`)
  }
  return data
}

export const api = {
  get: (u) => request('GET', u),
  post: (u, b) => request('POST', u, b),
  patch: (u, b) => request('PATCH', u, b),
  del: (u) => request('DELETE', u),
  upload: (u, form) => request('POST', u, form, true),
  download: async (u, name) => {
    const res = await fetch(`/api${u}`, { headers: { Authorization: `Bearer ${getToken()}` } })
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    URL.revokeObjectURL(a.href)
  },
}

export const qs = (obj) => {
  const p = new URLSearchParams()
  Object.entries(obj).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && p.set(k, v))
  const s = p.toString()
  return s ? `?${s}` : ''
}
