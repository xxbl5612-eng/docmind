"""WebSocket endpoint for real-time collaborative editing."""

from __future__ import annotations

from datetime import datetime, timezone

import orjson
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.core.cache import CacheManager, get_redis
from src.core.events import CHANNEL_COLLAB_SESSION, publish
from src.core.security import decode_access_token

ws_router = APIRouter()

# ── In-memory per-process registry ──
# session_id → {user_id → WebSocket}
_active_connections: dict[str, dict[str, WebSocket]] = {}

# session_id → {user_id → dict} (presence info)
_active_presence: dict[str, dict[str, dict]] = {}


async def broadcast_to_session(session_id: str, message: dict, exclude_user_id: str | None = None) -> None:
    """Send a message to all connected users in a session."""
    if session_id not in _active_connections:
        return

    data = orjson.dumps(message)
    for uid, ws in _active_connections[session_id].items():
        if uid != exclude_user_id:
            try:
                await ws.send_text(data.decode("utf-8"))
            except Exception:
                pass

    # Also publish to Redis for cross-process fanout
    redis = get_redis()
    await publish(redis, CHANNEL_COLLAB_SESSION.format(session_id=session_id), message)


@ws_router.websocket("/ws/v1/collaboration/{session_id}")
async def collaboration_ws(websocket: WebSocket, session_id: str, token: str):
    """Real-time collaboration WebSocket endpoint."""
    # Validate JWT
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001)
            return
    except Exception:
        await websocket.close(code=4001)
        return

    await websocket.accept()

    # Register connection
    if session_id not in _active_connections:
        _active_connections[session_id] = {}
        _active_presence[session_id] = {}

    _active_connections[session_id][user_id] = websocket
    _active_presence[session_id][user_id] = {
        "user_id": user_id,
        "joined_at": datetime.now(timezone.utc).isoformat(),
        "cursor": None,
    }

    # Broadcast join
    await broadcast_to_session(
        session_id,
        {"type": "user_joined", "user_id": user_id, "timestamp": datetime.now(timezone.utc).isoformat()},
        exclude_user_id=user_id,
    )

    # Send current session state to the new joiner
    current_users = list(_active_presence.get(session_id, {}).keys())
    await websocket.send_text(orjson.dumps({
        "type": "session_state",
        "users": current_users,
        "session_id": session_id,
    }).decode("utf-8"))

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = orjson.loads(raw)
            except Exception:
                continue

            msg_type = msg.get("type", "")

            if msg_type == "ping":
                await websocket.send_text(orjson.dumps({"type": "pong"}).decode("utf-8"))

            elif msg_type == "cursor_move":
                position = msg.get("position", {})
                if user_id in _active_presence.get(session_id, {}):
                    _active_presence[session_id][user_id]["cursor"] = position
                await broadcast_to_session(
                    session_id,
                    {"type": "cursor_update", "user_id": user_id, "position": position, "selection": msg.get("selection")},
                    exclude_user_id=user_id,
                )

            elif msg_type == "text_edit":
                ops = msg.get("ops", [])
                base_version = msg.get("base_version", 0)
                # Broadcast to all other users
                await broadcast_to_session(
                    session_id,
                    {
                        "type": "text_applied",
                        "ops": ops,
                        "new_version": base_version + 1,
                        "user_id": user_id,
                        "local_id": msg.get("local_id", ""),
                    },
                    exclude_user_id=user_id,
                )
                # Ack to sender
                await websocket.send_text(orjson.dumps({
                    "type": "text_ack",
                    "local_id": msg.get("local_id", ""),
                    "applied_version": base_version + 1,
                }).decode("utf-8"))

            elif msg_type == "ai_suggestion_request":
                selection = msg.get("selection", {})
                await websocket.send_text(orjson.dumps({
                    "type": "ai_suggestion",
                    "suggestion_text": "[AI suggestion placeholder]",
                    "for_selection": selection,
                }).decode("utf-8"))

    except WebSocketDisconnect:
        pass
    finally:
        # Cleanup
        if session_id in _active_connections:
            _active_connections[session_id].pop(user_id, None)
            _active_presence.get(session_id, {}).pop(user_id, None)

            if not _active_connections[session_id]:
                del _active_connections[session_id]
                del _active_presence[session_id]
            else:
                await broadcast_to_session(
                    session_id,
                    {"type": "user_left", "user_id": user_id, "timestamp": datetime.now(timezone.utc).isoformat()},
                )
