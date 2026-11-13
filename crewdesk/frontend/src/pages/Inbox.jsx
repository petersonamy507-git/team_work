// Inbox (Teamwork /app/inbox): searchable list + preview pane, filters, options menu, mark read / archive
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, MoreVertical, Check, CheckCheck, Archive, ArchiveRestore, Mail, MessageSquare, CheckSquare, Bell, ExternalLink, Send, ArrowUp, ArrowDown } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { api, qs } from '../lib/api'
import { useData, useUi } from '../lib/ui-context'
import { timeAgo, fmtDate } from '../lib/format'
import { Avatar, Menu } from '../components/ui'
import { EmptyState, Pill } from '../components/Kit'

const KINDS = [['task', 'Tasks'], ['message', 'Messages'], ['comment', 'Comments'], ['time', 'Time'], ['proof', 'Proofs'], ['reminder', 'Reminders'], ['info', 'Other']]
const ICON = { message: Mail, comment: MessageSquare, task: CheckSquare }
const pref = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1' } catch { return d } }

function Post({ who, when, body, highlight, sub }) {
  return (
    <div className={`ib-post ${highlight ? 'hl' : ''}`}>
      <Avatar user={who} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 6 }}><b>{who?.name || 'Crewdesk'}</b><span className="spacer" style={{ flex: 1 }} /><span className="muted small">{timeAgo(when)}</span></div>
        {sub && <div className="muted small">{sub}</div>}
        <div className="ib-body">{body}</div>
      </div>
    </div>
  )
}

function Preview({ item, onNav, onAct }) {
  const { openTask, refresh, notify } = useUi()
  const { user } = useAuth()
  const navigate = useNavigate()
  // older notifications point at /my-work; find the task they talk about from the quoted title
  const quoted = (item.message.match(/"([^"]+)"/) || [])[1]
  const [found, setFound] = useState(null)
  useEffect(() => {
    if (/^\/(tasks|projects|chat)\//.test(item.link || '') || !quoted) return
    api.get(`/search?q=${encodeURIComponent(quoted)}`).then((r) => { const t = r.tasks.find((x) => x.title === quoted) || r.tasks[0]; if (t) setFound(`/tasks/${t.id}`) }).catch(() => {})
  }, [item.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const link = found || item.link || ''
  const task = link.match(/^\/tasks\/(\d+)/)
  const msg = link.match(/^\/projects\/(\d+)\/messages\/(\d+)/)
  const chat = link.match(/^\/chat\/(\d+)/)
  const { data: t, error: terr, reload: reloadT } = useData(task ? `/tasks/${task[1]}` : null, [link])
  const { data: m, error: merr, reload: reloadM } = useData(msg ? `/messages/${msg[2]}` : null, [link])
  const [reply, setReply] = useState('')
  const end = useRef()
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [t?.comments?.length, m?.replies?.length])
  const send = async () => {
    if (!reply.trim()) return
    if (msg) { await api.post(`/messages/${msg[2]}/replies`, { body: reply }); reloadM() } else if (task) { await api.post(`/tasks/${task[1]}/comments`, { body: reply }); reloadT() }
    setReply(''); notify('Reply posted'); refresh()
  }
  const crumbs = t ? [t.project_name, 'Tasks', t.title] : m ? [m.project_name || 'Project', 'Messages', m.title] : [item.kind]
  const canReply = (task && t) || (msg && m)
  return (
    <div className="ib-preview">
      <div className="ib-bar">
        <span className="muted small ellipsis" style={{ flex: 1 }}>{crumbs.filter(Boolean).join(' › ')}</span>
        <button className="icon-btn" title={item.is_read ? 'Mark as unread' : 'Mark as read'} onClick={() => onAct(`/inbox/${item.id}/read?read=${!item.is_read}`)}><CheckCheck size={16} /></button>
        <button className="icon-btn" title="Archive" onClick={() => onAct(`/inbox/${item.id}/archive?archived=${!item.is_archived}`)}><Archive size={16} /></button>
        <button className="icon-btn" title="Previous" onClick={() => onNav(-1)}><ArrowUp size={16} /></button>
        <button className="icon-btn" title="Next" onClick={() => onNav(1)}><ArrowDown size={16} /></button>
        {(link || chat) && <button className="icon-btn" title="Open" onClick={() => (task ? openTask(Number(task[1])) : navigate(link))}><ExternalLink size={16} /></button>}
      </div>
      <div className="ib-thread">
        {(terr || merr) && <div className="kit-empty"><b>This item is no longer available</b><span>It may have been deleted.</span></div>}
        {t && <>
          <div className="ib-title"><h2>{t.title}</h2><div className="row" style={{ gap: 6, flexWrap: 'wrap' }}><Pill tone={t.status === 'completed' ? 'green' : 'blue'}>{t.status.replace('_', ' ')}</Pill>{t.due_date && <Pill tone="amber">Due {fmtDate(t.due_date)}</Pill>}{(t.assignees || []).map((a) => <span key={a.id} className="kit-person small"><Avatar user={a} size={18} />{a.name}</span>)}</div></div>
          {t.description && <Post who={t.created_by} when={t.created_at} body={t.description} sub="created the task" />}
          {(t.comments || []).map((c) => <Post key={c.id} who={c.user} when={c.created_at} body={c.body} highlight={item.kind === 'comment' && c === t.comments[t.comments.length - 1]} />)}
          {!(t.comments || []).length && !t.description && <div className="muted small" style={{ padding: 20 }}>No comments yet. Start the conversation below.</div>}
        </>}
        {m && <>
          <div className="ib-title"><h2>{m.title}</h2></div>
          <Post who={m.user} when={m.created_at} body={m.body} highlight={!m.replies.length} />
          {m.replies.map((r, k) => <Post key={r.id} who={r.user} when={r.created_at} body={r.body} highlight={k === m.replies.length - 1} />)}
        </>}
        {!t && !m && !terr && !merr && <Post who={item.actor} when={item.created_at} body={item.message} highlight />}
        <div ref={end} />
      </div>
      {canReply && <div className="ib-reply"><Avatar user={user} size={32} />
        <textarea rows={1} placeholder={msg ? 'Reply to message' : 'Add a comment'} value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send() }} />
        <button className="btn primary" disabled={!reply.trim()} onClick={send}><Send size={14} /></button></div>}
    </div>
  )
}

