import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException

import auth
from config import active_sessions, API_KEY, HARDCODED_FRONTEND_KEY
from models.schemas import SessionInfo

router = APIRouter(tags=["sessions"])
logger = logging.getLogger("session-routes")


async def verify_access(
        api_key: str = Depends(auth.verify_api_key),
        user: str = Depends(auth.get_token_username)
):
    if not api_key and not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True


@router.post("/sessions", dependencies=[Depends(verify_access)])
async def create_session(current_user: str = Depends(auth.get_token_username)):
    session_id = str(uuid.uuid4())
    active_sessions[session_id] = {
        "browser": None,
        "controller": None,
        "status": "ready",
        "tasks": [],
        "capture_enabled": False,
        "last_screenshot": None,
        "username": current_user
    }
    return {"session_id": session_id}


@router.get("/sessions/{session_id}", dependencies=[Depends(verify_access)], response_model=SessionInfo)
async def get_session(
        session_id: str,
        current_user: str = Depends(auth.get_token_username)
):
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user and active_sessions[session_id].get("username") != current_user:
        raise HTTPException(status_code=403, detail="Not authorized to access this session")

    session = active_sessions[session_id]
    return {
        "session_id": session_id,
        "status": session["status"],
        "username": session.get("username", "anonymous"),
        "capture_enabled": session.get("capture_enabled", False),
        "tasks": session.get("tasks", [])
    }


@router.delete("/sessions/{session_id}", dependencies=[Depends(verify_access)])
async def delete_session(
        session_id: str,
        current_user: str = Depends(auth.get_token_username)
):
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user and active_sessions[session_id].get("username") != current_user:
        raise HTTPException(status_code=403, detail="Not authorized to access this session")

    session = active_sessions[session_id]
    if session.get("browser"):
        try:
            await session["browser"].close()
        except Exception as e:
            pass

    del active_sessions[session_id]

    return {"message": "Session closed successfully"}