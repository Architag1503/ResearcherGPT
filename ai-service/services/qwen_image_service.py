import os
import time
import requests
import uuid
from typing import Optional

# Base URL and API Keys
BASE_URL = os.getenv("QWEN_BASE_URL") or os.getenv("DASHSCOPE_BASE_URL") or "https://dashscope-intl.aliyuncs.com/api/v1"
API_KEY = (
    os.getenv("QWEN_API_KEY") 
    or os.getenv("DASHSCOPE_API_KEY") 
    or "sk-ws-H.DDLLPDE.QMOu.MEYCIQCUVNUEB6EfVX9Tp_HgpQPbBTOvtyy6WtoxQfmy-t-MdAIhAJOoYl8VtTmBtMu7HMDJprkhrnnXV04C-PJeXBLd2TlO"
)

# Supported models to attempt in order
CANDIDATE_MODELS = ["qwen-image", "qwen-image-2.0", "wan2.6-t2i", "wanx-v1"]

def _build_academic_prompt(prompt: str, visual_type: str = "diagram") -> str:
    """
    Refines prompts for publication-grade research paper aesthetics.
    """
    vtype = (visual_type or "diagram").lower()
    if "table" in vtype:
        return (
            f"Publication-grade scientific experimental comparison table:\n{prompt}\n\n"
            "Format Guidelines: Clean horizontal table layout, IEEE booktabs style, solid black headers, "
            "sharp typography, high contrast, clean white background, perfectly legible data cells, no blur."
        )
    elif "formula" in vtype or "math" in vtype:
        return (
            f"High-resolution academic mathematical formulation figure:\n{prompt}\n\n"
            "Format Guidelines: Crisp publication-grade LaTeX mathematical notation, centered equation plate, "
            "pure white background, sharp black typography, formal journal layout, high contrast, perfectly clear symbols."
        )
    else:
        return (
            f"Publication-grade academic system architecture diagram:\n{prompt}\n\n"
            "Format Guidelines: Minimalist academic schematic flowchart, clean modular blocks, directional arrows, "
            "clear labels, neutral monochrome or muted blue/slate tones, pure white background, publication vector style."
        )

def generate_qwen_image(
    prompt: str, 
    visual_type: str = "diagram", 
    size: str = "1024*1024"
) -> Optional[str]:
    """
    Calls Qwen / DashScope Text-to-Image API to generate diagrams, tables, or formulas.
    Saves image in uploads/ and returns the relative path ('uploads/qwen_xxx.png').
    Returns None if generation fails or is unauthorized.
    """
    if not API_KEY:
        print("[QwenImageService] Error: No QWEN_API_KEY / DASHSCOPE_API_KEY configured.")
        return None

    full_prompt = _build_academic_prompt(prompt, visual_type)
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable"
    }

    # Normalize base URL (strip trailing slash)
    base = BASE_URL.rstrip('/')

    for model_name in CANDIDATE_MODELS:
        payload = {
            "model": model_name,
            "input": {
                "prompt": full_prompt
            },
            "parameters": {
                "size": size,
                "n": 1
            }
        }

        try:
            print(f"[QwenImageService] Submitting task with model '{model_name}' for {visual_type}...")
            endpoint = f"{base}/services/aigc/text2image/image-synthesis"
            res = requests.post(endpoint, headers=headers, json=payload, timeout=20)
            
            if res.status_code not in (200, 201):
                err_data = res.text[:200]
                print(f"[QwenImageService] Model '{model_name}' returned status {res.status_code}: {err_data}")
                continue

            resp_json = res.json()
            output = resp_json.get("output", {})
            task_id = output.get("task_id")
            
            # Check if synchronous result returned immediately
            results = output.get("results", [])
            if results and results[0].get("url"):
                return _download_and_save(results[0].get("url"), visual_type)

            if not task_id:
                print(f"[QwenImageService] No task_id in response for model '{model_name}'")
                continue

            print(f"[QwenImageService] Task ID: {task_id}. Polling status...")
            # Poll async task
            poll_endpoint = f"{base}/tasks/{task_id}"
            max_attempts = 18
            file_url = None

            for attempt in range(max_attempts):
                time.sleep(2)
                status_res = requests.get(poll_endpoint, headers=headers, timeout=15)
                if status_res.status_code != 200:
                    continue
                
                status_json = status_res.json()
                task_output = status_json.get("output", {})
                task_status = task_output.get("task_status", "").upper()
                print(f"[QwenImageService] Attempt {attempt+1}: Task status '{task_status}'")

                if task_status == "SUCCEEDED":
                    res_list = task_output.get("results", [])
                    if res_list and res_list[0].get("url"):
                        file_url = res_list[0].get("url")
                    break
                elif task_status in ("FAILED", "CANCELED"):
                    print(f"[QwenImageService] Task failed: {task_output.get('message', 'Unknown error')}")
                    break

            if file_url:
                saved_path = _download_and_save(file_url, visual_type)
                if saved_path:
                    return saved_path

        except Exception as e:
            print(f"[QwenImageService] Exception with model '{model_name}': {e}")
            continue

    print("[QwenImageService] All candidate models exhausted without successful image generation.")
    return None

def _download_and_save(file_url: str, visual_type: str) -> Optional[str]:
    """Downloads the generated image from DashScope CDN and saves it in uploads/."""
    try:
        print(f"[QwenImageService] Downloading generated visual from: {file_url[:80]}...")
        img_res = requests.get(file_url, timeout=30)
        if img_res.status_code != 200:
            print(f"[QwenImageService] Failed to download image: {img_res.status_code}")
            return None

        # Resolve uploads directory (supporting both docker /usr/src/app/uploads and local dev uploads)
        uploads_dir = "/usr/src/app/uploads"
        if not os.path.exists(uploads_dir):
            uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "server", "uploads"))
            if not os.path.exists(uploads_dir):
                uploads_dir = "uploads"
                os.makedirs(uploads_dir, exist_ok=True)

        prefix = "qwen_" + visual_type.lower()[:4]
        filename = f"{prefix}_{uuid.uuid4().hex[:12]}.png"
        file_path = os.path.join(uploads_dir, filename)

        with open(file_path, "wb") as f:
            f.write(img_res.content)

        print(f"[QwenImageService] Visual successfully saved to: {file_path}")
        return f"uploads/{filename}"
    except Exception as e:
        print(f"[QwenImageService] Error saving visual file: {e}")
        return None
