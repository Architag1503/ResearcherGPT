"""
sentence_segmenter.py

Sentence segmentation using NLTK with a regex fallback.
Preserves citation markers and mathematical expressions.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Optional

try:
    import nltk
    # Ensure punkt tokenizer data is available
    try:
        nltk.data.find('tokenizers/punkt_tab')
    except LookupError:
        try:
            nltk.download('punkt_tab', quiet=True)
        except Exception:
            pass
    try:
        nltk.data.find('tokenizers/punkt')
    except LookupError:
        try:
            nltk.download('punkt', quiet=True)
        except Exception:
            pass
    _NLTK_AVAILABLE = True
except ImportError:
    _NLTK_AVAILABLE = False


@dataclass
class Sentence:
    """A single segmented sentence with position metadata."""
    text: str
    start_offset: int   # character offset in the source paragraph/document
    end_offset: int
    sentence_index: int
    paragraph_id: Optional[str] = None
    document_id: Optional[str] = None
    # Normalized version (populated downstream)
    normalized_text: str = ''


class SentenceSegmenter:
    """
    Segments text into sentences, preserving citation markers and
    mathematical notation.
    """

    # Abbreviations that should NOT trigger a sentence break
    _ABBREVS = {
        'fig', 'eq', 'eqs', 'sec', 'ref', 'refs', 'tab', 'vs',
        'approx', 'e.g', 'i.e', 'et al', 'cf', 'al', 'dr', 'mr',
        'mrs', 'prof', 'st', 'ave', 'dept', 'univ', 'est',
    }

    def __init__(self, min_sentence_length: int = 10):
        self.min_sentence_length = min_sentence_length
        self._tokenizer = None
        if _NLTK_AVAILABLE:
            try:
                from nltk.tokenize import PunktSentenceTokenizer
                # Use default English punkt model
                self._tokenizer = nltk.data.load('tokenizers/punkt_tab/english.pickle')
            except Exception:
                try:
                    self._tokenizer = nltk.data.load('tokenizers/punkt/english.pickle')
                except Exception:
                    self._tokenizer = None

    def segment(self, text: str, document_id: str = '', paragraph_id: str = '') -> List[Sentence]:
        """Segment *text* into sentences."""
        if not text or not text.strip():
            return []

        # Protect citation markers so they don't disrupt sentence detection
        protected, placeholders = self._protect_citations(text)

        if self._tokenizer is not None:
            spans = list(self._tokenizer.span_tokenize(protected))
        else:
            spans = list(self._regex_span_tokenize(protected))

        sentences: List[Sentence] = []
        for idx, (start, end) in enumerate(spans):
            raw = text[start:end].strip()
            # Restore citations in the raw text
            for placeholder, citation in placeholders.items():
                raw = raw.replace(placeholder, citation)
            if len(raw) < self.min_sentence_length:
                continue
            sentences.append(Sentence(
                text=raw,
                start_offset=start,
                end_offset=end,
                sentence_index=idx,
                paragraph_id=paragraph_id,
                document_id=document_id,
            ))
        return sentences

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _protect_citations(text: str):
        """Replace citation brackets with safe placeholders."""
        placeholders = {}
        counter = [0]

        def _replace(m: re.Match) -> str:
            ph = f'CITATION{counter[0]:04d}'
            placeholders[ph] = m.group(0)
            counter[0] += 1
            return ph

        # Numeric [1], [1,2], [1-5]; author-year (Smith, 2020); LaTeX \cite{}
        pattern = re.compile(
            r'\[[\d,\s\-]+\]|\([A-Z][a-z]+,?\s*\d{4}[a-z]?(?:;\s*[A-Z][a-z]+,?\s*\d{4}[a-z]?)*\)|\\cite\{[^}]+\}'
        )
        protected = pattern.sub(_replace, text)
        return protected, placeholders

    @staticmethod
    def _regex_span_tokenize(text: str):
        """Simple regex sentence splitter as NLTK fallback."""
        # Split on period / ! / ? followed by whitespace and capital letter
        boundaries = [0]
        for m in re.finditer(r'(?<=[.!?])\s+(?=[A-Z])', text):
            boundaries.append(m.end())
        boundaries.append(len(text))
        spans = []
        for i in range(len(boundaries) - 1):
            spans.append((boundaries[i], boundaries[i + 1]))
        return spans


# ---------------------------------------------------------------------------
# Module-level convenience function
# ---------------------------------------------------------------------------

_default_segmenter = SentenceSegmenter()


def segment_sentences(
    text: str,
    document_id: str = '',
    paragraph_id: str = '',
) -> List[Sentence]:
    """Segment *text* into sentences using the default segmenter."""
    return _default_segmenter.segment(text, document_id=document_id, paragraph_id=paragraph_id)
