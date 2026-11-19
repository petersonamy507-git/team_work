// Crewdesk HQ: a Basecamp-style home — greeting + quick actions, project cards, recent activity,
// people active in the last 24 hours, and a bottom bar with My Tasks / Events / Bookmarks / Activity / Notes.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Folder, Users, Settings, Search, Maximize2, Minimize2, Bookmark, BookmarkCheck, X, CheckSquare, CalendarDays, List, StickyNote, Trash2, Pin } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useData, useUi } from '../lib/ui-context'
import { timeAgo, fmtDate } from '../lib/format'
import { Avatar, AvatarStack } from '../components/ui'
import TaskRow from '../components/TaskRow'
import { FormModal, useRows } from '../components/Kit'

function usePrefs() {
  const [p, setP] = useState({})
  useEffect(() => { api.get('/prefs').then(setP).catch(() => {}) }, [])
  const save = async (patch) => { setP((x) => ({ ...x, ...patch })); await api.patch('/prefs', patch) }
  return [p, save]
}

export default function HQ() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { setQuickAdd, setPaletteOpen, projects, notify } = useUi()
  const { data: acts } = useData('/activity')
  const cats = useRows('categories')
  const [prefs, savePrefs] = usePrefs()
  const [wide, setWide] = useState(false)
  const [folder, setFolder] = useState('all')
  const [panel, setPanel] = useState(null)
  const [folderForm, setFolderForm] = useState(false)
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const bookmarks = prefs.bookmarks || []
  const pinned = prefs.hq_pinned || []
  const isMarked = (link) => bookmarks.some((b) => b.link === link)
  const toggleMark = (title, link) => savePrefs({ bookmarks: isMarked(link) ? bookmarks.filter((b) => b.link !== link) : [{ title, link, at: new Date().toISOString() }, ...bookmarks] })
  const togglePin = (id) => savePrefs({ hq_pinned: pinned.includes(id) ? pinned.filter((x) => x !== id) : [id, ...pinned] })
  const list = useMemo(() => projects.filter((p) => folder === 'all' || (folder === 'none' ? !p.category_id : p.category_id === folder))
    .sort((a, b) => (pinned.includes(b.id) - pinned.includes(a.id)) || a.name.localeCompare(b.name)), [projects, folder, pinned])
  const recent = (acts || []).slice(0, 6)
  const activeIds = [...new Set((acts || []).filter((a) => Date.now() - new Date(a.created_at + 'Z') < 864e5 && a.user).map((a) => a.user.id))]
  const activeUsers = activeIds.map((id) => (acts || []).find((a) => a.user?.id === id).user)
  return (
    <div className="hq">
      <div className="hq-top">
        <div className="hq-brand"><img src="/logo.svg" alt="" />Crewdesk</div>
        <button className="hq-search" onClick={() => setPaletteOpen(true)}><Search size={15} />Go, jump, or search…<kbd>Ctrl K</kbd></button>
        <div className="hq-new">{(acts || []).some((a) => Date.now() - new Date(a.created_at + 'Z') < 3600e3) && <><span className="dot" style={{ background: '#e2445c' }} />New for you</>}</div>
      </div>
      <div className={`hq-grid ${wide ? 'wide' : ''}`}>
        {!wide && <div className="hq-left">
          <h2>{greet}, {user.name.split(' ')[0]}</h2>
          <button className="hq-act" onClick={() => setQuickAdd('project')}><Plus size={16} />Make a new project</button>
          <button className="hq-act" onClick={() => setFolderForm(true)}><Folder size={16} />Add a folder</button>
          <button className="hq-act" onClick={() => navigate('/people/people?invite=1')}><Users size={16} />Invite people to the account</button>
          {user.role === 'admin' && <button className="hq-act" onClick={() => navigate('/settings/general')}><Settings size={16} />Adminland</button>}
        </div>}
        <div className="hq-center">
          <div className="hq-center-head"><h3>{wide ? 'All projects' : 'Your projects'}</h3><button className="icon-btn" title={wide ? 'Shrink' : 'Expand'} onClick={() => setWide(!wide)}>{wide ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button></div>
          <div className="muted small" style={{ textAlign: 'center', marginBottom: 10 }}>Press <kbd className="hq-kbd">Ctrl</kbd> <kbd className="hq-kbd">K</kbd> anytime to jump to anything</div>
          {(cats.rows || []).length > 0 && <div className="chips" style={{ justifyContent: 'center', marginBottom: 10 }}>
            <button className={folder === 'all' ? 'on' : ''} onClick={() => setFolder('all')}>All</button>
            {cats.rows.map((c) => <button key={c.id} className={folder === c.id ? 'on' : ''} onClick={() => setFolder(c.id)}><Folder size={12} /> {c.name}</button>)}
            <button className={folder === 'none' ? 'on' : ''} onClick={() => setFolder('none')}>No folder</button></div>}
          <div className="hq-cards">
            {list.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="hq-card" style={{ '--pc': p.color }}>
                <span className="hq-card-tools" onClick={(e) => e.preventDefault()}>
                  <button title={pinned.includes(p.id) ? 'Unpin' : 'Pin to top'} className={pinned.includes(p.id) ? 'on' : ''} onClick={() => togglePin(p.id)}><Pin size={13} /></button>
                  <button title={isMarked(`/projects/${p.id}`) ? 'Remove bookmark' : 'Bookmark'} className={isMarked(`/projects/${p.id}`) ? 'on' : ''} onClick={() => { toggleMark(p.name, `/projects/${p.id}`); notify(isMarked(`/projects/${p.id}`) ? 'Bookmark removed' : 'Bookmarked') }}>{isMarked(`/projects/${p.id}`) ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}</button>
                </span>
                <b>{p.name}</b>
                <span className="hq-desc">{p.client ? `Client: ${p.client.name}` : (p.description || 'Project')}</span>
                <span style={{ flex: 1 }} />
                <AvatarStack users={p.members} size={20} max={9} />
              </Link>))}
            <button className="hq-card hq-add" onClick={() => setQuickAdd('project')}><Plus size={22} />Make a new project</button>
          </div>
        </div>
        {!wide && <div className="hq-right">
          <h3>Most recent activity <Link to="/activity" className="small" style={{ color: 'var(--accent)', fontWeight: 400 }}>– View all</Link></h3>
          {recent.map((a) => (
            <div key={a.id} className="hq-act-row">
              <span className="hq-tl" />
              <div><div className="muted small">{timeAgo(a.created_at)}</div>
                <div className="small"><Avatar user={a.user} size={18} /> <b>{a.user?.name || 'Someone'}</b> {a.action}{a.project_name && <> — {a.project_id ? <Link to={`/projects/${a.project_id}`} style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{a.project_name}</Link> : a.project_name}</>}</div></div>
            </div>))}
          {acts && !recent.length && <div className="muted small">Nothing has happened yet.</div>}
          <div className="small" style={{ marginTop: 18 }}><b>{activeUsers.length} {activeUsers.length === 1 ? 'person' : 'people'}</b> active in the last 24 hours</div>
          <div style={{ marginTop: 6 }}><AvatarStack users={activeUsers} size={26} max={12} /></div>
        </div>}
      </div>
      <div className="hq-bottom">
        <span className="hq-me"><Avatar user={user} size={30} /></span>
        {[['tasks', 'My Tasks', CheckSquare], ['events', 'My Events', CalendarDays], ['bookmarks', 'My Bookmarks', Bookmark], ['activity', 'My Activity', List], ['notes', 'My Notes', StickyNote]].map(([k, l, I]) =>
          <button key={k} className={panel === k ? 'on' : ''} onClick={() => setPanel(panel === k ? null : k)}><I size={14} />{l}</button>)}
      </div>
      {panel && <MePanel kind={panel} onClose={() => setPanel(null)} prefs={prefs} savePrefs={savePrefs} bookmarks={bookmarks} toggleMark={toggleMark} />}
      {folderForm && <FormModal title="Add a folder" onClose={() => setFolderForm(false)} onSubmit={(v) => cats.create(v)}
        fields={[{ key: 'name', label: 'Folder name', required: true, autoFocus: true, placeholder: 'Clients' }, { key: 'color', label: 'Colour', type: 'color' }]} />}
    </div>
  )
}

