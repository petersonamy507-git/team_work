// More › People: People, Roles, Skills, Teams, Statuses (Teamwork /app/people/*)
import { useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Users, Plus, Pencil, Trash2, Mail, IdCard, Award, UsersRound, Bell, Download, Grid2x2, List, Upload, UserRoundSearch } from 'lucide-react'
import { api } from '../lib/api'
import { useData, useUi } from '../lib/ui-context'
import { timeAgo } from '../lib/format'
import { Avatar, AvatarStack } from '../components/ui'
import { Section, DataTable, EmptyState, FormModal, Hero, PersonChip, Pill, useRows, money, toCSV, AskAiButton } from '../components/Kit'
import { downloadText } from '../lib/taskFilters'

const TABS = [{ to: '/people/people', label: 'People' }, { to: '/people/roles', label: 'Roles' }, { to: '/people/skills', label: 'Skills', badge: 'NEW' },
  { to: '/people/teams', label: 'Teams' }, { to: '/people/statuses', label: 'Statuses' }]

export default function PeopleHub() {
  const { tab = 'people' } = useParams()
  if (/^\d+$/.test(tab)) return <Navigate to={`/people/person/${tab}`} replace />
  const C = { people: PeopleTab, roles: RolesTab, skills: SkillsTab, teams: TeamsTab, statuses: StatusesTab }[tab] || PeopleTab
  return <Section icon={Users} title="People" tabs={TABS}><C /></Section>
}

const memberOf = (list, uid) => (list || []).filter((x) => (x.member_ids || []).includes(uid)).map((x) => x.name)

