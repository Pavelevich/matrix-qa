from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from bson import ObjectId

from mongodb_config import users_collection
from .auth_routes import get_current_user


router = APIRouter(tags=["history"])


class HistoryItem(BaseModel):
    title: str
    content: str
    model: Optional[str] = None
    instructions: Optional[str] = None


@router.get("/")
async def get_history(current_user: dict = Depends(get_current_user)):
    user_doc = await users_collection.find_one({"username": current_user["username"]})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    history = user_doc.get("history", [])

    for item in history:
        if "_id" in item:
            item["_id"] = str(item["_id"])


    history.sort(key=lambda x: x.get("timestamp", datetime.min), reverse=True)

    return {"success": True, "history": history}


@router.post("/")
async def save_to_history(history_item: HistoryItem, current_user: dict = Depends(get_current_user)):
    if not history_item.content:
        raise HTTPException(status_code=400, detail="Content is required")

    new_item = {
        "_id": ObjectId(),
        "title": history_item.title,
        "content": history_item.content,
        "model": history_item.model,
        "instructions": history_item.instructions,
        "timestamp": datetime.utcnow()
    }

    await users_collection.update_one(
        {"username": current_user["username"]},
        {"$push": {"history": new_item}}
    )

    return {"success": True, "message": "Result saved to history"}


@router.delete("/{history_id}")
async def delete_history_item(history_id: str, current_user: dict = Depends(get_current_user)):
    try:

        result = await users_collection.update_one(
            {"username": current_user["username"]},
            {"$pull": {"history": {"_id": ObjectId(history_id)}}}
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="History item not found")

        return {"success": True, "message": "History item deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting history item: {str(e)}")


@router.delete("/")
async def clear_history(current_user: dict = Depends(get_current_user)):
    await users_collection.update_one(
        {"username": current_user["username"]},
        {"$set": {"history": []}}
    )

    return {"success": True, "message": "History cleared"}