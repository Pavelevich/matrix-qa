
import base64
import io
import logging
import time
from typing import Optional, Dict, Any
from PIL import Image, ImageDraw, ImageFont

from config import X_SERVER_AVAILABLE

logger = logging.getLogger("screenshot-service")

# Default video settings
DEFAULT_VIDEO_SETTINGS = {
    "resolution": "1920x1080",
    "quality": "high",
    "refresh_rate": 1.0
}


def get_video_settings_from_session(session: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get video settings from session, with fallback to defaults

    Args:
        session: Session data

    Returns:
        Dictionary with video settings
    """
    video_settings = session.get("video_settings", {})

    # Merge with defaults
    settings = DEFAULT_VIDEO_SETTINGS.copy()
    settings.update(video_settings)

    return settings


def parse_resolution(resolution_string: str) -> tuple:
    """
    Parse resolution string to width and height

    Args:
        resolution_string: Resolution in format "WIDTHxHEIGHT"

    Returns:
        Tuple of (width, height)
    """
    try:
        width, height = resolution_string.split('x')
        return int(width), int(height)
    except (ValueError, AttributeError):
        logger.warning(f"Invalid resolution format: {resolution_string}, using default 1920x1080")
        return 1920, 1080


def get_image_format_and_quality(quality_setting: str) -> tuple:
    """
    Get image format and quality based on quality setting

    Args:
        quality_setting: Quality setting ("high", "medium", "low")

    Returns:
        Tuple of (format, quality_options)
    """
    if quality_setting == "high":
        return "PNG", {}
    elif quality_setting == "medium":
        return "JPEG", {"quality": 90, "optimize": True}
    elif quality_setting == "low":
        return "JPEG", {"quality": 70, "optimize": True}
    else:
        return "PNG", {}


async def take_screenshot(session_id: str, session: Dict[str, Any]) -> Optional[str]:
    """
    Take a screenshot of the current browser window or system display with configurable resolution

    Args:
        session_id: Session ID
        session: Session data with browser information and video settings

    Returns:
        Base64 encoded image data URI or None on failure
    """
    try:

        video_settings = get_video_settings_from_session(session)
        target_width, target_height = parse_resolution(video_settings["resolution"])
        image_format, format_options = get_image_format_and_quality(video_settings["quality"])

        logger.info(
            f"Taking screenshot with resolution {target_width}x{target_height}, quality: {video_settings['quality']}")


        browser = session.get("browser")

        if browser and hasattr(browser, "page") and browser.page:
            try:
                logger.info(f"Capturing screenshot from browser in session {session_id}")

                # Set viewport to the configured resolution
                await browser.page.set_viewport_size({"width": target_width, "height": target_height})

                # Take a screenshot with configured quality
                if image_format == "PNG":
                    screenshot_bytes = await browser.page.screenshot(
                        full_page=True,
                        type="png"
                    )
                else:  # JPEG
                    screenshot_bytes = await browser.page.screenshot(
                        full_page=True,
                        type="jpeg",
                        quality=format_options.get("quality", 90)
                    )

                img_str = base64.b64encode(screenshot_bytes).decode('utf-8')
                mime_type = "image/png" if image_format == "PNG" else "image/jpeg"
                return f"data:{mime_type};base64,{img_str}"

            except Exception as browser_error:
                logger.error(f"Error capturing from browser: {str(browser_error)}")

        # 2. Fallback to ImageGrab if X server is available
        if X_SERVER_AVAILABLE:
            try:
                from PIL import ImageGrab
                screenshot = ImageGrab.grab()

                # Resize to target resolution if needed
                if screenshot.width != target_width or screenshot.height != target_height:
                    # Calculate aspect ratio to maintain proportions
                    aspect_ratio = screenshot.width / screenshot.height
                    target_aspect_ratio = target_width / target_height

                    if aspect_ratio > target_aspect_ratio:
                        # Image is wider than target, fit by width
                        new_width = target_width
                        new_height = int(target_width / aspect_ratio)
                    else:
                        # Image is taller than target, fit by height
                        new_height = target_height
                        new_width = int(target_height * aspect_ratio)

                    screenshot = screenshot.resize((new_width, new_height), Image.LANCZOS)

                    # Create a black background with target dimensions
                    final_image = Image.new('RGB', (target_width, target_height), color='black')

                    # Center the resized image on the black background
                    x_offset = (target_width - new_width) // 2
                    y_offset = (target_height - new_height) // 2
                    final_image.paste(screenshot, (x_offset, y_offset))
                    screenshot = final_image

                buffered = io.BytesIO()
                screenshot.save(buffered, format=image_format, **format_options)
                img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
                mime_type = "image/png" if image_format == "PNG" else "image/jpeg"
                return f"data:{mime_type};base64,{img_str}"

            except Exception as grab_error:
                logger.error(f"Error using ImageGrab: {str(grab_error)}")

        # 3. Generate placeholder if no capture method is available
        image = Image.new('RGB', (target_width, target_height), color='black')

        try:
            draw = ImageDraw.Draw(image)

            # Scale font sizes based on resolution
            base_font_size = max(16, target_width // 60)
            small_font_size = max(12, target_width // 80)

            # Use default font
            try:
                font = ImageFont.truetype("FreeMono.ttf", base_font_size)
                small_font = ImageFont.truetype("FreeMono.ttf", small_font_size)
            except:
                font = ImageFont.load_default()
                small_font = ImageFont.load_default()

            # Calculate positions based on resolution
            margin_x = target_width // 8
            margin_y = target_height // 12

            # Title and status
            draw.text((margin_x, margin_y), "MATRIX QA BROWSER MONITOR", fill="green", font=font)
            draw.text((margin_x, margin_y + base_font_size + 10), "Running in headless mode", fill="yellow", font=font)

            # Session info
            y_pos = margin_y + (base_font_size + 10) * 3
            draw.text((margin_x, y_pos), f"Session: {session_id[:8]}...", fill="cyan", font=small_font)
            draw.text((margin_x, y_pos + small_font_size + 5), f"User: {session.get('username', 'unknown')}",
                      fill="cyan", font=small_font)

            # Video settings info
            y_pos += (small_font_size + 5) * 2 + 10
            draw.text((margin_x, y_pos), f"Resolution: {target_width}x{target_height}", fill="magenta", font=small_font)
            draw.text((margin_x, y_pos + small_font_size + 5), f"Quality: {video_settings['quality'].upper()}",
                      fill="magenta", font=small_font)

            # Line separator
            y_pos += (small_font_size + 5) * 2 + 10
            draw.line([(margin_x, y_pos), (target_width - margin_x, y_pos)], fill="green", width=2)

            # Information
            y_pos += 20
            draw.text((margin_x, y_pos), "HEADLESS MODE ACTIVE", fill="magenta", font=small_font)
            draw.text((margin_x, y_pos + small_font_size + 5), "No direct display available", fill="white",
                      font=small_font)

            # Current tasks
            y_pos += (small_font_size + 5) * 3
            draw.text((margin_x, y_pos), "ACTIVE TASKS:", fill="yellow", font=small_font)
            y_pos += small_font_size + 10

            for task in session.get("tasks", []):
                if task["status"] == "running":
                    task_text = f"Task {task['id'][:6]}: {task['instructions'][:40]}..."
                    draw.text((margin_x, y_pos), task_text, fill="white", font=small_font)
                    y_pos += small_font_size + 5

            # Timestamp
            timestamp = f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}"
            draw.text((margin_x, target_height - margin_y), timestamp, fill="white", font=small_font)

        except Exception as text_error:
            logger.warning(f"Error adding text to placeholder: {str(text_error)}")

        # Convert to base64
        buffered = io.BytesIO()
        image.save(buffered, format=image_format, **format_options)
        img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
        mime_type = "image/png" if image_format == "PNG" else "image/jpeg"
        return f"data:{mime_type};base64,{img_str}"

    except Exception as e:
        logger.error(f"Error capturing screenshot: {str(e)}")
        return None