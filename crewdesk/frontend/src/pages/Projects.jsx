// Manage › Projects (Teamwork /app/projects/list): categories sidebar, table/cards, status filter
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Star, Folder, LayoutGrid, List, FolderPlus, Tag, Trash2, Download, ChevronDown, LayoutTemplate, Pencil, MoreVertical, Copy, Sparkles, PiggyBank, Archive, CheckCircle2, ChevronRight, CheckSquare, Flag, MessageSquare, Clock, Paperclip, CalendarDays, RotateCcw } from 'lucide-react'
import { ProjectForm } from '../components/QuickAdd'
import { api } from '../lib/api'
import { useData, useUi } from '../lib/ui-context'
import { fmtDate, fmtMinutes } from '../lib/format'
import { AvatarStack, HealthPill, Loading, Menu, Progress } from '../components/ui'
import { Section, DataTable, EmptyState, FormModal, PersonChip, useRows, toCSV } from '../components/Kit'
import { downloadText } from '../lib/taskFilters'

export function StarButton({ project }) {
  const { refresh } = useUi()
  return (
    <button className="icon-btn" title="Star" onClick={async (e) => { e.preventDefault(); e.stopPropagation(); await api.patch(`/projects/${project.id}`, { name: project.name, is_starred: !project.is_starred }); refresh() }}>
      <Star size={16} fill={project.is_starred ? '#f0b400' : 'none'} color={project.is_starred ? '#f0b400' : '#c3c7d4'} />
    </button>
  )
}

const TYPE_COLORS = { Confirmed: '#d6f7e6', Tentative: '#fff1d6', Internal: '#e5ebff', Billable: '#efe5ff', 'Non-billable': '#f1f2f6' }

