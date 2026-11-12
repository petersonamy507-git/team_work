// Templates, Proofs, Crewdesk AI (Ask AI, AI teammates, AI skills) and Automate.
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  LayoutTemplate, Plus, Trash2, Copy, Folder, FileCheck2, Sparkles, Send, Mic, Paperclip, Bot, Zap, PanelLeftClose, MessageSquarePlus,
  Grid2x2, List, Check, RotateCcw, X, Wand2, Pencil, ChevronDown, ChevronRight,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useData, useUi } from '../lib/ui-context'
import { fmtDate, timeAgo } from '../lib/format'
import { AvatarStack } from '../components/ui'
import { Section, DataTable, EmptyState, FormModal, Hero, Pill, PersonChip, useRows, AskAiButton } from '../components/Kit'
import { BUILTIN_TEMPLATES } from '../lib/builtinTemplates'

/* ================= Templates ================= */
export function Templates() {
  const { rows, create, update, remove } = useRows('templates')
  const { projects, notify, refresh } = useUi()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [use, setUse] = useState(null)
  const [fromProject, setFromProject] = useState(false)
  const [grid, setGrid] = useState(true)
  const [q, setQ] = useState('')
  const [showGallery, setShowGallery] = useState(true)
  const [closed, setClosed] = useState({})
  const list = (rows || []).filter((t) => t.name.toLowerCase().includes(q.toLowerCase()))
  const toText = (t) => (t?.content?.tasklists || []).map((l) => `${l.name}\n${(l.tasks || []).map((x) => `- ${x}`).join('\n')}`).join('\n\n')
  const parse = (txt) => {
    const lists = []; let cur = null
    ;(txt || '').split('\n').forEach((line) => { const l = line.trim(); if (!l) return; if (l.startsWith('-')) { if (!cur) { cur = { name: 'Tasks', tasks: [] }; lists.push(cur) } cur.tasks.push(l.replace(/^-\s*/, '')) } else { cur = { name: l, tasks: [] }; lists.push(cur) } })
    return { tasklists: lists }
  }
  const save = (v) => { const body = { name: v.name, description: v.description, content: parse(v.structure) }; return form.id ? update(form.id, body) : create(body) }
  return (
    <Section icon={Folder} title="Projects" tabs={[{ to: '/projects', label: 'List', end: true }, { to: '/templates', label: 'Templates' }]}>
      <div className="tw-toolbar"><button className="icon-btn" onClick={() => setShowGallery(!showGallery)}>{showGallery ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button><h2>Crewdesk Templates</h2><span className="spacer" />
        <input className="input" style={{ width: 200, height: 32 }} placeholder="Search templates" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="scope-toggle"><button className={!grid ? 'active' : ''} onClick={() => setGrid(false)}><List size={14} /></button><button className={grid ? 'active' : ''} onClick={() => setGrid(true)}><Grid2x2 size={14} /></button></div>
        <button className="btn" onClick={() => setFromProject(true)}><Copy size={14} />From a project</button>
        <button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Create a template</button></div>
      {showGallery && Object.entries(BUILTIN_TEMPLATES).map(([cat, tpls]) => {
        const shownT = tpls.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()))
        if (!shownT.length) return null
        return (<div key={cat} style={{ marginBottom: 18 }}>
          <button className="tb-btn" style={{ fontSize: 16, color: 'var(--text)' }} onClick={() => setClosed({ ...closed, [cat]: !closed[cat] })}>{closed[cat] ? <ChevronRight size={16} /> : <ChevronDown size={16} />}{cat}</button>
          {!closed[cat] && <div className="tpl-grid">{shownT.map((t) => (
            <div key={t.name} className="tpl-card" onClick={() => setUse({ ...t, id: 0, builtin: true })}>
              <div className="tpl-prev" style={{ background: t.color }}><div className="tpl-doc"><b>{t.name} Template</b>{t.content.tasklists.slice(0, 3).map((l) => <div key={l.name}><div className="tl">⌄ {l.name}</div>{l.tasks.slice(0, 3).map((x) => <div key={x} className="tk"><i />{x}</div>)}</div>)}</div></div>
              <div className="tpl-name"><span className="tpl-logo">c.</span>{t.name}</div>
            </div>))}</div>}
        </div>)
      })}
      <div className="tw-toolbar" style={{ marginTop: 6 }}><h2>Your templates</h2></div>
      {rows && !list.length && <EmptyState icon={LayoutTemplate} title="No Templates Found" text="Create a template to start new projects with task lists already in place." action={<button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Create a template</button>} />}
      {grid ? <div className="dash-grid">{list.map((t) => (
        <div key={t.id} className="widget" style={{ minHeight: 170 }}>
          <div className="widget-head"><LayoutTemplate size={18} color="#4461d7" /><h3>{t.name}</h3>
            <button className="icon-btn" onClick={() => setForm({ ...t, structure: toText(t) })}><Pencil size={14} /></button><button className="icon-btn" onClick={() => confirm('Delete template?') && remove(t.id)}><Trash2 size={14} /></button></div>
          <p className="muted small" style={{ flex: 1 }}>{t.description || 'No description'}</p>
          <div className="muted small">{(t.content?.tasklists || []).length} task lists · {(t.content?.tasklists || []).reduce((a, l) => a + (l.tasks || []).length, 0)} tasks</div>
          <button className="btn primary" style={{ marginTop: 10, alignSelf: 'flex-start' }} onClick={() => setUse(t)}>Use template</button>
        </div>))}</div>
        : <DataTable rows={list} columns={[{ key: 'name', label: 'Template', render: (t) => <b>{t.name}</b> }, { key: 'description', label: 'Description' },
          { key: 'lists', label: 'Task lists', render: (t) => (t.content?.tasklists || []).length }, { key: 'created_by', label: 'Created by', render: (t) => <PersonChip user={t.created_by} /> },
          { key: 'a', label: '', nosort: true, render: (t) => <button className="btn" onClick={() => setUse(t)}>Use</button> }]} />}
      {form && <FormModal wide title={form.id ? 'Edit template' : 'Create a template'} initial={form} onClose={() => setForm(null)} onSubmit={save}
        fields={[{ key: 'name', label: 'Template name', required: true, autoFocus: true }, { key: 'description', label: 'Description', type: 'textarea', rows: 2 },
          { key: 'structure', label: 'Task lists and tasks', type: 'textarea', rows: 10, placeholder: 'Planning\n- Kickoff call\n- Gather requirements\n\nDelivery\n- Build\n- Review', help: 'A line is a task list; lines starting with "-" are tasks in it.' }]} />}
      {use && <FormModal title={`New project from "${use.name}"`} initial={{ name: use.name }} submitLabel="Create project" onClose={() => setUse(null)}
        onSubmit={async (v) => { const r = await api.post(`/templates/${use.id}/use`, use.builtin ? { ...v, content: use.content, template_name: use.name } : v); notify('Project created from template'); refresh(); navigate(`/projects/${r.id}`) }}
        fields={[{ key: 'name', label: 'Project name', required: true }, { key: 'start_date', label: 'Start date', type: 'date' }]} />}
      {fromProject && <FormModal title="Save a project as a template" submitLabel="Save template" onClose={() => setFromProject(false)}
        onSubmit={async (v) => { await api.post(`/projects/${v.project_id}/save-as-template`); notify('Template saved'); refresh() }}
        fields={[{ key: 'project_id', label: 'Project', type: 'project', required: true }]} />}
      {projects.length === 0 && null}
    </Section>
  )
}

