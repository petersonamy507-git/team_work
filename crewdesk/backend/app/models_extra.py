"""Teamwork-parity sections: Everything, People, Finance, Resourcing, Reports, AI, Automate, Recent, Dashboards."""
from datetime import datetime, date

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base

UID = lambda: mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # noqa: E731
PID = lambda: mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)  # noqa: E731
NOW = lambda: mapped_column(DateTime, server_default=func.now())  # noqa: E731


class Risk(Base):
    __tablename__ = "risks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = PID()
    source: Mapped[str] = mapped_column(String(300))
    probability: Mapped[int] = mapped_column(Integer, default=50)
    impact: Mapped[str] = mapped_column(String(20), default="medium")  # low | medium | high
    status: Mapped[str] = mapped_column(String(20), default="open")  # open | closed
    owner_id: Mapped[int | None] = UID()
    impact_schedule: Mapped[bool] = mapped_column(Boolean, default=False)
    impact_cost: Mapped[bool] = mapped_column(Boolean, default=False)
    impact_performance: Mapped[bool] = mapped_column(Boolean, default=False)
    mitigation: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[int | None] = UID()
    created_at: Mapped[datetime] = NOW()


class Notebook(Base):
    __tablename__ = "notebooks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = PID()
    title: Mapped[str] = mapped_column(String(250))
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by_id: Mapped[int | None] = UID()
    created_at: Mapped[datetime] = NOW()
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class Link(Base):
    __tablename__ = "links"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = PID()
    title: Mapped[str] = mapped_column(String(250))
    url: Mapped[str] = mapped_column(String(1000))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_by_id: Mapped[int | None] = UID()
    created_at: Mapped[datetime] = NOW()


class Form(Base):
    __tablename__ = "forms"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = PID()
    title: Mapped[str] = mapped_column(String(250))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    fields: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON [{label,type,required}]
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by_id: Mapped[int | None] = UID()
    created_at: Mapped[datetime] = NOW()


class FormResponse(Base):
    __tablename__ = "form_responses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), index=True)
    answers: Mapped[str] = mapped_column(Text)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = NOW()


class Proof(Base):
    __tablename__ = "proofs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = PID()
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(250))
    file_id: Mapped[int | None] = mapped_column(ForeignKey("files.id", ondelete="SET NULL"), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="in_review")  # in_review | approved | changes | rejected
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    reviewer_ids: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by_id: Mapped[int | None] = UID()
    created_at: Mapped[datetime] = NOW()


class ProjectCategory(Base):
    __tablename__ = "project_categories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    color: Mapped[str] = mapped_column(String(16), default="#4461d7")


class Role(Base):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    billable_rate: Mapped[int] = mapped_column(Integer, default=0)
    cost_rate: Mapped[int] = mapped_column(Integer, default=0)
    member_ids: Mapped[str | None] = mapped_column(Text, nullable=True)  # comma separated user ids


class Skill(Base):
    __tablename__ = "skills"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    member_ids: Mapped[str | None] = mapped_column(Text, nullable=True)


class Team(Base):
    __tablename__ = "teams"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    handle: Mapped[str | None] = mapped_column(String(60), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(16), default="#4461d7")
    lead_id: Mapped[int | None] = UID()
    member_ids: Mapped[str | None] = mapped_column(Text, nullable=True)


class StatusUpdate(Base):
    __tablename__ = "status_updates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    emoji: Mapped[str | None] = mapped_column(String(16), nullable=True)
    text: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = NOW()


class Rate(Base):
    __tablename__ = "rates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    billable_rate: Mapped[int] = mapped_column(Integer, default=0)  # per hour, whole currency units
    cost_rate: Mapped[int] = mapped_column(Integer, default=0)


class Budget(Base):
    __tablename__ = "budgets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = PID()
    type: Mapped[str] = mapped_column(String(20), default="financial")  # financial | time
    amount: Mapped[int] = mapped_column(Integer, default=0)  # currency units or minutes
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notify_pct: Mapped[int] = mapped_column(Integer, default=80)
    created_at: Mapped[datetime] = NOW()


class Invoice(Base):
    __tablename__ = "invoices"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = PID()
    number: Mapped[str] = mapped_column(String(60))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    issue_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    amount: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="open")  # draft | open | paid | overdue
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    created_by_id: Mapped[int | None] = UID()
    created_at: Mapped[datetime] = NOW()


