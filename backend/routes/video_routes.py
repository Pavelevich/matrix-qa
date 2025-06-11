
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import io


from mongo_routes.auth_routes import get_current_user


from config import active_sessions

logger = logging.getLogger("video-routes")

router = APIRouter(tags=["video-settings"])

class VideoSettingsRequest(BaseModel):
    resolution: str
    quality: str
    refresh_rate: float
    recording_enabled: bool = False  # NUEVO CAMPO

class VideoSettingsResponse(BaseModel):
    success: bool
    message: str

@router.post("/video-settings", response_model=VideoSettingsResponse)
async def update_video_settings(
    settings: VideoSettingsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update video settings for the current user's sessions including recording

    Args:
        settings: Video settings to apply
        current_user: Current authenticated user

    Returns:
        Success response
    """
    try:
        # Validate resolution format
        if 'x' not in settings.resolution:
            raise HTTPException(status_code=400, detail="Invalid resolution format. Use WIDTHxHEIGHT")

        try:
            width, height = settings.resolution.split('x')
            width, height = int(width), int(height)

            if width < 640 or height < 480 or width > 3840 or height > 2160:
                raise HTTPException(
                    status_code=400,
                    detail="Resolution must be between 640x480 and 3840x2160"
                )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid resolution values")

        # Validate quality
        if settings.quality not in ['high', 'medium', 'low']:
            raise HTTPException(status_code=400, detail="Quality must be 'high', 'medium', or 'low'")

        # Validate refresh rate
        if settings.refresh_rate < 0.1 or settings.refresh_rate > 10.0:
            raise HTTPException(status_code=400, detail="Refresh rate must be between 0.1 and 10.0 seconds")

        # Update video settings for all user sessions
        username = current_user["username"]
        updated_sessions = 0

        for session_id, session_data in active_sessions.items():
            if session_data.get("username") == username:
                # Update video settings in session
                if "video_settings" not in session_data:
                    session_data["video_settings"] = {}

                session_data["video_settings"].update({
                    "resolution": settings.resolution,
                    "quality": settings.quality,
                    "refresh_rate": settings.refresh_rate,
                    "recording_enabled": settings.recording_enabled  # NUEVO CAMPO
                })

                updated_sessions += 1
                logger.info(f"Updated video settings for session {session_id}: {settings.resolution}, {settings.quality}, recording: {settings.recording_enabled}")

        if updated_sessions > 0:
            recording_status = "with recording enabled" if settings.recording_enabled else "with recording disabled"
            message = f"Video settings updated for {updated_sessions} active session(s) {recording_status}"
        else:
            recording_status = "enabled" if settings.recording_enabled else "disabled"
            message = f"Video settings saved (recording {recording_status}, will apply to new sessions)"

        return VideoSettingsResponse(
            success=True,
            message=message
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating video settings: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update video settings")

@router.get("/video-settings")
async def get_video_settings(current_user: dict = Depends(get_current_user)):
    """
    Get current video settings for the user

    Args:
        current_user: Current authenticated user

    Returns:
        Current video settings
    """
    try:
        username = current_user["username"]


        for session_id, session_data in active_sessions.items():
            if session_data.get("username") == username:
                video_settings = session_data.get("video_settings", {})
                if video_settings:
                    return {
                        "success": True,
                        "settings": video_settings
                    }

        default_settings = {
            "resolution": "1920x1080",
            "quality": "high",
            "refresh_rate": 1.0,
            "recording_enabled": False
        }

        return {
            "success": True,
            "settings": default_settings
        }

    except Exception as e:
        logger.error(f"Error getting video settings: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get video settings")


@router.get("/recordings")
async def get_user_recordings(current_user: dict = Depends(get_current_user)):
    """
    Get list of video recordings for the current user
    """
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
                        raise HTTPException(status_code=500, detail="Database not available")

        if db is None:
            raise HTTPException(status_code=500, detail="Database not available")

        username = current_user["username"]

        recordings = await db.execution_videos.find(
            {"username": username},
            {"video_data": 0}
        ).sort("created_at", -1).to_list(length=100)

        for recording in recordings:
            recording["_id"] = str(recording["_id"])

        return {
            "success": True,
            "recordings": recordings
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user recordings: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get recordings")



@router.get("/recordings/{recording_id}/download")
async def download_video_recording(
        recording_id: str,
        current_user: dict = Depends(get_current_user)
):
    """
    Download a specific video recording with correct file type handling
    """
    try:
        from mongodb_config import database
        from bson import ObjectId

        db = database
        username = current_user["username"]

        # Get the specific recording
        recording = await db.execution_videos.find_one({
            "_id": ObjectId(recording_id),
            "username": username
        })

        if not recording:
            raise HTTPException(status_code=404, detail="Recording not found")

        if "video_data" not in recording:
            raise HTTPException(status_code=404, detail="Video data not found")

        video_data = recording["video_data"]


        file_type = recording.get("file_type", "gif")

        # Validate file type
        if file_type not in ["mp4", "gif"]:
            logger.warning(f"Unknown file type '{file_type}' for recording {recording_id}, defaulting to gif")
            file_type = "gif"

        # Generate filename
        session_id = recording.get("session_id", "unknown")
        start_time = recording.get("start_time")
        if start_time:
            if hasattr(start_time, 'strftime'):
                timestamp = start_time.strftime("%Y%m%d_%H%M%S")
            else:
                # Handle string timestamps
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(str(start_time).replace('Z', '+00:00'))
                    timestamp = dt.strftime("%Y%m%d_%H%M%S")
                except:
                    timestamp = "unknown"
        else:
            timestamp = "unknown"

        filename = f"matrix_video_{session_id}_{timestamp}.{file_type}"


        media_type = "video/mp4" if file_type == "mp4" else "image/gif"

        logger.info(f"Downloading {file_type.upper()} video: {filename} ({len(video_data)} bytes)")

        return StreamingResponse(
            io.BytesIO(video_data),
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Length": str(len(video_data))
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading video recording: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to download recording")


@router.get("/ffmpeg-status")
async def check_ffmpeg_status(current_user: dict = Depends(get_current_user)):
    """
    Check if FFmpeg is available for MP4 video creation
    """
    try:
        from services.video_recorder import video_recorder

        return {
            "success": True,
            "ffmpeg_available": video_recorder.ffmpeg_available,
            "default_format": "mp4" if video_recorder.ffmpeg_available else "gif",
            "message": "FFmpeg is available for MP4 videos" if video_recorder.ffmpeg_available else "Only GIF format available (FFmpeg not found)"
        }
    except Exception as e:
        logger.error(f"Error checking FFmpeg status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to check FFmpeg status")

@router.delete("/recordings/{recording_id}")
async def delete_video_recording(
    recording_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a specific video recording

    Args:
        recording_id: Recording ID
        current_user: Current authenticated user

    Returns:
        Success response
    """
    try:

        from mongodb_config import database
        from bson import ObjectId


        db = database

        username = current_user["username"]

        # Delete the recording
        result = await db.execution_videos.delete_one({
            "_id": ObjectId(recording_id),
            "username": username
        })

        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Recording not found")

        return {
            "success": True,
            "message": "Recording deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting video recording: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete recording")