/* ================= Proofs ================= */
const PROOF = { in_review: ['blue', 'In review'], approved: ['green', 'Approved'], changes: ['amber', 'Changes requested'], rejected: ['red', 'Rejected'] }
export function Proofs({ projectId }) {
  const { rows, create, update, remove } = useRows('proofs', projectId ? { project_id: projectId } : {})
  const [form, setForm] = useState(null)
  const [files, setFiles] = useState([])
  const { data: tasks } = useData(form ? `/tasks?status=all${form.project_id || projectId ? `&project_id=${form.project_id || projectId}` : ''}` : null, [form?.project_id])
  const save = (v) => (form.id ? update(form.id, v) : create({ ...v, project_id: v.project_id || projectId }))
  const filePid = form?.project_id || projectId
  useEffect(() => { if (filePid) api.get(`/projects/${filePid}/files`).then(setFiles) }, [filePid])
  const body = (
    <>
      {rows && !rows.length && !projectId && <Hero icon={FileCheck2} title="Proofs" text="Say goodbye to endless emails and hello to faster file approvals. Create a proof, share it for review and approval, and gather feedback in one place while keeping track of the proof's status."><AskAiButton /><button className="btn primary" onClick={() => setForm({})}>Start using proofing</button></Hero>}
      <div className="tw-toolbar"><h2>Proofs</h2><span className="spacer" /><button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add proof</button></div>
      <DataTable rows={rows} search={(p) => p.title}
        empty={<EmptyState icon={FileCheck2} title="No proofs yet" text="Upload a file and ask people to review it." />}
        columns={[
          { key: 'title', label: 'Proof', render: (p) => <span className="row" style={{ gap: 8 }}><FileCheck2 size={16} color="#4461d7" /><b>{p.title}</b></span> },
          { key: 'version', label: 'Version', render: (p) => <Pill>V{p.version}</Pill> },
          { key: 'status', label: 'Proof status', render: (p) => <Pill tone={PROOF[p.status]?.[0]}>{PROOF[p.status]?.[1]}</Pill> },
          ...(projectId ? [] : [{ key: 'project_name', label: 'Project name' }]),
          { key: 'task_id', label: 'Linked task', render: (p) => p.task_id ? `#${p.task_id}` : '—' },
          { key: 'created_by', label: 'Created by', render: (p) => <PersonChip user={p.created_by} /> },
          { key: 'due_date', label: 'Due date', render: (p) => fmtDate(p.due_date) || '—' },
          { key: 'reviewers', label: 'Reviewers & approvers', render: (p) => <AvatarStack users={p.reviewers} /> },
          { key: 'a', label: '', nosort: true, render: (p) => <span className="act" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn" title="Approve" onClick={() => update(p.id, { status: 'approved' })}><Check size={14} /></button>
            <button className="icon-btn" title="Request changes" onClick={() => update(p.id, { status: 'changes' })}><RotateCcw size={14} /></button>
            <button className="icon-btn" title="New version" onClick={() => update(p.id, { version: p.version + 1, status: 'in_review' })}><Copy size={14} /></button>
            <button className="icon-btn" onClick={() => confirm('Delete proof?') && remove(p.id)}><Trash2 size={14} /></button></span> },
        ]} onRow={(p) => setForm(p)} />
      {form && <FormModal title={form.id ? 'Edit proof' : 'Add proof'} initial={form} onClose={() => setForm(null)} onSubmit={save}
        onChange={(v) => { if (v.project_id && v.project_id !== form.project_id) setForm({ ...form, ...v }) }}
        fields={[{ key: 'title', label: 'Proof name', required: true, autoFocus: true }, ...(!projectId && !form.id ? [{ key: 'project_id', label: 'Project', type: 'project', required: true }] : []),
          { key: 'file_id', label: 'File', type: 'select', options: files.map((f) => [f.id, f.original_name || f.name]) },
          { key: 'task_id', label: 'Linked task', type: 'select', options: (tasks || []).map((t) => [t.id, t.title]) },
          { key: 'status', label: 'Status', type: 'select', half: true, default: 'in_review', required: true, options: Object.entries(PROOF).map(([k, v]) => [k, v[1]]) },
          { key: 'due_date', label: 'Due date', type: 'date', half: true }, { key: 'reviewer_ids', label: 'Reviewers & approvers', type: 'people' }]} />}
    </>
  )
  return projectId ? body : <Section icon={FileCheck2} title="Proofs">{body}</Section>
}

