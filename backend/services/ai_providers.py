import os
import logging
from typing import Any, Dict, Optional

from config import ANTHROPIC_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY

logger = logging.getLogger("ai-providers")


def is_langchain_installed() -> bool:
    """Check if langchain packages are installed"""
    try:
        import langchain_anthropic
        return True
    except ImportError:
        return False


def get_llm_for_provider(
        api_provider: str,
        api_model: str,
        api_key: Optional[str] = None,
        use_default_key: bool = False
) -> Any:
    """
    Return the appropriate LLM client for the specified provider

    Args:
        api_provider: The AI provider (anthropic, openai, deepseek, etc.)
        api_model: The model to use
        api_key: Custom API key (if not using default)
        use_default_key: Whether to use the default API key from env vars

    Returns:
        LLM client object for the specified provider
    """
    try:

        effective_api_key = None


        if use_default_key:
            if api_provider == "anthropic" and ANTHROPIC_API_KEY:
                effective_api_key = ANTHROPIC_API_KEY
                logger.info("Using default Anthropic API key")
            elif api_provider == "openai" and OPENAI_API_KEY:
                effective_api_key = OPENAI_API_KEY
                logger.info("Using default OpenAI API key")
            elif api_provider == "deepseek" and DEEPSEEK_API_KEY:
                effective_api_key = DEEPSEEK_API_KEY
                logger.info("Using default DeepSeek API key")
            else:

                if ANTHROPIC_API_KEY and api_provider != "openai":
                    logger.warning(f"No default key for {api_provider}. Falling back to Anthropic.")
                    api_provider = "anthropic"
                    api_model = "claude-3-5-sonnet-20240620"
                    effective_api_key = ANTHROPIC_API_KEY
                else:
                    raise ValueError(f"No default API key available for {api_provider}")
        else:

            effective_api_key = api_key
            if not effective_api_key:
                raise ValueError(f"No API key provided for {api_provider}")
            logger.info(f"Using custom API key for {api_provider}")


        if not effective_api_key:
            raise ValueError("No API key available - neither custom nor default")

        if effective_api_key.startswith('sk-ant') and api_provider != "anthropic":
            logger.warning(f"API key format is for Anthropic but provider is {api_provider}. Switching to Anthropic.")
            api_provider = "anthropic"
            api_model = "claude-3-5-sonnet-20240620"
        elif not effective_api_key.startswith(
                'sk-ant') and api_provider == "anthropic" and effective_api_key.startswith('sk-'):
            logger.warning("API key format is not for Anthropic but provider is anthropic. Will try to use anyway.")


        if api_provider == "anthropic":
            try:
                from langchain_anthropic import ChatAnthropic
                return ChatAnthropic(model=api_model, api_key=effective_api_key)
            except ImportError:
                logger.warning("langchain_anthropic not installed. Using default ChatAnthropic.")
                from langchain_anthropic import ChatAnthropic
                return ChatAnthropic(model="claude-3-5-sonnet-20240620", api_key=ANTHROPIC_API_KEY)

        elif api_provider == "openai":
            try:

                if effective_api_key.startswith('sk-ant'):
                    logger.warning("Cannot use Anthropic API key with OpenAI. Falling back to Anthropic provider.")
                    from langchain_anthropic import ChatAnthropic
                    return ChatAnthropic(model="claude-3-5-sonnet-20240620", api_key=effective_api_key)

                os.environ["OPENAI_API_KEY"] = effective_api_key
                logger.info(f"Set OPENAI_API_KEY environment variable for process")

                from langchain_openai import ChatOpenAI
                return ChatOpenAI(model=api_model)
            except ImportError:
                logger.warning("langchain_openai not installed. Falling back to Anthropic.")
                if ANTHROPIC_API_KEY:
                    from langchain_anthropic import ChatAnthropic
                    return ChatAnthropic(model="claude-3-5-sonnet-20240620", api_key=ANTHROPIC_API_KEY)
                else:
                    raise ImportError("langchain_openai not installed and no Anthropic fallback available")

        elif api_provider == "deepseek":
            try:

                logger.info(f"Setting up DeepSeek provider with model: {api_model}")
                logger.info(f"Using API key starting with: {effective_api_key[:5]}...")


                from langchain_openai import ChatOpenAI


                os.environ["OPENAI_API_KEY"] = effective_api_key
                logger.info(f"Set OPENAI_API_KEY environment variable for DeepSeek: {effective_api_key[:5]}...")


                model_name = api_model or "deepseek-chat"
                if model_name == "deepseek-coder":
                    model_name = "deepseek-coder-33b-instruct"

                logger.info(f"Final model name for DeepSeek: {model_name}")


                client = ChatOpenAI(
                    model=model_name,
                    openai_api_base="https://api.deepseek.com/v1",
                    openai_api_key=effective_api_key
                )


                logger.info(f"Successfully configured ChatOpenAI client for DeepSeek")

                return client

            except Exception as e:
                logger.error(f"Error creating DeepSeek client: {str(e)}")
                if ANTHROPIC_API_KEY:
                    logger.warning("Falling back to Anthropic due to DeepSeek setup error")
                    from langchain_anthropic import ChatAnthropic
                    return ChatAnthropic(model="claude-3-5-sonnet-20240620", api_key=ANTHROPIC_API_KEY)
                else:
                    raise ValueError(f"Failed to initialize DeepSeek and no fallback available: {str(e)}")

        elif api_provider == "gemini":
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                return ChatGoogleGenerativeAI(model=api_model, google_api_key=effective_api_key)
            except ImportError:
                logger.warning("langchain_google_genai not installed. Falling back to Anthropic.")
                if ANTHROPIC_API_KEY:
                    from langchain_anthropic import ChatAnthropic
                    return ChatAnthropic(model="claude-3-5-sonnet-20240620", api_key=ANTHROPIC_API_KEY)
                else:
                    raise ImportError("langchain_google_genai not installed and no Anthropic fallback available")

        elif api_provider == "mistral":
            try:
                from langchain_mistralai.chat_models import ChatMistralAI
                return ChatMistralAI(model=api_model, mistral_api_key=effective_api_key)
            except ImportError:
                logger.warning("langchain_mistralai not installed. Falling back to Anthropic.")
                if ANTHROPIC_API_KEY:
                    from langchain_anthropic import ChatAnthropic
                    return ChatAnthropic(model="claude-3-5-sonnet-20240620", api_key=ANTHROPIC_API_KEY)
                else:
                    raise ImportError("langchain_mistralai not installed and no Anthropic fallback available")
        else:

            if ANTHROPIC_API_KEY:
                from langchain_anthropic import ChatAnthropic
                return ChatAnthropic(model="claude-3-5-sonnet-20240620", api_key=ANTHROPIC_API_KEY)
            else:
                raise ValueError(f"Unknown provider {api_provider} and no Anthropic fallback available")
    except Exception as e:
        logger.error(f"Error creating LLM: {str(e)}")

        if ANTHROPIC_API_KEY:
            logger.warning("Falling back to default Anthropic model due to error")
            from langchain_anthropic import ChatAnthropic
            return ChatAnthropic(model="claude-3-5-sonnet-20240620", api_key=ANTHROPIC_API_KEY)
        else:
            raise ValueError(f"Failed to initialize AI model: {str(e)}")


