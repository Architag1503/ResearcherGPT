/**
 * Academic Paper Normalization and Validation Service.
 * Ensures deterministic IEEE layout structure, paragraph deduplication,
 * caption cleaning, heading normalization, and elimination of spiral layout loops.
 */

export interface NormalizedManuscript {
  title: string;
  abstract: string;
  keywords: string;
  sections: {
    title: string;
    heading: string;
    content: string;
  }[];
  references: string[];
}

export class PaperValidationService {
  private static ROMAN_NUMERALS = [
    'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'
  ];

  public static toRoman(num: number): string {
    if (num >= 1 && num <= this.ROMAN_NUMERALS.length) {
      return this.ROMAN_NUMERALS[num - 1];
    }
    return String(num);
  }

  /**
   * Cleans duplicate numbers or Roman numerals from headings.
   * e.g. "III. III. METHODOLOGY" -> "METHODOLOGY"
   * e.g. "1. 1. Introduction" -> "Introduction"
   */
  public static cleanHeadingTitle(rawTitle: string): { cleanTitle: string; romanTitle: string; index: number } {
    let clean = rawTitle.replace(/^#+\s*/, '').trim();

    // Check for duplicate Roman prefix: "III. III. METHODOLOGY" or "I. I. Introduction"
    clean = clean.replace(/^([IVXLCDM]+)\.?\s+\1(?:\.|\s+|$)\s*/i, '$1. ');
    // Check for duplicate Arabic prefix: "1. 1. Introduction"
    clean = clean.replace(/^(\d+)\.?\s+\1(?:\.|\s+|$)\s*/, '$1. ');

    let numIndex = 0;
    const numMatch = clean.match(/^(\d+)(?:\.|\s+)\s*(.*)$/);
    const romanMatch = clean.match(/^([IVXLCDM]+)(?:\.|\s+)\s*(.*)$/i);

    let pureTitle = clean;
    if (numMatch) {
      numIndex = parseInt(numMatch[1], 10);
      pureTitle = numMatch[2].trim() || clean;
    } else if (romanMatch) {
      const rIdx = this.ROMAN_NUMERALS.indexOf(romanMatch[1].toUpperCase());
      if (rIdx !== -1) {
        numIndex = rIdx + 1;
        pureTitle = romanMatch[2].trim() || clean;
      }
    }

    return {
      cleanTitle: pureTitle,
      romanTitle: numIndex > 0 ? `${this.toRoman(numIndex)}. ${pureTitle.toUpperCase()}` : pureTitle.toUpperCase(),
      index: numIndex
    };
  }

  /**
   * Strips prefix labels like "Fig. 1." or "TABLE I:"
   */
  public static stripCaptionPrefix(caption: string, type: 'figure' | 'table'): string {
    let clean = caption.replace(/<[^>]*>/g, ' ');
    clean = clean.replace(/\\(?:textbf|textit|texttt|emph)\{/g, ' ');
    clean = clean.replace(/}/g, ' ');
    clean = clean.replace(/\s+/g, ' ').trim();

    if (type === 'figure') {
      while (true) {
        const prev = clean;
        clean = clean.replace(/^(?:Fig\.?|Figure)\s*\d*[:.\s-]*/i, '').trim();
        if (clean === prev) break;
      }
      clean = clean.replace(/\.+$/, '');
      return clean || 'System Architecture and Workflow';
    } else {
      const matchConcat = clean.match(/^(?:TABLE|Table)\s*([IVXLCDM]+)\s*[:.\s-]*([A-Za-z].*)$/i);
      if (matchConcat) {
        return matchConcat[2].trim().toUpperCase();
      }
      const matchUnspaced = clean.match(/^(?:TABLE|Table)([IVXLCDM]+)([A-Z].*)$/i);
      if (matchUnspaced) {
        return matchUnspaced[2].trim().toUpperCase();
      }
      clean = clean.replace(/^(?:TABLE|Table)\s*[IVXLCDM\d]*[:.\s-]*/i, '').trim().toUpperCase();
      return clean || 'EXPERIMENTAL EVALUATION';
    }
  }

  /**
   * Eliminates duplicate caption prefixes like "Fig. 1. Fig. 1." or "TABLE IACADEMIC...".
   */
  public static normalizeCaption(caption: string, type: 'figure' | 'table', index: number): string {
    const clean = this.stripCaptionPrefix(caption, type);
    if (type === 'figure') {
      return `Fig. ${index}. ${clean}.`;
    } else {
      return `TABLE ${this.toRoman(index)}: ${clean}`;
    }
  }

  /**
   * Deduplicates paragraphs across the document and strips repetitive filler sentences.
   */
  public static deduplicateSectionContent(content: string, seenParagraphHashes: Set<string>): string {
    if (!content) return '';

    // Split by <p> tags or double newlines
    const hasP = /<p[^>]*>/i.test(content);
    let rawParas: string[] = [];

    if (hasP) {
      const pMatches = content.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
      if (pMatches) {
        rawParas = pMatches.map(p => p.replace(/<\/?p[^>]*>/gi, '').trim());
      }
    } else {
      rawParas = content.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    }

    const uniqueParas: string[] = [];

    for (const p of rawParas) {
      const cleanText = p.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!cleanText) continue;

      // Filter out known repetitive procedural filler text
      const lower = cleanText.toLowerCase();
      if (
        lower.includes('mathematical modeling of the') &&
        (lower.includes('state-transition weights conform') || lower.includes('converts state-transition'))
      ) {
        continue;
      }

      // Check fingerprint
      const fingerprint = cleanText.toLowerCase().replace(/[^a-z0-9]/g, '');
      const key = fingerprint.length > 120 ? fingerprint.slice(0, 120) : fingerprint;

      if (fingerprint.length > 30 && seenParagraphHashes.has(key)) {
        // Skip duplicate paragraph
        continue;
      }

      if (fingerprint.length > 30) {
        seenParagraphHashes.add(key);
      }
      uniqueParas.push(p);
    }

    // Preserve non-<p> containers like figures, tables, pre
    let nonPContent = content.replace(/<p[^>]*>[\s\S]*?<\/p>/gi, '').trim();

    const formattedParas = uniqueParas.map(p => `<p>${p}</p>`).join('\n');
    return nonPContent ? `${formattedParas}\n${nonPContent}` : formattedParas;
  }

