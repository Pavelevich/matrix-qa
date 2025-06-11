import asyncio
import uuid
import logging
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional, List

from services.jira_service import JiraService
from services.test_runner import execute_test
from config import active_sessions
from routes.websocket_routes import websocket_manager
from auth import verify_access_jwt

router = APIRouter(prefix="/jira", tags=["jira"])
logger = logging.getLogger("jira-routes")

jira_service: Optional[JiraService] = None


class JiraWebhookPayload(BaseModel):
    webhookEvent: str
    issue: Optional[Dict[str, Any]] = None
    changelog: Optional[Dict[str, Any]] = None


class AutomationLabelConfig(BaseModel):
    labels: List[str]


async def initialize_jira_service(jira_url: str, username: str, api_token: str, automation_labels: List[str] = None):
    global jira_service
    jira_service = JiraService(jira_url, username, api_token, automation_labels)


@router.post("/webhook")
async def handle_jira_webhook(
        request: Request,
        background_tasks: BackgroundTasks
):
    if not jira_service:
        raise HTTPException(status_code=500, detail="Jira service not initialized")

    try:
        webhook_data = await request.json()

        if not jira_service.should_process_webhook(webhook_data):
            issue_key = jira_service.extract_issue_key_from_webhook(webhook_data)
            return {"message": f"Webhook ignored for {issue_key} - no action needed (missing automation labels or wrong status)"}

        issue_key = jira_service.extract_issue_key_from_webhook(webhook_data)
        if not issue_key:
            raise HTTPException(status_code=400, detail="Could not extract issue key from webhook")

        background_tasks.add_task(process_jira_issue, issue_key)

        return {"message": f"Processing issue {issue_key} for automation", "issue_key": issue_key}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing webhook: {str(e)}")


async def process_jira_issue(issue_key: str):
    try:
        issue_data = await jira_service.get_issue(issue_key)
        if not issue_data:
            return

        if not jira_service.has_automation_label(issue_data):
            await jira_service.add_comment(
                issue_key,
                "❌ MATRIX QA: This issue was moved to Done but does not have automation labels. Add one of these labels to enable automation: " +
                ", ".join(jira_service.automation_labels)
            )
            return

        instructions = jira_service.extract_instructions_from_issue(issue_data)
        if not instructions:
            await jira_service.add_comment(
                issue_key,
                "❌ MATRIX QA: No test instructions found in this issue. Please add test instructions to the description."
            )
            return

        automation_summary = jira_service.get_automation_summary(issue_data)

        session_id = str(uuid.uuid4())
        task_id = str(uuid.uuid4())

        active_sessions[session_id] = {
            "id": session_id,
            "username": "jira_automation",
            "status": "active",
            "browser": None,
            "controller": None,
            "last_activity": datetime.now(),
            "capture_enabled": False,
            "tasks": [],
            "jira_issue_key": issue_key
        }

        await jira_service.add_comment(
            issue_key,
            f"🤖 MATRIX QA: Test execution started...\n📝 Instructions: {instructions[:200]}...\n🏷️ Automation triggered by labels: {automation_summary['labels']}"
        )

        await execute_test_for_jira(
            session_id=session_id,
            task_id=task_id,
            issue_key=issue_key,
            instructions=instructions,
            browser_visible=False,
            capture_interval=1.0,
            api_provider="anthropic",
            api_model="claude-3-5-sonnet-20240620",
            api_key="",
            use_default_key=False
        )

    except Exception as e:
        if jira_service:
            await jira_service.add_comment(
                issue_key,
                f"❌ MATRIX QA: Error executing test - {str(e)}"
            )


async def execute_test_for_jira(
        session_id: str,
        task_id: str,
        issue_key: str,
        instructions: str,
        browser_visible: bool,
        capture_interval: float,
        api_provider: str = "anthropic",
        api_model: str = "claude-3-5-sonnet-20240620",
        api_key: Optional[str] = None,
        use_default_key: bool = True
):
    try:
        from browser_use import Agent, Browser, BrowserConfig, Controller
        from services.ai_providers import get_llm_for_provider
        from config import X_SERVER_AVAILABLE

        session = active_sessions[session_id]

        actual_headless = True if not X_SERVER_AVAILABLE else not browser_visible
        browser_config = BrowserConfig(
            headless=actual_headless,
            viewport_width=1920,
            viewport_height=1080
        )

        session["browser"] = Browser(config=browser_config)
        session["controller"] = Controller()
        session["status"] = "browser_ready"

        from config import load_environment_variables
        load_environment_variables()

        llm = get_llm_for_provider(
            api_provider,
            api_model,
            "",
            False
        )

        agent = Agent(
            task=instructions,
            llm=llm,
            browser=session["browser"],
            controller=session["controller"],
            enable_memory=True
        )

        raw_result = await agent.run()

        if not isinstance(raw_result, str):
            raw_result = str(raw_result)

        from services.test_runner import extract_clean_result, format_raw_output

        formatted_raw_result = format_raw_output(raw_result)
        clean_result, structured_logs = extract_clean_result(raw_result)

        execution_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")

        status = "SUCCESS"
        if any(keyword in clean_result.lower() for keyword in ["error", "failed", "exception"]):
            status = "FAILED"

        await jira_service.add_formatted_comment(
            issue_key=issue_key,
            title=f"Automated Test Execution",
            result=clean_result,
            execution_time=execution_time,
            status=status
        )

        if session["browser"]:
            await session["browser"].close()

        if session_id in active_sessions:
            del active_sessions[session_id]

    except Exception as e:
        if jira_service:
            execution_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
            await jira_service.add_formatted_comment(
                issue_key=issue_key,
                title="Automated Test Execution - ERROR",
                result=f"Test execution failed with error: {str(e)}",
                execution_time=execution_time,
                status="FAILED"
            )
        try:
            if session_id in active_sessions:
                session = active_sessions[session_id]
                if session.get("browser"):
                    await session["browser"].close()
                del active_sessions[session_id]
        except Exception as cleanup_error:
            pass


