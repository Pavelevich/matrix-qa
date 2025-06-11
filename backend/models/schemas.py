"""
Pydantic models for API schemas
"""
from typing import Dict, List, Optional
from pydantic import BaseModel

class User(BaseModel):
    """User model for authentication and user management"""
    username: str
    password: str
    role: Optional[str] = "user"

class AuthRequest(BaseModel):
    """Authentication request model"""
    username: str
    password: str

class AuthResponse(BaseModel):
    """Authentication response model"""
    success: bool
    token: Optional[str] = None
    message: Optional[str] = None

class ApiConnectionTest(BaseModel):
    """API connection test request model"""
    provider: str
    api_key: str
    model: Optional[str] = None
    use_default_key: Optional[bool] = False

class TestTask(BaseModel):
    """Test task request model"""
    instructions: str
    browser_visible: bool = True
    capture_interval: float = 1.0
    api_provider: Optional[str] = "anthropic"
    api_model: Optional[str] = "claude-3-5-sonnet-20240620"
    api_key: Optional[str] = None
    use_default_key: Optional[bool] = True

class TaskResult(BaseModel):
    """Task result model"""
    session_id: str
    status: str
    final_result: Optional[str] = None

class SessionInfo(BaseModel):
    """Session information model"""
    session_id: str
    status: str
    username: str
    capture_enabled: bool
    tasks: List[Dict] = []

class WebSocketMessage(BaseModel):
    """WebSocket message model"""
    type: str
    data: Optional[Dict] = None
    message: Optional[str] = None
    status: Optional[str] = None
    task_id: Optional[str] = None
    error: Optional[str] = None