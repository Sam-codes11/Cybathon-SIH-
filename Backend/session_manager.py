import threading, time, uuid
_lock = threading.Lock()
_sessions = {}
class CallSession:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.created_at = time.time()
        self.segment_results = []
        self.current_risk = "LOW"
        self.current_action = "ALLOW"
    def add_segment(self, spoof_probability, risk, detection_mode):
        self.segment_results.append({
            "timestamp": time.time(), "spoof_probability": spoof_probability,
            "risk": risk, "detection_mode": detection_mode,
        })
        self.current_risk = risk
def get_or_create_session(session_id: str = None) -> CallSession:
    with _lock:
        if session_id is None:
            session_id = str(uuid.uuid4())
        if session_id not in _sessions:
            _sessions[session_id] = CallSession(session_id)
        return _sessions[session_id]
def list_active_sessions():
    with _lock:
        return [
            {"session_id": s.session_id, "current_risk": s.current_risk,
             "current_action": s.current_action, "segments": len(s.segment_results),
             "created_at": s.created_at}
            for s in _sessions.values()
        ]
def end_session(session_id: str):
    with _lock:
        _sessions.pop(session_id, None)