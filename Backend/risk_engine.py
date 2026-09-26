import config
import db

def get_action(risk_level: str, spoof_score: float = None, number_risk_tier: str = None) -> dict:
    """
    Returns automated action dict based on risk_level, spoof_score, and optional number_risk_tier.
    
    IMPORTANT: number_risk_tier is an additive signal and does NOT alter the underlying
    acoustic/prosody neural score. It is optionally used here only to adjust the automated
    action tier (e.g., bumping VERIFY to ALERT if caller number is high-risk).
    """
    if config.ENABLE_ACTION_ESCALATE and spoof_score is not None and spoof_score >= config.ESCALATE_THRESHOLD:
        return {"action": "ESCALATE", "message": "Critical risk -- auto-escalated, immediate interception"}

    actions = {
        "LOW": {"action": "ALLOW", "message": "Call cleared -- no anomalies detected"},
        "MEDIUM": {"action": "VERIFY", "message": "Suspicious patterns -- verification recommended"},
        "HIGH": {"action": "ALERT", "message": "High risk -- alert triggered"},
    }
    base = actions.get(risk_level, actions["LOW"])
    action = base["action"]
    message = base["message"]

    # Additive number-risk adjustment (Task 4) - MOCK pending real DoT/FRI integration
    if config.ENABLE_NUMBER_RISK and number_risk_tier:
        tier_upper = str(number_risk_tier).upper()
        if tier_upper == "HIGH":
            if action == "ALLOW":
                action = "VERIFY"
                message = "Acoustics normal, but high-risk caller number flagged by DoT/FRI -- verification required"
            elif action == "VERIFY":
                action = "ALERT"
                message = "Suspicious audio combined with high-risk caller number -- alert triggered"
        elif tier_upper == "MEDIUM":
            if action == "ALLOW":
                action = "VERIFY"
                message = "Unverified / commercial caller number series -- secondary verification recommended"

    return {"action": action, "message": message}

def process_and_log(
    session_id, spoof_score, risk_level, detection_mode,
    transcript=None, content_risk_flags=None, attack_type=None,
    speaker_slot=None, turn_id=None, number_risk_tier=None
):
    action_info = get_action(risk_level, spoof_score=spoof_score, number_risk_tier=number_risk_tier)
    db.log_call_full(
        session_id, spoof_score, risk_level, action_info["action"], detection_mode,
        transcript=transcript, content_risk_flags=content_risk_flags, attack_type=attack_type,
        speaker_slot=speaker_slot, turn_id=turn_id, number_risk_tier=number_risk_tier
    )
    action_info["repeated_suspicious"] = db.count_recent_risky(session_id) >= 2
    return action_info