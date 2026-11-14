"""
text_normalizer.py

Unicode normalization, whitespace cleanup, and punctuation standardization
while preserving original text and character offsets.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import List, Tuple


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------

@dataclass
class NormalizedSpan:
    """Maps a normalized token back to the original text position."""
    original_start: int
    original_end: int
    original_text: str
    normalized_text: str


@dataclass
class NormalizationResult:
    """Result of normalizing a single text string."""
    original_text: str
    normalized_text: str
    # List of (orig_offset, norm_offset) mapping pairs
    offset_map: List[Tuple[int, int]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Shared academic stop-phrase patterns (used by common_phrase_filter too)
# ---------------------------------------------------------------------------

# Mathematical / formula sentinel – we do NOT normalize inside these regions
_MATH_PATTERNS = [
    r'\$[^$]+\$',           # inline LaTeX $...$
    r'\\\([^)]+\\\)',       # LaTeX \(...\)
    r'\\\[[^\]]+\\\]',     # LaTeX \[...\]
    r'\b(?:[A-Z][a-z]*_\{?\d\}?)\b',  # subscript notation  X_{i}
]
_MATH_RE = re.compile('|'.join(_MATH_PATTERNS))

# Ligature corrections
_LIGATURES = {
    '\ufb00': 'ff', '\ufb01': 'fi', '\ufb02': 'fl',
    '\ufb03': 'ffi', '\ufb04': 'ffl', '\ufb06': 'st',
    '\u00e6': 'ae', '\u0153': 'oe',
}


class TextNormalizer:
    """
    Stateless text normalizer.  Normalizes Unicode, ligatures, whitespace,
    and punctuation without destroying mathematical notation.
    """

    def __init__(
        self,
        unicode_form: str = 'NFC',
        fix_ligatures: bool = True,
        collapse_whitespace: bool = True,
        normalize_quotes: bool = True,
        normalize_dashes: bool = True,
        preserve_math: bool = True,
    ):
        self.unicode_form = unicode_form
        self.fix_ligatures = fix_ligatures
        self.collapse_whitespace = collapse_whitespace
        self.normalize_quotes = normalize_quotes
        self.normalize_dashes = normalize_dashes
        self.preserve_math = preserve_math

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def normalize(self, text: str) -> NormalizationResult:
        """Normalize *text* and return a NormalizationResult with offset map."""
        if not text:
            return NormalizationResult(original_text='', normalized_text='', offset_map=[])

        original = text

        # 1. Unicode NFC/NFKC
        text = unicodedata.normalize(self.unicode_form, text)

        # 2. Ligature replacement
        if self.fix_ligatures:
            for lig, rep in _LIGATURES.items():
                text = text.replace(lig, rep)

        # 3. Protect math regions so we don't mangle them
        math_placeholders: List[Tuple[str, str]] = []
        if self.preserve_math:
            def _protect(m: re.Match) -> str:
                placeholder = f'__MATH_{len(math_placeholders):04d}__'
                math_placeholders.append((placeholder, m.group(0)))
                return placeholder
            text = _MATH_RE.sub(_protect, text)

        # 4. Quote normalization
        if self.normalize_quotes:
            text = re.sub(r'[\u2018\u2019\u201a\u201b\u2032]', "'", text)
            text = re.sub(r'[\u201c\u201d\u201e\u201f\u2033]', '"', text)

        # 5. Dash normalization
        if self.normalize_dashes:
            text = re.sub(r'[\u2013\u2014\u2015]', '-', text)

        # 6. Remove control characters (except \n \t)
        text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)

        # 7. Whitespace collapse
        if self.collapse_whitespace:
            text = re.sub(r'[ \t]+', ' ', text)
            text = re.sub(r'\n{3,}', '\n\n', text)

        # 8. Restore math
        for placeholder, original_math in math_placeholders:
            text = text.replace(placeholder, original_math)

        # 9. Strip leading/trailing whitespace
        text = text.strip()

        # Build a simple character-level offset map
        offset_map = _build_offset_map(original, text)

        return NormalizationResult(
            original_text=original,
            normalized_text=text,
            offset_map=offset_map,
        )

    def normalize_text(self, text: str) -> str:
        """Convenience method – returns only the normalized string."""
        return self.normalize(text).normalized_text


# ---------------------------------------------------------------------------
# Module-level convenience function
# ---------------------------------------------------------------------------

_default_normalizer = TextNormalizer()


def normalize_text(text: str) -> str:
    """Normalize text using default settings."""
    return _default_normalizer.normalize_text(text)


def normalize_with_offsets(text: str) -> NormalizationResult:
    """Normalize text and return full NormalizationResult including offset map."""
    return _default_normalizer.normalize(text)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _build_offset_map(original: str, normalized: str) -> List[Tuple[int, int]]:
    """
    Build a list of (original_char_offset, normalized_char_offset) pairs
    using a simple two-pointer diff.  Not a perfect diff but good enough
    for locating approximate positions in the original PDF/DOCX.
    """
    pairs: List[Tuple[int, int]] = []
    oi, ni = 0, 0
    while oi < len(original) and ni < len(normalized):
        pairs.append((oi, ni))
        # Advance both pointers; skip chars that were removed in normalized
        if original[oi] == normalized[ni]:
            oi += 1
            ni += 1
        else:
            oi += 1  # character was normalized away
    return pairs
