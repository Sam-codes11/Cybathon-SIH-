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
            attack_type TEXT,
            speaker_slot TEXT,
            turn_id INTEGER
        )
    """)
    for col, coltype in (("speaker_slot", "TEXT"), ("turn_id", "INTEGER"), ("number_risk_tier", "TEXT")):
        try:
            c.execute(f"ALTER TABLE calls ADD COLUMN {col} {coltype}")
        except sqlite3.OperationalError:
            pass  # column already exists
    c.execute("""
        CREATE TABLE IF NOT EXISTS voiceprints (
            speaker_id TEXT PRIMARY KEY,
            embedding TEXT NOT NULL,
            enrolled_at REAL NOT NULL
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS session_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT UNIQUE,
            started_at REAL,
            ended_at REAL,
            peak_risk TEXT,
            peak_spoof_score REAL,
            segment_count INTEGER,
            number_risk_tier TEXT
        )
    """)
    try:
        c.execute("ALTER TABLE session_history ADD COLUMN number_risk_tier TEXT")
    except sqlite3.OperationalError:
        pass  # column already exists
    conn.commit()
    conn.close()
def get_db_connection():
    return sqlite3.connect(DB_PATH)
@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    try:
        yield conn
    finally:
        conn.close()
def log_call_full(session_id, spoof_score, risk_level, action, detection_mode,
                   transcript=None, content_risk_flags=None, attack_type=None,
                   speaker_slot=None, turn_id=None, number_risk_tier=None):
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO calls
               (session_id, timestamp, spoof_score, risk_level, action, detection_mode,
                transcript, content_risk_flags, attack_type, speaker_slot, turn_id, number_risk_tier)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (session_id, time.time(), spoof_score, risk_level, action, detection_mode,
             transcript, json.dumps(content_risk_flags or []), attack_type,
             speaker_slot, turn_id, number_risk_tier)
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
        trend_rows = conn.execute(
            "SELECT id, timestamp, spoof_score, risk_level, action FROM calls "
            "ORDER BY timestamp ASC LIMIT 30"
        ).fetchall()
        trend = [
            {
                "id": r[0],
                "timestamp": r[1],
                "spoof_score": round(float(r[2] or 0.0), 3),
                "risk_level": r[3],
                "action": r[4]
            }
            for r in trend_rows
        ]
        return {
            "total_calls": total,
            "high_risk_calls": high_risk,
            "recent": recent,
            "trend": trend
        }
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


def save_session_summary(session_id, started_at, ended_at, peak_risk, peak_spoof_score, segment_count, number_risk_tier=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO session_history
        (session_id, started_at, ended_at, peak_risk, peak_spoof_score, segment_count, number_risk_tier)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (session_id, started_at, ended_at, peak_risk, peak_spoof_score, segment_count, number_risk_tier))
    conn.commit()
    conn.close()


def get_session_history(limit=20):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(session_history)")
    cols = [row[1] for row in cursor.fetchall()]
    has_num_risk = "number_risk_tier" in cols

    if has_num_risk:
        cursor.execute('''
            SELECT session_id, started_at, ended_at, peak_risk, peak_spoof_score, segment_count, number_risk_tier
            FROM session_history
            ORDER BY ended_at DESC
            LIMIT ?
        ''', (limit,))
        rows = cursor.fetchall()
        conn.close()
        return [
            {
                "session_id": r[0],
                "started_at": r[1],
                "ended_at": r[2],
                "duration_sec": round(r[2] - r[1], 1) if (r[1] and r[2]) else 0,
                "peak_risk": r[3],
                "peak_spoof_score": r[4],
                "segment_count": r[5],
                "number_risk_tier": r[6]
            }
            for r in rows
        ]
    else:
        cursor.execute('''
            SELECT session_id, started_at, ended_at, peak_risk, peak_spoof_score, segment_count
            FROM session_history
            ORDER BY ended_at DESC
            LIMIT ?
        ''', (limit,))
        rows = cursor.fetchall()
        conn.close()
        return [
            {
                "session_id": r[0],
                "started_at": r[1],
                "ended_at": r[2],
                "duration_sec": round(r[2] - r[1], 1) if (r[1] and r[2]) else 0,
                "peak_risk": r[3],
                "peak_spoof_score": r[4],
                "segment_count": r[5],
                "number_risk_tier": None
            }
            for r in rows
        ]