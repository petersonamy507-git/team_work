// Crewdesk Chat (Teamwork Chat): Home, Highlights, Channels, People; channels + direct messages with live polling
import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { MessageCircle, Search, Plus, Hash, Lock, Star, Info, Users, Bookmark, Send, Smile, Trash2, Pencil, X, LogIn, LogOut, MoreVertical } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useUi } from '../lib/ui-context'
import { timeAgo } from '../lib/format'
import { Avatar, Menu } from '../components/ui'
import { EmptyState, FormModal } from '../components/Kit'

const EMOJI = ['👍', '🙂', '😂', '🎉', '❤️', '🙏', '👀', '✅', '🔥', '👋']
const dayOf = (iso) => new Date(iso.endsWith('Z') ? iso : iso + 'Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const timeOf = (iso) => new Date(iso.endsWith('Z') ? iso : iso + 'Z').toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

function ChanIcon({ c, size = 38 }) {
  if (c.is_dm) return <Avatar user={c.other} size={size} />
  return <span className="chat-chan-ic" style={{ width: size, height: size }}>{c.is_private ? <Lock size={size / 2.4} /> : <Hash size={size / 2.4} />}</span>
}

function Conversation({ channel, onChanged }) {
  const { user } = useAuth()
  const { notify } = useUi()
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [edit, setEdit] = useState(null)
  const [side, setSide] = useState(null)
  const end = useRef()
  const last = useRef(0)
  const cid = channel.id
  useEffect(() => {
    let alive = true
    setMsgs([]); last.current = 0
    const load = async () => {
      const rows = await api.get(`/chat/channels/${cid}/messages?after=${last.current}`).catch(() => [])
      if (!alive || !rows.length) return
      last.current = rows[rows.length - 1].id
      setMsgs((m) => [...m, ...rows.filter((r) => !m.some((x) => x.id === r.id))])
      onChanged?.()
    }
    load()
    const t = setInterval(load, 3000)
    return () => { alive = false; clearInterval(t) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs.length])
  const send = async () => {
    const b = text.trim(); if (!b) return
    setText('')
    const m = await api.post(`/chat/channels/${cid}/messages`, { body: b })
    last.current = Math.max(last.current, m.id)
    setMsgs((x) => [...x, m]); onChanged?.()
  }
  const saveEdit = async () => { const m = await api.patch(`/chat/messages/${edit.id}`, { body: edit.body }); setMsgs((x) => x.map((y) => (y.id === m.id ? m : y))); setEdit(null); onChanged?.() }
  const del = async (m) => { if (!confirm('Delete this message?')) return; await api.del(`/chat/messages/${m.id}`); setMsgs((x) => x.filter((y) => y.id !== m.id)); onChanged?.() }
  const mark = async (m) => { const r = await api.patch(`/chat/messages/${m.id}`, { is_bookmarked: !m.is_bookmarked }); setMsgs((x) => x.map((y) => (y.id === r.id ? r : y))); notify(r.is_bookmarked ? 'Added to Highlights' : 'Removed from Highlights') }
  let lastDay = ''
  return (
    <div className="chat-main">
      <div className="chat-head">
        <ChanIcon c={channel} size={30} />
        <div style={{ flex: 1 }}><b style={{ fontSize: 16 }}>{channel.name}</b><div className="muted small">{channel.is_dm ? 'Direct message' : `${channel.member_count} members`}{channel.description ? ` · ${channel.description}` : ''}</div></div>
        <button className={`icon-btn ${side === 'info' ? 'on' : ''}`} title="Channel info" onClick={() => setSide(side === 'info' ? null : 'info')}><Info size={16} /></button>
        <button className={`icon-btn ${side === 'marks' ? 'on' : ''}`} title="Bookmarked messages" onClick={() => setSide(side === 'marks' ? null : 'marks')}><Bookmark size={16} /></button>
      </div>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div className="chat-msgs">
          {!msgs.length && <EmptyState icon={MessageCircle} title="No messages yet" text={channel.is_dm ? `Say hi to ${channel.name}!` : 'Be the first to say something.'} />}
          {msgs.map((m) => { const d = dayOf(m.created_at); const head = d !== lastDay; lastDay = d
            return (<div key={m.id}>
              {head && <div className="chat-day"><span>{d}</span></div>}
              <div className="chat-msg">
                <Avatar user={m.user} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div><b>{m.user?.name || 'Crewdesk'}</b> <span className="muted small">{timeOf(m.created_at)}</span>{m.is_bookmarked && <Bookmark size={12} color="#f0a500" fill="#f0a500" style={{ marginLeft: 6 }} />}</div>
                  {edit?.id === m.id ? (
                    <div className="row" style={{ gap: 6 }}><input className="input" autoFocus value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEdit(null) }} /><button className="btn sm" onClick={saveEdit}>Save</button></div>
                  ) : <div className="chat-body">{m.body}</div>}
                </div>
                <span className="chat-tools">
                  <button className="icon-btn" title={m.is_bookmarked ? 'Remove bookmark' : 'Bookmark'} onClick={() => mark(m)}><Bookmark size={14} /></button>
                  {m.user?.id === user.id && <button className="icon-btn" title="Edit" onClick={() => setEdit({ id: m.id, body: m.body })}><Pencil size={14} /></button>}
                  {m.user?.id === user.id && <button className="icon-btn" title="Delete" onClick={() => del(m)}><Trash2 size={14} /></button>}
                </span>
              </div>
            </div>) })}
          <div ref={end} />
        </div>
        {side && <div className="chat-side">
          {side === 'info' ? <>
            <h4>{channel.is_dm ? 'Conversation' : 'Channel info'}</h4>
            <div className="muted small" style={{ marginBottom: 8 }}>{channel.description || 'No description'}</div>
            <div className="small"><b>{channel.member_count}</b> members{channel.is_private ? ' · private' : ' · public'}</div>
          </> : <>
            <h4>Bookmarked</h4>
            {msgs.filter((m) => m.is_bookmarked).map((m) => <div key={m.id} className="small" style={{ padding: '6px 0', borderBottom: '1px solid var(--row-line)' }}><b>{m.user?.name}</b>: {m.body}</div>)}
            {!msgs.some((m) => m.is_bookmarked) && <div className="muted small">Nothing bookmarked here yet.</div>}
          </>}
        </div>}
      </div>
      <div className="chat-compose">
        <textarea rows={1} placeholder="Message goes here" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <Menu trigger={<button className="icon-btn" title="Emoji"><Smile size={17} /></button>}>
          <div className="row" style={{ gap: 2, padding: 4, flexWrap: 'wrap', width: 200 }}>{EMOJI.map((e) => <button key={e} style={{ fontSize: 18, width: 34 }} onClick={() => setText(text + e)}>{e}</button>)}</div>
        </Menu>
        <button className="btn primary" disabled={!text.trim()} onClick={send}><Send size={14} /></button>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const { cid, view = 'home' } = useParams()
  const { people } = useUi()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [chans, setChans] = useState(null)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('recent')
  const [form, setForm] = useState(false)
  const [marks, setMarks] = useState(null)
  const load = () => api.get('/chat/channels').then(setChans).catch(() => {})
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t) }, [])
  useEffect(() => { if (view === 'highlights') api.get('/chat/bookmarks').then(setMarks) }, [view])
  const cur = chans?.find((c) => String(c.id) === String(cid))
  useEffect(() => { if (!cid && view === 'home' && chans?.length) navigate(`/chat/${chans[0].id}`, { replace: true }) }, [cid, view, chans, navigate])
  const dm = async (uid) => { const c = await api.post(`/chat/dm/${uid}`); await load(); navigate(`/chat/${c.id}`) }
  const list = (chans || []).filter((c) => c.is_member && c.name.toLowerCase().includes(q.toLowerCase()) && (tab === 'recent' || c.unread > 0))
  const dmIds = new Set((chans || []).filter((c) => c.is_dm).map((c) => c.other?.id))
  return (
    <div className="chat-app">
      <div className="chat-top">
        <MessageCircle size={20} />
        {[['home', 'Home', '/chat'], ['highlights', 'Highlights', '/chat/v/highlights'], ['channels', 'Channels', '/chat/v/channels'], ['people', 'People', '/chat/v/people']].map(([k, l, to]) =>
          <NavLink key={k} to={to} end className={() => ((view === k && (k !== 'home' || true)) ? 'on' : '')}>{l}</NavLink>)}
        <span style={{ flex: 1 }} />
        <button className="btn sm" onClick={() => setForm(true)}><Plus size={14} />New channel</button>
      </div>
      <div className="chat-body-wrap">
        <div className="chat-list">
          <label className="sp-search" style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #cfd3e0', borderRadius: 9999, padding: '5px 10px', margin: 12 }}><Search size={14} /><input style={{ border: 0, outline: 0, flex: 1 }} placeholder="Filter conversations" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <div className="chips" style={{ padding: '0 12px 6px' }}><button className={tab === 'recent' ? 'on' : ''} onClick={() => setTab('recent')}>Recent</button><button className={tab === 'unread' ? 'on' : ''} onClick={() => setTab('unread')}>Unread</button></div>
          {list.map((c) => (
            <div key={c.id} className={`chat-item ${String(c.id) === String(cid) ? 'on' : ''}`} onClick={() => navigate(`/chat/${c.id}`)}>
              <ChanIcon c={c} />
              <div style={{ flex: 1, minWidth: 0 }}><b className="ellipsis" style={{ display: 'block' }}>{c.name}</b><span className="muted small ellipsis" style={{ display: 'block' }}>{c.last ? `${c.last.user?.id === user.id ? 'You' : c.last.user?.name?.split(' ')[0]}: ${c.last.body}` : 'No messages yet'}</span></div>
              {c.unread > 0 && <span className="side-count">{c.unread}</span>}
            </div>))}
          {chans && !list.length && <div className="muted small" style={{ padding: 12 }}>No conversations.</div>}
          <div className="side-section" style={{ padding: '14px 12px 4px' }}>People</div>
          {people.filter((p) => p.is_active !== false && p.id !== user.id && !dmIds.has(p.id) && p.name.toLowerCase().includes(q.toLowerCase())).map((p) => (
            <div key={p.id} className="chat-item" onClick={() => dm(p.id)}><Avatar user={p} size={34} /><b style={{ flex: 1 }}>{p.name}</b></div>))}
        </div>
        {view === 'home' && (cur ? <Conversation key={cur.id} channel={cur} onChanged={load} /> : <div className="chat-main"><EmptyState icon={MessageCircle} title="Welcome to Crewdesk Chat" text="Pick a conversation, or start one with someone from the People list." /></div>)}
        {view === 'highlights' && <div className="chat-main" style={{ padding: 20, overflow: 'auto' }}><h2 style={{ fontSize: 18, marginBottom: 10 }}>Highlights</h2>
          {marks && !marks.length && <EmptyState icon={Bookmark} title="No bookmarked messages" text="Bookmark a message to find it here later." />}
          {(marks || []).map((m) => <div key={m.id} className="chat-msg" style={{ cursor: 'pointer' }} onClick={() => navigate(`/chat/${m.channel_id}`)}><Avatar user={m.user} size={30} /><div><div><b>{m.user?.name}</b> <span className="muted small">in {m.channel_name} · {timeAgo(m.created_at)}</span></div><div className="chat-body">{m.body}</div></div></div>)}</div>}
        {view === 'channels' && <div className="chat-main" style={{ padding: 20, overflow: 'auto' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}><h2 style={{ fontSize: 18 }}>Discover channels</h2><button className="btn primary" onClick={() => setForm(true)}><Plus size={14} />Create channel</button></div>
          {(chans || []).filter((c) => !c.is_dm).map((c) => (
            <div key={c.id} className="chat-item" style={{ borderBottom: '1px solid var(--row-line)' }}>
              <ChanIcon c={c} /><div style={{ flex: 1 }} onClick={() => c.is_member && navigate(`/chat/${c.id}`)}><b>{c.name}</b><div className="muted small">{c.description || 'No description'} · {c.member_count} members</div></div>
              {c.is_member ? <><button className="btn sm" onClick={() => navigate(`/chat/${c.id}`)}>Open</button>{c.is_private && <button className="icon-btn" title="Leave" onClick={async () => { await api.patch(`/chat/channels/${c.id}`, { join: false }); load() }}><LogOut size={14} /></button>}</>
                : <button className="btn sm" onClick={async () => { await api.patch(`/chat/channels/${c.id}`, { join: true }); await load(); navigate(`/chat/${c.id}`) }}><LogIn size={14} />Join</button>}
              <Menu trigger={<button className="icon-btn"><MoreVertical size={14} /></button>}><button style={{ color: 'var(--danger)' }} onClick={async () => { if (confirm(`Delete channel ${c.name}?`)) { await api.del(`/chat/channels/${c.id}`); load() } }}><Trash2 size={14} />Delete channel</button></Menu>
            </div>))}</div>}
        {view === 'people' && <div className="chat-main" style={{ padding: 20, overflow: 'auto' }}><h2 style={{ fontSize: 18, marginBottom: 10 }}>People</h2>
          {people.filter((p) => p.is_active !== false && p.id !== user.id).map((p) => <div key={p.id} className="chat-item" style={{ borderBottom: '1px solid var(--row-line)' }}><Avatar user={p} size={34} /><div style={{ flex: 1 }}><b>{p.name}</b><div className="muted small">{p.title || p.email}</div></div><button className="btn sm" onClick={() => dm(p.id)}><MessageCircle size={14} />Message</button></div>)}</div>}
      </div>
      {form && <FormModal title="Create channel" onClose={() => setForm(false)} onSubmit={async (v) => { const c = await api.post('/chat/channels', v); await load(); navigate(`/chat/${c.id}`) }}
        fields={[{ key: 'name', label: 'Channel name', required: true, autoFocus: true, placeholder: 'design-team' }, { key: 'description', label: 'Description' },
          { key: 'is_private', label: 'Private', type: 'checkbox', text: 'Private channel (only invited members)' }, { key: 'member_ids', label: 'Members (for private channels)', type: 'people' }]} />}
      {Star && X && Users ? null : null}
    </div>
  )
}
