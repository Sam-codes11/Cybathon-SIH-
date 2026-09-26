import re

# Pattern groups -- each maps a scam behavior to phrases that indicate it.
# Keyword-based, robust regex patterns designed to catch spoken extortion and phishing phrases.
ATTACK_PATTERNS = {
    "financial_extortion": [
        r"\b(give|send|transfer|need|pay|want)\b.*\b(rupees?|rs|dollars?|money|cash|amount|funds?)\b",
        r"\b(rupees?|dollars?)\b",
        r"\b\d+\s*(rupees?|rs|dollars?|lakh|crore)\b",
        r"\b(hundred|thousand|lakh|crore)\s*(rupees?|dollars?)\b",
        r"\b(upi|gpay|phonepe|paytm)\b",
        r"\baccount.*(freeze|frozen|blocked|debit)\b",
        r"\b(fine|penalty)\b.*\b(pay|deposit)\b",
        r"\btransfer\b.*\b(money|funds?|cash|amount)\b",
        r"\bpay\b.*\b(immediately|now|urgent(ly)?)\b",
        r"\bneed\s+(some\s+)?money\b",
        r"\bgive\s+me\s+.*(rupees?|money|cash|\d+)\b",
    ],
    "otp_phishing": [
        r"\botp\b", r"\bone[\s-]?time[\s-]?password\b", r"\bshare.*\bcode\b",
        r"\bverification\s*code\b", r"\bsend.*\bcode\b", r"\bpin\b",
    ],
    "digital_arrest_scam": [
        r"\barrest\b", r"\bcustoms?\b.*\bofficer\b", r"\bcbi\b", r"\bpolice\b.*\bwarrant\b",
        r"\blegal\s*action\b", r"\bcourt\s*order\b", r"\bnarcotics\b",
    ],
    "impersonation_authority": [
        r"\bi\s*am\s*(your|the)\s*(son|daughter|father|mother|manager|officer|bank)\b",
        r"\bdon'?t\s*tell\s*(anyone|family)\b", r"\bkeep\s*this\s*secret\b",
        r"\bcalling\s*from\s*(bank|police|customs|cbi|rbi)\b",
    ],
    "urgency_pressure": [
        r"\bright\s*now\b", r"\bimmediately\b", r"\bemergency\b", r"\burgent(ly)?\b",
        r"\bquick(ly)?\b", r"\basap\b", r"\bwithin.*(minute|hour)s?\b",
    ],
}


def analyze_transcript(transcript: str):
    if not transcript:
        return None, []
    text = transcript.lower()
    matches = {}
    flagged_phrases = []
    for attack_type, patterns in ATTACK_PATTERNS.items():
        hits = [p for p in patterns if re.search(p, text)]
        if hits:
            matches[attack_type] = len(hits)
            flagged_phrases.extend(hits)
    if not matches:
        return None, []
    priority = [
        "digital_arrest_scam",
        "impersonation_authority",
        "otp_phishing",
        "financial_extortion",
        "urgency_pressure",
    ]
    best = next((p for p in priority if p in matches), list(matches.keys())[0])
    return best, flagged_phrases