function PeopleTab() {
  const { data, reload } = useData('/people')
  const { data: rates } = useData('/finance/rates')
  const { data: clients } = useData('/clients')
  const roles = useRows('roles').rows
  const teams = useRows('teams').rows
  const { notify, refresh } = useUi()
  const navigate = useNavigate()
  const [kind, setKind] = useState('people')
  const [sp] = useSearchParams()
  const [invite, setInvite] = useState(!!sp.get('invite'))
  const [edit, setEdit] = useState(null)
  const rate = (uid) => rates?.find((r) => r.user_id === uid)
  const client = (cid) => clients?.find((c) => c.id === cid)?.name
  const rows = (data || []).filter((p) => (kind === 'clients' ? p.role === 'client' : true))
  const fileRef = useRef()
  const [sel, setSel] = useState([])
  const exportCsv = () => downloadText('people.csv', toCSV(rows.map((p) => ({ Name: p.name, Email: p.email, Title: p.title || '', Company: client(p.client_id) || '', Role: memberOf(roles, p.id).join('; '), Teams: memberOf(teams, p.id).join('; '), 'Billable rate': rate(p.id)?.billable_rate || 0, 'Cost rate': rate(p.id)?.cost_rate || 0 }))))
  const importCsv = async (e) => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    const lines = (await f.text()).split(/\r?\n/).filter((l) => l.trim())
    const head = lines.shift().toLowerCase().split(',').map((h) => h.trim().replace(/"/g, ''))
    const col = (n) => head.findIndex((h) => h.includes(n))
    const [ni, ei, ti] = [col('name'), col('email'), col('title')]
    if (ei < 0) return notify('The CSV needs an "email" column (and optionally name, title)')
    const rowsIn = lines.map((l) => { const c = l.split(',').map((x) => x.trim().replace(/^"|"$/g, '')); return { name: ni >= 0 ? c[ni] : '', email: c[ei], title: ti >= 0 ? c[ti] : '' } })
    const r = await api.post('/people/import', { rows: rowsIn })
    notify(`Imported ${r.added} people${r.skipped.length ? `, skipped ${r.skipped.length} (already exist or no email)` : ''}`); reload()
  }
  const save = async (v) => {
    await api.patch(`/people/${edit.id}`, { name: v.name, title: v.title, role: v.role, client_id: v.client_id ? Number(v.client_id) : null, phone: v.phone, capacity_minutes: Math.round(Number(v.capacity_hours || 8) * 60) })
    await api.post(`/finance/rates/${edit.id}`, { billable_rate: v.billable_rate, cost_rate: v.cost_rate })
    notify('Person updated'); refresh()
  }
  return (
    <>
      <div className="tw-toolbar">
        <div className="chips"><button className={kind === 'people' ? 'on' : ''} onClick={() => setKind('people')}>People</button><button className={kind === 'placeholders' ? 'on' : ''} onClick={() => setKind('placeholders')}>Placeholders <span className="new-badge">NEW</span></button><button className={kind === 'clients' ? 'on' : ''} onClick={() => setKind('clients')}>Client users</button></div>
        <span className="muted small">{rows.length} people</span><span className="spacer" />
        {kind !== 'placeholders' && <>
          <button className="tb-btn" onClick={exportCsv}><Download size={14} />Export</button>
          <button className="btn outline-accent" onClick={() => fileRef.current.click()}><Upload size={14} />Import</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={importCsv} />
          <button className="btn primary" onClick={() => setInvite(true)}><Plus size={15} />Invite users</button></>}
      </div>
      {kind === 'placeholders' ? <Placeholders /> : <>
      {sel.length > 0 && <div className="row small" style={{ gap: 8, marginBottom: 8 }}><b>{sel.length} selected</b><button className="btn sm" onClick={async () => { for (const id of sel) await api.patch(`/people/${id}`, { is_active: false }); setSel([]); notify('Deactivated'); reload() }}>Deactivate</button><button className="btn sm" onClick={async () => { for (const id of sel) await api.patch(`/people/${id}`, { is_active: true }); setSel([]); notify('Activated'); reload() }}>Activate</button></div>}
      <DataTable rows={data ? rows : null} search={(p) => p.name + p.email} onRow={(p) => navigate(`/people/person/${p.id}`)} selectable selected={sel} setSelected={setSel}
        columns={[
          { key: 'name', label: 'Name', render: (p) => <span className="kit-person"><Avatar user={p} size={26} /><b>{p.name}</b>{!p.is_active && <Pill>inactive</Pill>}</span> },
          { key: 'client', label: 'Client', sort: (p) => client(p.client_id), render: (p) => client(p.client_id) || '—' },
          { key: 'role', label: 'Role', sort: (p) => memberOf(roles, p.id)[0], render: (p) => memberOf(roles, p.id).join(', ') || <span className="muted">—</span> },
          { key: 'br', label: 'Billable rate', sort: (p) => rate(p.id)?.billable_rate, render: (p) => (rate(p.id)?.billable_rate ? money(rate(p.id).billable_rate) : '—') },
          { key: 'cr', label: 'Cost rate', sort: (p) => rate(p.id)?.cost_rate, render: (p) => (rate(p.id)?.cost_rate ? money(rate(p.id).cost_rate) : '—') },
          { key: 'teams', label: 'Teams', render: (p) => memberOf(teams, p.id).join(', ') || '—' },
          { key: 'email', label: 'Email' },
          { key: 'open_tasks', label: 'Open tasks' },
          { key: 'a', label: '', nosort: true, render: (p) => <span className="act" onClick={(e) => e.stopPropagation()}><button className="icon-btn" onClick={() => setEdit({ ...p, billable_rate: rate(p.id)?.billable_rate || 0, cost_rate: rate(p.id)?.cost_rate || 0, capacity_hours: (p.capacity_minutes || 480) / 60 })}><Pencil size={14} /></button><a className="icon-btn" href={`mailto:${p.email}`}><Mail size={14} /></a></span> },
        ]} />
      </>}
      {invite && <FormModal title="Invite users" submitLabel="Invite" onClose={() => setInvite(false)}
        onSubmit={async (v) => { await api.post('/people', { ...v, role: v.role || 'member' }); notify(`Invited ${v.email} (temporary password: ${v.password || 'changeme123'})`); reload() }}
        fields={[{ key: 'name', label: 'Full name', required: true, autoFocus: true }, { key: 'email', label: 'Email address', required: true },
          { key: 'title', label: 'Job title', half: true }, { key: 'role', label: 'User type', type: 'select', half: true, default: 'member', options: [['member', 'Team member'], ['admin', 'Administrator'], ['client', 'Client user']] },
          { key: 'password', label: 'Temporary password', placeholder: 'changeme123' }]} />}
      {edit && <FormModal title={`Edit ${edit.name}`} initial={edit} onClose={() => setEdit(null)} onSubmit={save}
        fields={[{ key: 'name', label: 'Name', required: true }, { key: 'title', label: 'Job title', half: true }, { key: 'phone', label: 'Phone', half: true },
          { key: 'role', label: 'User type', type: 'select', half: true, required: true, options: [['member', 'Team member'], ['admin', 'Administrator'], ['client', 'Client user']] },
          { key: 'client_id', label: 'Client / company', type: 'select', half: true, options: (clients || []).map((c) => [c.id, c.name]) },
          { key: 'billable_rate', label: 'Billable rate (per hour)', type: 'number', half: true }, { key: 'cost_rate', label: 'Cost rate (per hour)', type: 'number', half: true },
          { key: 'capacity_hours', label: 'Daily capacity (hours)', type: 'number', half: true }]} />}
    </>
  )
}

/* roles & skills share a layout: name + people avatars */
function MemberList({ kind, icon, title, text, addLabel, badge }) {
  const { rows, create, update, remove } = useRows(kind)
  const [form, setForm] = useState(null)
  const save = (v) => (form.id ? update(form.id, v) : create(v))
  return (
    <>
      <Hero icon={icon} title={title} text={text} badge={badge}><AskAiButton onClick={() => {}} /><button className="btn primary" onClick={() => setForm({})}><Plus size={15} />{addLabel}</button></Hero>
      <div className="kit-card-sheet">
        <DataTable rows={rows} search={(r) => r.name} onRow={(r) => setForm(r)}
          empty={<EmptyState icon={icon} title={`No ${kind} yet`} action={<button className="btn primary" onClick={() => setForm({})}><Plus size={15} />{addLabel}</button>} />}
          columns={[{ key: 'name', label: kind === 'roles' ? 'Role' : 'Skill', render: (r) => <b>{r.name}</b> },
            { key: 'members', label: 'People', sort: (r) => r.member_ids.length, render: (r) => r.members.length ? <AvatarStack users={r.members} max={8} /> : <span className="muted">No one yet</span> },
            { key: 'a', label: '', nosort: true, render: (r) => <span className="act" onClick={(e) => e.stopPropagation()}><button className="icon-btn" onClick={() => confirm(`Delete ${r.name}?`) && remove(r.id)}><Trash2 size={14} /></button></span> }]} />
      </div>
      {form && <FormModal title={form.id ? `Edit ${form.name}` : addLabel} initial={form} onClose={() => setForm(null)} onSubmit={save}
        fields={[{ key: 'name', label: 'Name', required: true, autoFocus: true }, { key: 'member_ids', label: 'People', type: 'people' }]} />}
    </>
  )
}

const RolesTab = () => <MemberList kind="roles" icon={IdCard} title="Roles" addLabel="Add role"
  text="Simplify the distribution of client work. Assign roles based on billable rates, identify available capacity, monitor workloads and track productivity." />
const SkillsTab = () => <MemberList kind="skills" icon={Award} title="Skills" addLabel="Add skill"
  text="Match the right people to the right projects with confidence. Map your team's strengths, identify experts fast and assign work more efficiently." />

function TeamsTab() {
  const { rows, create, update, remove } = useRows('teams')
  const [form, setForm] = useState(null)
  const save = (v) => (form.id ? update(form.id, v) : create(v))
  return (
    <>
      {rows && !rows.length ? (
        <EmptyState icon={UsersRound} title="There are no teams yet" action={<div className="row" style={{ gap: 8 }}><AskAiButton /><button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add a team</button></div>} />
      ) : (<>
        <div className="tw-toolbar"><h2>Teams</h2><span className="spacer" /><button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add a team</button></div>
        <div className="dash-grid">{(rows || []).map((t) => (
          <div key={t.id} className="widget" style={{ minHeight: 150, cursor: 'pointer' }} onClick={() => setForm(t)}>
            <div className="widget-head"><span style={{ width: 28, height: 28, borderRadius: 8, background: t.color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{t.name[0]}</span>
              <h3>{t.name}</h3><button className="icon-btn" onClick={(e) => { e.stopPropagation(); confirm(`Delete team ${t.name}?`) && remove(t.id) }}><Trash2 size={14} /></button></div>
            {t.handle && <div className="muted small">@{t.handle}</div>}
            <p className="muted small" style={{ flex: 1 }}>{t.description}</p>
            <div className="row" style={{ justifyContent: 'space-between' }}><AvatarStack users={t.members} max={6} /><span className="muted small">{t.members.length} members{t.lead && ` · lead ${t.lead.name}`}</span></div>
          </div>))}</div>
      </>)}
      {form && <FormModal title={form.id ? 'Edit team' : 'Add a team'} initial={form} onClose={() => setForm(null)} onSubmit={save}
        fields={[{ key: 'name', label: 'Team name', required: true, autoFocus: true, half: true }, { key: 'handle', label: 'Handle', half: true, placeholder: 'design' },
          { key: 'color', label: 'Colour', type: 'color', half: true }, { key: 'lead_id', label: 'Team lead', type: 'person', half: true },
          { key: 'description', label: 'Description', type: 'textarea', rows: 2 }, { key: 'member_ids', label: 'Members', type: 'people' }]} />}
    </>
  )
}

function StatusesTab() {
  const { rows, create, remove } = useRows('statuses')
  const [form, setForm] = useState(false)
  const [grid, setGrid] = useState(true)
  return (
    <>
      <div className="tw-toolbar"><span className="spacer" />
        <div className="scope-toggle"><button className={!grid ? 'active' : ''} onClick={() => setGrid(false)}><List size={14} /></button><button className={grid ? 'active' : ''} onClick={() => setGrid(true)}><Grid2x2 size={14} /></button></div>
        <button className="btn primary" onClick={() => setForm(true)}><Plus size={15} />Update my status</button></div>
      {rows && !rows.length && <EmptyState icon={Bell} title="No status updates yet" text="Nobody has posted a status update yet" action={<div className="row" style={{ gap: 8 }}><AskAiButton /><button className="btn primary" onClick={() => setForm(true)}><Plus size={15} />Update my status</button></div>} />}
      <div className={grid ? 'dash-grid' : ''}>{(rows || []).map((s) => (
        <div key={s.id} className={grid ? 'widget' : 'twrow'} style={grid ? { minHeight: 110 } : {}}>
          <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}><Avatar user={s.user} size={32} />
            <div style={{ flex: 1 }}><b>{s.user?.name}</b><div className="muted small">{timeAgo(s.created_at)}</div>
              <div style={{ marginTop: 6, fontSize: 15 }}>{s.emoji} {s.text}</div></div>
            <button className="icon-btn" onClick={() => remove(s.id)}><Trash2 size={14} /></button></div>
        </div>))}</div>
      {form && <FormModal title="Update my status" onClose={() => setForm(false)} onSubmit={create}
        fields={[{ key: 'emoji', label: 'Emoji', type: 'select', options: ['💬', '🚀', '🎯', '🏖️', '🤒', '🏠', '📅', '☕'] }, { key: 'text', label: 'What are you working on?', required: true, type: 'textarea', rows: 3 }]} />}
    </>
  )
}

export { PersonChip }

function Placeholders() {
  const { rows, create, update, remove } = useRows('placeholders')
  const roles = useRows('roles').rows
  const [form, setForm] = useState(null)
  const save = (v) => { const body = { ...v, capacity_minutes: Math.round(Number(v.hours || 8) * 60) }; return form.id ? update(form.id, body) : create(body) }
  return (
    <>
      {rows && !rows.length && <Hero icon={UserRoundSearch} title="Placeholder user" text="Placeholder users allow you to plan and allocate work during early planning, giving you a clear view of capacity and coverage until a team member is hired."><AskAiButton /><button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add placeholder</button></Hero>}
      {rows?.length > 0 && <div className="tw-toolbar"><span className="small">{rows.length} placeholders</span><span className="spacer" /><button className="btn primary" onClick={() => setForm({})}><Plus size={15} />Add placeholder</button></div>}
      {rows?.length > 0 && <DataTable rows={rows} search={(r) => r.name + (r.role || '')} onRow={(r) => setForm({ ...r, hours: (r.capacity_minutes || 480) / 60 })}
        columns={[
          { key: 'name', label: 'Name', render: (r) => <span className="kit-person"><span style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px dashed #22b5a8', color: '#22b5a8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><UserRoundSearch size={13} /></span><b>{r.name}</b></span> },
          { key: 'role', label: 'Role', render: (r) => r.role || '—' },
          { key: 'skills', label: 'Skills', render: (r) => <span className="row" style={{ gap: 4, flexWrap: 'wrap' }}>{(r.skills || '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => <span key={x} className="kit-pill gray">{x}</span>)}</span> },
          { key: 'capacity_minutes', label: 'Capacity / day', render: (r) => `${(r.capacity_minutes || 480) / 60}h` },
          { key: 'created_at', label: 'Date added', render: (r) => new Date(r.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) },
          { key: 'a', label: '', nosort: true, render: (r) => <span className="act" onClick={(e) => e.stopPropagation()}><button className="icon-btn" onClick={() => confirm(`Delete ${r.name}?`) && remove(r.id)}><Trash2 size={14} /></button></span> },
        ]} />}
      {form && <FormModal title={form.id ? 'Edit placeholder' : 'Add placeholder'} initial={form} onClose={() => setForm(null)} onSubmit={save}
        fields={[{ key: 'name', label: 'Name', required: true, autoFocus: true, placeholder: 'Copywriter' }, { key: 'role', label: 'Role', type: 'select', options: (roles || []).map((x) => x.name), half: true },
          { key: 'hours', label: 'Capacity (hours per day)', type: 'number', half: true, default: 8 }, { key: 'skills', label: 'Skills (comma separated)', placeholder: 'Brand voice, Campaign writer' }]} />}
    </>
  )
}
