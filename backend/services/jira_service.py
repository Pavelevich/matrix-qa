import aiohttp
import asyncio
import json
import logging
import base64
from typing import List, Dict, Any, Optional
from jira import JIRA
import aiohttp

logger = logging.getLogger("jira-service")


class JiraService:
    """Service for interacting with Jira API"""

    def __init__(self, jira_url: str, username: str, api_token: str, automation_labels: List[str] = None):
        """
        Initialize Jira service

        Args:
            jira_url: Jira instance URL (e.g., 'https://company.atlassian.net')
            username: Jira username/email
            api_token: Jira API token
            automation_labels: List of labels that trigger automation
        """
        self.jira_url = jira_url.rstrip('/')
        self.username = username
        self.api_token = api_token
        self.automation_labels = automation_labels or ['qa-automation', 'matrix-test', 'automated-test', 'automation']


        auth_string = f"{username}:{api_token}"
        auth_bytes = auth_string.encode('ascii')
        auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
        self.auth_header = f"Basic {auth_b64}"


        try:
            self.jira = JIRA(
                server=jira_url,
                basic_auth=(username, api_token)
            )
            logger.info(f"Successfully connected to Jira at {jira_url}")
        except Exception as e:
            logger.error(f"Failed to connect to Jira: {e}")
            self.jira = None

    def is_connected(self) -> bool:
        """Check if Jira connection is established"""
        return self.jira is not None

    async def get_issue(self, issue_key: str) -> Optional[Dict[str, Any]]:
        """
        Get issue data from Jira

        Args:
            issue_key: Jira issue key (e.g., 'PROJ-123')

        Returns:
            Issue data dict or None if not found
        """
        try:
            if not self.jira:
                logger.error("Jira client not initialized")
                return None

            issue = self.jira.issue(issue_key)
            return {
                "key": issue.key,
                "fields": {
                    "summary": issue.fields.summary,
                    "description": issue.fields.description,
                    "status": {
                        "name": issue.fields.status.name
                    },
                    "labels": issue.fields.labels,
                    "assignee": {
                        "displayName": issue.fields.assignee.displayName if issue.fields.assignee else None
                    },
                    "reporter": {
                        "displayName": issue.fields.reporter.displayName if issue.fields.reporter else None
                    }
                }
            }
        except Exception as e:
            logger.error(f"Error getting issue {issue_key}: {e}")
            return None

    def has_automation_label(self, issue_data: Dict[str, Any]) -> bool:
        """Check if issue has any automation labels"""
        if not issue_data or not issue_data.get("fields"):
            return False

        labels = issue_data["fields"].get("labels", [])
        return any(label in self.automation_labels for label in labels)

    def extract_instructions_from_issue(self, issue_data: Dict[str, Any]) -> str:
        """Extract test instructions from issue description"""
        if not issue_data or not issue_data.get("fields"):
            return ""

        description = issue_data["fields"].get("description", "")
        return description or ""

    def should_process_webhook(self, webhook_data: Dict[str, Any]) -> bool:
        """
        Check if webhook should trigger automation

        Args:
            webhook_data: Webhook payload from Jira

        Returns:
            True if should process, False otherwise
        """
        try:

            if webhook_data.get("webhookEvent") != "jira:issue_updated":
                return False


            changelog = webhook_data.get("changelog", {})
            items = changelog.get("items", [])

            status_changed_to_done = False
            for item in items:
                if item.get("field") == "status" and item.get("toString") == "Done":
                    status_changed_to_done = True
                    break

            if not status_changed_to_done:
                return False

            # Check if issue has automation labels
            issue = webhook_data.get("issue", {})
            labels = issue.get("fields", {}).get("labels", [])

            has_automation_label = any(label in self.automation_labels for label in labels)

            return has_automation_label

        except Exception as e:
            logger.error(f"Error processing webhook: {e}")
            return False

    def extract_issue_key_from_webhook(self, webhook_data: Dict[str, Any]) -> Optional[str]:
        """Extract issue key from webhook data"""
        try:
            return webhook_data.get("issue", {}).get("key")
        except Exception:
            return None

    async def add_comment(self, issue_key: str, comment_text: str) -> bool:
        """Add comment to Jira issue"""
        try:
            if not self.jira:
                logger.error("Jira client not initialized")
                return False

            self.jira.add_comment(issue_key, comment_text)
            logger.info(f"Added comment to issue {issue_key}")
            return True
        except Exception as e:
            logger.error(f"Error adding comment to {issue_key}: {e}")
            return False

    async def add_formatted_comment(self, issue_key: str, title: str, result: str,
                                    execution_time: str, status: str) -> bool:
        """Add formatted test result comment to Jira issue"""
        try:
            status_emoji = "✅" if status == "SUCCESS" else "❌"

            comment = f"""
{status_emoji} **MATRIX QA - {title}**

**Status:** {status}
**Execution Time:** {execution_time}

**Result:**
{result}

---
*Automated by Matrix QA Test Runner*
            """

            return await self.add_comment(issue_key, comment)
        except Exception as e:
            logger.error(f"Error adding formatted comment to {issue_key}: {e}")
            return False

    def get_automation_summary(self, issue_data: Dict[str, Any]) -> Dict[str, Any]:
        """Get summary of automation-relevant data from issue"""
        if not issue_data:
            return {}

        fields = issue_data.get("fields", {})
        labels = fields.get("labels", [])
        automation_labels_found = [label for label in labels if label in self.automation_labels]

        return {
            "key": issue_data.get("key"),
            "summary": fields.get("summary"),
            "status": fields.get("status", {}).get("name"),
            "labels": automation_labels_found,
            "has_automation_labels": len(automation_labels_found) > 0
        }

    async def add_automation_label(self, issue_key: str, label: str) -> bool:
        """Add automation label to issue"""
        try:
            if not self.jira:
                logger.error("Jira client not initialized")
                return False

            issue = self.jira.issue(issue_key)
            current_labels = issue.fields.labels or []

            if label not in current_labels:
                current_labels.append(label)
                issue.update(fields={'labels': current_labels})
                logger.info(f"Added label '{label}' to issue {issue_key}")
            else:
                logger.info(f"Label '{label}' already exists on issue {issue_key}")

            return True
        except Exception as e:
            logger.error(f"Error adding label to {issue_key}: {e}")
            return False