from typing import List, Dict, Any

def build_merged_context(
    retrieved_chunks: List[Dict[str, Any]],
    notes: List[Dict[str, Any]] = None,
    gaps: List[Dict[str, Any]] = None,
    chat_history: List[Dict[str, Any]] = None
) -> str:
    """
    Consolidates retrieved paper chunks, research notes, gaps, and previous chat context
    into a structured markdown block for LLM prompts.
    """
    context_blocks = []

    # 1. Add Retrieved Chunks
    if retrieved_chunks:
        context_blocks.append("### SECTION A: RESEARCH PAPER CHUNKS")
        for idx, c in enumerate(retrieved_chunks):
            p_title = c.get("paper_title") or c.get("title") or f"PaperRef_{c.get('paper_id')}"
            page = c.get("page_number", "N/A")
            score = c.get("confidence_score", 1.0)
            context_blocks.append(
                f"**[Chunk {idx+1}] Source: {p_title} (Page {page}, Match Score: {score:.2f})**\n"
                f"{c['text_content']}\n"
            )

    # 2. Add Research Notes
    if notes:
        context_blocks.append("### SECTION B: RESEARCHER NOTES & OBSERVATIONS")
        for idx, n in enumerate(notes):
            n_title = n.get("title", "Untitled Note")
            tags = ", ".join(n.get("tags", []))
            context_blocks.append(
                f"**[Note {idx+1}] {n_title}** (Tags: {tags})\n"
                f"{n.get('content', '')}\n"
            )

    # 3. Add Research Gaps
    if gaps:
        context_blocks.append("### SECTION C: DETECTED RESEARCH GAPS")
        for idx, g in enumerate(gaps):
            context_blocks.append(
                f"**[Gap {idx+1}] {g.get('title')}** (Category: {g.get('category')})\n"
                f"Description: {g.get('description')}\n"
            )

    # 4. Add Chat History
    if chat_history:
        context_blocks.append("### SECTION D: RECENT CONVERSATION CONTEXT")
        for h in chat_history[-4:]:  # last 4 turns
            role = "User" if h.get("role") == "user" else "Assistant"
            context_blocks.append(f"*{role}*: {h.get('content')}")
        context_blocks.append("")

    return "\n".join(context_blocks)
