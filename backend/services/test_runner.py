import asyncio
import logging
import re
import json
from datetime import datetime
from bson import ObjectId
from typing import Dict, Any, Optional, List, Tuple

from config import active_sessions
from services.ai_providers import get_llm_for_provider
from mongodb_config import users_collection

logger = logging.getLogger("test-runner")


async def broadcast_to_session(session_id: str, message: Dict[str, Any], websocket_manager):
    """
    Broadcast a message to all WebSocket connections for a session
    """
    await websocket_manager.broadcast_to_session(session_id, message)


def extract_log_entries(result_text: str) -> List[Dict[str, str]]:
    """
    Extract structured log entries from the raw output

    Args:
        result_text: Raw result text from test execution

    Returns:
        List of structured log entries
    """
    entries = []
    cleaned_text = result_text.replace('\xa0', ' ').replace('\x00', '').strip()
    info_lines = re.findall(r'INFO:browser_use\.agent\.service:(.*?)(?=\nINFO:browser_use\.agent\.service:|$)',
                            cleaned_text, re.DOTALL)

    for line_content in info_lines:
        entry_text = line_content.strip()
        if not entry_text:
            continue

        entry_type = "info"
        icon = ""
        clean_text = entry_text

        if entry_text.startswith('🧠'):
            entry_type = "memory"; icon = "🧠"; clean_text = entry_text[2:].strip()
        elif entry_text.startswith('🎯'):
            entry_type = "goal"; icon = "🎯"; clean_text = entry_text[2:].strip()
        elif entry_text.startswith('🛠️'):
            entry_type = "action"; icon = "🛠️"; clean_text = entry_text[3:].strip()
        elif entry_text.startswith('📄 Result:'):
            entry_type = "result"; icon = "📄"; clean_text = entry_text[10:].strip()
        elif entry_text.startswith('📄'):
            entry_type = "result"; icon = "📄"; clean_text = entry_text[2:].strip()
        elif entry_text.startswith('✅'):
            entry_type = "success"; icon = "✅"; clean_text = entry_text[2:].strip()
        elif entry_text.startswith('❌'):
            entry_type = "error"; icon = "❌"; clean_text = entry_text[2:].strip()
        elif 'Result:' in entry_text:
            entry_type = "result"; icon = "📄"
            result_match = re.search(r'Result:\s*(.*)', entry_text, re.DOTALL)
            if result_match: clean_text = result_match.group(1).strip()

        clean_text = re.sub(r'\s+', ' ', clean_text).strip()
        if clean_text:
            entries.append({"type": entry_type, "icon": icon, "text": clean_text})
    return entries


def clean_history_string(history_str: str) -> str:
    """
    Cleans and extracts the actual result text from agent history string
    """
    cleaned_str = history_str.replace('\xa0', ' ').replace('\x00', '').strip()
    extracted_contents = re.findall(r"extracted_content='([^']*)'", cleaned_str)
    done_texts = re.findall(r"text': '([^']*)'", cleaned_str)

    for content in extracted_contents:
        if ("navigated to" in content.lower() and "requested" in content.lower()) or \
           ("successfully" in content.lower() and "requested" in content.lower()):
            return content
    for text in done_texts:
        if text and len(text) > 5: return text
    if extracted_contents: return extracted_contents[-1]
    return "Task completed successfully."


def extract_clean_result(result_text: str) -> Tuple[str, List[Dict[str, str]]]:
    """
    Extract a clean result text and structured log entries from the raw result
    """
    log_entries = extract_log_entries(result_text)
    clean_result = None
    json_extraction = None
    result_entries = [entry for entry in log_entries if entry["type"] == "result"]

    for entry in reversed(result_entries):
        if "Extracted from page" in entry["text"] and "```json" in entry["text"]:
            if not json_extraction: json_extraction = entry["text"]
            continue
        else:
            clean_result = entry["text"]; break

    if not clean_result:
        cleaned_text = result_text.replace('\xa0', ' ').replace('\x00', '').strip()
        patterns = [
            r'📄 Result:\s*(.*?)(?=\n(?:INFO:|✅|📝|$))',
            r'INFO:browser_use\.agent\.service:📄 Result:\s*(.*?)(?=\n(?:INFO:|$))',
            r'📄\s*Result:\s*(.*?)(?=\n(?:INFO:|✅|📝|$))',
            r'Result:\s*(.*?)(?=\n(?:INFO:|✅|📝|$))',
        ]
        for pattern in patterns:
            matches = list(re.finditer(pattern, cleaned_text, re.DOTALL | re.IGNORECASE))
            if matches:
                match = matches[-1]; result_text_found = match.group(1).strip()
                if "Extracted from page" in result_text_found and "```json" in result_text_found:
                    if not json_extraction: json_extraction = result_text_found
                    continue
                else:
                    clean_result = re.sub(r'\s+', ' ', result_text_found).strip(); break

    if not clean_result and '{"done":{"text":' in result_text:
        done_match = re.search(r'"done":\s*{"text":\s*"([^"]*)"', result_text)
        if done_match: clean_result = done_match.group(1)

    if not clean_result and ("AgentHistoryList" in result_text or "ActionResult" in result_text):
        clean_result = clean_history_string(result_text)

    json_content = None
    json_match = re.search(r'```json\n([\s\S]*?)\n```', result_text)
    if json_match: json_content = json_match.group(1).strip()

    if clean_result: return clean_result, log_entries
    elif json_extraction: return json_extraction, log_entries
    elif json_content: return f"```json\n{json_content}\n```", log_entries
    else: return "Task completed successfully.", log_entries


