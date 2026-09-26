from fastapi import Header, HTTPException
import config

async def require_api_key(x_api_key: str = Header(default=None)):
    """Shared-secret check for endpoints that read call history or
    enroll/verify a voice. Not full auth (no per-user identity, no
    OAuth/JWT, no RBAC) -- it's the minimum bar for a demo server."""
    if config.API_KEY is None:
        return  # no key configured: allowed through for local dev only
    if x_api_key != config.API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
