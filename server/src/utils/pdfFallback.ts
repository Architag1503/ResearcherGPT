import crypto from 'crypto';
import { PDFParse } from 'pdf-parse';

export interface FallbackChunk {
  chunk_index: number;
  text_content: string;
  page_number: number;
  qdrant_id: string;
}

export interface FallbackPdfResult {
  chunks: FallbackChunk[];
  metadata: {
    title: string;
    authors: string[];
    doi: string;
    year: number | null;
    abstract: string;
    journal: string;
    extra_meta: Record<string, any>;
  };
}

function cleanText(text: string): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function splitIntoChunks(
  pages: Array<{ pageNumber: number; text: string }>,
  chunkSize = 1200
): FallbackChunk[] {
  const chunks: FallbackChunk[] = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const pageText = page.text;
    if (!pageText) continue;

    const sentences = pageText.split(/(?<=[.!?])\s+/);
    let current: string[] = [];
    let currentLen = 0;

    for (const rawSentence of sentences) {
      const sentence = rawSentence.trim();
      if (!sentence) continue;

      if (sentence.length > chunkSize) {
        if (current.length > 0) {
          chunks.push({
            chunk_index: chunkIndex++,
            text_content: current.join(' '),
            page_number: page.pageNumber,
            qdrant_id: crypto.randomUUID(),
          });
          current = [];
          currentLen = 0;
        }
        for (let offset = 0; offset < sentence.length; offset += chunkSize - 200) {
          const slice = sentence.slice(offset, offset + chunkSize).trim();
          if (slice) {
            chunks.push({
              chunk_index: chunkIndex++,
              text_content: slice,
              page_number: page.pageNumber,
              qdrant_id: crypto.randomUUID(),
            });
          }
        }
        continue;
      }

      if (currentLen + sentence.length > chunkSize && current.length > 0) {
        chunks.push({
          chunk_index: chunkIndex++,
          text_content: current.join(' '),
          page_number: page.pageNumber,
          qdrant_id: crypto.randomUUID(),
        });
        current = current.slice(-2);
        currentLen = current.reduce((acc, s) => acc + s.length + 1, 0);
      }

      current.push(sentence);
      currentLen += sentence.length + 1;
    }

    if (current.length > 0) {
      chunks.push({
        chunk_index: chunkIndex++,
        text_content: current.join(' '),
        page_number: page.pageNumber,
        qdrant_id: crypto.randomUUID(),
      });
    }
  }

  return chunks;
}

/**
 * Local Node.js PDF extraction and chunking fallback used when the external AI
 * service returns 429 or is temporarily unavailable. Requires zero external API keys.
 */
export async function extractPdfFallback(
  pdfBuffer: Buffer,
  fallbackTitle?: string
): Promise<FallbackPdfResult> {
  // Pass a standalone copy and invoke getInfo/getText sequentially so pdfjs worker never races on buffer transfer.
  const parser = new PDFParse({ data: Buffer.from(pdfBuffer) });
  try {
    const infoResult = await parser.getInfo().catch(() => null);
    const textResult = await parser.getText();

    const pages = (textResult.pages || []).map((p) => ({
      pageNumber: p.num,
      text: cleanText(p.text),
    }));

    const firstPage = pages[0]?.text || cleanText(textResult.text || '');
    const pdfInfo = (infoResult?.info || {}) as Record<string, any>;

    let title = typeof pdfInfo.Title === 'string' ? pdfInfo.Title.trim() : '';
    if (!title && firstPage) {
      const firstLine = firstPage.split(/\.\s+|\n/)[0]?.trim() || '';
      if (firstLine.length > 8) {
        title = firstLine.slice(0, 180);
      }
    }
    if (!title) {
      title = fallbackTitle || 'Untitled Paper';
    }

    const authorsRaw = typeof pdfInfo.Author === 'string' ? pdfInfo.Author : '';
    const authors = authorsRaw
      ? authorsRaw.split(/,|;|\band\b/i).map((a) => a.trim()).filter(Boolean)
      : [];

    const doiMatch = firstPage.match(/(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i);
    const doi = doiMatch ? doiMatch[1] : '';

    const yearMatch = firstPage.match(/\b(199\d|20[0-3]\d)\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

    let abstract = '';
    const absMatch = firstPage.match(
      /abstract[:\s—\-]+([\s\S]{40,1600}?)(?=\b(?:keywords|index terms|1\.?\s*introduction|i\.\s*introduction)\b|$)/i
    );
    if (absMatch && absMatch[1]) {
      abstract = cleanText(absMatch[1]);
    } else if (firstPage) {
      abstract = firstPage.slice(0, 800);
    }

    const chunks = splitIntoChunks(pages);
    if (chunks.length === 0 && (title || abstract)) {
      chunks.push({
        chunk_index: 0,
        text_content: `Title: ${title}\nAbstract: ${abstract}`.trim(),
        page_number: 1,
        qdrant_id: crypto.randomUUID(),
      });
    }

    return {
      chunks,
      metadata: {
        title,
        authors,
        doi,
        year,
        abstract,
        journal: '',
        extra_meta: {
          document_type: 'Digital',
          extraction_engine: 'node_pdf_fallback',
          warnings: ['AI service rate-limited; parsed and chunked locally without external AI calls.'],
        },
      },
    };
  } finally {
    await parser.destroy().catch(() => {});
  }
}
