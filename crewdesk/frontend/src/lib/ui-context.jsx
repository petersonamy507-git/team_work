import { createContext, useCallback, useContext, useEffect, useState } from 'react'
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

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  const loadLookups = useCallback(() => {
    api.get('/people').then(setPeople).catch(() => {})
    api.get('/projects?status=active').then(setProjects).catch(() => {})
    api.get('/inbox?filter=unread').then((r) => setUnread(r.unread)).catch(() => {})
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