/* ================= Crewdesk AI ================= */
const AI_TABS = [{ to: '/ai/ask', label: 'Ask AI' }, { to: '/ai/teammates', label: 'AI teammates' }, { to: '/ai/skills', label: 'AI skills', badge: 'NEW' }]
export function AiHub() {
  const { tab = 'ask' } = useParams()
  const C = { ask: AskAi, teammates: AiTeammates, skills: AiSkills }[tab] || AskAi
  return <Section icon={Sparkles} title="Crewdesk AI" tabs={AI_TABS} flush={tab === 'ask'}><C /></Section>
}

const SUGGEST = [['For you', ['What should I focus on today?', "Log yesterday's time", 'Catch me up', 'Plan my day']],
  ['Insights', ["What's changed since yesterday?", 'Which of my projects have overdue work?', 'Which tasks are overdue?', 'Summarize project status']]]
function AskAi() {
  const { user } = useAuth()
  const chats = useRows('ai-chats')
  const skills = useRows('ai-skills').rows
  const [cur, setCur] = useState(null)
  const [text, setText] = useState('')
  const [side, setSide] = useState(true)
  const [busy, setBusy] = useState(false)
  const end = useRef()
  const chat = chats.rows?.find((c) => c.id === cur)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat?.messages?.length])
  const asked = useRef(false)
  useEffect(() => { const pr = new URLSearchParams(window.location.search).get('prompt'); if (pr && !asked.current) { asked.current = true; ask(pr) } }) // eslint-disable-line react-hooks/exhaustive-deps
  const ask = async (prompt) => {
    if (!prompt.trim()) return
    setBusy(true); setText('')
    try { const c = await api.post('/ai/ask', { prompt, chat_id: cur }); setCur(c.id); chats.reload() } finally { setBusy(false) }
  }
  return (
    <div className="ai-wrap">
      {side && <div className="ai-side">
        <div className="row" style={{ justifyContent: 'space-between' }}><button className="btn" onClick={() => setCur(null)}><MessageSquarePlus size={14} />New chat</button><button className="icon-btn" onClick={() => setSide(false)}><PanelLeftClose size={15} /></button></div>
        <div className="muted small" style={{ margin: '10px 4px 4px' }}>Chats</div>
        {chats.rows?.length === 0 && <EmptyState icon={Bot} title="No chats yet" text="Start a conversation to see it appear here." />}
        {(chats.rows || []).map((c) => <div key={c.id} className="row" style={{ gap: 2 }}><button className={`chat ${c.id === cur ? 'on' : ''}`} style={{ flex: 1 }} onClick={() => setCur(c.id)}>{c.title}</button><button className="icon-btn" onClick={() => { chats.remove(c.id); if (cur === c.id) setCur(null) }}><Trash2 size={13} /></button></div>)}
      </div>}
      <div className="ai-main">
        {!side && <button className="icon-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setSide(true)}><PanelLeftClose size={15} style={{ transform: 'scaleX(-1)' }} /></button>}
        {!chat ? <div className="ai-hello"><span>Hello {user?.name?.split(' ')[0]}</span><br />How can I help?</div> : (
          <div className="ai-msgs">{chat.messages.map((m, i) => <div key={i} className={`ai-msg ${m.role}`}>{m.text}</div>)}<div ref={end} /></div>)}
        <div className="ai-box">
          <textarea placeholder="Ask me to find, summarize or plan anything in Crewdesk" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(text) } }} />
          <div className="row"><button className="icon-btn"><Paperclip size={15} /></button><button className="icon-btn"><Mic size={15} /></button>
            {skills?.length > 0 && <select className="input" style={{ width: 160, height: 28 }} value="" onChange={(e) => e.target.value && ask(skills.find((s) => s.id === Number(e.target.value)).prompt)}><option value="">AI skills</option>{skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
            <span style={{ flex: 1 }} /><button className="btn primary" disabled={busy || !text.trim()} onClick={() => ask(text)}><Send size={14} /></button></div>
        </div>
        {!chat && <div className="ai-sugg">{SUGGEST.map(([h, list]) => <div key={h}><h5>{h}</h5>{list.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}</div>)}</div>}
      </div>
    </div>
  )
}