def format_raw_output(raw_output: str) -> str:
    """
    Format the raw output to be more readable
    """
    formatted = re.sub(r'\n{3,}', '\n\n', raw_output)
    formatted = re.sub(r'(INFO:[^\n]+)\n', r'\1\n\n', formatted)
    if "AgentHistoryList" in formatted:
        try:
            formatted = formatted.replace(", ", ",\n  ").replace("(", "(\n  ").replace(")", "\n)") \
                               .replace("[", "[\n  ").replace("]", "\n]")
        except Exception: pass
    return formatted

async def direct_save_result_to_mongodb(
    username: str,
    title: str,
    content: str,
    model_name: Optional[str],
    instructions_text: Optional[str]
):
    if not username:
        logger.error("No username provided. Unable to save history to MongoDB.")
        return False

    logger.info(f"Trying to save result to MongoDB for user: {username}...")
    try:
        history_item_payload = {
            "_id": ObjectId(),
            "title": title,
            "content": content,
            "model": model_name,
            "instructions": instructions_text,
            "timestamp": datetime.utcnow()
        }

        result = await users_collection.update_one(
            {"username": username},
            {"$push": {"history": history_item_payload}}
        )

        if result.modified_count > 0:
            logger.info(f"Result successfully saved to MongoDB for user {username}.")
            return True
        elif result.matched_count == 0:
            logger.error(f"User {username} not found in MongoDB. History not saved.")
            return False
        else:
            logger.warning(f"Document for {username} found but not modified by $push. Result: {result.raw_result}")
            return False

    except Exception as e:
        logger.error(f"Exception when trying to save result directly to MongoDB for {username}: {str(e)}", exc_info=True)
        return False



