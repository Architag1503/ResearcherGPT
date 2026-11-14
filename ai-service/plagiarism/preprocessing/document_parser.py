"""
document_parser.py

Section detection, bibliography identification, and structure extraction
from raw text (extracted from PDF/DOCX upstream).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from .text_normalizer import normalize_text


# ---------------------------------------------------------------------------
# Constants — section heading patterns
# ---------------------------------------------------------------------------

# Map canonical section names to regex patterns that match their headings
_SECTION_PATTERNS: List[Tuple[str, re.Pattern]] = [
    ('abstract',      re.compile(r'^\s*abstract\s*$', re.I | re.M)),
    ('introduction',  re.compile(r'^\s*(?:\d+\.?\s+)?introduction\s*$', re.I | re.M)),
    ('related_work',  re.compile(r'^\s*(?:\d+\.?\s+)?related\s+work[s]?\s*$', re.I | re.M)),
    ('methodology',   re.compile(r'^\s*(?:\d+\.?\s+)?(?:methodology|methods?|approach|proposed\s+method)\s*$', re.I | re.M)),
    ('experiments',   re.compile(r'^\s*(?:\d+\.?\s+)?(?:experiments?|experimental\s+(?:setup|results?))\s*$', re.I | re.M)),
    ('results',       re.compile(r'^\s*(?:\d+\.?\s+)?results?\s*$', re.I | re.M)),
    ('discussion',    re.compile(r'^\s*(?:\d+\.?\s+)?discussion\s*$', re.I | re.M)),
    ('conclusion',    re.compile(r'^\s*(?:\d+\.?\s+)?conclusions?\s*$', re.I | re.M)),
    ('references',    re.compile(r'^\s*(?:references?|bibliography)\s*$', re.I | re.M)),
    ('appendix',      re.compile(r'^\s*(?:appendix|supplementary)\s*', re.I | re.M)),
]

# Patterns that identify a table or figure caption line
_CAPTION_RE = re.compile(r'^(?:Table|Figure|Fig\.|Algorithm)\s+\d+', re.I)

# Pattern for inline math markers in PDF-extracted text
_INLINE_MATH_RE = re.compile(r'\$[^$\n]{1,120}\$')


@dataclass
class DocumentSection:
    """One detected section of a document."""
    name: str
    heading: str
    text: str
    start_char: int
    end_char: int
    is_bibliography: bool = False


@dataclass
class ParsedDocument:
    """Result of parsing a full document."""
    document_id: str
    raw_text: str
    sections: Dict[str, DocumentSection] = field(default_factory=dict)
    # Ordered list of section names as they appear in the document
    section_order: List[str] = field(default_factory=list)
    # Extracted reference strings (from bibliography)
    references: List[str] = field(default_factory=list)
    # Lines identified as captions (not ordinary prose)
    captions: List[str] = field(default_factory=list)
    # Lines identified as math expressions
    math_expressions: List[str] = field(default_factory=list)
    # Was section detection successful?
    structure_detected: bool = False

    def get_body_text(self, exclude_sections: Optional[List[str]] = None) -> str:
        """Return concatenated body text, optionally excluding certain sections."""
        exclude = set(exclude_sections or ['references', 'bibliography', 'appendix'])
        parts = []
        for name in self.section_order:
            if name in exclude:
                continue
            sec = self.sections.get(name)
            if sec and sec.text.strip():
                parts.append(sec.text)
        if parts:
            return '\n\n'.join(parts)
        # Fallback: return everything
        return self.raw_text

    def get_section_texts(self) -> Dict[str, str]:
        """Return {section_name: text} for all sections."""
        return {name: sec.text for name, sec in self.sections.items()}


class DocumentParser:
    """
    Parses raw document text into sections, identifies bibliography,
    extracts captions and math expressions.
    """

    def parse(self, text: str, document_id: str) -> ParsedDocument:
        """Parse *text* into a ParsedDocument."""
        doc = ParsedDocument(document_id=document_id, raw_text=text)

        # 1. Extract captions and math before section splitting
        doc.captions = self._extract_captions(text)
        doc.math_expressions = _INLINE_MATH_RE.findall(text)

        # 2. Find section boundaries
        boundaries = self._find_section_boundaries(text)

        if len(boundaries) >= 2:
            doc.structure_detected = True
            self._build_sections(text, boundaries, doc)
        else:
            # Fallback: treat everything as one 'body' section
            doc.sections['body'] = DocumentSection(
                name='body',
                heading='',
                text=text,
                start_char=0,
                end_char=len(text),
                is_bibliography=False,
            )
            doc.section_order = ['body']

        # 3. Extract references list from bibliography section
        bib_sec = doc.sections.get('references') or doc.sections.get('bibliography')
        if bib_sec:
            doc.references = self._extract_reference_entries(bib_sec.text)

        return doc

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _find_section_boundaries(text: str) -> List[Tuple[int, str, str]]:
        """
        Returns [(char_offset, canonical_name, heading_text), ...] sorted by offset.
        """
        found: List[Tuple[int, str, str]] = []
        for canonical, pattern in _SECTION_PATTERNS:
            for m in pattern.finditer(text):
                found.append((m.start(), canonical, m.group(0).strip()))
        # Sort by position, deduplicate overlapping matches keeping earliest
        found.sort(key=lambda x: x[0])
        deduplicated: List[Tuple[int, str, str]] = []
        seen_names: set = set()
        for offset, name, heading in found:
            if name not in seen_names:
                deduplicated.append((offset, name, heading))
                seen_names.add(name)
        return deduplicated

    @staticmethod
    def _build_sections(
        text: str,
        boundaries: List[Tuple[int, str, str]],
        doc: ParsedDocument,
    ) -> None:
        """Populate doc.sections and doc.section_order from boundary list."""
        # Add a sentinel at end
        sentinel = [(len(text), '__end__', '')]
        all_bounds = boundaries + sentinel

        for i, (start, name, heading) in enumerate(boundaries):
            end = all_bounds[i + 1][0]
            # Skip the heading line itself from section text
            section_text = text[start:end]
            # Remove the heading from section body
            heading_end = section_text.find('\n')
            if heading_end != -1:
                section_text = section_text[heading_end + 1:].strip()

            is_bib = name in ('references', 'bibliography')
            doc.sections[name] = DocumentSection(
                name=name,
                heading=heading,
                text=section_text,
                start_char=start,
                end_char=end,
                is_bibliography=is_bib,
            )
            doc.section_order.append(name)

    @staticmethod
    def _extract_reference_entries(bib_text: str) -> List[str]:
        """
        Split bibliography text into individual reference entries.
        Handles both numeric ([1] Author...) and author-year formats.
        """
        # Numeric references: [1] ...
        numeric_entries = re.split(r'(?=\[\d+\])', bib_text)
        if len(numeric_entries) > 2:
            return [e.strip() for e in numeric_entries if e.strip()]

        # Author-year or plain paragraph entries: split on double newline
        entries = [e.strip() for e in re.split(r'\n{2,}', bib_text) if e.strip()]
        return entries

    @staticmethod
    def _extract_captions(text: str) -> List[str]:
        """Extract figure/table captions."""
        captions = []
        for line in text.splitlines():
            if _CAPTION_RE.match(line.strip()):
                captions.append(line.strip())
        return captions


# ---------------------------------------------------------------------------
# Module-level convenience function
# ---------------------------------------------------------------------------

_default_parser = DocumentParser()


def parse_document(text: str, document_id: str) -> ParsedDocument:
    """Parse *text* using the default DocumentParser."""
    return _default_parser.parse(text, document_id=document_id)