function AiTeammates() {
  const { rows, create, update, remove } = useRows('ai-teammates')
  const [form, setForm] = useState(null)
  const save = (v) => (form.id ? update(form.id, v) : create(v))
  return (
    <>
      <div className="tw-toolbar"><h2>AI teammates</h2><span className="spacer" /><button className="btn primary" onClick={() => setForm({ is_active: true })}><Plus size={15} />Add AI teammate</button></div>
      {rows && !rows.length && <EmptyState icon={Bot} title="No AI teammates yet" text="AI teammates take on a role, like project coordinator or QA reviewer, with instructions you give them." action={<button className="btn primary" onClick={() => setForm({ is_active: true })}><Plus size={15} />Add AI teammate</button>} />}
      <div className="dash-grid">{(rows || []).map((t) => (
        <div key={t.id} className="widget" style={{ minHeight: 150 }}>
          <div className="widget-head"><Bot size={20} color="#7b61ff" /><h3>{t.name}</h3><Pill tone={t.is_active ? 'green' : 'gray'}>{t.is_active ? 'Active' : 'Paused'}</Pill></div>
          <div className="muted small">{t.role}</div><p className="small" style={{ flex: 1, marginTop: 6 }}>{t.instructions}</p>
          <div className="row" style={{ gap: 6 }}><button className="btn" onClick={() => setForm(t)}><Pencil size={13} />Edit</button><button className="btn" onClick={() => update(t.id, { is_active: !t.is_active })}>{t.is_active ? 'Pause' : 'Activate'}</button><button className="icon-btn" onClick={() => remove(t.id)}><Trash2 size={14} /></button></div>
        </div>))}</div>
      {form && <FormModal title={form.id ? 'Edit AI teammate' : 'Add AI teammate'} initial={form} onClose={() => setForm(null)} onSubmit={save}
        fields={[{ key: 'name', label: 'Name', required: true }, { key: 'role', label: 'Role', placeholder: 'Project coordinator' }, { key: 'instructions', label: 'Instructions', type: 'textarea', rows: 5 }, { key: 'is_active', label: 'Active', type: 'checkbox', text: 'Active' }]} />}
    </>
  )
}