async def execute_test(
        session_id: str,
        task_id: str,
        instructions: str,
        browser_visible: bool,
        capture_interval: float,
        api_provider: Optional[str] = "anthropic",
        api_model: Optional[str] = "claude-3-5-sonnet-20240620",
        api_key: Optional[str] = None,
        use_default_key: bool = True,
        websocket_manager=None
):
    if session_id not in active_sessions:
        logger.error(f"Sesión {session_id} no found")
        return

    session = active_sessions[session_id]
    current_username = session.get("username")
    if not current_username:
        logger.warning(f"No 'username' found in active_sessions for session_id {session_id}. History will not be saved to DB.")

    for task_loop in session["tasks"]:
        if task_loop["id"] == task_id:
            task_loop["status"] = "running"
            break

    await broadcast_to_session(session_id, {
        "type": "task_update",
        "task_id": task_id,
        "status": "running",
        "message": "Starting test..."
    }, websocket_manager)

    try:
        from browser_use import Agent, Browser, BrowserConfig, Controller

        if not session.get("browser"):
            from config import X_SERVER_AVAILABLE
            actual_headless = True if not X_SERVER_AVAILABLE else not browser_visible
            if browser_visible and not X_SERVER_AVAILABLE:
                logger.warning("Forcing headless mode due to missing X server.")
                await broadcast_to_session(session_id, {"type": "task_update", "task_id": task_id, "status": "running", "message": "No display server. Forced headless."}, websocket_manager)

            browser_config = BrowserConfig(headless=actual_headless, viewport_width=1920, viewport_height=1080)
            logger.info(f"Initializing browser with headless={actual_headless}, viewport=1920x1080")
            session["browser"] = Browser(config=browser_config)
            session["controller"] = Controller()
            session["status"] = "browser_ready"
            await broadcast_to_session(session_id, {"type": "session_update", "status": "browser_ready", "message": f"Browser initialized ({'headless' if actual_headless else 'visible'})"}, websocket_manager)

        if websocket_manager:
            await websocket_manager.start_screenshot_stream(session_id, capture_interval)

        llm_for_agent = None
        try:
            if api_provider == "deepseek":
                logger.info(f"Setting up DeepSeek LLM model: {api_model}, default key: {use_default_key}")


            llm_for_agent = get_llm_for_provider(api_provider, api_model, api_key, use_default_key)
            logger.info(f"Using LLM: {api_provider} / {api_model}")
            await broadcast_to_session(session_id, {"type": "task_update", "task_id": task_id, "status": "running", "message": f"AI: {api_provider.upper()} / {api_model}"}, websocket_manager)
        except Exception as llm_error:
            logger.error(f"Failed to initialize LLM: {str(llm_error)}", exc_info=True)

            for task_llm_err in session["tasks"]:
                if task_llm_err["id"] == task_id:
                    task_llm_err["status"] = "failed"; task_llm_err["error"] = f"AI init failed: {str(llm_error)}"
                    break
            await broadcast_to_session(session_id, {"type": "task_error", "task_id": task_id, "status": "failed", "error": f"AI init error: {str(llm_error)}"}, websocket_manager)
            return

        agent = Agent(
            task=instructions,
            llm=llm_for_agent,
            browser=session["browser"],
            controller=session["controller"],
            enable_memory=True
        )


        original_step = agent.step
        async def step_with_notification(*args, **kwargs):
            step_result = await original_step(*args, **kwargs)
            try:
                if agent.state.history.history and agent.state.history.history[-1].model_output:
                    step_info_data = {
                        "step": agent.state.n_steps,
                        "goal": agent.state.history.history[-1].model_output.current_state.next_goal,
                        "action": str(agent.state.history.history[-1].model_output.action[0]) if agent.state.history.history[-1].model_output.action else "No action"
                    }
                    await broadcast_to_session(session_id, {"type": "task_step", "task_id": task_id, "status": "running", "step_info": step_info_data}, websocket_manager)
            except Exception as e_step: logger.error(f"Error extracting step info: {str(e_step)}")
            return step_result
        agent.step = step_with_notification

        logger.info(f"Running agent with instructions: {instructions}")
        agent_response_dict = await agent.run(max_steps=100)

        agent_history_list_object = agent_response_dict.get("history")
        intercepted_final_llm_message = agent_response_dict.get("final_llm_message", "Task completed, message not extracted.")

        logger.info(f"=== USING LLM MESSAGE DIRECTLY: {intercepted_final_llm_message[:200] if intercepted_final_llm_message else 'None'}...")

        raw_result_str_for_processing = ""
        if agent_history_list_object:
            try:
                raw_result_str_for_processing = agent_history_list_object.json()
            except AttributeError:
                raw_result_str_for_processing = str(agent_history_list_object)
        else:
            raw_result_str_for_processing = intercepted_final_llm_message

        formatted_raw_result_for_client = format_raw_output(raw_result_str_for_processing)
        clean_result_from_extraction, structured_logs_for_client = extract_clean_result(raw_result_str_for_processing)

        final_message_to_show_and_save = intercepted_final_llm_message

        if not final_message_to_show_and_save or final_message_to_show_and_save == "Task completed, message not extracted.":
            logger.warning("No message from LLM, using fallback...")
            final_message_to_show_and_save = "Task completed successfully."

        logger.info(f"Final message for task: {final_message_to_show_and_save[:200]}...")

        for task_item_update in session["tasks"]:
            if task_item_update["id"] == task_id:
                task_item_update["raw_output"] = formatted_raw_result_for_client
                task_item_update["status"] = "completed"
                task_item_update["result"] = final_message_to_show_and_save
                task_item_update["structured_logs"] = structured_logs_for_client
                break

        await broadcast_to_session(session_id, {
            "type": "task_complete",
            "task_id": task_id,
            "status": "completed",
            "result": final_message_to_show_and_save,
            "structured_logs": structured_logs_for_client,
            "raw_result": formatted_raw_result_for_client,
            "hide_raw": True
        }, websocket_manager)

        if current_username:
            task_title_for_db = instructions[:100]
            model_identifier_for_db = f"{api_provider}/{api_model}" if api_provider and api_model else "N/A"

            await direct_save_result_to_mongodb(
                username=current_username,
                title=task_title_for_db,
                content=final_message_to_show_and_save,
                model_name=model_identifier_for_db,
                instructions_text=instructions
            )
        else:
            logger.warning(f"The user for the session could not be determined. {session_id}.The result will not be saved in MongoDB.")

    except Exception as e_outer:
        logger.error(f"Error executing test: {str(e_outer)}", exc_info=True)
        for task_item_err_outer in session["tasks"]:
            if task_item_err_outer["id"] == task_id:
                task_item_err_outer["status"] = "failed"
                task_item_err_outer["error"] = str(e_outer)
                break
        await broadcast_to_session(session_id, {
            "type": "task_error", "task_id": task_id, "status": "failed", "error": str(e_outer)
        }, websocket_manager)

    finally:
        await asyncio.sleep(5)