class Expense(Base):
    __tablename__ = "expenses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = PID()
    name: Mapped[str] = mapped_column(String(250))
    date: Mapped[date | None] = mapped_column(Date, nullable=True)
    cost: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True)
    created_by_id: Mapped[int | None] = UID()
    created_at: Mapped[datetime] = NOW()


class ProjectTemplate(Base):
    __tablename__ = "project_templates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON {tasklists:[{name,tasks:[title]}]}
    created_by_id: Mapped[int | None] = UID()
    created_at: Mapped[datetime] = NOW()


class Allocation(Base):
    __tablename__ = "allocations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[int] = PID()
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    minutes_per_day: Mapped[int] = mapped_column(Integer, default=480)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)


class PortfolioBoard(Base):
    __tablename__ = "portfolio_boards"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    columns: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON [{id,name,color,project_ids:[]}]


class SavedReport(Base):
    __tablename__ = "saved_reports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    kind: Mapped[str] = mapped_column(String(40), default="custom")  # custom | scheduled
    report_type: Mapped[str] = mapped_column(String(40), default="tasks")
    config: Mapped[str | None] = mapped_column(Text, nullable=True)
    frequency: Mapped[str | None] = mapped_column(String(20), nullable=True)
    recipients: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = NOW()


class Automation(Base):
    __tablename__ = "automations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(200))
    trigger: Mapped[str] = mapped_column(String(60))  # task_created | task_completed | task_late
    action: Mapped[str] = mapped_column(String(60))  # assign | set_priority | add_tag | notify | set_status
    action_value: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    run_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = NOW()


class AiChat(Base):
    __tablename__ = "ai_chats"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    messages: Mapped[str] = mapped_column(Text)  # JSON [{role,text}]
    created_at: Mapped[datetime] = NOW()


class AiSkill(Base):
    __tablename__ = "ai_skills"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    prompt: Mapped[str] = mapped_column(Text)


class AiTeammate(Base):
    __tablename__ = "ai_teammates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    role: Mapped[str | None] = mapped_column(String(160), nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class RecentItem(Base):
    __tablename__ = "recent_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # project | task | message | comment
    ref_id: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(300))
    subtitle: Mapped[str | None] = mapped_column(String(300), nullable=True)
    link: Mapped[str] = mapped_column(String(255))
    viewed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Dashboard(Base):
    __tablename__ = "dashboards"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    scope: Mapped[str] = mapped_column(String(30), default="home")  # home | mywork | project:<id>
    name: Mapped[str] = mapped_column(String(120))
    widgets: Mapped[str] = mapped_column(Text)  # JSON list of widget keys
    position: Mapped[int] = mapped_column(Integer, default=0)


class Placeholder(Base):
    """Placeholder user for planning before someone is hired (People > Placeholders)."""
    __tablename__ = "placeholders"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str | None] = mapped_column(String(120), nullable=True)
    skills: Mapped[str | None] = mapped_column(String(500), nullable=True)
    capacity_minutes: Mapped[int] = mapped_column(Integer, default=480)
    created_at: Mapped[datetime] = NOW()


class Reaction(Base):
    """Emoji reaction on a comment or message (kind = task-comment | message | reply)."""
    __tablename__ = "reactions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    ref_id: Mapped[str] = mapped_column(String(40), index=True)
    emoji: Mapped[str] = mapped_column(String(16))


class SiteSetting(Base):
    """Company-wide settings (Settings > General, Projects, Currencies, Time, Logo, Working hours, Appearance, Integrations)."""
    __tablename__ = "site_settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON


class UserPref(Base):
    """Per-user preferences (welcome checklist, followed messages, dismissed banners...)."""
    __tablename__ = "user_prefs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = mapped_column(String(80))
    value: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON


class ChatChannel(Base):
    __tablename__ = "chat_channels"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_dm: Mapped[bool] = mapped_column(Boolean, default=False)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    member_ids: Mapped[str | None] = mapped_column(Text, nullable=True)  # comma separated
    created_by_id: Mapped[int | None] = UID()
    created_at: Mapped[datetime] = NOW()


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    channel_id: Mapped[int] = mapped_column(ForeignKey("chat_channels.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int | None] = UID()
    body: Mapped[str] = mapped_column(Text)
    is_bookmarked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = NOW()


class ChatRead(Base):
    __tablename__ = "chat_reads"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    channel_id: Mapped[int] = mapped_column(ForeignKey("chat_channels.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    last_read_id: Mapped[int] = mapped_column(Integer, default=0)
