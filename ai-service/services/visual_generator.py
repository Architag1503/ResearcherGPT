import os
from typing import Optional
from services.qwen_image_service import generate_qwen_image
from services.napkin_service import generate_diagram as generate_napkin_diagram

def generate_visual(prompt: str, visual_type: str = "diagram", size: str = "1024*1024") -> Optional[str]:
    """
    Unified academic visual generator:
    1. Attempts Qwen / DashScope image generation API first (supports diagrams, tables, formulas).
    2. If Qwen fails or is unauthorized, automatically falls back to Napkin AI.
    3. Returns the local relative uploads path (e.g. 'uploads/qwen_xxx.png' or 'uploads/napkin_xxx.png') or None.
    """
    print(f"[VisualGenerator] Generating {visual_type} using primary engine (Qwen AI)...")
    try:
        qwen_img = generate_qwen_image(prompt, visual_type=visual_type, size=size)
        if qwen_img:
            print(f"[VisualGenerator] Qwen AI successfully produced visual: {qwen_img}")
            return qwen_img
    except Exception as e:
        print(f"[VisualGenerator] Qwen AI attempt failed: {e}")

    # Fallback to Napkin AI for diagrams and schematics
    print(f"[VisualGenerator] Primary engine did not produce image, engaging secondary fallback (Napkin AI)...")
    try:
        napkin_img = generate_napkin_diagram(prompt)
        if napkin_img:
            print(f"[VisualGenerator] Napkin AI successfully produced diagram: {napkin_img}")
            return napkin_img
    except Exception as e:
        print(f"[VisualGenerator] Napkin AI fallback failed: {e}")

    return None
