from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.database import Base


def _now_utc():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    created_at = Column(DateTime(timezone=True), server_default= func.now())

    logs = relationship("UploadedLog", back_populates="user")


class UploadedLog(Base):
    __tablename__ = "uploaded_logs"

    id = Column(Integer, primary_key=True)
    filename = Column(String)
    upload_time = Column(DateTime(timezone=True), server_default= func.now())

    user_id = Column(Integer, ForeignKey("users.id"))

    user = relationship("User", back_populates="logs")
    entries = relationship("LogEntry", back_populates="log")


class LogEntry(Base):
    __tablename__ = "log_entries"

    id = Column(Integer, primary_key=True)

    log_id = Column(Integer, ForeignKey("uploaded_logs.id"))

    timestamp = Column(DateTime(timezone=True))
    ip_address = Column(String)
    url = Column(String)
    action = Column(String)
    status_code = Column(Integer)

    raw_log = Column(Text)

    log = relationship("UploadedLog", back_populates="entries")
    alerts = relationship("Alert", back_populates="log_entry")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True)

    log_id = Column(Integer, ForeignKey("uploaded_logs.id"), index=True, nullable=True)
    log_entry_id = Column(Integer, ForeignKey("log_entries.id"), nullable=True)  # null for aggregate alerts (e.g. brute force, IP burst)

    alert_type = Column(String)
    reason = Column(Text)  # Human-readable explanation for the user
    confidence_score = Column(Integer)

    created_at = Column(DateTime(timezone=True), server_default= func.now())

    log_entry = relationship("LogEntry", back_populates="alerts")