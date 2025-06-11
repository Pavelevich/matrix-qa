import json
import logging
import re
from typing import Any, Dict, List, Union

logger = logging.getLogger("matrix-utils")


def is_json_serializable(obj: Any) -> bool:
    if isinstance(obj, (str, int, float, bool, type(None))):
        return True
    elif isinstance(obj, (list, tuple)):
        return all(is_json_serializable(item) for item in obj)
    elif isinstance(obj, dict):
        return all(isinstance(k, str) and is_json_serializable(v) for k, v in obj.items())
    else:
        return False


def sanitize_message_for_json(message: Dict[str, Any]) -> Dict[str, Any]:
    try:
        json.dumps(message)
        return message
    except TypeError as e:
        logger.warning(f"Non-serializable data in message, converting to strings: {str(e)}")
        result = {}
        for key, value in message.items():
            if not is_json_serializable(value):
                result[key] = str(value)
            else:
                result[key] = value
        return result


def extract_task_status(text: str) -> Dict[str, str]:
    cleaned_text = text.replace("[Step undefined]", "")
    cleaned_text = re.sub(r"Task started\. ID:.*", "", cleaned_text)
    cleaned_text = cleaned_text.replace("Navigate to the specified URL:", "Navigating to:")
    cleaned_text = cleaned_text.strip()

    action_type = "info"
    if "navigate" in cleaned_text.lower():
        action_type = "navigate"
    elif any(keyword in cleaned_text.lower() for keyword in ["click", "accept", "submit", "fill", "type"]):
        action_type = "action"
    elif any(keyword in cleaned_text.lower() for keyword in ["check", "examine", "find", "verify", "confirm"]):
        action_type = "check"

    return {
        "text": cleaned_text,
        "type": action_type
    }


def format_test_result_for_download(
        result: str,
        task_info: Dict[str, Any]
) -> str:
    from datetime import datetime

    date = datetime.now().isoformat().replace(':', '-').replace('.', '-')[:19]
    metadata = [
        "==== MATRIX QA TEST RUNNER - EXECUTION RESULT ====",
        f"Date: {date}",
        f"Instructions: {task_info.get('instructions', 'N/A')}",
        f"Model: {task_info.get('provider', 'N/A').upper()} / {task_info.get('model', 'N/A')}",
        "============================================\n\n"
    ]

    return "\n".join(metadata) + result