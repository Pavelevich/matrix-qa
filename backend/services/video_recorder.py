
import asyncio
import base64
import io
import logging
import os
import tempfile
import time
from datetime import datetime
from typing import Dict, List, Optional, Any
from PIL import Image
import subprocess
import threading
from datetime import datetime, timezone

logger = logging.getLogger("video-recorder")


class VideoRecorder:
    def __init__(self):
        self.active_recordings: Dict[str, Dict[str, Any]] = {}
        self.temp_dir = tempfile.mkdtemp(prefix="matrix_video_")
        self.ffmpeg_available = self._check_ffmpeg()

    def _check_ffmpeg(self) -> bool:
        """Check if FFmpeg is available"""
        try:
            subprocess.run(['ffmpeg', '-version'],
                           capture_output=True, check=True)
            logger.info("FFmpeg is available for video recording")
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            logger.warning("FFmpeg not found. Video recording will use GIF fallback")
            return False

    async def start_recording(self, session_id: str, video_settings: Dict[str, Any],
                              username: str, task_id: str = None) -> bool:
        """
        Start recording for a session

        Args:
            session_id: Session ID
            video_settings: Video configuration
            username: User who owns the recording
            task_id: Optional task ID for association

        Returns:
            Success status
        """
        try:
            if session_id in self.active_recordings:
                logger.warning(f"Recording already active for session {session_id}")
                return False

            recording_data = {
                "session_id": session_id,
                "username": username,
                "task_id": task_id,
                "start_time": datetime.now(timezone.utc),
                "frames": [],
                "frame_count": 0,
                "video_settings": video_settings,
                "temp_folder": os.path.join(self.temp_dir, f"session_{session_id}_{int(time.time())}"),
                "recording": True
            }

            # Create temporary folder for frames
            os.makedirs(recording_data["temp_folder"], exist_ok=True)

            self.active_recordings[session_id] = recording_data

            logger.info(f"Started video recording for session {session_id}, user: {username}")
            return True

        except Exception as e:
            logger.error(f"Error starting video recording: {str(e)}")
            return False

    async def add_frame(self, session_id: str, frame_data: str) -> bool:
        """
        Add a frame to the recording

        Args:
            session_id: Session ID
            frame_data: Base64 encoded image data

        Returns:
            Success status
        """
        try:
            if session_id not in self.active_recordings:
                return False

            recording = self.active_recordings[session_id]
            if not recording["recording"]:
                return False

            # Extract image data from data URL
            if frame_data.startswith('data:image/'):
                # Remove data URL prefix
                header, image_data = frame_data.split(',', 1)
                image_bytes = base64.b64decode(image_data)
            else:
                image_bytes = base64.b64decode(frame_data)

            # Save frame as image file
            frame_filename = f"frame_{recording['frame_count']:06d}.png"
            frame_path = os.path.join(recording["temp_folder"], frame_filename)

            with open(frame_path, 'wb') as f:
                f.write(image_bytes)

            recording["frames"].append({
                "filename": frame_filename,
                "timestamp": datetime.now(timezone.utc),
                "frame_number": recording["frame_count"]
            })

            recording["frame_count"] += 1

            # Limit frame storage to prevent excessive disk usage
            if recording["frame_count"] > 10000:  # ~5 hours at 0.5s intervals
                await self._cleanup_old_frames(recording)

            return True

        except Exception as e:
            logger.error(f"Error adding frame to recording: {str(e)}")
            return False

    async def stop_recording(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Stop recording and generate video file

        Args:
            session_id: Session ID

        Returns:
            Recording metadata or None if failed
        """
        try:
            if session_id not in self.active_recordings:
                logger.warning(f"No active recording found for session {session_id}")
                return None

            recording = self.active_recordings[session_id]
            recording["recording"] = False
            recording["end_time"] = datetime.now(timezone.utc)

            logger.info(f"Stopping recording for session {session_id}, captured {recording['frame_count']} frames")

            # Generate video file
            video_result = await self._generate_video(recording)

            if video_result:
                video_data, file_type = video_result  # Now returns tuple (data, type)

                recording["video_data"] = video_data
                recording["video_size"] = len(video_data)
                recording["duration"] = (recording["end_time"] - recording["start_time"]).total_seconds()
                recording["file_type"] = file_type  # IMPORTANT: Set the file type

                # Cleanup temporary files
                await self._cleanup_temp_files(recording["temp_folder"])

                # Remove from active recordings
                completed_recording = self.active_recordings.pop(session_id)

                return {
                    "session_id": session_id,
                    "username": completed_recording["username"],
                    "task_id": completed_recording.get("task_id"),
                    "start_time": completed_recording["start_time"],
                    "end_time": completed_recording["end_time"],
                    "duration": completed_recording["duration"],
                    "frame_count": completed_recording["frame_count"],
                    "video_data": completed_recording["video_data"],
                    "video_size": completed_recording["video_size"],
                    "video_settings": completed_recording["video_settings"],
                    "file_type": completed_recording["file_type"]  # Include file type
                }
            else:
                logger.error(f"Failed to generate video for session {session_id}")
                return None

        except Exception as e:
            logger.error(f"Error stopping recording: {str(e)}")
            return None

    async def _generate_video(self, recording: Dict[str, Any]) -> Optional[tuple]:
        """Generate video from captured frames - Returns (video_data, file_type)"""
        try:
            if recording["frame_count"] < 2:
                logger.warning("Not enough frames to create video")
                return None

            temp_folder = recording["temp_folder"]
            video_settings = recording["video_settings"]

            # Try FFmpeg first for MP4
            if self.ffmpeg_available:
                logger.info("Attempting to create MP4 video with FFmpeg")
                mp4_result = await self._create_mp4_video(recording)
                if mp4_result:
                    logger.info("Successfully created MP4 video")
                    return (mp4_result, "mp4")
                else:
                    logger.warning("FFmpeg failed, falling back to GIF")
            else:
                logger.info("FFmpeg not available, using GIF fallback")

            # Fallback to GIF
            gif_result = await self._create_gif_fallback(recording)
            if gif_result:
                logger.info("Successfully created GIF video")
                return (gif_result, "gif")
            else:
                logger.error("Both MP4 and GIF creation failed")
                return None

        except Exception as e:
            logger.error(f"Error generating video: {str(e)}")
            return None

    async def _create_mp4_video(self, recording: Dict[str, Any]) -> Optional[bytes]:
        """Create MP4 video using FFmpeg"""
        try:
            temp_folder = recording["temp_folder"]
            video_settings = recording["video_settings"]

            # Output video file
            video_filename = f"output_video_{int(time.time())}.mp4"
            video_path = os.path.join(temp_folder, video_filename)

            fps = max(0.5, 1.0 / video_settings.get("refresh_rate", 1.0))  # Ensure minimum FPS

            ffmpeg_cmd = [
                'ffmpeg', '-y',  # Overwrite output file
                '-framerate', str(fps),
                '-i', os.path.join(temp_folder, 'frame_%06d.png'),
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-crf', '18',  # High quality
                '-preset', 'fast',  # Faster encoding
                '-movflags', '+faststart',  # Web optimization
                video_path
            ]

            logger.info(f"Running FFmpeg command: {' '.join(ffmpeg_cmd)}")

            # Run FFmpeg with proper error handling
            def run_ffmpeg():
                try:
                    result = subprocess.run(
                        ffmpeg_cmd,
                        capture_output=True,
                        check=True,
                        timeout=300,
                        text=True
                    )
                    return True, result.stderr
                except subprocess.TimeoutExpired:
                    logger.error("FFmpeg timeout during video generation")
                    return False, "Timeout"
                except subprocess.CalledProcessError as e:
                    logger.error(f"FFmpeg error: {e.stderr}")
                    return False, e.stderr
                except Exception as e:
                    logger.error(f"FFmpeg execution error: {str(e)}")
                    return False, str(e)

            # Use asyncio to run FFmpeg without blocking
            import asyncio
            loop = asyncio.get_event_loop()
            success, error_msg = await loop.run_in_executor(None, run_ffmpeg)

            if success and os.path.exists(video_path):
                with open(video_path, 'rb') as f:
                    video_data = f.read()

                # Clean up the video file
                try:
                    os.remove(video_path)
                except Exception as e:
                    logger.warning(f"Could not remove temporary video file: {e}")

                logger.info(f"MP4 video created successfully, size: {len(video_data)} bytes")
                return video_data
            else:
                logger.error(f"FFmpeg failed to generate video file: {error_msg}")
                return None

        except Exception as e:
            logger.error(f"Error creating MP4 video: {str(e)}")
            return None

    async def _create_gif_fallback(self, recording: Dict[str, Any]) -> Optional[bytes]:
        """Create animated GIF as fallback when FFmpeg is not available"""
        try:
            temp_folder = recording["temp_folder"]
            video_settings = recording["video_settings"]

            images = []
            frame_files = sorted([f for f in os.listdir(temp_folder) if f.startswith('frame_')])

            if not frame_files:
                logger.error("No frame files found for GIF creation")
                return None

            # Limit frames for GIF (max 100 frames to keep size reasonable)
            if len(frame_files) > 100:
                step = len(frame_files) // 100
                frame_files = frame_files[::step]
                logger.info(f"Reduced frames from {len(recording['frames'])} to {len(frame_files)} for GIF")

            for frame_file in frame_files:
                frame_path = os.path.join(temp_folder, frame_file)
                if os.path.exists(frame_path):
                    try:
                        image = Image.open(frame_path)
                        # Resize to reduce file size
                        if image.width > 800:
                            ratio = 800 / image.width
                            new_height = int(image.height * ratio)
                            image = image.resize((800, new_height), Image.Resampling.LANCZOS)
                        images.append(image)
                    except Exception as e:
                        logger.warning(f"Could not process frame {frame_file}: {e}")
                        continue

            if images:

                gif_path = os.path.join(temp_folder, 'output.gif')
                duration = max(500, int(video_settings.get("refresh_rate", 1.0) * 1000))  # Convert to milliseconds, minimum 500ms

                images[0].save(
                    gif_path,
                    save_all=True,
                    append_images=images[1:],
                    duration=duration,
                    loop=0,
                    optimize=True
                )

                with open(gif_path, 'rb') as f:
                    gif_data = f.read()


                try:
                    os.remove(gif_path)
                except Exception as e:
                    logger.warning(f"Could not remove temporary GIF file: {e}")

                logger.info(f"GIF created successfully, size: {len(gif_data)} bytes")
                return gif_data

            logger.error("No valid images found for GIF creation")
            return None

        except Exception as e:
            logger.error(f"Error creating GIF fallback: {str(e)}")
            return None

    async def _cleanup_old_frames(self, recording: Dict[str, Any]):
        """Remove old frames to prevent excessive disk usage"""
        try:
            frames_to_remove = recording["frames"][:1000]  # Remove oldest 1000 frames

            for frame_info in frames_to_remove:
                frame_path = os.path.join(recording["temp_folder"], frame_info["filename"])
                if os.path.exists(frame_path):
                    os.remove(frame_path)

            recording["frames"] = recording["frames"][1000:]
            logger.info(f"Cleaned up old frames for session {recording['session_id']}")

        except Exception as e:
            logger.error(f"Error cleaning up old frames: {str(e)}")

    async def _cleanup_temp_files(self, temp_folder: str):
        """Clean up temporary files"""
        try:
            if os.path.exists(temp_folder):
                for file in os.listdir(temp_folder):
                    file_path = os.path.join(temp_folder, file)
                    if os.path.isfile(file_path):
                        os.remove(file_path)
                os.rmdir(temp_folder)
                logger.info(f"Cleaned up temporary folder: {temp_folder}")
        except Exception as e:
            logger.error(f"Error cleaning up temp files: {str(e)}")

    def get_recording_status(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get recording status for a session"""
        if session_id in self.active_recordings:
            recording = self.active_recordings[session_id]
            return {
                "recording": recording["recording"],
                "frame_count": recording["frame_count"],
                "start_time": recording["start_time"],
                "duration": (datetime.now(timezone.utc) - recording["start_time"]).total_seconds()
            }
        return None


# Global instance
video_recorder = VideoRecorder()