function MePanel({ kind, onClose, prefs, savePrefs, bookmarks, toggleMark }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { setQuickAdd } = useUi()
  const s = new Date().toISOString().slice(0, 10)
  const e = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10)
  const { data: tasks } = useData(kind === 'tasks' ? '/tasks?assignee=me&status=open' : null, [kind])
  const { data: events } = useData(kind === 'events' ? `/events?start=${s}&end=${e}` : null, [kind])
  const { data: acts } = useData(kind === 'activity' ? '/activity' : null, [kind])
  const [notes, setNotes] = useState(prefs.my_notes || '')
  const [saved, setSaved] = useState(true)
  useEffect(() => { if (saved) return; const t = setTimeout(async () => { await savePrefs({ my_notes: notes }); setSaved(true) }, 600); return () => clearTimeout(t) }, [notes, saved, savePrefs])
  const title = { tasks: 'My Tasks', events: 'My Events', bookmarks: 'My Bookmarks', activity: 'My Activity', notes: 'My Notes' }[kind]
  return (
    <div className="hq-panel">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}><h3>{title}</h3><button className="icon-btn" onClick={onClose}><X size={16} /></button></div>
      <div className="hq-panel-body">
        {kind === 'tasks' && <>{(tasks || []).map((t) => <TaskRow key={t.id} task={t} showProject />)}{tasks && !tasks.length && <div className="muted small">You have no open tasks.</div>}
          <button className="btn" style={{ marginTop: 10 }} onClick={() => navigate('/my-work')}>Open My work</button></>}
        {kind === 'events' && <>{(events || []).map((ev) => <div key={ev.id} className="twrow"><CalendarDays size={15} className="muted" /><b style={{ flex: 1 }}>{ev.title}</b><span className="muted small">{fmtDate(ev.date, { weekday: 'short', day: 'numeric', month: 'short' })} {ev.start_time || ''}</span></div>)}
          {events && !events.length && <div className="muted small">No upcoming events.</div>}<button className="btn" style={{ marginTop: 10 }} onClick={() => setQuickAdd('event')}><Plus size={14} />Add event</button></>}
        {kind === 'bookmarks' && <>{bookmarks.map((b) => <div key={b.link} className="twrow" onClick={() => navigate(b.link)}><Bookmark size={15} color="#4461d7" /><b style={{ flex: 1 }}>{b.title}</b><button className="icon-btn" onClick={(ev) => { ev.stopPropagation(); toggleMark(b.title, b.link) }}><Trash2 size={13} /></button></div>)}
          {!bookmarks.length && <div className="muted small">Bookmark a project with the bookmark icon on its card to find it here.</div>}
          <button className="btn" style={{ marginTop: 10 }} onClick={() => { const t = prompt('Bookmark name'); const l = t && prompt('Crewdesk link (for example /projects/1 or /reports/all)', window.location.pathname); if (t && l) toggleMark(t, l.replace(window.location.origin, '')) }}><Plus size={14} />Add bookmark</button></>}
        {kind === 'activity' && <>{(acts || []).filter((a) => a.user?.id === user.id).slice(0, 30).map((a) => <div key={a.id} className="twrow small"><span style={{ flex: 1 }}>{a.action}{a.project_name && <span className="muted"> · {a.project_name}</span>}</span><span className="muted">{timeAgo(a.created_at)}</span></div>)}
          {acts && !acts.some((a) => a.user?.id === user.id) && <div className="muted small">You haven't done anything yet.</div>}</>}
        {kind === 'notes' && <><textarea className="input hq-notes" placeholder="Private notes only you can see. They save automatically." value={notes} onChange={(e2) => { setNotes(e2.target.value); setSaved(false) }} /><div className="muted small">{saved ? 'Saved' : 'Saving…'}</div></>}
      </div>
    </div>
  )
}