export default function InboxPage() {
  const { refresh, notify } = useUi()
  const [q, setQ] = useState('')
  const [f, setF] = useState({ kind: [], read: '', archived: false })
  const [sel, setSel] = useState(null)
  const [autoRead, setAutoRead] = useState(() => pref('cd_inbox_auto', true))
  const [group, setGroup] = useState(() => pref('cd_inbox_group', false))
  const { data, reload } = useData(`/inbox2${qs({ q, kind: f.kind.join(','), read: f.read, archived: f.archived ? 'true' : '' })}`, [q, JSON.stringify(f)])
  const items = data?.items || []
  const cur = items.find((n) => n.id === sel)
  const save = (k, v, set) => { set(v); try { localStorage.setItem(k, v ? '1' : '0') } catch { /* ignore */ } }
  const act = async (url, msg) => { await api.post(url); if (msg) notify(msg); reload(); refresh() }
  useEffect(() => { if (cur && autoRead && !cur.is_read) act(`/inbox/${cur.id}/read`) }, [sel]) // eslint-disable-line react-hooks/exhaustive-deps
  const nf = f.kind.length + (f.read ? 1 : 0) + (f.archived ? 1 : 0)
  const groups = group ? Object.entries(items.reduce((g, n) => { (g[n.link || n.id] = g[n.link || n.id] || []).push(n); return g }, {})).map(([, l]) => ({ ...l[0], count: l.length })) : items
  return (
    <div className="tw-page" style={{ flexDirection: 'row', height: 'calc(100vh - 40px)' }}>
      <div style={{ width: 380, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div className="row" style={{ gap: 6, padding: '12px 12px 8px' }}>
          <label className="sp-search" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #cfd3e0', borderRadius: 9999, padding: '5px 10px' }}><Search size={14} /><input style={{ border: 0, outline: 0, flex: 1 }} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <Menu trigger={<button className={`tb-btn ${nf ? 'on' : ''}`}><Filter size={14} />Filter{nf ? ` ${nf}` : ''}</button>}>
            <div className="muted small" style={{ padding: '6px 10px' }}>Type</div>
            {KINDS.map(([k, l]) => <button key={k} onClick={(e) => { e.stopPropagation(); setF({ ...f, kind: f.kind.includes(k) ? f.kind.filter((x) => x !== k) : [...f.kind, k] }) }}>{f.kind.includes(k) ? <Check size={14} /> : <span style={{ width: 14 }} />}{l}</button>)}
            <div className="muted small" style={{ padding: '6px 10px' }}>Read status</div>
            {[['', 'All'], ['unread', 'Unread'], ['read', 'Read']].map(([k, l]) => <button key={k} onClick={(e) => { e.stopPropagation(); setF({ ...f, read: k }) }}>{f.read === k ? <Check size={14} /> : <span style={{ width: 14 }} />}{l}</button>)}
            <div className="muted small" style={{ padding: '6px 10px' }}>Status</div>
            {[[false, 'Active'], [true, 'Archived']].map(([k, l]) => <button key={l} onClick={(e) => { e.stopPropagation(); setF({ ...f, archived: k }) }}>{f.archived === k ? <Check size={14} /> : <span style={{ width: 14 }} />}{l}</button>)}
            {nf > 0 && <button onClick={() => setF({ kind: [], read: '', archived: false })} style={{ color: 'var(--accent)' }}>Clear filters</button>}
          </Menu>
          <Menu trigger={<button className="icon-btn"><MoreVertical size={16} /></button>}>
            <button onClick={() => act('/inbox/read-all', 'All marked as read')}><CheckCheck size={14} />Mark all as read</button>
            <button onClick={() => act('/inbox/archive-all', 'Inbox archived')}><Archive size={14} />Archive all</button>
            <button onClick={() => act('/inbox/archive-all?only_read=true', 'Read items archived')}><Archive size={14} />Archive read</button>
            <button onClick={(e) => { e.stopPropagation(); save('cd_inbox_auto', !autoRead, setAutoRead) }}>{autoRead ? <Check size={14} /> : <span style={{ width: 14 }} />}Mark items as read automatically</button>
            <button onClick={(e) => { e.stopPropagation(); save('cd_inbox_group', !group, setGroup) }}>{group ? <Check size={14} /> : <span style={{ width: 14 }} />}Group related items</button>
          </Menu>
        </div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          {data && !items.length && <EmptyState icon={Bell} title={f.archived ? 'No archived items' : 'You\'re all caught up'} text="Assignments, comments and messages land here." />}
          {groups.map((n) => { const I = ICON[n.kind] || Bell
            return (
              <div key={n.id} className={`twrow ${sel === n.id ? 'sel' : ''}`} style={{ alignItems: 'flex-start', padding: '10px 12px', borderRadius: 0 }} onClick={() => setSel(n.id)}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#ffe5f1', color: '#d0307a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><I size={13} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="muted" style={{ fontSize: 11 }}>{n.actor?.name || 'Crewdesk'} · {n.kind}{n.count > 1 ? ` · ${n.count} updates` : ''}</div>
                  <div className="ellipsis" style={{ fontWeight: n.is_read ? 400 : 600, fontSize: 13 }}>{n.message}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{timeAgo(n.created_at)}</span>
                  <span className="row" style={{ gap: 0 }}>
                    <button className="icon-btn hover-only" title={n.is_read ? 'Mark as unread' : 'Mark as read'} onClick={(e) => { e.stopPropagation(); act(`/inbox/${n.id}/read?read=${!n.is_read}`) }}><Check size={13} /></button>
                    <button className="icon-btn hover-only" title={n.is_archived ? 'Unarchive' : 'Archive'} onClick={(e) => { e.stopPropagation(); act(`/inbox/${n.id}/archive?archived=${!n.is_archived}`) }}>{n.is_archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}</button>
                    {!n.is_read && <span className="dot" style={{ background: 'var(--accent)', marginTop: 8 }} />}
                  </span>
                </div>
              </div>) })}
        </div>
      </div>
      {cur ? <Preview key={cur.id} item={cur} onAct={(u) => act(u)} onNav={(d) => { const i = groups.findIndex((n) => n.id === cur.id); const n = groups[i + d]; if (n) setSel(n.id) }} /> : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState icon={Mail} title="Nothing to preview" text="Your inbox is a central hub for managing communications that are important to you. To preview, respond or react to updates without leaving your inbox, just select an item and view it in this panel." />
        </div>)}
    </div>
  )
}
