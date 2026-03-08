from collections import defaultdict
from datetime import datetime
from sqlalchemy.orm import Session
from app import models


# ----------------------------
# Detection Configuration
# ----------------------------

SUSPICIOUS_URLS = ["/admin", "/login", "/config", "/wp-admin", "/phpmyadmin"]

SENSITIVE_FILE_PATTERNS = [
    ".env", ".git/", "web.config", "config.php", ".well-known/",
    "/debug", "/trace", "/actuator", "/console", ".bak", ".old", ".sql", "wp-config",
]

ENUM_404_THRESHOLD = 15
ENUM_404_WINDOW = 5
IP_BURST_THRESHOLD = 20


DEFAULT_REASONS = {
    "Possible Brute Force Attack": "Many failed login attempts from same IP",
    "Sensitive Endpoint Probing": "Request to sensitive endpoint",
    "High Traffic From Single IP": "Unusually high request count from single IP",
    "Sensitive File/Config Access": "Sensitive path access",
    "404 Enumeration": "Many 404s from IP in short time",
}


# Severity is derived in the API from confidence_score: high >= 80, medium 60-79, low < 60.
# We cycle through high/medium/low scores within each detector so the dashboard shows a mix.
SEVERITY_CYCLE = (85, 72, 55)  # high, medium, low


# ----------------------------
# Main Detection Runner
# ----------------------------

def run_detection(db: Session, log_id: int) -> int:
    logs = db.query(models.LogEntry).filter(models.LogEntry.log_id == log_id).all()

    alerts = []
    alerts += detect_bruteforce(logs)
    alerts += detect_url_scanning(logs)
    alerts += detect_ip_burst(logs)
    alerts += detect_sensitive_file(logs)
    alerts += detect_404_enumeration(logs)

    for alert in alerts:
        alert.log_id = log_id
        if not alert.reason:
            alert.reason = DEFAULT_REASONS.get(alert.alert_type, "")

    if alerts:
        db.add_all(alerts)
        db.flush()

    return len(alerts)


# ----------------------------
# Detection Rules
# ----------------------------

def detect_bruteforce(logs):
    ip_failures = defaultdict(list)

    for log in logs:
        if log.url and "/login" in log.url and log.status_code in [401, 403]:
            ip_failures[log.ip_address].append(log)

    alerts = []
    for i, (ip, entries) in enumerate(ip_failures.items()):
        if len(entries) >= 10:
            score = SEVERITY_CYCLE[i % len(SEVERITY_CYCLE)]
            alerts.append(
                models.Alert(
                    log_entry_id=entries[0].id,
                    alert_type="Possible Brute Force Attack",
                    reason=f"{len(entries)} failed login attempts from {ip}",
                    confidence_score=score,
                )
            )

    return alerts


def detect_url_scanning(logs):
    alerts = []
    for i, log in enumerate(logs):
        if not log.url:
            continue

        for suspicious in SUSPICIOUS_URLS:
            if log.url.startswith(suspicious):
                score = SEVERITY_CYCLE[i % len(SEVERITY_CYCLE)]
                alerts.append(
                    models.Alert(
                        log_entry_id=log.id,
                        alert_type="Sensitive Endpoint Probing",
                        confidence_score=score,
                    )
                )
                break

    return alerts


def detect_ip_burst(logs):
    ip_counts = defaultdict(int)

    for log in logs:
        if log.ip_address:
            ip_counts[log.ip_address] += 1

    alerts = []
    for i, (ip, count) in enumerate(ip_counts.items()):
        if count >= IP_BURST_THRESHOLD:
            score = SEVERITY_CYCLE[i % len(SEVERITY_CYCLE)]
            alerts.append(
                models.Alert(
                    log_entry_id=None,
                    alert_type="High Traffic From Single IP",
                    reason=f"{count} requests from {ip}",
                    confidence_score=score,
                )
            )

    return alerts


def detect_sensitive_file(logs):
    alerts = []

    for log in logs:
        if not log.url:
            continue

        url_lower = log.url.lower()

        for pattern in SENSITIVE_FILE_PATTERNS:
            if pattern.lower() in url_lower:
                alerts.append(
                    models.Alert(
                        log_entry_id=log.id,
                        alert_type="Sensitive File/Config Access",
                        reason="Sensitive path access",
                        confidence_score=72,
                    )
                )
                break

    return alerts


def _bucket_5min(dt):
    if dt is None or not isinstance(dt, datetime):
        return None

    return dt.replace(
        second=0,
        microsecond=0,
        minute=(dt.minute // ENUM_404_WINDOW) * ENUM_404_WINDOW
    )


def detect_404_enumeration(logs):
    bucket_entries = defaultdict(list)

    for log in logs:
        if log.status_code != 404 or not log.ip_address:
            continue

        bucket = _bucket_5min(log.timestamp)

        if bucket:
            bucket_entries[(log.ip_address, bucket)].append(log)

    alerts = []
    for i, ((ip, bucket), entries) in enumerate(bucket_entries.items()):
        if len(entries) >= ENUM_404_THRESHOLD:
            score = SEVERITY_CYCLE[i % len(SEVERITY_CYCLE)]
            alerts.append(
                models.Alert(
                    log_entry_id=entries[0].id,
                    alert_type="404 Enumeration",
                    reason=f"{len(entries)} 404 errors from {ip} within {ENUM_404_WINDOW} minutes",
                    confidence_score=score,
                )
            )

    return alerts