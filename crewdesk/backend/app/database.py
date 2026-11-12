from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from .config import DATABASE_URL

engine_kwargs = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def add_missing_columns():
    """create_all() never alters existing tables, so add any new model columns here (MySQL and SQLite)."""
    from sqlalchemy import inspect, text, Boolean, Integer
    insp = inspect(engine)
    for table in Base.metadata.sorted_tables:
        if not insp.has_table(table.name):
            continue
        existing = {c["name"] for c in insp.get_columns(table.name)}
        for col in table.columns:
            if col.name in existing:
                continue
            q = engine.dialect.identifier_preparer.quote
            ddl = f"{q(col.name)} {col.type.compile(dialect=engine.dialect)}"
            default = getattr(col.default, "arg", None)
            if not col.nullable and default is not None and not callable(default):
                val = int(default) if isinstance(col.type, (Boolean, Integer)) else f"'{default}'"
                ddl += f" NOT NULL DEFAULT {val}"
            else:
                ddl += " NULL"
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {q(table.name)} ADD COLUMN {ddl}"))
