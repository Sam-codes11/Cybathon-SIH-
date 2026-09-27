"""
In-memory broadcast registry so a second ("listener") websocket can
receive a live copy of the same raw PCM audio Person 1's device is
streaming to /audio-stream. Not durable, not authenticated beyond the
session code itself -- this is a demo relay, not a telephony system.
"""
from fastapi import WebSocket

_listeners: dict[str, list[WebSocket]] = {}


def register_listener(session_id: str, ws: WebSocket) -> None:
    _listeners.setdefault(session_id, []).append(ws)


def unregister_listener(session_id: str, ws: WebSocket) -> None:
    if session_id in _listeners:
        _listeners[session_id] = [w for w in _listeners[session_id] if w is not ws]
        if not _listeners[session_id]:
            del _listeners[session_id]


async def broadcast_audio(session_id: str, pcm_bytes: bytes) -> None:
    for ws in list(_listeners.get(session_id, [])):
        try:
            await ws.send_bytes(pcm_bytes)
        except Exception:
            unregister_listener(session_id, ws)
