"""
paragraph_chunker.py

Multi-granularity document chunking.
Produces chunks at sentence, overlapping-window, paragraph, and section level.
Every chunk carries full provenance metadata.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional

from .text_normalizer import normalize_text
from .sentence_segmenter import segment_sentences, Sentence


class ChunkGranularity(str, Enum):
    SENTENCE = 'sentence'
    WINDOW = 'window'          # overlapping sentence windows
    PARAGRAPH = 'paragraph'
    SECTION = 'section'


@dataclass
class DocumentChunk:
    """
    A chunk of text with full provenance.
    This is the primary unit fed to every detection layer.
    """
    chunk_id: str            # deterministic SHA-256 based ID
    document_id: str
    section: str             # 'abstract' | 'introduction' | 'methodology' | ...
    paragraph_id: str
    sentence_id: str         # '' for paragraph/section chunks
    start_offset: int
    end_offset: int
    original_text: str
    normalized_text: str
    granularity: str         # ChunkGranularity value
    sentences: List[str] = field(default_factory=list)  # constituent sentences
    word_count: int = 0
    is_bibliography: bool = False

    def __post_init__(self):
        if not self.word_count:
            self.word_count = len(self.normalized_text.split())


@dataclass
class ChunkConfig:
    """Controls which granularities are produced and their parameters."""
    granularities: List[str] = field(
        default_factory=lambda: ['sentence', 'window', 'paragraph']
    )
    window_size: int = 3            # sentences per sliding window
    window_stride: int = 1          # stride (overlap = window_size - stride)
    min_sentence_words: int = 5
    min_paragraph_words: int = 20
    min_section_words: int = 50
    exclude_bibliography: bool = True


class ParagraphChunker:
    """Creates DocumentChunk objects from structured document content."""

    def __init__(self, config: Optional[ChunkConfig] = None):
        self.config = config or ChunkConfig()

    def chunk_text(
        self,
        text: str,
        document_id: str,
        section: str = 'body',
        paragraph_id: str = 'p0',
        is_bibliography: bool = False,
        base_offset: int = 0,
    ) -> List[DocumentChunk]:
        """
        Chunk a paragraph/section of text into DocumentChunks.
        Returns chunks at all configured granularities.
        """
        chunks: List[DocumentChunk] = []
        cfg = self.config

        if not text or not text.strip():
            return chunks

        # Skip bibliography from ordinary matching if configured
        if is_bibliography and cfg.exclude_bibliography:
            return chunks

        normalized = normalize_text(text)
        sentences: List[Sentence] = segment_sentences(
            text, document_id=document_id, paragraph_id=paragraph_id
        )

        # ------- Sentence-level chunks -------
        if 'sentence' in cfg.granularities:
            for s in sentences:
                if len(s.text.split()) < cfg.min_sentence_words:
                    continue
                norm_s = normalize_text(s.text)
                chunk = DocumentChunk(
                    chunk_id=_make_chunk_id(document_id, s.start_offset + base_offset),
                    document_id=document_id,
                    section=section,
                    paragraph_id=paragraph_id,
                    sentence_id=f's{s.sentence_index}',
                    start_offset=s.start_offset + base_offset,
                    end_offset=s.end_offset + base_offset,
                    original_text=s.text,
                    normalized_text=norm_s,
                    granularity=ChunkGranularity.SENTENCE,
                    sentences=[s.text],
                    is_bibliography=is_bibliography,
                )
                chunks.append(chunk)

        # ------- Overlapping window chunks -------
        if 'window' in cfg.granularities and len(sentences) >= cfg.window_size:
            window_size = cfg.window_size
            stride = max(1, cfg.window_stride)
            for i in range(0, len(sentences) - window_size + 1, stride):
                window_sents = sentences[i: i + window_size]
                window_text = ' '.join(s.text for s in window_sents)
                if len(window_text.split()) < cfg.min_sentence_words:
                    continue
                chunk = DocumentChunk(
                    chunk_id=_make_chunk_id(
                        document_id,
                        window_sents[0].start_offset + base_offset,
                        suffix=f'w{i}',
                    ),
                    document_id=document_id,
                    section=section,
                    paragraph_id=paragraph_id,
                    sentence_id=f'w{i}',
                    start_offset=window_sents[0].start_offset + base_offset,
                    end_offset=window_sents[-1].end_offset + base_offset,
                    original_text=window_text,
                    normalized_text=normalize_text(window_text),
                    granularity=ChunkGranularity.WINDOW,
                    sentences=[s.text for s in window_sents],
                    is_bibliography=is_bibliography,
                )
                chunks.append(chunk)

        # ------- Paragraph-level chunk -------
        if 'paragraph' in cfg.granularities:
            if len(normalized.split()) >= cfg.min_paragraph_words:
                chunk = DocumentChunk(
                    chunk_id=_make_chunk_id(document_id, base_offset, suffix='para'),
                    document_id=document_id,
                    section=section,
                    paragraph_id=paragraph_id,
                    sentence_id='',
                    start_offset=base_offset,
                    end_offset=base_offset + len(text),
                    original_text=text,
                    normalized_text=normalized,
                    granularity=ChunkGranularity.PARAGRAPH,
                    sentences=[s.text for s in sentences],
                    is_bibliography=is_bibliography,
                )
                chunks.append(chunk)

        return chunks

    def chunk_sections(
        self,
        sections: dict,
        document_id: str,
    ) -> List[DocumentChunk]:
        """
        Chunk a dictionary of {section_name: text} pairs.
        Also produces section-level chunks when configured.
        """
        all_chunks: List[DocumentChunk] = []
        offset = 0

        for section_name, section_text in sections.items():
            if not section_text:
                continue
            is_bib = section_name.lower() in ('references', 'bibliography')
            # Split section into paragraphs
            paragraphs = re.split(r'\n{2,}', section_text)
            for para_idx, para in enumerate(paragraphs):
                para = para.strip()
                if not para:
                    continue
                para_id = f'{section_name[:8]}_p{para_idx}'
                para_chunks = self.chunk_text(
                    para,
                    document_id=document_id,
                    section=section_name,
                    paragraph_id=para_id,
                    is_bibliography=is_bib,
                    base_offset=offset,
                )
                all_chunks.extend(para_chunks)
                offset += len(para) + 2  # +2 for \n\n separator

            # Section-level chunk
            if 'section' in self.config.granularities and not is_bib:
                norm_sec = normalize_text(section_text)
                if len(norm_sec.split()) >= self.config.min_section_words:
                    chunk = DocumentChunk(
                        chunk_id=_make_chunk_id(document_id, 0, suffix=f'sec_{section_name[:8]}'),
                        document_id=document_id,
                        section=section_name,
                        paragraph_id='section',
                        sentence_id='',
                        start_offset=0,
                        end_offset=len(section_text),
                        original_text=section_text,
                        normalized_text=norm_sec,
                        granularity=ChunkGranularity.SECTION,
                        sentences=[],
                        is_bibliography=False,
                    )
                    all_chunks.append(chunk)

        return all_chunks


# ---------------------------------------------------------------------------
# Module-level convenience function
# ---------------------------------------------------------------------------

_default_chunker = ParagraphChunker()


def chunk_document(
    text: str,
    document_id: str,
    section: str = 'body',
) -> List[DocumentChunk]:
    """Chunk *text* using default settings."""
    return _default_chunker.chunk_text(text, document_id=document_id, section=section)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _make_chunk_id(doc_id: str, offset: int, suffix: str = '') -> str:
    raw = f'{doc_id}_{offset}_{suffix}'
    return hashlib.sha256(raw.encode()).hexdigest()[:16]
