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
        # Turn-tracking (turn-boundary attribution, NOT identity diarization)
        self.turn_index = 0
        self.silence_streak = 0
        self.current_speaker_slot = "A"

    def update_turn(self, is_speech: bool, silence_windows_to_flip: int = 2):
        if is_speech:
            if self.silence_streak >= silence_windows_to_flip and self.turn_index > 0:
                self.current_speaker_slot = "B" if self.current_speaker_slot == "A" else "A"
                self.turn_index += 1
            elif self.turn_index == 0:
                self.turn_index = 1
            self.silence_streak = 0
        else:
            self.silence_streak += 1
        return self.current_speaker_slot, self.turn_index

    def add_segment(self, spoof_probability, risk, detection_mode, speaker_slot="A", turn_id=0):
        self.segment_results.append({
            "timestamp": time.time(), "spoof_probability": spoof_probability,
            "risk": risk, "detection_mode": detection_mode,
            "speaker_slot": speaker_slot, "turn_id": turn_id,
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