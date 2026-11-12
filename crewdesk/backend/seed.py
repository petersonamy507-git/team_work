"""Fill the database with demo data.  Run:  python seed.py
Sign in afterwards with  admin@crewdesk.local / admin123"""
import random
from datetime import date, timedelta

from sqlalchemy import select

from app.database import Base, engine, SessionLocal
from app import models
from app.security import hash_password

random.seed(7)
Base.metadata.create_all(bind=engine)
db = SessionLocal()

if db.scalar(select(models.User).where(models.User.email == "admin@crewdesk.local")):
    print("Demo data already present, nothing to do.")
    raise SystemExit

today = date.today()
people = [
    ("Admin User", "admin@crewdesk.local", "Workspace owner", "admin", "#6366f1"),
    ("Aisha Khan", "aisha@crewdesk.local", "Project manager", "member", "#0ea5e9"),
    ("Rahul Mehta", "rahul@crewdesk.local", "Designer", "member", "#10b981"),
    ("Sara Lopez", "sara@crewdesk.local", "Developer", "member", "#f59e0b"),
    ("Omar Ali", "omar@crewdesk.local", "Copywriter", "member", "#ec4899"),
]
users = []
for name, email, title, role, color in people:
    u = models.User(name=name, email=email, title=title, role=role, color=color,
                    password_hash=hash_password("admin123" if role == "admin" else "password123"))
    db.add(u)
    users.append(u)
db.flush()
admin = users[0]

clients = [models.Client(name="Northwind Foods", website="https://example.com"),
           models.Client(name="Bluepeak Studio", website="https://example.org")]
db.add_all(clients)
db.flush()

specs = [
    ("Website redesign", "#6366f1", "good", clients[0], [
        ("Discovery", ["Kickoff call", "Collect brand assets", "Competitor review"]),
        ("Design", ["Wireframes", "Homepage mockup", "Mobile layouts", "Design review"]),
        ("Build", ["Set up repo", "Build header and footer", "CMS integration", "QA pass"]),
    ]),
    ("Q4 marketing campaign", "#ec4899", "at_risk", clients[1], [
        ("Planning", ["Campaign brief", "Budget approval", "Channel plan"]),
        ("Content", ["Write ad copy", "Landing page copy", "Social calendar", "Video script"]),
    ]),
    ("Mobile app launch", "#10b981", "needs_attention", None, [
        ("Pre-launch", ["App store listing", "Beta feedback triage", "Press kit"]),
        ("Launch", ["Release build", "Launch email", "Monitor reviews"]),
    ]),
]
priorities = ["none", "low", "medium", "high"]
for pname, color, health, client, lists in specs:
    p = models.Project(name=pname, color=color, health=health, client_id=client.id if client else None,
                       owner_id=admin.id, description=f"{pname} for the team.",
                       start_date=today - timedelta(days=20), end_date=today + timedelta(days=40),
                       budget_minutes=200 * 60)
    db.add(p)
    db.flush()
    for u in users:
        db.add(models.ProjectMember(project_id=p.id, user_id=u.id))
    cols = []
    for i, (cn, cc) in enumerate([("To do", "#94a3b8"), ("In progress", "#3b82f6"),
                                   ("Review", "#f59e0b"), ("Done", "#10b981")]):
        c = models.BoardColumn(project_id=p.id, name=cn, color=cc, position=i)
        db.add(c)
        cols.append(c)
    db.flush()
    ms = models.Milestone(project_id=p.id, name=f"{pname} phase 1 signed off", owner_id=users[1].id,
                          due_date=today + timedelta(days=random.randint(3, 25)))
    db.add(ms)
    db.flush()
    for li, (lname, titles) in enumerate(lists):
        tl = models.TaskList(project_id=p.id, name=lname, position=li, milestone_id=ms.id if li == 0 else None)
        db.add(tl)
        db.flush()
        for ti, title in enumerate(titles):
            status = random.choice(["new", "new", "in_progress", "completed"])
            col = cols[3] if status == "completed" else (cols[1] if status == "in_progress" else cols[0])
            t = models.Task(project_id=p.id, tasklist_id=tl.id, column_id=col.id, title=title, status=status,
                            priority=random.choice(priorities), position=ti,
                            assignee_id=random.choice(users).id, created_by_id=admin.id,
                            due_date=today + timedelta(days=random.randint(-5, 15)) if random.random() > .2 else None,
                            estimate_minutes=random.choice([None, 60, 120, 240]))
            db.add(t)
    db.add(models.Message(project_id=p.id, user_id=users[1].id, title="Welcome to the project",
                          body="Here is where we'll share updates. Reply with any questions."))
    db.add(models.Activity(project_id=p.id, user_id=admin.id, action=f"created project {pname}"))
db.flush()

projects = db.scalars(select(models.Project)).all()
for u in users:
    for back in range(0, 14):
        day = today - timedelta(days=back)
        if day.weekday() >= 5 or random.random() < .3:
            continue
        p = random.choice(projects)
        db.add(models.TimeEntry(user_id=u.id, project_id=p.id, date=day, minutes=random.choice([30, 60, 90, 120, 180]),
                                description="Worked on project tasks", billable=random.random() > .2))

db.add(models.Notification(user_id=admin.id, actor_id=users[1].id, kind="task",
                           message="Aisha Khan assigned you \"Design review\"", link="/my-work"))
db.add(models.Notification(user_id=admin.id, actor_id=users[3].id, kind="comment",
                           message="Sara Lopez commented on \"CMS integration\"", link="/my-work"))
db.commit()
print("Demo data created. Sign in with admin@crewdesk.local / admin123")
