import sqlite3
import json
import time
from pathlib import Path
from contextlib import contextmanager

DB_PATH = str(Path(__file__).resolve().parent / "voiceguard.db")
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS calls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            timestamp REAL NOT NULL,
            spoof_score REAL,
            risk_level TEXT,
            action TEXT,
            detection_mode TEXT,
            transcript TEXT,
            content_risk_flags TEXT,
            attack_type TEXT
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS voiceprints (
            speaker_id TEXT PRIMARY KEY,
            embedding TEXT NOT NULL,
            enrolled_at REAL NOT NULL
        )
    """)
    conn.commit()
    conn.close()
@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    try:
        yield conn
    finally:
        conn.close()
def log_call_full(session_id, spoof_score, risk_level, action, detection_mode,
                   transcript=None, content_risk_flags=None, attack_type=None):
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO calls
               (session_id, timestamp, spoof_score, risk_level, action, detection_mode,
                transcript, content_risk_flags, attack_type)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (session_id, time.time(), spoof_score, risk_level, action, detection_mode,
             transcript, json.dumps(content_risk_flags or []), attack_type)
        )
        conn.commit()
def count_recent_risky(session_id, window_seconds=600, min_risk=("MEDIUM", "HIGH")):
    with get_conn() as conn:
        cutoff = time.time() - window_seconds
        placeholders = ",".join("?" for _ in min_risk)
        cur = conn.execute(
            f"SELECT COUNT(*) FROM calls WHERE session_id=? AND timestamp>=? "
            f"AND risk_level IN ({placeholders})",
            (session_id, cutoff, *min_risk)
        )
        return cur.fetchone()[0]
def get_dashboard_stats():
    with get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) FROM calls").fetchone()[0]
        high_risk = conn.execute(
            "SELECT COUNT(*) FROM calls WHERE risk_level='HIGH'").fetchone()[0]
        recent = conn.execute(
            "SELECT session_id, timestamp, risk_level, action FROM calls "
            "ORDER BY timestamp DESC LIMIT 20"
        ).fetchall()
        return {"total_calls": total, "high_risk_calls": high_risk, "recent": recent}
def get_analytics_summary():
    with get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) FROM calls").fetchone()[0]
        ai_flagged = conn.execute(
            "SELECT COUNT(*) FROM calls WHERE risk_level IN ('MEDIUM','HIGH')").fetchone()[0]
        real = total - ai_flagged
        by_attack_type = conn.execute(
            "SELECT attack_type, COUNT(*) FROM calls WHERE attack_type IS NOT NULL "
            "GROUP BY attack_type"
        ).fetchall()
        by_detection_mode = conn.execute(
            "SELECT detection_mode, COUNT(*) FROM calls GROUP BY detection_mode"
        ).fetchall()
        return {
            "total_calls": total,
            "ai_flagged": ai_flagged,
            "real_calls": real,
            "attack_type_breakdown": dict(by_attack_type),
            "detection_basis_breakdown": dict(by_detection_mode),
        }
def save_voiceprint(speaker_id, embedding_vector):
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO voiceprints (speaker_id, embedding, enrolled_at) "
            "VALUES (?, ?, ?)",
            (speaker_id, json.dumps(embedding_vector), time.time())
        )
        conn.commit()
def get_all_voiceprints():
    with get_conn() as conn:
        cur = conn.execute("SELECT speaker_id, embedding FROM voiceprints")
        return {row[0]: json.loads(row[1]) for row in cur.fetchall()}