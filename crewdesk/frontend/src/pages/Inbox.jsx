// Inbox (Teamwork /app/inbox): searchable list + preview pane, filters, options menu, mark read / archive
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, MoreVertical, Check, CheckCheck, Archive, ArchiveRestore, Mail, MessageSquare, CheckSquare, Bell, ExternalLink, Send } from 'lucide-react'
import { api, qs } from '../lib/api'
import { useData, useUi } from '../lib/ui-context'
import { timeAgo, fmtDate } from '../lib/format'
import { Avatar, Menu } from '../components/ui'
import { EmptyState, Pill } from '../components/Kit'

const KINDS = [['task', 'Tasks'], ['message', 'Messages'], ['comment', 'Comments'], ['time', 'Time'], ['proof', 'Proofs'], ['reminder', 'Reminders'], ['info', 'Other']]
const ICON = { message: Mail, comment: MessageSquare, task: CheckSquare }
const pref = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1' } catch { return d } }

function Preview({ item }) {
  const { openTask, refresh, notify } = useUi()
  const navigate = useNavigate()
  const link = item.link || ''
  const task = link.match(/^\/tasks\/(\d+)/)
  const msg = link.match(/^\/projects\/(\d+)\/messages\/(\d+)/)
  const { data: t } = useData(task ? `/tasks/${task[1]}` : null, [link])
  const { data: m, reload } = useData(msg ? `/messages/${msg[2]}` : null, [link])
  const [reply, setReply] = useState('')
  const send = async () => { if (!reply.trim()) return; await api.post(`/messages/${msg[2]}/replies`, { body: reply }); setReply(''); notify('Reply posted'); reload(); refresh() }
  return (
    <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
      <div className="row" style={{ gap: 10, marginBottom: 12 }}><Avatar user={item.actor} size={34} /><div style={{ flex: 1 }}><div className="small muted">{timeAgo(item.created_at)}</div><b>{item.message}</b></div>
        {link && <button className="btn" onClick={() => (task ? openTask(Number(task[1])) : navigate(link))}><ExternalLink size={14} />Open</button>}</div>
      {t && <div className="card" style={{ padding: 16 }}>
        <div className="muted small">{t.project_name} · {t.tasklist_name}</div><h2 style={{ fontSize: 18, margin: '4px 0 10px' }}>{t.title}</h2>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}><Pill tone={t.status === 'completed' ? 'green' : 'blue'}>{t.status.replace('_', ' ')}</Pill>{t.due_date && <Pill tone="amber">Due {fmtDate(t.due_date)}</Pill>}{(t.assignees || []).map((a) => <span key={a.id} className="kit-person"><Avatar user={a} size={20} />{a.name}</span>)}</div>
        {t.description && <p style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{t.description}</p>}
        {(t.comments || []).slice(-5).map((c) => <div key={c.id} className="row" style={{ gap: 8, marginTop: 10, alignItems: 'flex-start' }}><Avatar user={c.user} size={24} /><div><b className="small">{c.user?.name}</b> <span className="muted small">{timeAgo(c.created_at)}</span><div>{c.body}</div></div></div>)}
      </div>}
      {m && <div className="card" style={{ padding: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>{m.title}</h2><p style={{ whiteSpace: 'pre-wrap' }}>{m.body}</p>
        {(m.replies || []).map((r) => <div key={r.id} className="row" style={{ gap: 8, marginTop: 12, alignItems: 'flex-start' }}><Avatar user={r.user} size={24} /><div><b className="small">{r.user?.name}</b> <span className="muted small">{timeAgo(r.created_at)}</span><div style={{ whiteSpace: 'pre-wrap' }}>{r.body}</div></div></div>)}
        <div className="row" style={{ gap: 8, marginTop: 14 }}><textarea className="input" rows={2} placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} /><button className="btn primary" onClick={send}><Send size={14} /></button></div>
      </div>}
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
      {cur ? <Preview item={cur} /> : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState icon={Mail} title="Nothing to preview" text="Your inbox is a central hub for managing communications that are important to you. To preview, respond or react to updates without leaving your inbox, just select an item and view it in this panel." />
        </div>)}
    </div>
  )
}