function AiSkills() {
  const { rows, create, update, remove } = useRows('ai-skills')
  const [form, setForm] = useState(null)
  const navigate = useNavigate()
  const gallery = [['Kickoff summary', 'Summarize project status'], ['Log my time', "Log yesterday's time"], ['Create tasks from notes', 'What should I focus on today?'], ['Report time logged', 'Catch me up']]
  const save = (v) => (form.id ? update(form.id, v) : create(v))
  return (
    <>
      <Hero icon={Wand2} title="AI skills" text="Save a prompt once and reuse it whenever you like. Ask AI will run it the same way every time."><button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Create skill</button></Hero>
      <div className="tw-toolbar"><h2>Your skills</h2></div>
      <DataTable rows={rows} empty={<EmptyState icon={Wand2} title="No skills yet" />} onRow={(s) => setForm(s)}
        columns={[{ key: 'name', label: 'Skill', render: (s) => <b>{s.name}</b> }, { key: 'prompt', label: 'Prompt' },
          { key: 'a', label: '', nosort: true, render: (s) => <span className="act" onClick={(e) => e.stopPropagation()}><button className="icon-btn" onClick={() => remove(s.id)}><Trash2 size={14} /></button></span> }]} />
      <div className="tw-toolbar" style={{ marginTop: 18 }}><h2>Skills gallery</h2></div>
      <div className="rep-cards">{gallery.map(([n, p]) => <div key={n} className="rep-card" onClick={() => create({ name: n, prompt: p })}><span className="ic" style={{ background: '#efe5ff', color: '#6b3fc2' }}><Sparkles size={15} /></span><h4>{n}</h4><p>{p}</p><div className="tags"><span>Add to my skills</span></div></div>)}</div>
      <button className="btn" style={{ marginTop: 14 }} onClick={() => navigate('/ai/ask')}><Sparkles size={14} />Open Ask AI</button>
      {form && <FormModal title={form.id ? 'Edit skill' : 'Create skill'} initial={form} onClose={() => setForm(null)} onSubmit={save}
        fields={[{ key: 'name', label: 'Skill name', required: true }, { key: 'prompt', label: 'Prompt', type: 'textarea', required: true, rows: 4 }]} />}
    </>
  )
}

