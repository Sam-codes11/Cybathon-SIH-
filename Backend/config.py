import os

def _float_env(name, default):
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default

# Spoof-probability thresholds. All overridable via environment
# variables so risk sensitivity is configurable per deployment
# without a code change.
THREAT_LATCH_THRESHOLD = _float_env("VG_THREAT_LATCH_THRESHOLD", 0.65)
LATCHED_FLOOR = _float_env("VG_LATCHED_FLOOR", 0.76)
HIGH_RISK_THRESHOLD = _float_env("VG_HIGH_RISK_THRESHOLD", 0.70)
MEDIUM_RISK_THRESHOLD = _float_env("VG_MEDIUM_RISK_THRESHOLD", 0.50)
VOICEPRINT_MATCH_THRESHOLD = _float_env("VG_VOICEPRINT_THRESHOLD", 0.75)
ESCALATE_THRESHOLD = _float_env("VG_ESCALATE_THRESHOLD", 0.85)

# Feature flags (wrap new features for quick rollback if needed)
ENABLE_ACTION_ESCALATE = os.environ.get("VG_ENABLE_ACTION_ESCALATE", "1").lower() in ("1", "true", "yes")

# Shared-secret for sensitive endpoints. Unset = auth skipped (local dev only).
API_KEY = os.environ.get("VG_API_KEY")

# Comma-separated allowed frontend origins.
ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get(
        "VG_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if o.strip()
]
