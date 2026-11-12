import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { UiProvider } from './lib/ui-context'
import Layout from './components/Layout'
import { Login, Register } from './pages/Auth'
import HomePage from './pages/Home'
import MyWork from './pages/MyWork'
import InboxPage from './pages/Inbox'
import Projects from './pages/Projects'
import ProjectLayout, { ProjectOverview, ProjectTasks, ProjectBoard, ProjectTable, ProjectMilestones, ProjectMessages, MessageDetail, ProjectFiles, ProjectTime, ProjectPeople, ProjectActivity } from './pages/Project'
import AllTasks from './pages/Tasks'
import Milestones from './pages/Milestones'
import CalendarPage from './pages/Calendar'
import { PersonDetail } from './pages/People'
import Clients from './pages/Clients'
import Reports from './pages/Reports'
import ActivityPage from './pages/Activity'
import SettingsPage from './pages/Settings'
import Everything, { FormsTab, RisksTab, NotebooksTab, LinksTab, CommentsTab } from './pages/Everything'
import PeopleHub from './pages/PeopleHub'
import Finance from './pages/Finance'
import Resourcing from './pages/Resourcing'
import Reporting, { ReportView } from './pages/Reporting'
import TimeHub, { MyTimesheet } from './pages/TimeHub'
import { Templates, Proofs, AiHub, Automate } from './pages/Extras'
import { Dashboard } from './pages/Home'
import { ProjectSection, ProjectDashboard } from './pages/ProjectExtras'
import { Section } from './components/Kit'
import { Clock as ClockIcon } from 'lucide-react'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="empty">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return <UiProvider>{children}</UiProvider>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<HomePage />} />
        <Route path="my-work" element={<MyWork />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:pid" element={<ProjectLayout />}>
          <Route index element={<ProjectDashboard />} />
          <Route path="overview" element={<ProjectOverview />} />
          <Route path="tasks" element={<ProjectTasks />} />
          <Route path="board" element={<ProjectBoard />} />
          <Route path="table" element={<ProjectTable />} />
          <Route path="milestones" element={<ProjectMilestones />} />
          <Route path="messages" element={<ProjectMessages />} />
          <Route path="messages/:mid" element={<MessageDetail />} />
          <Route path="files" element={<ProjectFiles />} />
          <Route path="time" element={<ProjectTime />} />
          <Route path="people" element={<ProjectPeople />} />
          <Route path="activity" element={<ProjectActivity />} />
          <Route path="x/:section" element={<ProjectSection />} />
        </Route>
        <Route path="tasks" element={<AllTasks />} />
        <Route path="tasks/board" element={<AllTasks />} />
        <Route path="tasks/table" element={<AllTasks />} />
        <Route path="tasks/completed" element={<AllTasks />} />
        <Route path="work/tasks" element={<MyWork />} />
        <Route path="tasks/:tid" element={<AllTasks />} />
        <Route path="milestones" element={<Milestones />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="work/calendar" element={<Navigate to="/my-work?tab=calendar" replace />} />
        <Route path="work/timesheet" element={<Navigate to="/my-work?tab=timesheet" replace />} />
        <Route path="work/projects" element={<Navigate to="/my-work?tab=projects" replace />} />
        <Route path="work/dashboards" element={<Navigate to="/my-work?tab=dashboards" replace />} />
        <Route path="templates" element={<Templates />} />
        <Route path="proofs" element={<Proofs />} />
        <Route path="automate" element={<Automate />} />
        <Route path="everything" element={<Navigate to="/everything/milestones" replace />} />
        <Route path="everything/:tab" element={<Everything />} />
        <Route path="people" element={<Navigate to="/people/people" replace />} />
        <Route path="people/:tab" element={<PeopleHub />} />
        <Route path="people/person/:id" element={<PersonDetail />} />
        <Route path="finance" element={<Navigate to="/finance/budgets" replace />} />
        <Route path="finance/:tab" element={<Finance />} />
        <Route path="planning" element={<Navigate to="/planning/workload" replace />} />
        <Route path="planning/:tab" element={<Resourcing />} />
        <Route path="reports" element={<Navigate to="/reports/all" replace />} />
        <Route path="reports/overview" element={<Reports />} />
        <Route path="reports/view/:kind" element={<ReportView />} />
        <Route path="reports/:tab" element={<Reporting />} />
        <Route path="time" element={<Navigate to="/time/all" replace />} />
        <Route path="time/:tab" element={<TimeHub />} />
        <Route path="ai" element={<Navigate to="/ai/ask" replace />} />
        <Route path="ai/:tab" element={<AiHub />} />

        <Route path="clients" element={<Clients />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