@router.get("/status")
async def get_jira_status(auth_data: dict = Depends(verify_access_jwt)):
    return {
        "jira_service_initialized": jira_service is not None,
        "jira_url": jira_service.jira_url if jira_service else None,
        "username": jira_service.username if jira_service else None,
        "automation_labels": jira_service.automation_labels if jira_service else []
    }


@router.get("/tickets")
async def get_jira_tickets(auth_data: dict = Depends(verify_access_jwt)):
    if not jira_service:
        raise HTTPException(status_code=503, detail="Jira service not initialized")

    try:
        automation_labels = jira_service.automation_labels
        labels_jql = " OR ".join([f'labels = "{label}"' for label in automation_labels])
        jql = f'({labels_jql}) AND status IN ("Done", "In Progress")'

        issues = jira_service.jira.search_issues(
            jql,
            maxResults=50,
            expand='changelog',
            fields='summary,description,status,labels,assignee,reporter,created,updated,priority,components,fixVersions'
        )

        tickets = []
        for issue in issues:
            ticket_data = {
                'key': issue.key,
                'summary': issue.fields.summary,
                'description': issue.fields.description or "No description",
                'status': issue.fields.status.name,
                'status_category': issue.fields.status.statusCategory.name,
                'labels': issue.fields.labels,
                'assignee': issue.fields.assignee.displayName if issue.fields.assignee else "Unassigned",
                'reporter': issue.fields.reporter.displayName if issue.fields.reporter else "No reporter",
                'created': issue.fields.created,
                'updated': issue.fields.updated,
                'priority': issue.fields.priority.name if issue.fields.priority else "No priority",
                'url': f"{jira_service.jira_url}/browse/{issue.key}",
                'components': [comp.name for comp in issue.fields.components] if issue.fields.components else [],
                'fix_versions': [version.name for version in
                                 issue.fields.fixVersions] if issue.fields.fixVersions else []
            }
            tickets.append(ticket_data)

        return {
            "success": True,
            "tickets": tickets,
            "total": len(tickets),
            "jql_query": jql
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting Jira tickets: {str(e)}")


@router.get("/debug")
async def get_jira_debug_info(auth_data: dict = Depends(verify_access_jwt)):
    """
    Get debug information about the Jira service

    Returns:
        JSON response with debug information
    """
    try:
        if not jira_service:
            return {
                "success": False,
                "debug_info": {
                    "jira_service_initialized": False,
                    "error": "Jira service not initialized"
                }
            }

        return {
            "success": True,
            "debug_info": {
                "jira_service_initialized": True,
                "jira_url": jira_service.jira_url,
                "username": jira_service.username,
                "automation_labels": jira_service.automation_labels,
                "jira_client_connected": jira_service.is_connected(),
                "auth_header_present": bool(jira_service.auth_header)
            }
        }
    except Exception as e:
        return {
            "success": False,
            "debug_info": {
                "error": f"Error getting debug info: {str(e)}"
            }
        }


@router.post("/execute-ticket/{ticket_key}")
async def execute_jira_ticket(ticket_key: str, auth_data: dict = Depends(verify_access_jwt)):
    if not jira_service:
        raise HTTPException(status_code=503, detail="Jira service not initialized")

    try:
        issue = jira_service.jira.issue(ticket_key, fields='summary,description,status')
        execution_comment = f"""
🤖 **AUTOMATED EXECUTION STARTED**
- Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
- Executed by: Matrix QA Automation System
- Status: Execution in progress...

The automated testing for this ticket has been initiated.
        """
        jira_service.jira.add_comment(ticket_key, execution_comment)
        return {
            "success": True,
            "ticket_key": ticket_key,
            "summary": issue.fields.summary,
            "description": issue.fields.description or "No description",
            "status": issue.fields.status.name,
            "execution_started": True,
            "instructions": issue.fields.description or "No specific description in ticket"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error executing ticket: {str(e)}")