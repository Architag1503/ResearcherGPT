import os
import time
import requests
import uuid
from typing import Optional

# Base URL and keys
BASE_URL = "https://api.napkin.ai"
TOKEN = os.getenv("NAPKIN_API_KEY") or os.getenv("NAPKIN_API") or "sk-6ecef4ad8740560e38a38c6df90e7975f4ff5aca71882ff9d84f50c2f9a2ac15"

def generate_diagram(content: str, format_type: str = "png") -> Optional[str]:
    """
    Calls Napkin AI API to generate a diagram for research papers.
    Saves the output in /usr/src/app/uploads/ and returns the relative path (uploads/...).
    Returns None if any step fails.
    """
    if not TOKEN:
        print("[NapkinService] Error: No API key configured.")
        return None

    # Optimize content prompt for academic diagrams
    # We want a clean, minimalist, professional schematic
    optimized_content = (
        f"{content}\n\n"
        "Style Guidelines: Generate as a clean, publication-grade academic diagram. "
        "Use a professional schematic style, minimalist structure, clear labels, and logical flow. "
        "Do not use casual hand-drawn, sketch, colorful, or comic layouts. Use neutral, monochrome tones."
    )

    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {
        "format": format_type,
        "content": optimized_content,
        "transparent_background": True,
        "width": 1000,
        "orientation": "auto"
    }

    try:
        print(f"[NapkinService] Triggering visual generation for prompt: {content[:80]}...")
        res = requests.post(f"{BASE_URL}/v1/visual", headers=headers, json=payload, timeout=25)
        if res.status_code not in (200, 201):
            print(f"[NapkinService] POST /v1/visual failed: {res.status_code} - {res.text}")
            return None
        
        request_id = res.json().get("id")
        if not request_id:
            print("[NapkinService] Failed to get request_id from response")
            return None
            
        print(f"[NapkinService] Request ID: {request_id}. Polling status...")
        
        # Poll status
        file_url = None
        max_attempts = 25
        for attempt in range(max_attempts):
            time.sleep(2)
            status_res = requests.get(f"{BASE_URL}/v1/visual/{request_id}/status", headers=headers, timeout=15)
            if status_res.status_code != 200:
                print(f"[NapkinService] Status poll failed on attempt {attempt+1}: {status_res.status_code}")
                continue
                
            status_data = status_res.json()
            status = status_data.get("status")
            print(f"[NapkinService] Poll attempt {attempt+1}: status is '{status}'")
            
            if status == "completed":
                files = status_data.get("generated_files", [])
                if files:
                    file_url = files[0].get("url")
                    break
                else:
                    print("[NapkinService] Completed but generated_files list is empty")
                    return None
            elif status == "failed":
                print("[NapkinService] Generation failed on Napkin side.")
                return None
                
        if not file_url:
            print("[NapkinService] Timed out waiting for diagram generation.")
            return None

        # Download the file
        print(f"[NapkinService] Downloading diagram from: {file_url}")
        file_res = requests.get(file_url, headers=headers, timeout=30)
        if file_res.status_code != 200:
            print(f"[NapkinService] Failed to download visual file: {file_res.status_code}")
            return None

        # Ensure uploads folder exists in container
        uploads_dir = "/usr/src/app/uploads"
        if not os.path.exists(uploads_dir):
            # Fallback path if running outside Docker in dev
            uploads_dir = "uploads"
            if not os.path.exists(uploads_dir):
                os.makedirs(uploads_dir, exist_ok=True)

        filename = f"napkin_{uuid.uuid4().hex}.{format_type}"
        file_path = os.path.join(uploads_dir, filename)
        
        with open(file_path, "wb") as f:
            f.write(file_res.content)
            
        print(f"[NapkinService] Diagram successfully saved to: {file_path}")
        return f"uploads/{filename}"

    except Exception as e:
        print(f"[NapkinService] Unexpected error occurred: {e}")
        return None
