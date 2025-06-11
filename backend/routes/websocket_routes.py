import asyncio
import json
import logging
from typing import Dict, List, Any, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from config import active_sessions, active_connections, screenshot_tasks
from utils.helpers import sanitize_message_for_json
from services.screenshot import take_screenshot
from services.video_recorder import video_recorder

router = APIRouter(tags=["websockets"])
logger = logging.getLogger("websocket-routes")


class WebSocketManager:
    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()

        if session_id not in active_sessions:
            await websocket.close(code=4000, reason="Invalid session")
            return False

        if session_id not in active_connections:
            active_connections[session_id] = []
        active_connections[session_id].append(websocket)

        return True

    async def connect_screenshot(self, websocket: WebSocket, session_id: str):
        await websocket.accept()

        if session_id not in active_sessions:
            await websocket.close(code=4000, reason="Invalid session")
            return False

        if f"screenshot_{session_id}" in active_connections:
            await websocket.close(code=4001, reason="A capture connection already exists for this session")
            return False

        active_connections[f"screenshot_{session_id}"] = websocket
        return True



    async def disconnect(self, websocket: WebSocket, session_id: str):
        if session_id in active_connections and websocket in active_connections[session_id]:
            active_connections[session_id].remove(websocket)
            if not active_connections[session_id]:
                del active_connections[session_id]


                recording_data = await video_recorder.stop_recording(session_id)
                if recording_data:
                    logger.info(f"Auto-stopped recording for disconnected session {session_id}")
                    await self._save_video_to_database(recording_data)

                await self.stop_screenshot_stream(session_id)

    async def disconnect_screenshot(self, session_id: str):
        if f"screenshot_{session_id}" in active_connections:
            del active_connections[f"screenshot_{session_id}"]


            recording_data = await video_recorder.stop_recording(session_id)
            if recording_data:
                logger.info(f"Auto-stopped recording for screenshot disconnect {session_id}")
                await self._save_video_to_database(recording_data)

    async def broadcast_to_session(self, session_id: str, message: Dict[str, Any]):
        if session_id in active_connections:
            websockets = active_connections[session_id]

            if message.get("type") == "task_complete" and "result" in message:
                for task in active_sessions[session_id].get("tasks", []):
                    if task.get("id") == message.get("task_id") and task.get("result"):
                        if message["result"] == "Task completed successfully." and len(task.get("result")) > len(
                                message["result"]):
                            message["result"] = task["result"]
                            if task.get("structured_logs") and not message.get("structured_logs"):
                                message["structured_logs"] = task.get("structured_logs")
                            break
                if message.get("raw_result") and not message.get("formatted_output"):
                    message["formatted_output"] = self._format_output_for_display(
                        message.get("raw_result", ""),
                        message.get("structured_logs", [])
                    )

            sanitized_message = sanitize_message_for_json(message)

            for websocket in websockets[:]:
                try:
                    await websocket.send_json(sanitized_message)
                except Exception as e:
                    if websocket in active_connections[session_id]:
                        active_connections[session_id].remove(websocket)

    def _format_output_for_display(self, raw_output: str, structured_logs: List[Dict[str, str]]) -> str:
        if structured_logs:
            formatted_lines = []
            for entry in structured_logs:
                icon = entry.get("icon", "")
                text = entry.get("text", "")
                entry_type = entry.get("type", "info")

                if entry_type == "result":
                    formatted_lines.append(f"{icon} RESULT: {text}")
                elif entry_type == "goal":
                    formatted_lines.append(f"{icon} GOAL: {text}")
                elif entry_type == "action":
                    if text.startswith("{"):
                        try:
                            action_data = json.loads(text)
                            if "done" in action_data and "text" in action_data["done"]:
                                text = action_data["done"]["text"]
                            formatted_lines.append(f"{icon} ACTION: {text}")
                        except json.JSONDecodeError:
                            formatted_lines.append(f"{icon} ACTION: {text}")
                    else:
                        formatted_lines.append(f"{icon} ACTION: {text}")
                elif entry_type == "success":
                    formatted_lines.append(f"{icon} SUCCESS: {text}")
                elif entry_type == "error":
                    formatted_lines.append(f"{icon} ERROR: {text}")
                elif entry_type == "memory":
                    if len(text) > 100:
                        text = text[:97] + "..."
                    formatted_lines.append(f"{icon} MEMORY: {text}")
                else:
                    formatted_lines.append(f"{icon} {text}")
            return "\n".join(formatted_lines)
        return raw_output

    async def start_screenshot_stream(self, session_id: str, interval: float = 1.0):
        """
        Start screenshot streaming for a session

        Args:
            session_id: Session ID
            interval: Screenshot capture interval in seconds (can be overridden by video settings)
        """
        if session_id in screenshot_tasks and not screenshot_tasks[session_id].done():
            return  # Already running

        # Get video settings from session if available
        session_data = active_sessions.get(session_id, {})
        video_settings = session_data.get("video_settings", {})

        # Use refresh rate from video settings if available, otherwise use provided interval
        if "refresh_rate" in video_settings:
            interval = video_settings["refresh_rate"]
            logger.info(f"Using video settings refresh rate: {interval}s for session {session_id}")

        active_sessions[session_id]["capture_enabled"] = True

        # Start video recording if enabled
        recording_enabled = video_settings.get("recording_enabled", False)
        if recording_enabled:
            username = session_data.get("username", "unknown")
            task_id = session_data.get("current_task_id")

            recording_started = await video_recorder.start_recording(
                session_id=session_id,
                video_settings=video_settings,
                username=username,
                task_id=task_id
            )

            if recording_started:
                logger.info(f"Video recording started for session {session_id}")
                await self.broadcast_to_session(session_id, {
                    "type": "recording_status",
                    "status": "started",
                    "message": "Video recording started"
                })
            else:
                logger.error(f"Failed to start video recording for session {session_id}")

        screenshot_tasks[session_id] = asyncio.create_task(self._screenshot_loop(session_id, interval))

        await self.broadcast_to_session(session_id, {
            "type": "capture_status",
            "status": "started",
            "refresh_rate": interval,
            "recording_enabled": recording_enabled
        })

    async def update_video_settings(self, session_id: str, video_settings: dict):
        """
        Update video settings for an active session

        Args:
            session_id: Session ID
            video_settings: New video settings
        """
        if session_id in active_sessions:
            if "video_settings" not in active_sessions[session_id]:
                active_sessions[session_id]["video_settings"] = {}

            active_sessions[session_id]["video_settings"].update(video_settings)


            if ("refresh_rate" in video_settings and
                    session_id in screenshot_tasks and
                    not screenshot_tasks[session_id].done()):
                # Stop current capture
                await self.stop_screenshot_stream(session_id)

                # Start with new refresh rate
                await self.start_screenshot_stream(session_id, video_settings["refresh_rate"])

            await self.broadcast_to_session(session_id, {
                "type": "video_settings_updated",
                "settings": video_settings
            })

    async def stop_screenshot_stream(self, session_id: str):
        if session_id in screenshot_tasks and not screenshot_tasks[session_id].done():
            active_sessions[session_id]["capture_enabled"] = False
            screenshot_tasks[session_id].cancel()

            # Stop video recording if active
            recording_data = await video_recorder.stop_recording(session_id)
            if recording_data:
                logger.info(f"Video recording stopped for session {session_id}")

                # Save video to database
                await self._save_video_to_database(recording_data)

                await self.broadcast_to_session(session_id, {
                    "type": "recording_status",
                    "status": "stopped",
                    "message": "Video recording saved successfully"
                })

            await self.broadcast_to_session(session_id, {
                "type": "capture_status",
                "status": "stopped"
            })

    async def _screenshot_loop(self, session_id: str, interval: float):
        try:
            while active_sessions[session_id]["capture_enabled"]:
                if f"screenshot_{session_id}" in active_connections:
                    screenshot = await take_screenshot(session_id, active_sessions[session_id])
                    if screenshot:
                        active_sessions[session_id]["last_screenshot"] = screenshot

                        # Add frame to video recording if active
                        if video_recorder.get_recording_status(session_id):
                            await video_recorder.add_frame(session_id, screenshot)

                        websocket = active_connections[f"screenshot_{session_id}"]
                        await websocket.send_text(screenshot)
                await asyncio.sleep(interval)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            pass

    async def _save_video_to_database(self, recording_data: Dict[str, Any]):
        """Save video recording to database with correct file_type"""
        try:

            db = None


            try:
                from mongodb_config import get_database
                db = await get_database()
            except (ImportError, AttributeError):
                try:
                    from mongodb_config import get_db
                    db = await get_db()
                except (ImportError, AttributeError):
                    try:
                        from mongodb_config import database
                        db = database
                    except (ImportError, AttributeError):
                        try:
                            from mongodb_config import db as database_instance
                            db = database_instance
                        except (ImportError, AttributeError):
                            logger.error("No database connection method found")
                            return

            if db is not None:

                file_type = recording_data.get("file_type", "gif")

                video_record = {
                    "session_id": recording_data["session_id"],
                    "username": recording_data["username"],
                    "task_id": recording_data.get("task_id"),
                    "start_time": recording_data["start_time"],
                    "end_time": recording_data["end_time"],
                    "duration": recording_data["duration"],
                    "frame_count": recording_data["frame_count"],
                    "video_size": recording_data["video_size"],
                    "video_settings": recording_data["video_settings"],
                    "video_data": recording_data["video_data"],
                    "created_at": recording_data["end_time"],
                    "file_type": file_type
                }

                result = await db.execution_videos.insert_one(video_record)
                logger.info(f"Video saved to database for session {recording_data['session_id']} "
                            f"as {file_type.upper()} format (ID: {result.inserted_id})")
            else:
                logger.error("Database not available, video not saved")

        except Exception as e:
            logger.error(f"Error saving video to database: {str(e)}")

