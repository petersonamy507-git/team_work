import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from './api'

const UiCtx = createContext(null)

export function UiProvider({ children }) {
  const [taskId, setTaskId] = useState(null)
  const [quickAdd, setQuickAdd] = useState(null) // 'task' | 'project' | 'time' | 'message' | null
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [version, setVersion] = useState(0)
  const [toast, setToast] = useState(null)
  const [people, setPeople] = useState([])
  const [projects, setProjects] = useState([])
  const [unread, setUnread] = useState(0)

  // several actions often call refresh() back to back; coalesce them into one reload
  const timer = useRef()
  const refresh = useCallback(() => { clearTimeout(timer.current); timer.current = setTimeout(() => setVersion((v) => v + 1), 60) }, [])

  const lastLookup = useRef(0)
  const loadLookups = useCallback(() => {
    api.get('/inbox/count').then((r) => setUnread(r.unread)).catch(() => {})
    // people / projects change rarely; refetch at most every 5 seconds
    if (Date.now() - lastLookup.current < 5000) return
    lastLookup.current = Date.now()
    api.get('/people').then(setPeople).catch(() => {})
    api.get('/projects?status=active').then(setProjects).catch(() => {})
  }, [])

  useEffect(() => { loadLookups() }, [loadLookups, version])

  return (
    <UiCtx.Provider value={{ taskId, openTask: setTaskId, quickAdd, setQuickAdd, paletteOpen, setPaletteOpen,
      version, refresh, toast, notify: setToast, people, projects, unread }}>
      {children}
    </UiCtx.Provider>
  )
}

export const useUi = () => useContext(UiCtx)

/** load data and reload whenever the global version bumps */
export function useData(url, deps = []) {
  const { version } = useUi()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const load = useCallback(() => {
    if (!url) return
    api.get(url).then((d) => { setData(d); setError(null) }).catch((e) => setError(e.message))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps])
  useEffect(() => { load() }, [load, version])
  return { data, setData, error, reload: load }
}