export default function Projects({ mine }) {
  const { setQuickAdd, notify, refresh } = useUi()
  const navigate = useNavigate()
  const [status, setStatus] = useState('active')
  const [cat, setCat] = useState('all')
  const [view, setView] = useState(() => { try { return localStorage.getItem('cd_pview') || 'table' } catch { return 'table' } })
  const [catForm, setCatForm] = useState(null)
  const [setCatFor, setSetCatFor] = useState(null)
  const [typeFor, setTypeFor] = useState(null)
  const { data } = useData(`/projects?status=${status}`, [status])
  const { data: acts } = useData('/activity')
  const lastAct = (pid) => (acts || []).find((a) => a.project_id === pid)
  const { data: me } = useData('/auth/me')
  const cats = useRows('categories')
  const setV = (v) => { try { localStorage.setItem('cd_pview', v) } catch { /* ignore */ } setView(v) }
  let items = data || []
  if (mine && me) items = items.filter((p) => p.owner?.id === me.id || p.members?.some((m) => m.id === me.id))
  const count = (c) => items.filter((p) => (c === 'all' ? true : c === 'none' ? !p.category_id : p.category_id === c)).length
  const shown = items.filter((p) => (cat === 'all' ? true : cat === 'none' ? !p.category_id : p.category_id === cat))
  const exportCsv = () => downloadText('projects.csv', toCSV(shown.map((p) => ({ Name: p.name, Client: p.client?.name || '', Owner: p.owner?.name || '', Status: p.status, Health: p.health, 'Start date': p.start_date || '', 'End date': p.end_date || '', Tasks: p.task_count, Completed: p.completed_count, 'Logged minutes': p.logged_minutes }))))
  const catName = (id) => cats.rows?.find((c) => c.id === id)
  return (
    <Section icon={Folder} title={mine ? 'My projects' : 'Projects'} tabs={mine ? null : [{ to: '/projects', label: 'List', end: true }, { to: '/templates', label: 'Templates' }]}
      right={<>
        <span className="small" style={{ textTransform: 'capitalize' }}>{status} <span className="kit-pill gray">{items.length}</span></span>
        <div className="chips">{['active', 'completed', 'archived', 'all'].map((s) => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)} style={{ textTransform: 'capitalize' }}>{s}</button>)}</div>
        <div className="scope-toggle"><button className={view === 'table' ? 'active' : ''} onClick={() => setV('table')}><List size={14} /></button><button className={view === 'cards' ? 'active' : ''} onClick={() => setV('cards')}><LayoutGrid size={14} /></button></div>
        <button className="tb-btn" onClick={exportCsv}><Download size={14} /></button>
        <span className="split-btn"><button className="btn primary" onClick={() => setQuickAdd('project')}><Plus size={15} />Add project</button>
          <Menu trigger={<button className="btn primary caret"><ChevronDown size={14} /></button>}>
            <button onClick={() => setQuickAdd('project')}><FolderPlus size={15} />Blank project</button>
            <button onClick={() => navigate('/templates')}><LayoutTemplate size={15} />From a template</button>
          </Menu></span>
      </>} flush>
      <div className="proj-split">
        <div className="proj-cats">
          <button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}><Folder size={15} />All projects<span className="n">{count('all')}</span></button>
          <div className="row muted small" style={{ padding: '12px 8px 4px', justifyContent: 'space-between' }}>Categories<button className="icon-btn" title="Add category" onClick={() => setCatForm({})}><Plus size={14} /></button></div>
          {(cats.rows || []).map((c) => (
            <div key={c.id} className="row" style={{ gap: 0 }}>
              <button className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}><span className="dot" style={{ background: c.color }} />{c.name}<span className="n">{count(c.id)}</span></button>
              <Menu trigger={<button className="icon-btn"><Pencil size={12} /></button>}><button onClick={() => setCatForm(c)}><Pencil size={14} />Edit</button><button onClick={() => { cats.remove(c.id); setCat('all') }}><Trash2 size={14} />Delete</button></Menu>
            </div>))}
          {cats.rows && !cats.rows.length && <div className="muted small" style={{ padding: '2px 8px 6px' }}>No categories</div>}
          <button className={cat === 'none' ? 'on' : ''} onClick={() => setCat('none')}><Tag size={15} />No category<span className="n">{count('none')}</span></button>
        </div>
        <div className="proj-main">
          {!data ? <Loading /> : shown.length === 0 ? <EmptyState icon={Folder} title="No projects" text="Projects you create or join appear here." action={<button className="btn primary" onClick={() => setQuickAdd('project')}><Plus size={15} />Add project</button>} />
            : view === 'cards' ? (
              <div className="dash-grid">{shown.map((p) => (
                <Link to={`/projects/${p.id}`} key={p.id} className="widget" style={{ minHeight: 170, borderTop: `4px solid ${p.color}` }}>
                  <div className="widget-head"><h3 className="ellipsis">{p.name}</h3><StarButton project={p} /></div>
                  <div className="muted small" style={{ marginBottom: 10 }}>{p.client?.name || 'No client'}</div>
                  <Progress value={p.progress} />
                  <div className="row small muted" style={{ marginTop: 8 }}><span>{p.completed_count}/{p.task_count} tasks</span>{p.late_count > 0 && <span style={{ color: 'var(--danger)' }}>{p.late_count} late</span>}<span style={{ flex: 1 }} /><HealthPill h={p.health} /></div>
                  <div className="row" style={{ marginTop: 'auto' }}><AvatarStack users={p.members} /><span style={{ flex: 1 }} /><span className="small muted">{p.end_date ? `Due ${fmtDate(p.end_date)}` : ''}</span></div>
                </Link>))}</div>
            ) : (
              <DataTable rows={shown} search={(p) => p.name + (p.client?.name || '')} onRow={(p) => navigate(`/projects/${p.id}`)}
                columns={[
                  { key: 'star', label: '', nosort: true, width: 30, render: (p) => <StarButton project={p} /> },
                  { key: 'name', label: 'Name', render: (p) => <span className="row" style={{ gap: 8 }}><span className="dot" style={{ background: p.color }} /><b>{p.name}</b></span> },
                  { key: 'type', label: 'Type', render: (p) => <button className="type-pill" onClick={(e) => { e.stopPropagation(); setTypeFor(p) }} style={{ background: TYPE_COLORS[p.type] || '#f1f2f6' }}>{p.type || 'Set type'}</button> },
                  { key: 'client', label: 'Client', sort: (p) => p.client?.name, render: (p) => p.client?.name || '—' },
                  { key: 'owner', label: 'Owner', sort: (p) => p.owner?.name, render: (p) => <PersonChip user={p.owner} /> },
                  { key: 'start_date', label: 'Start date', render: (p) => fmtDate(p.start_date) || '—' },
                  { key: 'end_date', label: 'End date', render: (p) => fmtDate(p.end_date) || '—' },
                  { key: 'category', label: 'Category', sort: (p) => catName(p.category_id)?.name, render: (p) => <button className="tb-btn" onClick={(e) => { e.stopPropagation(); setSetCatFor(p) }}>{catName(p.category_id)?.name || '—'}</button> },
                  { key: 'health', label: 'Health', render: (p) => <HealthPill h={p.health} /> },
                  { key: 'progress', label: 'Progress', render: (p) => <div className="row" style={{ gap: 6, minWidth: 120 }}><div style={{ flex: 1 }}><Progress value={p.progress} /></div><span className="small muted">{p.progress}%</span></div> },
                  { key: 'logged_minutes', label: 'Time logged', render: (p) => fmtMinutes(p.logged_minutes) },
                  { key: 'members', label: 'People', nosort: true, render: (p) => <AvatarStack users={p.members} size={24} /> },
                  { key: 'activity', label: 'Activity', sort: (p) => lastAct(p.id)?.created_at, render: (p) => <span className="ellipsis muted small" style={{ maxWidth: 200, display: 'inline-block' }}>{lastAct(p.id) ? `${lastAct(p.id).user?.name?.split(' ')[0]} ${lastAct(p.id).action}` : '—'}</span> },
                  { key: 'latest', label: 'Latest update', render: (p) => <span className="muted small">{p.health !== 'none' ? p.health.replace('_', ' ') : '—'}</span> },
                  { key: 'last_active', label: 'Last active', sort: (p) => lastAct(p.id)?.created_at, render: (p) => (lastAct(p.id) ? fmtDate(lastAct(p.id).created_at, { day: 'numeric', month: 'short', year: 'numeric' }) : '—') },
                  { key: 'menu', label: '', nosort: true, render: (p) => <span onClick={(e) => e.stopPropagation()}><ProjectRowMenu p={p} /></span> },
                ]} />)}
        </div>
      </div>
      {catForm && <FormModal title={catForm.id ? 'Edit category' : 'Add category'} initial={catForm} onClose={() => setCatForm(null)} onSubmit={(v) => (catForm.id ? cats.update(catForm.id, v) : cats.create(v))}
        fields={[{ key: 'name', label: 'Category name', required: true, autoFocus: true }, { key: 'color', label: 'Colour', type: 'color' }]} />}
      {typeFor && <FormModal title={`Type for ${typeFor.name}`} initial={{ type: typeFor.type || '' }} onClose={() => setTypeFor(null)}
        onSubmit={async (v) => { await api.patch(`/projects/${typeFor.id}`, { name: typeFor.name, type: v.type || null }); notify('Project type updated'); refresh() }}
        fields={[{ key: 'type', label: 'Project type', type: 'select', options: Object.keys(TYPE_COLORS) }]} />}
      {setCatFor && <FormModal title={`Category for ${setCatFor.name}`} initial={{ category_id: setCatFor.category_id || '' }} onClose={() => setSetCatFor(null)}
        onSubmit={async (v) => { await api.patch(`/projects/${setCatFor.id}`, { name: setCatFor.name, category_id: v.category_id ? Number(v.category_id) : null }); notify('Category updated'); refresh() }}
        fields={[{ key: 'category_id', label: 'Category', type: 'select', options: (cats.rows || []).map((c) => [c.id, c.name]) }]} />}
    </Section>
  )
}

