import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# PostgreSQL. Override with DATABASE_URL environment variable if needed.
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://inder:password1234@localhost:5432/log_db"
)

_connect_args = {"connect_timeout": 5} if "postgresql" in DATABASE_URL else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=_connect_args,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()
