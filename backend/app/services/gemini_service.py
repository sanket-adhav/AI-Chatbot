import warnings
import asyncio
import threading
import logging
import google.generativeai as genai
from app.core.config import settings

logger = logging.getLogger(__name__)

# Suppress FutureWarning from the still-functional google-generativeai package
warnings.filterwarnings("ignore", category=FutureWarning, module="google.generativeai")

genai.configure(api_key=settings.gemini_api_key)

# Appended to every agent's instruction to enforce detailed, structured responses
DETAIL_SUFFIX = (
    "\n\n"
    "RESPONSE STYLE RULES — follow these strictly:\n"
    "1. Always give thorough, detailed, well-structured answers. Never give one-liners.\n"
    "2. Use markdown formatting: headers (##), bullet points, numbered lists, bold, and code blocks where appropriate.\n"
    "3. For any concept or question, explain the WHAT, WHY, and HOW.\n"
    "4. If code is relevant, always include working code examples with comments.\n"
    "5. End longer answers with a short summary or key takeaways section.\n"
    "6. Aim for responses that are comprehensive yet easy to read — at least 3-5 paragraphs for substantive questions."
)

_generation_config = genai.types.GenerationConfig(
    max_output_tokens=8192,   # allow long responses
    temperature=0.7,
    top_p=0.95,
)


def get_gemini_response(
    instruction: str,
    history: list[dict],  # [{"role": "user"|"model", "parts": [str]}]
    user_message: str,
    model_name: str | None = None,
) -> tuple[dict, dict]:
    """
    Send a message to Gemini with full conversation history and system instruction.
    Returns (assistant_text_response, token_usage_dict).
    """
    model = genai.GenerativeModel(
        model_name=model_name or settings.gemini_model,
        system_instruction=instruction + DETAIL_SUFFIX,
        generation_config=_generation_config,
    )

    chat = model.start_chat(history=history)
    response = chat.send_message(user_message)
    prompt_tokens = getattr(response.usage_metadata, "prompt_token_count", 0) if hasattr(response, "usage_metadata") else 0
    completion_tokens = getattr(response.usage_metadata, "candidates_token_count", 0) if hasattr(response, "usage_metadata") else 0
    total_tokens = getattr(response.usage_metadata, "total_token_count", 0) if hasattr(response, "usage_metadata") else 0
    
    token_usage = {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens
    }
    return response.text.strip(), token_usage


def get_gemini_vision_response(
    instruction: str,
    history: list[dict],
    user_message: str,
    image_bytes: bytes,
    mime_type: str,
    model_name: str | None = None,
) -> tuple[dict, dict]:
    """
    Send a multimodal message (text + image) to Gemini.
    Image is sent as inline binary data alongside the user's text prompt.
    Returns (assistant_text_response, token_usage_dict).
    """
    model = genai.GenerativeModel(
        model_name=model_name or settings.gemini_model,
        system_instruction=instruction + DETAIL_SUFFIX,
        generation_config=_generation_config,
    )

    # Build the user content part: text + image blob
    image_part = {"mime_type": mime_type, "data": image_bytes}
    text_part = user_message if user_message else "Please analyze this image in detail."

    chat = model.start_chat(history=history)
    response = chat.send_message([text_part, image_part])
    prompt_tokens = getattr(response.usage_metadata, "prompt_token_count", 0) if hasattr(response, "usage_metadata") else 0
    completion_tokens = getattr(response.usage_metadata, "candidates_token_count", 0) if hasattr(response, "usage_metadata") else 0
    total_tokens = getattr(response.usage_metadata, "total_token_count", 0) if hasattr(response, "usage_metadata") else 0
    
    token_usage = {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens
    }
    return response.text.strip(), token_usage


async def stream_gemini_response(
    instruction: str,
    history: list[dict],
    user_message: str,
    model_name: str | None = None,
):
    """
    Async generator that streams Gemini response token-by-token.
    Uses a background thread + asyncio.Queue to wrap Gemini's synchronous
    streaming API without blocking the FastAPI event loop.
    """
    model = genai.GenerativeModel(
        model_name=model_name or settings.gemini_model,
        system_instruction=instruction + DETAIL_SUFFIX,
        generation_config=_generation_config,
    )
    chat = model.start_chat(history=history)

    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()
    _SENTINEL = object()  # signals end of stream

    def _run_stream():
        """
        Runs in a background thread: calls Gemini with stream=True,
        puts each text chunk onto the asyncio queue, and signals done.
        """
        try:
            response = chat.send_message(user_message, stream=True)
            for chunk in response:
                text = getattr(chunk, "text", None)
                if text:
                    loop.call_soon_threadsafe(queue.put_nowait, text)
            prompt_tokens = getattr(response.usage_metadata, "prompt_token_count", 0) if hasattr(response, "usage_metadata") else 0
            completion_tokens = getattr(response.usage_metadata, "candidates_token_count", 0) if hasattr(response, "usage_metadata") else 0
            total_tokens = getattr(response.usage_metadata, "total_token_count", 0) if hasattr(response, "usage_metadata") else 0
            
            loop.call_soon_threadsafe(queue.put_nowait, {
                "token_usage": {
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": total_tokens
                }
            })
        except Exception as exc:
            loop.call_soon_threadsafe(queue.put_nowait, exc)
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, _SENTINEL)

    thread = threading.Thread(target=_run_stream, daemon=True)
    thread.start()

    while True:
        item = await queue.get()
        if item is _SENTINEL:
            break
        if isinstance(item, Exception):
            logger.error(f"Gemini streaming error: {item}")
            raise item
        yield item
