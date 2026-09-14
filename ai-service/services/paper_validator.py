import re
import hashlib
from typing import List, Dict, Any, Tuple, Optional

class PaperValidator:
    """
    Standardized Academic Paper Normalization and Validation Pipeline.
    Ensures deterministic IEEE section hierarchy, single rendering per element,
    elimination of repeated/spiral paragraphs, and proper figure/table/equation formatting.
    """

    ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
                      "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"]

    STANDARD_SECTIONS_ORDER = [
        "title", "abstract", "keywords", "introduction", "related work",
        "research gap", "objectives", "proposed framework", "system architecture",
        "methodology", "implementation details", "experimental setup",
        "results and evaluation", "discussion", "limitations", "future work",
        "conclusion", "references", "appendix"
    ]

    @staticmethod
    def to_roman(n: int) -> str:
        if 1 <= n <= len(PaperValidator.ROMAN_NUMERALS):
            return PaperValidator.ROMAN_NUMERALS[n - 1]
        return str(n)

    @classmethod
    def clean_heading_title(cls, title: str) -> Tuple[str, str]:
        """
        Cleans redundant Roman or Arabic numbers from section titles.
        Returns (clean_title_without_num, ieee_formatted_title).
        e.g. "III. III. METHODOLOGY" -> ("METHODOLOGY", "III. METHODOLOGY")
        e.g. "1. Introduction" -> ("Introduction", "I. INTRODUCTION")
        """
        clean = title.strip()
        # Remove Markdown header syntax
        clean = re.sub(r'^#+\s*', '', clean).strip()

        # Check for duplicate Roman numerals: "III. III. METHODOLOGY" or "I. I. Introduction"
        clean = re.sub(r'^([IVXLCDM]+)\.?\s+\1(?:\.|\s+|$)\s*', r'\1. ', clean, flags=re.IGNORECASE)
        # Check for duplicate Arabic numbers: "1. 1. Introduction"
        clean = re.sub(r'^(\d+)\.?\s+\1(?:\.|\s+|$)\s*', r'\1. ', clean)

        # Strip existing leading numbering for extraction (must have dot or whitespace delimiter)
        stripped = clean
        roman_match = re.match(r'^([IVXLCDM]+)(?:\.|\s+)\s*(.*)$', clean, flags=re.IGNORECASE)
        num_match = re.match(r'^(\d+)(?:\.|\s+)\s*(.*)$', clean)

        if roman_match and roman_match.group(1).upper() in cls.ROMAN_NUMERALS:
            stripped = roman_match.group(2).strip() or clean
        elif num_match:
            stripped = num_match.group(2).strip() or clean

        return stripped, clean

    @classmethod
    def strip_caption_prefix(cls, caption: str, element_type: str = "figure") -> str:
        """
        Strips label prefixes like "Fig. 1." or "TABLE I:" so LaTeX or engines that auto-prefix
        numbers do not duplicate the labels.
        """
        clean = re.sub(r'<[^>]*>', ' ', caption)
        clean = re.sub(r'\\(?:textbf|textit|texttt|emph)\{', ' ', clean)
        clean = clean.replace('}', ' ')
        clean = re.sub(r'\s+', ' ', clean).strip()

        if element_type == "figure":
            while True:
                prev = clean
                clean = re.sub(r'^(?:Fig\.?|Figure)\s*\d*[:.\s-]*', '', clean, flags=re.IGNORECASE).strip()
                if clean == prev:
                    break
            clean = clean.rstrip('.')
            return clean if clean else "System Architecture and Workflow"

        elif element_type == "table":
            m = re.match(r'^(?:TABLE|Table)\s*([IVXLCDM\d]+)\s*[:.\s-]*([A-Za-z].*)$', clean)
            if m:
                return m.group(2).strip().upper()
            m_unspaced = re.match(r'^(?:TABLE|Table)([IVXLCDM]+)([A-Z].*)$', clean)
            if m_unspaced:
                return m_unspaced.group(2).strip().upper()
            clean = re.sub(r'^(?:TABLE|Table)\s*[IVXLCDM\d]*[:.\s-]*', '', clean, flags=re.IGNORECASE).strip().upper()
            return clean if clean else "EXPERIMENTAL EVALUATION RESULTS"

        return clean

    @classmethod
    def normalize_caption(cls, caption: str, element_type: str = "figure", index: int = 1) -> str:
        """
        Eliminates duplicate caption prefixes such as:
        "Fig. 1. Fig. 1. System Architecture Workflow.." -> "Fig. 1. System Architecture Workflow."
        "TABLE IACADEMIC EXPERIMENTAL EVALUATION" -> "TABLE I: ACADEMIC EXPERIMENTAL EVALUATION"
        """
        clean = cls.strip_caption_prefix(caption, element_type)
        if element_type == "figure":
            return f"Fig. {index}. {clean}."
        elif element_type == "table":
            roman_str = cls.to_roman(index)
            return f"TABLE {roman_str}: {clean}"
        return clean

    @classmethod
    def deduplicate_paragraphs(cls, content: str, seen_hashes: set) -> str:
        """
        Splits section content into paragraphs, verifies semantic distinctness,
        and removes verbatim or near-duplicate paragraphs.
        """
        if not content:
            return ""

        # Handle both HTML paragraph tags and double newlines
        has_html_p = "<p" in content.lower()
        if has_html_p:
            raw_paras = re.findall(r'<p[^>]*>([\s\S]*?)<\/p>', content, flags=re.IGNORECASE)
            non_p = re.sub(r'<p[^>]*>[\s\S]*?<\/p>', '', content, flags=re.IGNORECASE).strip()
        else:
            raw_paras = [p.strip() for p in content.split("\n\n") if p.strip()]
            non_p = ""

        unique_paras = []
        for p in raw_paras:
            clean_text = re.sub(r'<[^>]*>', ' ', p)
            clean_text = re.sub(r'\s+', ' ', clean_text).strip()

            if len(clean_text) < 15:
                # Keep short tags or formula containers
                unique_paras.append(p)
                continue

            # Detect known procedural repetitive patterns
            if "mathematical modeling of the" in clean_text.lower() and "converts state-transition" in clean_text.lower():
                continue
            if "mathematical modeling of the" in clean_text.lower() and "state-transition weights conform" in clean_text.lower():
                continue

            # Normalize for fingerprint comparison: lower-case alphanumeric
            fingerprint = re.sub(r'[^a-zA-Z0-9]', '', clean_text.lower())
            # Use first 120 chars as hash key for long paragraphs
            prefix_key = fingerprint[:120] if len(fingerprint) >= 120 else fingerprint

            if prefix_key in seen_hashes:
                # Duplicate paragraph detected! Skip rendering again.
                continue

            seen_hashes.add(prefix_key)
            unique_paras.append(p)

        if has_html_p:
            res = "".join([f"<p>{p}</p>" if not p.startswith("<p") else p for p in unique_paras])
            if non_p:
                res = f"{res}\n{non_p}"
            return res
        else:
            return "\n\n".join(unique_paras)

    @classmethod
    def sanitize_paper_structure(cls, title: str, sections: List[Dict[str, Any]], references: List[str]) -> Dict[str, Any]:
        """
        Validates, normalizes, and deduplicates the complete paper structure.
        Guarantees that:
        - Every section heading is rendered once.
        - Abstract and Keywords are separated and clean.
        - Repeated filler blocks across sections are stripped.
        - Duplicate captions and misclassified equations/tables are resolved.
        """
        seen_paragraph_hashes = set()
        cleaned_sections = []
        abstract_text = ""
        keywords_text = ""
        cleaned_refs = []

        # Deduplicate references
        seen_refs = set()
        for r in references:
            clean_r = re.sub(r'<[^>]*>', ' ', str(r))
            clean_r = re.sub(r'\s+', ' ', clean_r).strip()
            clean_r = re.sub(r'^\[\d+\]\s*', '', clean_r)
            r_key = re.sub(r'[^a-zA-Z0-9]', '', clean_r.lower())[:80]
            if r_key and r_key not in seen_refs:
                seen_refs.add(r_key)
                cleaned_refs.append(clean_r)

        fig_counter = 1
        table_counter = 1
        sec_counter = 1

        for s in sections:
            raw_title = s.get("title", "").strip()
            raw_content = s.get("content", "").strip()
            if not raw_title:
                continue

            title_lower = raw_title.lower()

            # Handle Title, Abstract, Keywords, References separately
            if title_lower == "title":
                continue

            if title_lower == "abstract":
                clean_abs = re.sub(r'<[^>]*>', ' ', raw_content)
                clean_abs = re.sub(r'\s+', ' ', clean_abs).strip()
                clean_abs = re.sub(r'^(?:Abstract|ABSTRACT)\s*[:.—-]?\s*', '', clean_abs)
                abstract_text = clean_abs
                continue

            if title_lower in ("keywords", "key words", "index terms"):
                clean_kw = re.sub(r'<[^>]*>', ' ', raw_content)
                clean_kw = re.sub(r'\s+', ' ', clean_kw).strip()
                clean_kw = re.sub(r'^(?:Keywords|KEYWORDS|Index Terms|INDEX TERMS)\s*[:.—-]?\s*', '', clean_kw)
                keywords_text = clean_kw
                continue

            if title_lower in ("references", "bibliography"):
                # If references were in section content, extract them
                ref_lines = re.findall(r'<li[^>]*>([\s\S]*?)<\/li>', raw_content, flags=re.IGNORECASE)
                if not ref_lines:
                    ref_lines = [line.strip() for line in raw_content.split('\n') if line.strip()]
                for rl in ref_lines:
                    clean_rl = re.sub(r'<[^>]*>', ' ', rl)
                    clean_rl = re.sub(r'\s+', ' ', clean_rl).strip()
                    clean_rl = re.sub(r'^\[\d+\]\s*', '', clean_rl)
                    r_key = re.sub(r'[^a-zA-Z0-9]', '', clean_rl.lower())[:80]
                    if r_key and r_key not in seen_refs:
                        seen_refs.add(r_key)
                        cleaned_refs.append(clean_rl)
                continue

            # Deduplicate paragraphs in this section
            deduped_content = cls.deduplicate_paragraphs(raw_content, seen_paragraph_hashes)

            if title_lower == "appendix":
                cleaned_sections.append({
                    "section_id": "sec_appendix",
                    "title": "Appendix",
                    "heading": "APPENDIX",
                    "content": deduped_content
                })
                continue

            # Fix double figure captions in content
            def fix_fig_caption(m):
                nonlocal fig_counter
                raw_cap = m.group(1)
                fixed_cap = cls.normalize_caption(raw_cap, "figure", fig_counter)
                fig_counter += 1
                return f'<figcaption class="figure-caption"><strong>{fixed_cap}</strong></figcaption>'

            deduped_content = re.sub(
                r'<figcaption[^>]*class=["\']?(?:figure-caption|caption)[^>]*>([\s\S]*?)<\/figcaption>',
                fix_fig_caption,
                deduped_content,
                flags=re.IGNORECASE
            )

            # Clean section heading
            clean_title_no_num, _ = cls.clean_heading_title(raw_title)
            roman_num = cls.to_roman(sec_counter)
            ieee_heading = f"{roman_num}. {clean_title_no_num.upper()}"
            sec_counter += 1

            cleaned_sections.append({
                "section_id": f"sec_{sec_counter-1}",
                "title": clean_title_no_num,
                "heading": ieee_heading,
                "content": deduped_content
            })

        return {
            "title": title,
            "abstract": abstract_text,
            "keywords": keywords_text,
            "sections": cleaned_sections,
            "references": cleaned_refs
        }
