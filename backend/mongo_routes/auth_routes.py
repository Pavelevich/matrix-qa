from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import Optional, List, Dict, Any
import jwt
import bcrypt
from datetime import datetime, timedelta
from pydantic import BaseModel
from bson import ObjectId

from mongodb_config import users_collection, JWT_SECRET, encrypt_api_key, decrypt_api_key


class AuthRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    message: Optional[str] = None


class User(BaseModel):
    username: str
    password: str
    role: Optional[str] = "user"


router = APIRouter(tags=["mongodb-auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def serialize_mongo_doc(doc):
    if isinstance(doc, dict):
        return {key: serialize_mongo_doc(value) for key, value in doc.items()}
    elif isinstance(doc, list):
        return [serialize_mongo_doc(item) for item in doc]
    elif isinstance(doc, ObjectId):
        return str(doc)
    else:
        return doc


async def verify_password(username: str, password: str):
    user = await users_collection.find_one({"username": username})
    if not user:
        return False
    return bcrypt.checkpw(password.encode(), user["password"].encode())


def generate_token(username: str, role: str):
    expiration = datetime.utcnow() + timedelta(hours=1)
    payload = {
        "sub": username,
        "role": role,
        "exp": expiration
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        username = payload.get("sub")
        role = payload.get("role", "user")

        user = await users_collection.find_one({"username": username})
        if not user:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")

        return {"username": username, "role": role}
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")


async def get_token_username(authorization: Optional[str] = Header(None)):
    if not authorization:
        return None

    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload.get("sub")
    except:
        return None


@router.post("/authenticate", response_model=AuthResponse)
async def authenticate(auth_request: AuthRequest):
    username = auth_request.username
    password = auth_request.password

    if await verify_password(username, password):
        user = await users_collection.find_one({"username": username})
        token = generate_token(username, user.get("role", "user"))
        return {"success": True, "token": token}
    else:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )


@router.post("/users/add")
async def add_user(user: User, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    existing_user = await users_collection.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    hashed_password = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt()).decode()

    await users_collection.insert_one({
        "username": user.username,
        "password": hashed_password,
        "role": user.role,
        "linked_models": [],
        "history": []
    })

    return {"message": f"User {user.username} created successfully"}


@router.delete("/users/{username}")
async def delete_user(username: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if username == current_user["username"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    result = await users_collection.delete_one({"username": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": f"User {username} deleted successfully"}


@router.get("/users/list")
async def list_users(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    users = []
    async for user in users_collection.find({}, {"password": 0}):
        serialized_user = serialize_mongo_doc(user)
        users.append(serialized_user)

    return users


@router.get("/model-key/{model}")
async def get_api_key(model: str, current_user: dict = Depends(get_current_user)):
    user_doc = await users_collection.find_one({"username": current_user["username"]})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    linked_models = user_doc.get("linked_models", [])
    for linked_model in linked_models:
        if linked_model["model_name"] == model:
            try:
                decrypted_key = decrypt_api_key(linked_model["encrypted_api_key"])
                return {"success": True, "api_key": decrypted_key}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error decrypting API key: {str(e)}")

    return {"success": False, "message": "No API key found for this model"}


@router.post("/model-key")
async def save_api_key(data: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    model_name = data.get("model_name")
    api_key = data.get("api_key")

    if not model_name or not api_key:
        raise HTTPException(status_code=400, detail="Model name and API key are required")

    try:
        encrypted_key = encrypt_api_key(api_key)

        result = await users_collection.update_one(
            {"username": current_user["username"], "linked_models.model_name": model_name},
            {"$set": {"linked_models.$.encrypted_api_key": encrypted_key}}
        )

        if result.modified_count == 0:
            await users_collection.update_one(
                {"username": current_user["username"]},
                {"$push": {"linked_models": {"model_name": model_name, "encrypted_api_key": encrypted_key}}}
            )

        return {"success": True, "message": "API key saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving API key: {str(e)}")


@router.delete("/model-key/{model}")
async def delete_api_key(model: str, current_user: dict = Depends(get_current_user)):
    try:
        await users_collection.update_one(
            {"username": current_user["username"]},
            {"$pull": {"linked_models": {"model_name": model}}}
        )
        return {"success": True, "message": "API key deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting API key: {str(e)}")