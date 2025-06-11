import os
import logging
import hashlib
from dotenv import load_dotenv

logger = logging.getLogger("matrix-config")

ANTHROPIC_API_KEY = None
OPENAI_API_KEY = None
DEEPSEEK_API_KEY = None
API_KEY = "qa_secret_key"
HARDCODED_FRONTEND_KEY = "qa_secret_key"

JIRA_URL = None
JIRA_USERNAME = None
JIRA_API_TOKEN = None
JIRA_AUTOMATION_LABELS = None

X_SERVER_AVAILABLE = bool(os.environ.get('DISPLAY', ''))

USERS_FILE = "matrix_users.json"
SESSION_TIMEOUT = 3600

DEFAULT_USERS = {
    "admin": {
        "password_hash": hashlib.sha256("admin".encode()).hexdigest(),
        "role": "admin"
    },
    "user": {
        "password_hash": hashlib.sha256("pass1234".encode()).hexdigest(),
        "role": "user"
    }
}

active_tokens = {}
active_sessions = {}
active_connections = {}
screenshot_tasks = {}


def load_environment_variables():
    global ANTHROPIC_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY, API_KEY
    global JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN, JIRA_AUTOMATION_LABELS

    load_dotenv()

    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
    API_KEY = os.getenv("API_KEY", "qa_secret_key")

    JIRA_URL = os.getenv("JIRA_URL", "")
    JIRA_USERNAME = os.getenv("JIRA_USERNAME", "")
    JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN", "")

    jira_labels_env = os.getenv("JIRA_AUTOMATION_LABELS", "")
    if jira_labels_env:
        JIRA_AUTOMATION_LABELS = [label.strip() for label in jira_labels_env.split(",") if label.strip()]
    else:
        JIRA_AUTOMATION_LABELS = [
            "qa-automation",
            "matrix-test",
            "automated-test",
            "automation"
        ]

    if not ANTHROPIC_API_KEY:
        logger.warning("No ANTHROPIC_API_KEY found in environment variables")

    if not OPENAI_API_KEY:
        logger.warning("No OPENAI_API_KEY found in environment variables")

    if not DEEPSEEK_API_KEY:
        logger.warning("No DEEPSEEK_API_KEY found in environment variables")

    if not all([JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN]):
        logger.warning("Jira integration not fully configured")
    else:
        logger.info(f"Jira automation configured with labels: {JIRA_AUTOMATION_LABELS}")

    return {
        "ANTHROPIC_API_KEY": bool(ANTHROPIC_API_KEY),
        "OPENAI_API_KEY": bool(OPENAI_API_KEY),
        "DEEPSEEK_API_KEY": bool(DEEPSEEK_API_KEY),
        "API_KEY": API_KEY != "qa_secret_key",
        "JIRA_INTEGRATION": bool(JIRA_URL and JIRA_USERNAME and JIRA_API_TOKEN),
        "JIRA_AUTOMATION_LABELS": JIRA_AUTOMATION_LABELS
    }


def get_api_key_status():
    return {
        "anthropic": bool(ANTHROPIC_API_KEY),
        "openai": bool(OPENAI_API_KEY),
        "deepseek": bool(DEEPSEEK_API_KEY),
        "jira": bool(JIRA_URL and JIRA_USERNAME and JIRA_API_TOKEN)
    }


def get_jira_automation_config():
    return {
        "enabled": bool(JIRA_URL and JIRA_USERNAME and JIRA_API_TOKEN),
        "url": JIRA_URL,
        "username": JIRA_USERNAME,
        "automation_labels": JIRA_AUTOMATION_LABELS or []
    }


def check_optional_dependencies():
    dependencies = {
        "aiohttp": False,
        "langchain_anthropic": False,
        "langchain_openai": False,
        "langchain_google_genai": False,
        "langchain_mistralai": False
    }

    try:
        import aiohttp
        dependencies["aiohttp"] = True
    except ImportError:
        pass

    try:
        import langchain_anthropic
        dependencies["langchain_anthropic"] = True
    except ImportError:
        pass

    try:
        import langchain_openai
        dependencies["langchain_openai"] = True
    except ImportError:
        pass

    try:
        import langchain_google_genai
        dependencies["langchain_google_genai"] = True
    except ImportError:
        pass

    try:
        import langchain_mistralai
        dependencies["langchain_mistralai"] = True
    except ImportError:
        pass

    return dependencies