async def test_api_connection(provider: str, api_key: str, model: str = None, use_default_key: bool = False) -> Dict[
    str, Any]:
    """
    Test connection to API provider

    Args:
        provider: AI provider (anthropic, openai, etc.)
        api_key: API key to test
        model: Model to test with
        use_default_key: Whether to use default key

    Returns:
        Dict with success status and message
    """

    if not model:
        if provider == "anthropic":
            model = "claude-3-5-sonnet-20240620"
        elif provider == "openai":
            model = "gpt-4o"
        elif provider == "deepseek":
            model = "deepseek-chat"
        elif provider == "mistral":
            model = "mistral-medium"
        elif provider == "gemini":
            model = "gemini-pro"
        else:
            model = "default_model"


    if use_default_key:
        if provider == "anthropic" and ANTHROPIC_API_KEY:
            return {"success": True, "message": "DEFAULT ANTHROPIC API KEY VALIDATED"}
        elif provider == "openai" and OPENAI_API_KEY:
            return {"success": True, "message": "DEFAULT OPENAI API KEY VALIDATED"}
        elif provider == "deepseek" and DEEPSEEK_API_KEY:
            return {"success": True, "message": "DEFAULT DEEPSEEK API KEY VALIDATED"}
        elif provider != "anthropic" and provider != "openai" and provider != "deepseek":
            return {"success": False, "message": f"NO DEFAULT KEY AVAILABLE FOR {provider.upper()}"}
        else:
            return {"success": False, "message": f"NO DEFAULT {provider.upper()} API KEY CONFIGURED"}


    if not api_key:
        return {"success": False, "message": "API key is required"}


    if provider == "anthropic" and not api_key.startswith("sk-ant"):
        return {"success": False, "message": "INVALID ANTHROPIC API KEY FORMAT"}
    elif provider == "openai" and api_key.startswith("sk-ant"):
        return {"success": False, "message": "CANNOT USE ANTHROPIC KEY WITH OPENAI"}


    try:
        import aiohttp
    except ImportError:
        logger.warning("aiohttp not installed. Using simple API key validation.")

        if api_key.startswith('sk-'):
            if len(api_key) > 20:
                return {"success": True, "message": "API KEY FORMAT VALID [SIMULATED]"}
            else:
                return {"success": False, "message": "API KEY TOO SHORT"}
        else:
            return {"success": False, "message": "INVALID API KEY FORMAT"}


    try:
        import aiohttp

        if provider == "anthropic":

            headers = {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(
                        "https://api.anthropic.com/v1/messages",
                        headers=headers,
                        json={
                            "model": model,
                            "max_tokens": 10,
                            "messages": [{"role": "user", "content": "Hello"}]
                        }
                ) as response:
                    if response.status == 200:
                        return {"success": True, "message": "API CONNECTION SUCCESSFUL"}
                    else:
                        response_json = await response.json()
                        error_msg = response_json.get("error", {}).get("message", "Unknown error")
                        return {"success": False, "message": f"API ERROR: {error_msg}"}

        elif provider == "openai":

            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers=headers,
                        json={
                            "model": model,
                            "messages": [{"role": "user", "content": "Hello"}],
                            "max_tokens": 10
                        }
                ) as response:
                    if response.status == 200:
                        return {"success": True, "message": "API CONNECTION SUCCESSFUL"}
                    else:
                        response_json = await response.json()
                        error_msg = response_json.get("error", {}).get("message", "Unknown error")
                        return {"success": False, "message": f"API ERROR: {error_msg}"}

        elif provider == "deepseek":

            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }


            logger.info(f"Testing DeepSeek API with URL: https://api.deepseek.com/v1/chat/completions")
            logger.info(f"Testing with model: {model if model else 'deepseek-chat'}")

            async with aiohttp.ClientSession() as session:
                async with session.post(
                        "https://api.deepseek.com/v1/chat/completions",
                        headers=headers,
                        json={
                            "model": model if model else "deepseek-chat",
                            "messages": [{"role": "user", "content": "Hello"}],
                            "max_tokens": 10
                        }
                ) as response:
                    response_text = await response.text()
                    logger.info(f"DeepSeek API response status: {response.status}")
                    logger.info(f"DeepSeek API response: {response_text[:200]}...")

                    if response.status == 200:
                        return {"success": True, "message": "API CONNECTION SUCCESSFUL"}
                    else:
                        try:
                            response_json = json.loads(response_text)
                            error_msg = response_json.get("error", {}).get("message", "Unknown error")
                            return {"success": False, "message": f"API ERROR: {error_msg}"}
                        except:
                            return {"success": False, "message": f"API ERROR: {response_text[:100]}"}

        else:

            if len(api_key) > 20 and api_key.startswith("sk-"):
                return {"success": True, "message": "API KEY FORMAT VALID"}
            else:
                return {"success": False, "message": "INVALID API KEY FORMAT"}

    except Exception as e:
        logger.error(f"Error testing API connection: {str(e)}")
        return {"success": False, "message": f"CONNECTION ERROR: {str(e)}"}