import uuid
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException

import auth
from config import active_sessions
from models.schemas import TestTask
from services.ai_providers import test_api_connection
from services.test_runner import execute_test
from routes.websocket_routes import websocket_manager

router = APIRouter(tags=["tasks"])
logger = logging.getLogger("task-routes")


async def verify_access(
        api_key: str = Depends(auth.verify_api_key),
        user: str = Depends(auth.get_token_username)
):
    if not api_key and not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True


@router.post("/test-api-connection")
async def api_connection_test(test_data: dict):
    try:
        provider = test_data.get("provider", "anthropic")
        api_key = test_data.get("api_key", "")
        model = test_data.get("model")
        use_default_key = test_data.get("use_default_key", False)

        result = await test_api_connection(
            provider=provider,
            api_key=api_key,
            model=model,
            use_default_key=use_default_key
        )
        return result
    except Exception as e:
        return {
            "success": False,
            "message": f"Connection error: {str(e)}"
        }


@router.post("/sessions/{session_id}/tasks", dependencies=[Depends(verify_access)])
async def create_task(
        session_id: str,
        task: TestTask,
        current_user: str = Depends(auth.get_token_username)
):
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user and active_sessions[session_id].get("username") != current_user:
        raise HTTPException(status_code=403, detail="Not authorized to access this session")

    task_id = str(uuid.uuid4())
    task_data = {
        "id": task_id,
        "instructions": task.instructions,
        "browser_visible": task.browser_visible,
        "capture_interval": task.capture_interval,
        "api_provider": task.api_provider,
        "api_model": task.api_model,
        "api_key": task.api_key,
        "use_default_key": task.use_default_key,
        "status": "pending"
    }

    active_sessions[session_id]["tasks"].append(task_data)

    asyncio.create_task(execute_test(
        session_id=session_id,
        task_id=task_id,
        instructions=task.instructions,
        browser_visible=task.browser_visible,
        capture_interval=task.capture_interval,
        api_provider=task.api_provider,
        api_model=task.api_model,
        api_key=task.api_key,
        use_default_key=task.use_default_key,
        websocket_manager=websocket_manager
    ))

    return {"session_id": session_id, "task_id": task_id}


@router.get("/sessions/{session_id}/tasks/{task_id}", dependencies=[Depends(verify_access)])
async def get_task(
        session_id: str,
        task_id: str,
        current_user: str = Depends(auth.get_token_username)
):
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user and active_sessions[session_id].get("username") != current_user:
        raise HTTPException(status_code=403, detail="Not authorized to access this session")

    session = active_sessions[session_id]
    for task_item in session["tasks"]:
        if task_item["id"] == task_id:
            return task_item

    raise HTTPException(status_code=404, detail="Task not found")


@router.post("/sessions/{session_id}/tasks/{task_id}/stop", dependencies=[Depends(verify_access)])
async def stop_task(
        session_id: str,
        task_id: str,
        current_user: str = Depends(auth.get_token_username)
):
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user and active_sessions[session_id].get("username") != current_user:
        raise HTTPException(status_code=403, detail="Not authorized to access this session")

    session = active_sessions[session_id]
    task_found = False

    for task_item in session["tasks"]:
        if task_item["id"] == task_id:
            task_found = True
            if task_item["status"] == "running":
                task_item["status"] = "stopped"
                if websocket_manager:
                    await websocket_manager.broadcast_to_session(session_id, {
                        "type": "task_error",
                        "task_id": task_id,
                        "status": "stopped",
                        "error": "Task manually stopped by user"
                    })
                return {"message": "Task stopped successfully"}
            else:
                raise HTTPException(status_code=400, detail="Task is not running")

    if not task_found:
        raise HTTPException(status_code=404, detail="Task not found")