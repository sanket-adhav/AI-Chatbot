import google.generativeai as genai
from app.core.config import settings

genai.configure(api_key=settings.gemini_api_key)

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
    max_output_tokens=8192,
    temperature=0.7,
    top_p=0.95,
)

def get_gemini_vision_response(
    instruction: str,
    history: list[dict],
    user_message: str,
    image_bytes: bytes,
    mime_type: str,
    model_name: str | None = None,
) -> tuple[dict, dict]:
    """Send a multimodal message (text + image) to Gemini."""
    model = genai.GenerativeModel(
        model_name=model_name or settings.gemini_model,
        system_instruction=instruction + DETAIL_SUFFIX,
        generation_config=_generation_config,
    )

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
