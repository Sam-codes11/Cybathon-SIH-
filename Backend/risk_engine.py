import config
import db

def get_action(risk_level: str, spoof_score: float = None) -> dict:
    if config.ENABLE_ACTION_ESCALATE and spoof_score is not None and spoof_score >= config.ESCALATE_THRESHOLD:
        return {"action": "ESCALATE", "message": "Critical risk -- auto-escalated, immediate interception"}

    actions = {
        "LOW": {"action": "ALLOW", "message": "Call cleared -- no anomalies detected"},
        "MEDIUM": {"action": "VERIFY", "message": "Suspicious patterns -- verification recommended"},
        "HIGH": {"action": "ALERT", "message": "High risk -- alert triggered"},
    }
    return actions.get(risk_level, actions["LOW"])

def process_and_log(
    session_id, spoof_score, risk_level, detection_mode,
    transcript=None, content_risk_flags=None, attack_type=None,
    speaker_slot=None, turn_id=None
):
    action_info = get_action(risk_level, spoof_score=spoof_score)
    db.log_call_full(
        session_id, spoof_score, risk_level, action_info["action"], detection_mode,
        transcript=transcript, content_risk_flags=content_risk_flags, attack_type=attack_type,
        speaker_slot=speaker_slot, turn_id=turn_id
    )
    action_info["repeated_suspicious"] = db.count_recent_risky(session_id) >= 2
    return action_info