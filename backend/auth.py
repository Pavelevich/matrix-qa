import json
import hashlib
import secrets
import logging
from datetime import datetime, timedelta
import os
from fastapi import Header, Depends, HTTPException
import jwt
from mongodb_config import JWT_SECRET

from config import DEFAULT_USERS, USERS_FILE, active_tokens, SESSION_TIMEOUT, API_KEY, HARDCODED_FRONTEND_KEY

logger = logging.getLogger("matrix-auth")


def verify_api_key(api_key: str = Header(None, alias="X-API-Key")):
    if not api_key:
        return None

    if api_key == API_KEY or api_key == HARDCODED_FRONTEND_KEY:
        return api_key

    return None


def get_token_from_authorization(authorization: str = Header(None)):
    if not authorization:
        return None

    if authorization.startswith("Bearer "):
        return authorization.replace("Bearer ", "")

    return authorization


def get_token_username(authorization: str = Depends(get_token_from_authorization)):
    if not authorization:
        return None

    if token_is_valid(authorization):
        return active_tokens[authorization]["username"]

    try:
        payload = jwt.decode(authorization, JWT_SECRET, algorithms=["HS256"])
        username = payload.get("sub")
        return username
    except jwt.InvalidTokenError:
        logger.debug(f"Invalid JWT token: {authorization[:20]}...")
        return None
    except Exception as e:
        logger.error(f"Error decoding JWT: {str(e)}")
        return None


def verify_access_jwt(
        api_key: str = Header(None, alias="X-API-Key"),
        authorization: str = Header(None)
):
    if api_key and (api_key == API_KEY or api_key == HARDCODED_FRONTEND_KEY):
        return {"type": "api_key", "value": api_key}

    if authorization:
        token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            username = payload.get("sub")
            if username:
                return {"type": "jwt", "username": username, "role": payload.get("role", "user")}
        except jwt.InvalidTokenError:
            pass

    raise HTTPException(
        status_code=401,
        detail="Authentication required. Please provide a valid API key or JWT token."
    )


def load_users():
    try:
        if os.path.exists(USERS_FILE):
            with open(USERS_FILE, 'r') as f:
                return json.load(f)
        else:
            save_users(DEFAULT_USERS)
            return DEFAULT_USERS
    except Exception as e:
        logger.error(f"Error loading users: {str(e)}")
        return DEFAULT_USERS


def save_users(users):
    try:
        with open(USERS_FILE, 'w') as f:
            json.dump(users, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving users: {str(e)}")


def verify_password(username, password):
    users = load_users()
    if username in users:
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        return password_hash == users[username]["password_hash"]
    return False


def generate_token(username):
    token = secrets.token_hex(32)
    expiration = datetime.now() + timedelta(seconds=SESSION_TIMEOUT)
    active_tokens[token] = {
        "username": username,
        "expiration": expiration
    }
    return token


def token_is_valid(token):
    if token in active_tokens:
        if datetime.now() < active_tokens[token]["expiration"]:
            return True
        else:
            del active_tokens[token]
    return False


def get_user_role(username):
    users = load_users()
    if username in users:
        return users[username].get("role", "user")
    return None


def is_admin_user(username):
    return get_user_role(username) == "admin"


def add_user(username, password, role="user", admin_username=None):
    if admin_username and not is_admin_user(admin_username):
        return False, "Only administrators can add users"

    users = load_users()

    if username in users:
        return False, "Username already exists"

    password_hash = hashlib.sha256(password.encode()).hexdigest()

    users[username] = {
        "password_hash": password_hash,
        "role": role
    }

    save_users(users)
    return True, f"User {username} added successfully"


def delete_user(username, admin_username):
    if not is_admin_user(admin_username):
        return False, "Only administrators can delete users"

    users = load_users()

    if username not in users:
        return False, "User not found"

    if username == admin_username:
        return False, "Cannot delete your own account"

    del users[username]
    save_users(users)

    return True, f"User {username} deleted successfully"


def list_users(admin_username):
    if not is_admin_user(admin_username):
        return False, "Only administrators can list users"

    users = load_users()

    user_list = {}
    for username, user_data in users.items():
        user_list[username] = {
            "role": user_data.get("role", "user")
        }

    return True, user_list