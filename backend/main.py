import sys
import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
from routes import video_routes

from mongo_routes import auth_routes as original_auth_routes
from routes import session_routes, task_routes, websocket_routes, jira_routes, pdf_routes
from mongodb_config import connect_to_mongodb
from config import load_environment_variables

from routes import hacking_routes

path_to_browser_use_package_parent = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', 'browser_use_mod', 'browser-use')
)
expected_package_actual_path = os.path.join(path_to_browser_use_package_parent, 'browser_use')

if not os.path.isdir(expected_package_actual_path):
    print(f"⚠️  Warning: browser_use package not found at {expected_package_actual_path}")
else:
    print(f"✅ Found browser_use package at {expected_package_actual_path}")

if path_to_browser_use_package_parent not in sys.path:
    sys.path.insert(0, path_to_browser_use_package_parent)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("matrix-qa-server")

load_environment_variables()

@asynccontextmanager
async def lifespan(current_app: FastAPI):
    print("🚀 Starting Matrix QA Server...")

    print("📊 Connecting to MongoDB...")
    await connect_to_mongodb()

    print("🎯 Initializing Jira service...")
    jira_url_env = os.getenv('JIRA_URL', '').strip()
    jira_username_env = os.getenv('JIRA_USERNAME', '').strip()
    jira_api_token_env = os.getenv('JIRA_API_TOKEN', '').strip()
    jira_automation_labels_str_env = os.getenv('JIRA_AUTOMATION_LABELS',
                                               'qa-automation,matrix-test,automated-test,automation')

    if jira_automation_labels_str_env:
        jira_automation_labels_list = [label.strip() for label in jira_automation_labels_str_env.split(',') if
                                       label.strip()]
    else:
        jira_automation_labels_list = ['qa-automation', 'matrix-test', 'automated-test', 'automation']

    if jira_url_env and jira_username_env and jira_api_token_env:
        try:
            await jira_routes.initialize_jira_service(
                jira_url=jira_url_env,
                username=jira_username_env,
                api_token=jira_api_token_env,
                automation_labels=jira_automation_labels_list
            )
            print(f"✅ Jira service initialized: {jira_url_env}")
        except Exception as e:
            print(f"❌ Error initializing Jira service: {e}")
    else:
        print("⚠️  Jira service not configured - some environment variables missing")

    print("✅ Matrix QA Server startup complete!")
    yield
    print("🛑 Shutting down Matrix QA Server...")

app = FastAPI(title="Matrix QA Test Runner", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
os.makedirs(os.path.join(frontend_dir, "js"), exist_ok=True)
os.makedirs(os.path.join(frontend_dir, "css"), exist_ok=True)

app.mount("/js", StaticFiles(directory=os.path.join(frontend_dir, "js")), name="js")
app.mount("/css", StaticFiles(directory=os.path.join(frontend_dir, "css")), name="css")

import mongo_routes.auth_routes as mongo_auth_router_module
import mongo_routes.history_routes as mongo_history_router_module

app.include_router(original_auth_routes.router)

app.include_router(session_routes.router)
app.include_router(task_routes.router)
app.include_router(websocket_routes.router)

app.include_router(jira_routes.router)
app.include_router(hacking_routes.router)
app.include_router(video_routes.router, prefix="/api/video")
app.include_router(pdf_routes.router, prefix="/api/pdf")

mongodb_api = APIRouter(prefix="/api")
mongodb_api.include_router(mongo_auth_router_module.router, prefix="/auth")
mongodb_api.include_router(mongo_history_router_module.router, prefix="/history")

app.include_router(mongodb_api)

@app.get("/", response_class=HTMLResponse)
async def get_html():
    html_file_path = os.path.join(frontend_dir, "index.html")
    try:
        with open(html_file_path, "r", encoding="utf-8") as f:
            html_content = f.read()
        return HTMLResponse(content=html_content)
    except FileNotFoundError:
        logger.error(f"index.html not found at {html_file_path}")
        return HTMLResponse(content="""
        <html>
            <head><title>Matrix QA Test Runner</title></head>
            <body style="background-color: #000; color: #00ff00; font-family: monospace; text-align: center; padding-top: 50px;">
                <h1>Matrix QA Test Runner</h1>
                <p>Server running correctly but index.html was not found</p>
                <p style="color: #ff5555; font-weight: bold;">ERROR: SYSTEM FILE MISSING - Check server logs for path.</p>
            </body>
        </html>
        """)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "message": "Matrix QA Server is running",
        "routes_loaded": [
            "auth", "session", "task", "websocket",
            "jira", "hacking", "video", "mongodb", "pdf"
        ]
    }

if __name__ == "__main__":
    print("🌟 Matrix QA Test Runner - Starting Server...")
    print("=" * 50)

    host = "0.0.0.0"
    default_port = int(os.getenv("PORT", 8000))
    max_attempts = 10
    port_found = False

    for i in range(max_attempts):
        current_port = default_port + i
        try:
            print(f"⚡ Trying to start server on {host}:{current_port}...")
            import socket

            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind((host, current_port))

            print(f"✅ Port {current_port} is available")
            print(f"🚀 Starting Matrix QA Server at http://{host}:{current_port}")
            print("=" * 50)

            uvicorn.run(app, host=host, port=current_port)
            port_found = True
            break
        except OSError as e:
            if e.errno == 98:
                print(f"⚠️  Port {current_port} is already in use, trying next port...")
                if i >= max_attempts - 1:
                    print(f"❌ Could not find an available port after {max_attempts} attempts")
            else:
                print(f"❌ Network error: {e}")
                break
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            break

    if not port_found and max_attempts > 0:
        print("💥 CRITICAL: Could not start server - all ports in use or network error")