websocket_manager = WebSocketManager()

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    if not await websocket_manager.connect(websocket, session_id):
        return

    try:
        await websocket.send_json({
            "type": "session_status",
            "session_id": session_id,
            "status": active_sessions[session_id]["status"],
            "tasks": active_sessions[session_id]["tasks"]
        })
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message["type"] == "ping":
                await websocket.send_json({"type": "pong"})
            elif message["type"] == "start_capture":
                await websocket_manager.start_screenshot_stream(session_id, message.get("interval", 1.0))
            elif message["type"] == "stop_capture":
                await websocket_manager.stop_screenshot_stream(session_id)
            elif message["type"] == "update_video_settings":
                video_settings = message.get("settings", {})
                await websocket_manager.update_video_settings(session_id, video_settings)
            elif message["type"] == "get_recording_status":
                recording_status = video_recorder.get_recording_status(session_id)
                if recording_status:
                    await websocket.send_json({
                        "type": "recording_status_response",
                        "status": "active",
                        "frame_count": recording_status["frame_count"],
                        "duration": recording_status["duration"]
                    })
                else:
                    await websocket.send_json({
                        "type": "recording_status_response",
                        "status": "inactive"
                    })
    except WebSocketDisconnect:
        await websocket_manager.disconnect(websocket, session_id)
    except Exception as e:
        await websocket_manager.disconnect(websocket, session_id)

@router.websocket("/ws/screenshot/{session_id}")
async def screenshot_websocket(websocket: WebSocket, session_id: str):
    if not await websocket_manager.connect_screenshot(websocket, session_id):
        return

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await websocket_manager.disconnect_screenshot(session_id)
    except Exception as e:
        await websocket_manager.disconnect_screenshot(session_id)