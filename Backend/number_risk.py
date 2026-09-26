"""
number_risk.py - Caller ID / Phone Number Risk Assessment

=============================================================================
MOCK IMPLEMENTATION NOTICE:
This module provides a stubbed/mocked Financial Fraud Risk Intelligence (FRI)
and Department of Telecommunications (DoT) telecom risk check.
It evaluates incoming caller numbers against known malicious prefixes,
fraud test blocklists, and virtual VoIP patterns.

PENDING INTEGRATION with official Telecom Service Provider (TSP) & DoT FRI APIs.
=============================================================================
"""

import re
from typing import Optional, Dict, Any

# Mock test blocklist of known tele-fraud / impersonation numbers
FRAUD_BLOCKLIST = {
    "+911800000000",
    "+911400000001",
    "+18005550199",
    "+923001234567",
    "+2348012345678",
    "1409999999",
    "9999999999",
    "0000000000",
}

# International or non-standard routing prefixes frequently associated with cross-border VoIP spoofing
SUSPICIOUS_PREFIXES = [
    "+92",   # Pakistan (common cross-border extortion pattern)
    "+234",  # Nigeria (advance-fee fraud / romance scam)
    "+880",  # Bangladesh
    "+94",   # Sri Lanka
    "+4470", # UK Personal Numbering (abused VoIP forwarding)
    "+1876", # Jamaica lottery scams
]

def check_number_risk(caller_id: Optional[str]) -> Dict[str, Any]:
    """
    Evaluates caller ID risk tier: LOW, MEDIUM, HIGH, or UNKNOWN.
    
    NOTE: This is a clearly separated, additive signal (MOCK FRI STUB).
    It is NOT folded into the 0.70/0.30 spectral/prosody neural fusion score.
    It may be used by the risk engine solely to adjust automated actions
    (e.g., bumping VERIFY to ALERT).
    
    Returns:
        {
            "number_risk_tier": "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN",
            "reason": str,
            "source": "MOCK_FRI_DOT_STUB",
            "caller_id": Optional[str]
        }
    """
    if not caller_id or not str(caller_id).strip():
        return {
            "number_risk_tier": "UNKNOWN",
            "reason": "Caller ID absent or suppressed",
            "source": "MOCK_FRI_DOT_STUB",
            "caller_id": None
        }

    num_clean = re.sub(r"[\s\-\(\)]", "", str(caller_id).strip())

    # 1. Exact match in mock fraud blocklist
    if num_clean in FRAUD_BLOCKLIST or (num_clean.startswith("+91") and num_clean[3:] in FRAUD_BLOCKLIST):
        return {
            "number_risk_tier": "HIGH",
            "reason": "Known scam / fraudulent caller ID on DoT test blocklist",
            "source": "MOCK_FRI_DOT_STUB",
            "caller_id": caller_id
        }

    # 2. Suspicious international prefix check
    for prefix in SUSPICIOUS_PREFIXES:
        if num_clean.startswith(prefix):
            return {
                "number_risk_tier": "HIGH",
                "reason": f"High-risk cross-border dialing prefix ({prefix}) associated with telecom fraud",
                "source": "MOCK_FRI_DOT_STUB",
                "caller_id": caller_id
            }

    # 3. Telemarketing / automated robocall 140-series in India
    if num_clean.startswith("+91140") or num_clean.startswith("140"):
        return {
            "number_risk_tier": "MEDIUM",
            "reason": "Commercial / telemarketing promo number series (140-prefix)",
            "source": "MOCK_FRI_DOT_STUB",
            "caller_id": caller_id
        }

    # 4. Obvious invalid or spoofed short codes (e.g. fewer than 7 digits or repeating digits)
    digits_only = re.sub(r"\D", "", num_clean)
    if len(digits_only) < 7 or (len(digits_only) >= 10 and len(set(digits_only)) <= 2):
        return {
            "number_risk_tier": "MEDIUM",
            "reason": "Irregular digits or potential CLI spoofing pattern",
            "source": "MOCK_FRI_DOT_STUB",
            "caller_id": caller_id
        }

    # 5. Standard verified / domestic caller
    return {
        "number_risk_tier": "LOW",
        "reason": "Valid domestic formatting, no DoT flags found",
        "source": "MOCK_FRI_DOT_STUB",
        "caller_id": caller_id
    }