/* ================= Automate ================= */
const TRIGGERS = [['task_created', 'A task is created'], ['task_completed', 'A task is completed']]
const ACTIONS = [['assign', 'Assign to'], ['set_priority', 'Set priority'], ['add_tag', 'Add tag'], ['set_status', 'Set stage'], ['notify', 'Notify person']]
export function Automate() {
  const { rows, create, update, remove } = useRows('automations')
  const { people, projects } = useUi()
  const [form, setForm] = useState(null)
  const valueLabel = (a) => (['assign', 'notify'].includes(a.action) ? people.find((p) => String(p.id) === a.action_value)?.name : a.action_value) || '—'
  const save = (v) => (form.id ? update(form.id, v) : create(v))
  return (
    <Section icon={Zap} title="Automate">
      <div className="tw-toolbar"><h2>Automations</h2><span className="spacer" /><button className="btn primary" onClick={() => setForm({ trigger: 'task_created', action: 'set_priority', is_active: true })}><Plus size={15} />Add automation</button></div>
      <DataTable rows={rows} search={(a) => a.name} onRow={(a) => setForm(a)}
        empty={<EmptyState icon={Zap} title="Automate your workflow" text="When something happens to a task, Crewdesk can assign it, tag it, set its priority or stage, or notify someone." action={<button className="btn primary" onClick={() => setForm({ trigger: 'task_created', action: 'set_priority', is_active: true })}><Plus size={15} />Add automation</button>} />}
        columns={[{ key: 'name', label: 'Name', render: (a) => <b>{a.name}</b> },
          { key: 'project_name', label: 'Project', render: (a) => a.project_name || 'All projects' },
          { key: 'trigger', label: 'When', render: (a) => TRIGGERS.find((t) => t[0] === a.trigger)?.[1] },
          { key: 'action', label: 'Then', render: (a) => `${ACTIONS.find((t) => t[0] === a.action)?.[1]} ${valueLabel(a)}` },
          { key: 'run_count', label: 'Runs' },
          { key: 'is_active', label: 'Status', render: (a) => <button className="btn" onClick={(e) => { e.stopPropagation(); update(a.id, { is_active: !a.is_active }) }}>{a.is_active ? <Pill tone="green">On</Pill> : <Pill>Off</Pill>}</button> },
          { key: 'x', label: '', nosort: true, render: (a) => <span className="act" onClick={(e) => e.stopPropagation()}><button className="icon-btn" onClick={() => remove(a.id)}><Trash2 size={14} /></button></span> }]} />
      {form && <FormModal title={form.id ? 'Edit automation' : 'Add automation'} initial={form} onClose={() => setForm(null)} onSubmit={save} onChange={(v) => v.action !== form.action && setForm({ ...form, ...v })}
        fields={[{ key: 'name', label: 'Name', required: true }, { key: 'project_id', label: 'Project (leave empty for all)', type: 'select', options: projects.map((p) => [p.id, p.name]) },
          { key: 'trigger', label: 'When', type: 'select', required: true, options: TRIGGERS }, { key: 'action', label: 'Then', type: 'select', required: true, options: ACTIONS },
          ['assign', 'notify'].includes(form.action) ? { key: 'action_value', label: 'Person', type: 'select', required: true, options: people.map((p) => [String(p.id), p.name]) }
            : form.action === 'set_priority' ? { key: 'action_value', label: 'Priority', type: 'select', required: true, options: [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']] }
              : form.action === 'set_status' ? { key: 'action_value', label: 'Stage', type: 'select', required: true, options: [['new', 'To do'], ['in_progress', 'In progress'], ['backlog', 'Backlog'], ['completed', 'Completed']] }
                : { key: 'action_value', label: 'Tag', required: true },
          { key: 'is_active', label: 'Active', type: 'checkbox', text: 'Turn on' }]} />}
    </Section>
  )
}

export { timeAgo, X }
