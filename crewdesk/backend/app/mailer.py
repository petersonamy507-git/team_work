"""Optional email sending. Configure SMTP_* in backend/.env; without it emails are skipped quietly."""
import os
import smtplib
import threading
from email.message import EmailMessage


def smtp_configured() -> bool:
    return bool(os.getenv("SMTP_HOST"))


def _send(to: list[str], subject: str, body: str):
    try:
        msg = EmailMessage()
        msg["From"] = os.getenv("SMTP_FROM") or os.getenv("SMTP_USER") or "crewdesk@localhost"
        msg["To"] = ", ".join(to)
        msg["Subject"] = subject
        msg.set_content(body)
        port = int(os.getenv("SMTP_PORT", "587"))
        with smtplib.SMTP(os.getenv("SMTP_HOST"), port, timeout=15) as s:
            if os.getenv("SMTP_TLS", "true").lower() != "false":
                s.starttls()
            if os.getenv("SMTP_USER"):
                s.login(os.getenv("SMTP_USER"), os.getenv("SMTP_PASSWORD", ""))
            s.send_message(msg)
    except Exception as e:  # never break the request because mail failed
        print(f"[mailer] could not send '{subject}': {e}")


def send_email(to: list[str], subject: str, body: str) -> bool:
    to = [t for t in to if t]
    if not to or not smtp_configured():
        return False
    threading.Thread(target=_send, args=(to, subject, body), daemon=True).start()
    return True