export function ProjectRowMenu({ p }) {
  const { notify, refresh, setQuickAdd } = useUi()
  const navigate = useNavigate()
  const [mode, setMode] = useState('manage')
  const [more, setMore] = useState(false)
  const [edit, setEdit] = useState(false)
  const status = async (st) => { await api.patch(`/projects/${p.id}`, { name: p.name, status: st }); notify(`Project ${st === 'active' ? 'reactivated' : st}`); refresh() }
  const copy = async () => { const r = await api.post(`/projects/${p.id}/copy`); notify('Project copied'); refresh(); navigate(`/projects/${r.id}`) }
  const del = async () => { if (confirm(`Delete project "${p.name}" and everything in it?`)) { await api.del(`/projects/${p.id}`); notify('Project deleted'); refresh() } }
  return (
    <>
      <Menu trigger={<button className="icon-btn" title="Project options"><MoreVertical size={16} /></button>}>
        <div className="seg-toggle" onClick={(e) => e.stopPropagation()}><button className={mode === 'manage' ? 'on' : ''} onClick={() => setMode('manage')}>Manage</button><button className={mode === 'quick' ? 'on' : ''} onClick={() => setMode('quick')}>Quick add</button></div>
        {mode === 'manage' ? <>
          <button onClick={() => setEdit(true)}><Pencil size={14} />Edit project</button>
          <button onClick={copy}><Copy size={14} />Copy project</button>
          <button onClick={() => navigate(`/ai/ask?prompt=${encodeURIComponent('project ' + p.name)}`)}><Sparkles size={14} />Ask AI about this project</button>
          <button onClick={() => navigate(`/projects/${p.id}/finance`)}><PiggyBank size={14} />Budget</button>
          <button onClick={() => status('archived')}><Trash2 size={14} />Trash can (archive)</button>
          <button onClick={(e) => { e.stopPropagation(); setMore(!more) }}><ChevronRight size={14} />More options</button>
          {more && <>
            {p.status === 'active' ? <button style={{ paddingLeft: 30 }} onClick={() => status('completed')}><CheckCircle2 size={14} />Mark complete</button> : <button style={{ paddingLeft: 30 }} onClick={() => status('active')}><RotateCcw size={14} />Reactivate</button>}
            <button style={{ paddingLeft: 30 }} onClick={async () => { await api.post(`/projects/${p.id}/save-as-template`); notify('Saved as a template') }}><LayoutTemplate size={14} />Save as template</button>
            <button style={{ paddingLeft: 30 }} onClick={() => navigate(`/projects/${p.id}/x/settings`)}><Archive size={14} />Project settings</button>
          </>}
          <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
          <button style={{ color: 'var(--danger)' }} onClick={del}><Trash2 size={14} />Delete project</button>
        </> : <>
          <button onClick={() => setQuickAdd({ kind: 'task', project_id: p.id })}><CheckSquare size={14} />Task</button>
          <button onClick={() => setQuickAdd('milestone')}><Flag size={14} />Milestone</button>
          <button onClick={() => setQuickAdd('message')}><MessageSquare size={14} />Message</button>
          <button onClick={() => setQuickAdd('time')}><Clock size={14} />Time entry</button>
          <button onClick={() => navigate(`/projects/${p.id}/files`)}><Paperclip size={14} />File</button>
          <button onClick={() => setQuickAdd('event')}><CalendarDays size={14} />Event</button>
        </>}
      </Menu>
      {edit && <ProjectForm project={p} onDone={() => { setEdit(false); refresh() }} onCancel={() => setEdit(false)} />}
    </>
  )
}
