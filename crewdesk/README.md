# Crewdesk

A team work-management app: projects, task lists, boards, milestones, messages, files,
time tracking, people, clients, inbox, calendar and reports.

- **Frontend:** React + Vite (JavaScript), in `frontend/`
- **Backend:** FastAPI + SQLAlchemy, in `backend/`
- **Database:** MySQL

## What's in it

| Area | Features |
|---|---|
| Home | Greeting, my late / today / open counts, time distribution donut, projects by health, unread inbox items, delegated tasks (late, today, upcoming, no date, completed), logged time by weekday, upcoming milestones |
| My work | Teamwork-style My work: My tasks, My calendar, My timesheet, My projects and Activity tabs; Late / Today / Upcoming counts with a My tasks / My milestones switch; view another person's tasks; grouped (Late, Today, Upcoming, No due date) or list layout with sort and a Milestones and Events today sidebar; filter popover; Personal tasks notepad; select multiple (Shift+M); Add task / milestone / event |
| Inbox | Notifications for assignments, comments, messages, completions; read/unread, mark all read |
| Projects | Table or card view, active / completed / archived, star, health, progress, late count, time logged, owner, people |
| Project tabs | Overview, List (task lists, inline add, drag to reorder), Board (custom columns, drag and drop, colors), Table (sortable, inline edit), Milestones, Messages (threads with replies), Files (drag-and-drop upload, download), Time, People, Activity |
| Tasks | Side panel like Teamwork: complete, assignees, dates, priority, tags, estimate, workflow stage (Backlog, To do, In progress, Completed), progress, followers, reminders (delivered to Inbox), repeat, private; Details (subtasks, quick-add subtasks, files), Dependencies and Time tabs; Comments, Activity and Info tabs; copy link, move or copy, duplicate, print, delete, open in project |
| Tasks page | Tasks / Board / Table / Completed tasks tabs. Tasks: all active tasks grouped by task list with project and client, inline editing of every attribute on hover, me/everyone toggle, sort, filter popover (tags, due date presets, priority, stages, projects, assignees, created by, client, project owner, exclude tags, quick filters, not blocked, untagged, starred, following, saved filters). Board: workflow stage columns with drag and drop. Table: grouped table with column picker and inline edits. Completed: grouped by completion date. Select multiple, bulk edit, export CSV. Add task dialog with Details / Advanced options (dependencies, reminders, followers, progress, repeat) and Create and add another |
| Milestones | All milestones across projects, linked task lists and progress |
| Calendar | Month view of task due dates and milestones, everyone or just me |
| Time | Weekly timesheet and filterable time entries, billable flag, edit and delete |
| People | Team list with workload, person page with tasks, projects and time; admins add/deactivate people |
| Clients | Client companies linked to projects |
| Reports | Project health, team utilization and time per day, CSV export |
| Other | Ctrl+K search, Quick add (task, project, time, message), collapsible sidebar, profile settings |

## Requirements

- Python 3.10+
- Node.js 18+
- MySQL 8 running locally

## Setup on Windows

1. Create the database: open MySQL Workbench and run `database/create_database.sql`.
2. Double-click `setup.bat`. It creates a Python virtual environment, installs the backend
   packages and runs `npm install` for the frontend.
3. Open `backend/.env` and set your MySQL password:
   `DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/crewdesk`
4. Optional: double-click `seed.bat` to load demo projects and people.
   Demo sign-in: `admin@crewdesk.local` / `admin123` (other demo users use `password123`).
5. Double-click `start.bat`. It starts the API on port 8000 and the app on port 5173,
   and opens http://localhost:5173.

Without demo data, use **Create one** on the sign-in page. The first account becomes the admin.

## Manual commands

```bash
# backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # then edit DATABASE_URL
python seed.py                  # optional demo data
uvicorn app.main:app --reload --port 8000

# frontend (second terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

API docs are at http://localhost:8000/docs.

## Production build

`cd frontend && npm run build` creates `frontend/dist`. The FastAPI app serves that folder
automatically, so `uvicorn app.main:app --port 8000` alone serves both the API and the app at
http://localhost:8000.

## Project layout

```
backend/
  app/
    main.py          FastAPI app, routers, serves frontend/dist
    models.py        SQLAlchemy tables
    schemas.py       request bodies and response shapes
    security.py      password hashing and JWT auth
    routers/         auth, people+clients, projects (lists, board, members),
                     tasks, milestones, messages, files, time, home (dashboard,
                     inbox, search, reports, calendar, activity)
  seed.py            demo data
  uploads/           uploaded files (created automatically)
frontend/
  src/
    App.jsx          routes
    components/      layout + sidebar, task drawer, quick-add forms, shared UI
    pages/           one file per screen
    lib/             API client, auth, formatting helpers
database/
  create_database.sql
```