  /**
   * Full document normalization and sanitization pass.
   */
  public static normalizeManuscript(
    rawTitle: string,
    rawSections: { title: string; content: string }[],
    rawReferences: string[] = []
  ): NormalizedManuscript {
    const seenHashes = new Set<string>();
    const seenRefs = new Set<string>();
    const cleanedSections: { title: string; heading: string; content: string }[] = [];
    const cleanedReferences: string[] = [];

    let abstract = '';
    let keywords = '';
    let figCount = 1;

    for (const r of rawReferences) {
      const cleanRef = r.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replace(/^\[\d+\]\s*/, '').trim();
      const refKey = cleanRef.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
      if (refKey && !seenRefs.has(refKey)) {
        seenRefs.add(refKey);
        cleanedReferences.push(cleanRef);
      }
    }

    let secIdx = 1;
    for (const sec of rawSections) {
      const titleLower = sec.title.toLowerCase().trim();

      if (titleLower === 'title') continue;

      if (titleLower === 'abstract') {
        abstract = sec.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replace(/^abstract\s*[:.—-]?\s*/i, '').trim();
        continue;
      }

      if (titleLower === 'keywords' || titleLower === 'key words' || titleLower === 'index terms') {
        keywords = sec.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replace(/^(?:keywords|index terms)\s*[:.—-]?\s*/i, '').trim();
        continue;
      }

      if (titleLower === 'references' || titleLower === 'bibliography') {
        // Extract references if embedded in section
        const refLines = sec.content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || sec.content.split('\n');
        for (const line of refLines) {
          const cleanRef = line.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replace(/^\[\d+\]\s*/, '').trim();
          const refKey = cleanRef.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
          if (refKey && !seenRefs.has(refKey)) {
            seenRefs.add(refKey);
            cleanedReferences.push(cleanRef);
          }
        }
        continue;
      }

      // Deduplicate paragraphs in this section
      let content = this.deduplicateSectionContent(sec.content, seenHashes);

      if (titleLower === 'appendix') {
        cleanedSections.push({
          title: 'Appendix',
          heading: 'APPENDIX',
          content
        });
        continue;
      }

      // Clean duplicate captions inside figure tags
      content = content.replace(
        /<figcaption[^>]*class=["']?(?:figure-caption|caption)[^>]*>([\s\S]*?)<\/figcaption>/gi,
        (m, capText) => {
          const norm = this.normalizeCaption(capText, 'figure', figCount++);
          return `<figcaption class="figure-caption"><strong>${norm}</strong></figcaption>`;
        }
      );

      const { cleanTitle } = this.cleanHeadingTitle(sec.title);
      const romanHeading = `${this.toRoman(secIdx)}. ${cleanTitle.toUpperCase()}`;
      secIdx++;

      cleanedSections.push({
        title: cleanTitle,
        heading: romanHeading,
        content
      });
    }

    return {
      title: rawTitle.replace(/<[^>]*>/g, '').trim(),
      abstract,
      keywords,
      sections: cleanedSections,
      references: cleanedReferences
    };
  }
}
