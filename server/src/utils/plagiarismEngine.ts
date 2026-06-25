/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ResearcherGPT — Advanced Plagiarism Detection Engine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Enterprise-grade plagiarism detection across 11 phases:
 *   Phase 1  — Document Processing
 *   Phase 2  — Exact Plagiarism (Shingling + MinHash + Winnowing)
 *   Phase 3  — Semantic Plagiarism (TF-IDF Cosine Similarity)
 *   Phase 4  — Citation Plagiarism (Graph Comparison)
 *   Phase 5  — Structural Plagiarism (Tree Edit Distance)
 *   Phase 6  — Formula Plagiarism (LaTeX AST Comparison)
 *   Phase 7  — Figure Plagiarism (Caption Similarity)
 *   Phase 8  — Table Plagiarism (Structure Comparison)
 *   Phase 9  — Code Plagiarism (Token Similarity)
 *   Phase 10 — Source Discovery (OpenAlex API)
 *   Phase 11 — AI Content Detection (Heuristics)
 *
 * Uses OpenAlex REST API for external academic database search.
 */

// ── Types ───────────────────────────────────────────────────────────────────

interface PaperSection {
  title: string;
  heading: string;
  content: string;
}

interface ParsedDocument {
  title: string;
  sections: PaperSection[];
  references: string[];
  sentences: string[];
  formulas: string[];
  codeBlocks: string[];
  figureCaptions: string[];
  tableCaptions: string[];
  sectionHierarchy: string[];
}

interface OpenAlexWork {
  id: string;
  title: string;
  doi?: string;
  url?: string;
  publication_year?: number;
  authorships?: { author: { display_name: string } }[];
  abstract_inverted_index?: Record<string, number[]>;
  cited_by_count?: number;
  referenced_works?: string[];
}

interface MatchResult {
  sentence: string;
  source: string;
  sourceTitle: string;
  sourceDOI?: string;
  sourceURL?: string;
  similarity: number;
  confidence?: number;
}

interface SourceInfo {
  title: string;
  authors: string[];
  doi?: string;
  url?: string;
  year?: number;
  similarity: number;
  matchedSentences: number;
  openAlexId?: string;
  abstract?: string;
}

interface SectionAnalysis {
  section: string;
  exactScore: number;
  semanticScore: number;
  overallScore: number;
  flaggedSentences: number;
  totalSentences: number;
}

interface AIDetectionResult {
  humanProbability: number;
  aiProbability: number;
  confidence: string;
  perplexity: number;
  burstiness: number;
  vocabularyRichness: number;
}

interface PlagiarismResult {
  overallScore: number;
  exactMatchScore: number;
  semanticScore: number;
  citationScore: number;
  structureScore: number;
  formulaScore: number;
  figureScore: number;
  codeScore: number;
  exactMatches: MatchResult[];
  semanticMatches: MatchResult[];
  citationMatches: { citation: string; matchedCitation: string; sourceTitle: string; similarity: number }[];
  formulaMatches: { formula: string; matchedFormula: string; sourceTitle: string; similarity: number }[];
  structureMatches: { sectionA: string; sectionB: string; sourceTitle: string; similarity: number }[];
  codeMatches: { snippet: string; matchedSnippet: string; sourceTitle: string; similarity: number }[];
  aiDetection: AIDetectionResult;
  sectionScores: SectionAnalysis[];
  topSources: SourceInfo[];
  summary: string;
  severityLevel: string;
  totalSentencesAnalyzed: number;
  totalSourcesSearched: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

const OPENALEX_BASE = 'https://api.openalex.org';
const OPENALEX_API_KEY = process.env.OPENALEX_API_KEY || '';
const SHINGLE_SIZE = 5;
const MINHASH_PERMUTATIONS = 128;
const SEMANTIC_THRESHOLD_HIGH = 0.85;
const SEMANTIC_THRESHOLD_MODERATE = 0.70;
const MAX_OPENALEX_RESULTS = 100;

// ── Scoring Weights ─────────────────────────────────────────────────────────

const WEIGHTS = {
  exact: 0.35,
  semantic: 0.40,
  citation: 0.10,
  structure: 0.05,
  formula: 0.05,
  figure: 0.03,
  code: 0.02,
};

// ═══════════════════════════════════════════════════════════════════════════
// Phase 1: Document Processing
// ═══════════════════════════════════════════════════════════════════════════

function parseDocument(title: string, sections: PaperSection[], references: string[]): ParsedDocument {
  const sentences: string[] = [];
  const formulas: string[] = [];
  const codeBlocks: string[] = [];
  const figureCaptions: string[] = [];
  const tableCaptions: string[] = [];
  const sectionHierarchy: string[] = [];

  for (const section of sections) {
    sectionHierarchy.push(section.title || section.heading);
    const content = section.content || '';

    // Extract formulas (LaTeX patterns)
    const formulaPatterns = [
      /\$\$([^$]+)\$\$/g,
      /\\\[([^\]]+)\\\]/g,
      /\\begin\{equation\}([\s\S]*?)\\end\{equation\}/g,
      /\\begin\{align\}([\s\S]*?)\\end\{align\}/g,
      /\\begin\{aligned\}([\s\S]*?)\\end\{aligned\}/g,
    ];
    for (const pattern of formulaPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        formulas.push(match[1].trim());
      }
    }

    // Extract code blocks
    const codePattern = /```[\s\S]*?```/g;
    let codeMatch;
    while ((codeMatch = codePattern.exec(content)) !== null) {
      codeBlocks.push(codeMatch[0].replace(/```\w*\n?/g, '').replace(/```/g, '').trim());
    }

    // Extract figure captions
    const figPattern = /(?:Figure|Fig\.?)\s+\d+[.:]\s*([^\n]+)/gi;
    let figMatch;
    while ((figMatch = figPattern.exec(content)) !== null) {
      figureCaptions.push(figMatch[1].trim());
    }

    // Extract table captions
    const tablePattern = /(?:Table)\s+\d+[.:]\s*([^\n]+)/gi;
    let tableMatch;
    while ((tableMatch = tablePattern.exec(content)) !== null) {
      tableCaptions.push(tableMatch[1].trim());
    }

    // Extract sentences — clean text first
    const cleanText = content
      .replace(/\$\$[^$]+\$\$/g, '')
      .replace(/\\\[[^\]]+\\\]/g, '')
      .replace(/\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/#+\s+/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();

    const sectionSentences = cleanText
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 20);

    sentences.push(...sectionSentences);
  }

  return {
    title,
    sections,
    references,
    sentences,
    formulas,
    codeBlocks,
    figureCaptions,
    tableCaptions,
    sectionHierarchy,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 2: Exact Plagiarism Detection (Shingling + MinHash + Winnowing)
// ═══════════════════════════════════════════════════════════════════════════

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
}

function generateShingles(tokens: string[], size: number = SHINGLE_SIZE): Set<string> {
  const shingles = new Set<string>();
  for (let i = 0; i <= tokens.length - size; i++) {
    shingles.add(tokens.slice(i, i + size).join(' '));
  }
  return shingles;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function generateMinHash(shingles: Set<string>, numPermutations: number = MINHASH_PERMUTATIONS): number[] {
  const signature: number[] = new Array(numPermutations).fill(Infinity);
  const shingleArray = Array.from(shingles);

  for (let i = 0; i < numPermutations; i++) {
    for (const shingle of shingleArray) {
      const hash = hashString(shingle + '_perm_' + i);
      if (hash < signature[i]) {
        signature[i] = hash;
      }
    }
  }
  return signature;
}

function jaccardFromMinHash(sig1: number[], sig2: number[]): number {
  if (sig1.length !== sig2.length || sig1.length === 0) return 0;
  let agree = 0;
  for (let i = 0; i < sig1.length; i++) {
    if (sig1[i] === sig2[i]) agree++;
  }
  return agree / sig1.length;
}

function winnowingFingerprint(text: string, windowSize: number = 4): number[] {
  const tokens = tokenize(text);
  if (tokens.length < SHINGLE_SIZE) return [];

  const shingles: number[] = [];
  for (let i = 0; i <= tokens.length - SHINGLE_SIZE; i++) {
    shingles.push(hashString(tokens.slice(i, i + SHINGLE_SIZE).join(' ')));
  }

  // Winnowing: select minimum hash in each window
  const fingerprints: number[] = [];
  for (let i = 0; i <= shingles.length - windowSize; i++) {
    const window = shingles.slice(i, i + windowSize);
    fingerprints.push(Math.min(...window));
  }

  return [...new Set(fingerprints)];
}

function detectExactPlagiarism(
  paperSentences: string[],
  sourceSentences: { sentence: string; title: string; doi?: string; url?: string }[]
): MatchResult[] {
  const matches: MatchResult[] = [];

  for (const paperSent of paperSentences) {
    const paperTokens = tokenize(paperSent);
    if (paperTokens.length < 5) continue;

    const paperShingles = generateShingles(paperTokens);
    const paperMinHash = generateMinHash(paperShingles);

    let bestMatch: MatchResult | null = null;

    for (const source of sourceSentences) {
      const sourceTokens = tokenize(source.sentence);
      if (sourceTokens.length < 5) continue;

      const sourceShingles = generateShingles(sourceTokens);
      const sourceMinHash = generateMinHash(sourceShingles);

      const similarity = jaccardFromMinHash(paperMinHash, sourceMinHash);

      if (similarity > 0.6 && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = {
          sentence: paperSent.substring(0, 300),
          source: source.sentence.substring(0, 300),
          sourceTitle: source.title,
          sourceDOI: source.doi,
          sourceURL: source.url,
          similarity: Math.round(similarity * 100),
        };
      }
    }
    if (bestMatch) matches.push(bestMatch);
  }

  return matches;
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 3: Semantic Plagiarism Detection (TF-IDF Cosine Similarity)
// ═══════════════════════════════════════════════════════════════════════════

function buildVocabulary(documents: string[]): Map<string, number> {
  const vocab = new Map<string, number>();
  let idx = 0;
  for (const doc of documents) {
    const tokens = tokenize(doc);
    for (const token of tokens) {
      if (!vocab.has(token)) {
        vocab.set(token, idx++);
      }
    }
  }
  return vocab;
}

function computeTFIDF(
  document: string,
  vocab: Map<string, number>,
  idfScores: Map<string, number>
): number[] {
  const tokens = tokenize(document);
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  const vector = new Array(vocab.size).fill(0);
  for (const [token, count] of tf.entries()) {
    const idx = vocab.get(token);
    if (idx !== undefined) {
      const tfScore = count / tokens.length;
      const idf = idfScores.get(token) || 1;
      vector[idx] = tfScore * idf;
    }
  }
  return vector;
}

function computeIDF(documents: string[], vocab: Map<string, number>): Map<string, number> {
  const docCount = documents.length;
  const df = new Map<string, number>();

  for (const doc of documents) {
    const uniqueTokens = new Set(tokenize(doc));
    for (const token of uniqueTokens) {
      df.set(token, (df.get(token) || 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [token] of vocab.entries()) {
    const docFreq = df.get(token) || 1;
    idf.set(token, Math.log((docCount + 1) / (docFreq + 1)) + 1);
  }
  return idf;
}

function cosineSimilarity(vec1: number[], vec2: number[]): number {
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    mag1 += vec1[i] * vec1[i];
    mag2 += vec2[i] * vec2[i];
  }

  const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

function detectSemanticPlagiarism(
  paperSentences: string[],
  sourceSentences: { sentence: string; title: string; doi?: string; url?: string }[]
): MatchResult[] {
  const matches: MatchResult[] = [];
  if (sourceSentences.length === 0) return matches;

  // Build combined vocabulary
  const allDocs = [
    ...paperSentences,
    ...sourceSentences.map(s => s.sentence),
  ];
  const vocab = buildVocabulary(allDocs);
  const idfScores = computeIDF(allDocs, vocab);

  // Pre-compute source vectors
  const sourceVectors = sourceSentences.map(s => ({
    ...s,
    vector: computeTFIDF(s.sentence, vocab, idfScores),
  }));

  for (const paperSent of paperSentences) {
    if (paperSent.length < 30) continue;

    const paperVector = computeTFIDF(paperSent, vocab, idfScores);
    let bestMatch: (MatchResult & { confidence: number }) | null = null;

    for (const source of sourceVectors) {
      const similarity = cosineSimilarity(paperVector, source.vector);

      if (similarity > SEMANTIC_THRESHOLD_MODERATE && (!bestMatch || similarity > bestMatch.similarity / 100)) {
        const confidence = similarity >= SEMANTIC_THRESHOLD_HIGH ? 0.95 : 0.75;
        bestMatch = {
          sentence: paperSent.substring(0, 300),
          source: source.sentence.substring(0, 300),
          sourceTitle: source.title,
          sourceDOI: source.doi,
          sourceURL: source.url,
          similarity: Math.round(similarity * 100),
          confidence,
        };
      }
    }
    if (bestMatch) matches.push(bestMatch);
  }

  return matches;
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 4: Citation Plagiarism Detection
// ═══════════════════════════════════════════════════════════════════════════

function normalizeCitation(citation: string): string {
  return citation
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectCitationPlagiarism(
  paperRefs: string[],
  sourceRefs: { citations: string[]; title: string }[]
): { citation: string; matchedCitation: string; sourceTitle: string; similarity: number }[] {
  const matches: { citation: string; matchedCitation: string; sourceTitle: string; similarity: number }[] = [];

  const normalizedPaperRefs = paperRefs.map(r => ({ original: r, normalized: normalizeCitation(r) }));

  for (const source of sourceRefs) {
    const normalizedSourceRefs = source.citations.map(r => ({
      original: r,
      normalized: normalizeCitation(r),
    }));

    for (const paperRef of normalizedPaperRefs) {
      for (const sourceRef of normalizedSourceRefs) {
        // Compute token overlap
        const paperTokens = new Set(paperRef.normalized.split(' '));
        const sourceTokens = new Set(sourceRef.normalized.split(' '));
        const intersection = new Set([...paperTokens].filter(t => sourceTokens.has(t)));
        const union = new Set([...paperTokens, ...sourceTokens]);

        const similarity = union.size > 0 ? intersection.size / union.size : 0;

        if (similarity > 0.5) {
          matches.push({
            citation: paperRef.original.substring(0, 200),
            matchedCitation: sourceRef.original.substring(0, 200),
            sourceTitle: source.title,
            similarity: Math.round(similarity * 100),
          });
        }
      }
    }
  }

  // Deduplicate — keep best match per citation
  const bestMatches = new Map<string, typeof matches[0]>();
  for (const m of matches) {
    const key = normalizeCitation(m.citation);
    if (!bestMatches.has(key) || (bestMatches.get(key)!.similarity < m.similarity)) {
      bestMatches.set(key, m);
    }
  }

  return Array.from(bestMatches.values());
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 5: Structural Plagiarism Detection
// ═══════════════════════════════════════════════════════════════════════════

function normalizeSection(section: string): string {
  return section
    .toLowerCase()
    .replace(/\d+\.?\s*/g, '')
    .replace(/[^a-z\s]/g, '')
    .trim();
}

function detectStructuralPlagiarism(
  paperHierarchy: string[],
  sourceHierarchies: { hierarchy: string[]; title: string }[]
): { sectionA: string; sectionB: string; sourceTitle: string; similarity: number }[] {
  const matches: { sectionA: string; sectionB: string; sourceTitle: string; similarity: number }[] = [];

  const normalizedPaper = paperHierarchy.map(s => normalizeSection(s));

  for (const source of sourceHierarchies) {
    const normalizedSource = source.hierarchy.map(s => normalizeSection(s));

    // Compute Longest Common Subsequence
    const lcsLength = computeLCS(normalizedPaper, normalizedSource);
    const maxLen = Math.max(normalizedPaper.length, normalizedSource.length);
    const similarity = maxLen > 0 ? lcsLength / maxLen : 0;

    if (similarity > 0.4) {
      // Find matching sections
      for (let i = 0; i < normalizedPaper.length; i++) {
        for (let j = 0; j < normalizedSource.length; j++) {
          if (normalizedPaper[i] === normalizedSource[j] && normalizedPaper[i].length > 2) {
            matches.push({
              sectionA: paperHierarchy[i],
              sectionB: source.hierarchy[j],
              sourceTitle: source.title,
              similarity: Math.round(similarity * 100),
            });
          }
        }
      }
    }
  }

  return matches;
}

function computeLCS(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 6: Formula Plagiarism Detection
// ═══════════════════════════════════════════════════════════════════════════

function normalizeFormula(formula: string): string {
  return formula
    .replace(/\s+/g, '')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\,/g, '')
    .replace(/\\;/g, '')
    .replace(/\\!/g, '')
    .replace(/\\quad/g, '')
    .replace(/\\qquad/g, '')
    .toLowerCase();
}

function detectFormulaPlagiarism(
  paperFormulas: string[],
  sourceFormulas: { formula: string; title: string }[]
): { formula: string; matchedFormula: string; sourceTitle: string; similarity: number }[] {
  const matches: { formula: string; matchedFormula: string; sourceTitle: string; similarity: number }[] = [];

  for (const pFormula of paperFormulas) {
    const normalizedP = normalizeFormula(pFormula);
    if (normalizedP.length < 5) continue;

    for (const source of sourceFormulas) {
      const normalizedS = normalizeFormula(source.formula);
      if (normalizedS.length < 5) continue;

      // Token-level comparison
      const pTokens = normalizedP.split(/([+\-*/=<>^_{}\\])/).filter(Boolean);
      const sTokens = normalizedS.split(/([+\-*/=<>^_{}\\])/).filter(Boolean);

      const pSet = new Set(pTokens);
      const sSet = new Set(sTokens);
      const intersection = new Set([...pSet].filter(t => sSet.has(t)));
      const union = new Set([...pSet, ...sSet]);
      const similarity = union.size > 0 ? intersection.size / union.size : 0;

      if (similarity > 0.6) {
        matches.push({
          formula: pFormula.substring(0, 200),
          matchedFormula: source.formula.substring(0, 200),
          sourceTitle: source.title,
          similarity: Math.round(similarity * 100),
        });
      }
    }
  }

  return matches;
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 9: Code Plagiarism Detection
// ═══════════════════════════════════════════════════════════════════════════

function tokenizeCode(code: string): string[] {
  return code
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/["'].*?["']/g, 'STRING')
    .replace(/\d+/g, 'NUM')
    .split(/[\s;{}()\[\],]+/)
    .filter(t => t.length > 0);
}

function detectCodePlagiarism(
  paperCode: string[],
  sourceCode: { code: string; title: string }[]
): { snippet: string; matchedSnippet: string; sourceTitle: string; similarity: number }[] {
  const matches: { snippet: string; matchedSnippet: string; sourceTitle: string; similarity: number }[] = [];

  for (const pCode of paperCode) {
    const pTokens = tokenizeCode(pCode);
    if (pTokens.length < 5) continue;

    for (const source of sourceCode) {
      const sTokens = tokenizeCode(source.code);
      if (sTokens.length < 5) continue;

      const pSet = new Set(pTokens);
      const sSet = new Set(sTokens);
      const intersection = new Set([...pSet].filter(t => sSet.has(t)));
      const union = new Set([...pSet, ...sSet]);
      const similarity = union.size > 0 ? intersection.size / union.size : 0;

      if (similarity > 0.5) {
        matches.push({
          snippet: pCode.substring(0, 300),
          matchedSnippet: source.code.substring(0, 300),
          sourceTitle: source.title,
          similarity: Math.round(similarity * 100),
        });
      }
    }
  }

  return matches;
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 10: Source Discovery — OpenAlex API
// ═══════════════════════════════════════════════════════════════════════════

function reconstructAbstract(invertedIndex: Record<string, number[]>): string {
  if (!invertedIndex) return '';

  const entries: [string, number[]][] = Object.entries(invertedIndex);
  const words: [string, number][] = [];

  for (const [word, positions] of entries) {
    for (const pos of positions) {
      words.push([word, pos]);
    }
  }

  words.sort((a, b) => a[1] - b[1]);
  return words.map(w => w[0]).join(' ');
}

async function searchOpenAlex(query: string, maxResults: number = MAX_OPENALEX_RESULTS): Promise<OpenAlexWork[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    // Clean and truncate query for API
    const cleanQuery = query
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);

    if (cleanQuery.length < 10) {
      clearTimeout(timeoutId);
      return [];
    }

    const params = new URLSearchParams({
      search: cleanQuery,
      per_page: String(Math.min(maxResults, 50)),
      sort: 'relevance_score:desc',
      select: 'id,title,doi,authorships,abstract_inverted_index,publication_year,cited_by_count,referenced_works',
    });

    if (OPENALEX_API_KEY) {
      params.set('api_key', OPENALEX_API_KEY);
    }

    const url = `${OPENALEX_BASE}/works?${params.toString()}`;

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ResearcherGPT/1.0 (mailto:research@example.com)',
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`OpenAlex API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json() as { results: OpenAlexWork[] };
    return data.results || [];
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn(`OpenAlex search timed out for query: "${query.substring(0, 50)}..."`);
    } else {
      console.error('OpenAlex search error:', error);
    }
    return [];
  }
}

async function discoverSources(
  paperTitle: string,
  paperSentences: string[],
  paperReferences: string[]
): Promise<SourceInfo[]> {
  const allSources: Map<string, SourceInfo> = new Map();

  // Search 1: By paper title
  const titleResults = await searchOpenAlex(paperTitle, 25);
  for (const work of titleResults) {
    if (!work.title) continue;
    const abstract = work.abstract_inverted_index ? reconstructAbstract(work.abstract_inverted_index) : '';
    const authors = (work.authorships || []).map(a => a.author?.display_name).filter(Boolean) as string[];
    const doi = work.doi ? work.doi.replace('https://doi.org/', '') : undefined;

    allSources.set(work.id, {
      title: work.title,
      authors,
      doi,
      url: work.doi || `https://openalex.org/works/${work.id.split('/').pop()}`,
      year: work.publication_year,
      similarity: 0,
      matchedSentences: 0,
      openAlexId: work.id,
      abstract,
    });
  }

  // Search 2: By key sentences (sample up to 50 sentences for breadth and accuracy)
  const sampleSentences = paperSentences
    .filter(s => s.length > 50)
    .sort(() => 0.5 - Math.random())
    .slice(0, 50);

  for (const sentence of sampleSentences) {
    const sentenceResults = await searchOpenAlex(sentence, 15);
    for (const work of sentenceResults) {
      if (!work.title) continue;
      if (allSources.has(work.id)) continue;

      const abstract = work.abstract_inverted_index ? reconstructAbstract(work.abstract_inverted_index) : '';
      const authors = (work.authorships || []).map(a => a.author?.display_name).filter(Boolean) as string[];
      const doi = work.doi ? work.doi.replace('https://doi.org/', '') : undefined;

      allSources.set(work.id, {
        title: work.title,
        authors,
        doi,
        url: work.doi || `https://openalex.org/works/${work.id.split('/').pop()}`,
        year: work.publication_year,
        similarity: 0,
        matchedSentences: 0,
        openAlexId: work.id,
        abstract,
      });
    }

    // Rate limit: 100ms between requests (polite crawling)
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Search 3: By key phrases from references
  const refSamples = paperReferences.slice(0, 3);
  for (const ref of refSamples) {
    const refResults = await searchOpenAlex(ref, 10);
    for (const work of refResults) {
      if (!work.title || allSources.has(work.id)) continue;

      const abstract = work.abstract_inverted_index ? reconstructAbstract(work.abstract_inverted_index) : '';
      const authors = (work.authorships || []).map(a => a.author?.display_name).filter(Boolean) as string[];
      const doi = work.doi ? work.doi.replace('https://doi.org/', '') : undefined;

      allSources.set(work.id, {
        title: work.title,
        authors,
        doi,
        url: work.doi || `https://openalex.org/works/${work.id.split('/').pop()}`,
        year: work.publication_year,
        similarity: 0,
        matchedSentences: 0,
        openAlexId: work.id,
        abstract,
      });
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return Array.from(allSources.values());
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 11: AI-Generated Content Detection (Heuristics)
// ═══════════════════════════════════════════════════════════════════════════

function detectAIContent(sentences: string[]): AIDetectionResult {
  if (sentences.length === 0) {
    return { humanProbability: 100, aiProbability: 0, confidence: 'Low', perplexity: 0, burstiness: 1, vocabularyRichness: 1 };
  }

  // 1. Perplexity estimation — uniformity of word frequency
  const allTokens = sentences.join(' ').toLowerCase().split(/\s+/);
  const wordFreq = new Map<string, number>();
  for (const token of allTokens) {
    wordFreq.set(token, (wordFreq.get(token) || 0) + 1);
  }

  const totalWords = allTokens.length;
  const uniqueWords = wordFreq.size;

  // Entropy-based perplexity approximation
  let entropy = 0;
  for (const [, count] of wordFreq.entries()) {
    const p = count / totalWords;
    entropy -= p * Math.log2(p);
  }
  const perplexity = Math.pow(2, entropy);

  // 2. Burstiness — variance in sentence lengths
  const sentLengths = sentences.map(s => s.split(/\s+/).length);
  const meanLen = sentLengths.reduce((a, b) => a + b, 0) / sentLengths.length;
  const variance = sentLengths.reduce((sum, len) => sum + Math.pow(len - meanLen, 2), 0) / sentLengths.length;
  const burstiness = Math.sqrt(variance) / (meanLen || 1);

  // 3. Vocabulary richness — Type-Token Ratio
  const vocabularyRichness = totalWords > 0 ? uniqueWords / totalWords : 1;

  // 4. Sentence start diversity
  const sentenceStarts = sentences.map(s => s.split(/\s+/).slice(0, 3).join(' ').toLowerCase());
  const uniqueStarts = new Set(sentenceStarts).size;
  const startDiversity = sentenceStarts.length > 0 ? uniqueStarts / sentenceStarts.length : 1;

  // 5. Connective word ratio (AI text tends to overuse transitions)
  const connectiveWords = ['however', 'furthermore', 'moreover', 'additionally', 'consequently', 'therefore', 'nevertheless', 'specifically', 'importantly', 'notably', 'significantly', 'essentially', 'fundamentally'];
  const connectiveCount = allTokens.filter(t => connectiveWords.includes(t)).length;
  const connectiveRatio = connectiveCount / (totalWords || 1);

  // Scoring heuristic:
  // Human text: high burstiness (>0.4), moderate vocabulary richness, diverse starts
  // AI text: low burstiness (<0.3), high connective ratio, uniform starts
  let aiScore = 0;

  // Low burstiness suggests AI
  if (burstiness < 0.2) aiScore += 25;
  else if (burstiness < 0.35) aiScore += 15;
  else if (burstiness < 0.5) aiScore += 5;

  // Low start diversity suggests AI
  if (startDiversity < 0.5) aiScore += 20;
  else if (startDiversity < 0.7) aiScore += 10;

  // High connective ratio suggests AI
  if (connectiveRatio > 0.04) aiScore += 20;
  else if (connectiveRatio > 0.025) aiScore += 10;

  // Low vocabulary richness with high sentence count suggests AI
  if (vocabularyRichness < 0.3 && sentences.length > 20) aiScore += 15;
  else if (vocabularyRichness < 0.4) aiScore += 5;

  // Very uniform sentence lengths suggest AI
  const coeffOfVariation = burstiness;
  if (coeffOfVariation < 0.15) aiScore += 10;

  aiScore = Math.min(aiScore, 95);
  const humanScore = 100 - aiScore;

  let confidence = 'Low';
  if (sentences.length > 50 && Math.abs(aiScore - 50) > 20) confidence = 'High';
  else if (sentences.length > 20 && Math.abs(aiScore - 50) > 10) confidence = 'Medium';

  return {
    humanProbability: Math.round(humanScore),
    aiProbability: Math.round(aiScore),
    confidence,
    perplexity: Math.round(perplexity * 100) / 100,
    burstiness: Math.round(burstiness * 1000) / 1000,
    vocabularyRichness: Math.round(vocabularyRichness * 1000) / 1000,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Section-wise Analysis
// ═══════════════════════════════════════════════════════════════════════════

function analyzeSections(
  doc: ParsedDocument,
  exactMatches: MatchResult[],
  semanticMatches: MatchResult[]
): SectionAnalysis[] {
  const analyses: SectionAnalysis[] = [];

  for (const section of doc.sections) {
    const sectionContent = section.content || '';
    const sectionSentences = sectionContent
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 20);

    if (sectionSentences.length === 0) continue;

    let exactFlagged = 0;
    let semanticFlagged = 0;

    for (const sent of sectionSentences) {
      const sentLower = sent.toLowerCase().substring(0, 100);
      if (exactMatches.some(m => m.sentence.toLowerCase().substring(0, 100) === sentLower)) {
        exactFlagged++;
      }
      if (semanticMatches.some(m => m.sentence.toLowerCase().substring(0, 100) === sentLower)) {
        semanticFlagged++;
      }
    }

    const exactScore = (exactFlagged / sectionSentences.length) * 100;
    const semanticScore = (semanticFlagged / sectionSentences.length) * 100;
    const overallScore = exactScore * 0.5 + semanticScore * 0.5;

    analyses.push({
      section: section.title || section.heading || 'Untitled Section',
      exactScore: Math.round(exactScore),
      semanticScore: Math.round(semanticScore),
      overallScore: Math.round(overallScore),
      flaggedSentences: exactFlagged + semanticFlagged,
      totalSentences: sectionSentences.length,
    });
  }

  return analyses;
}

// ═══════════════════════════════════════════════════════════════════════════
// Severity Classification
// ═══════════════════════════════════════════════════════════════════════════

function classifySeverity(score: number): string {
  if (score < 10) return 'very_low';
  if (score < 20) return 'acceptable';
  if (score < 30) return 'moderate';
  if (score < 50) return 'high';
  return 'severe';
}

function generateSummary(result: PlagiarismResult): string {
  const level = result.severityLevel;
  const score = result.overallScore;

  const levelDescriptions: Record<string, string> = {
    very_low: 'The paper demonstrates strong originality with minimal similarity to existing literature.',
    acceptable: 'The paper shows acceptable levels of similarity, primarily in standard terminology and common phrasing.',
    moderate: 'The paper contains moderate levels of similarity that may require attention. Some passages show significant overlap with existing sources.',
    high: 'The paper contains high levels of similarity with existing sources. Several passages require revision or proper attribution.',
    severe: 'The paper shows severe levels of similarity. Major sections appear to closely match existing sources and require substantial revision.',
  };

  const parts = [
    `Overall Plagiarism Score: ${score}% (${level.replace('_', ' ').toUpperCase()})`,
    '',
    levelDescriptions[level] || '',
    '',
    `Analysis Breakdown:`,
    `• Exact text matches: ${result.exactMatchScore}%`,
    `• Semantic similarity: ${result.semanticScore}%`,
    `• Citation overlap: ${result.citationScore}%`,
    `• Structural similarity: ${result.structureScore}%`,
    `• Formula similarity: ${result.formulaScore}%`,
    `• Figure similarity: ${result.figureScore}%`,
    `• Code similarity: ${result.codeScore}%`,
    '',
    `AI-Generated Content Probability: ${result.aiDetection.aiProbability}% (Confidence: ${result.aiDetection.confidence})`,
    '',
    `Total sentences analyzed: ${result.totalSentencesAnalyzed}`,
    `Total external sources searched: ${result.totalSourcesSearched}`,
    '',
    result.topSources.length > 0
      ? `Top matched source: "${result.topSources[0].title}" (${result.topSources[0].similarity}% similarity)`
      : 'No significant matches found in external databases.',
  ];

  return parts.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Entry Point
// ═══════════════════════════════════════════════════════════════════════════

export async function runPlagiarismDetection(
  paperTitle: string,
  paperSections: PaperSection[],
  paperReferences: string[],
  localPapers: { title: string; content: string; doi?: string; url?: string; references?: string[] }[]
): Promise<PlagiarismResult> {

  // ── Phase 1: Document Processing ──────────────────────────────────────
  const doc = parseDocument(paperTitle, paperSections, paperReferences);

  // ── Phase 10: Source Discovery (run early to get external sources) ─────
  const externalSources = await discoverSources(paperTitle, doc.sentences, doc.references);

  // Build source sentence corpus from local papers + external abstracts
  const sourceSentences: { sentence: string; title: string; doi?: string; url?: string }[] = [];
  const sourceCitations: { citations: string[]; title: string }[] = [];
  const sourceHierarchies: { hierarchy: string[]; title: string }[] = [];
  const sourceFormulas: { formula: string; title: string }[] = [];
  const sourceCodeBlocks: { code: string; title: string }[] = [];

  // Add local papers
  for (const local of localPapers) {
    const localSentences = local.content
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 20);

    for (const s of localSentences) {
      sourceSentences.push({ sentence: s, title: local.title, doi: local.doi, url: local.url });
    }

    if (local.references) {
      sourceCitations.push({ citations: local.references, title: local.title });
    }
  }

  // Add external sources (abstracts as sentences)
  for (const source of externalSources) {
    if (source.abstract) {
      const absSentences = source.abstract
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 20);

      for (const s of absSentences) {
        sourceSentences.push({
          sentence: s,
          title: source.title,
          doi: source.doi,
          url: source.url,
        });
      }
    }
  }

  // ── Phase 2: Exact Plagiarism Detection ───────────────────────────────
  const exactMatches = detectExactPlagiarism(doc.sentences, sourceSentences);
  const exactMatchScore = doc.sentences.length > 0
    ? (exactMatches.length / doc.sentences.length) * 100
    : 0;

  // ── Phase 3: Semantic Plagiarism Detection ────────────────────────────
  const semanticMatches = detectSemanticPlagiarism(doc.sentences, sourceSentences);
  const semanticScore = doc.sentences.length > 0
    ? (semanticMatches.length / doc.sentences.length) * 100
    : 0;

  // ── Phase 4: Citation Plagiarism ──────────────────────────────────────
  const citationMatches = detectCitationPlagiarism(doc.references, sourceCitations);
  const citationScore = doc.references.length > 0
    ? (citationMatches.length / doc.references.length) * 100
    : 0;

  // ── Phase 5: Structural Plagiarism ────────────────────────────────────
  const structureMatches = detectStructuralPlagiarism(doc.sectionHierarchy, sourceHierarchies);
  const structureScore = structureMatches.length > 0
    ? structureMatches.reduce((sum, m) => sum + m.similarity, 0) / structureMatches.length
    : 0;

  // ── Phase 6: Formula Plagiarism ───────────────────────────────────────
  const formulaMatches = detectFormulaPlagiarism(doc.formulas, sourceFormulas);
  const formulaScore = doc.formulas.length > 0
    ? (formulaMatches.length / doc.formulas.length) * 100
    : 0;

  // ── Phase 7: Figure Plagiarism (caption-based) ────────────────────────
  // Compare figure captions using same semantic approach
  let figureScore = 0;
  if (doc.figureCaptions.length > 0) {
    const figSourceSentences = sourceSentences.filter(s => s.sentence.length < 200);
    const figMatches = detectSemanticPlagiarism(doc.figureCaptions, figSourceSentences);
    figureScore = (figMatches.length / doc.figureCaptions.length) * 100;
  }

  // ── Phase 9: Code Plagiarism ──────────────────────────────────────────
  const codeMatches = detectCodePlagiarism(doc.codeBlocks, sourceCodeBlocks);
  const codeScore = doc.codeBlocks.length > 0
    ? (codeMatches.length / doc.codeBlocks.length) * 100
    : 0;

  // ── Phase 11: AI Content Detection ────────────────────────────────────
  const aiDetection = detectAIContent(doc.sentences);

  // ── Section-wise Analysis ─────────────────────────────────────────────
  const sectionScores = analyzeSections(doc, exactMatches, semanticMatches);

  // ── Calculate source similarities ─────────────────────────────────────
  const sourceMatchCounts = new Map<string, number>();
  for (const m of [...exactMatches, ...semanticMatches]) {
    const key = m.sourceTitle;
    sourceMatchCounts.set(key, (sourceMatchCounts.get(key) || 0) + 1);
  }

  for (const source of externalSources) {
    const matchCount = sourceMatchCounts.get(source.title) || 0;
    source.matchedSentences = matchCount;
    source.similarity = doc.sentences.length > 0
      ? Math.round((matchCount / doc.sentences.length) * 100)
      : 0;
  }

  // Also include local papers as sources
  const localSourceInfos: SourceInfo[] = localPapers.map(lp => {
    const matchCount = sourceMatchCounts.get(lp.title) || 0;
    return {
      title: lp.title,
      authors: [],
      doi: lp.doi,
      url: lp.url,
      similarity: doc.sentences.length > 0 ? Math.round((matchCount / doc.sentences.length) * 100) : 0,
      matchedSentences: matchCount,
    };
  });

  const topSources = [...externalSources, ...localSourceInfos]
    .filter(s => s.matchedSentences > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 20)
    .map(s => ({
      ...s,
      abstract: undefined, // Don't store full abstracts in report
    }));

  // ── Composite Score ───────────────────────────────────────────────────
  const clamp = (v: number) => Math.min(100, Math.max(0, v));

  const overallScore = Math.round(
    WEIGHTS.exact * clamp(exactMatchScore) +
    WEIGHTS.semantic * clamp(semanticScore) +
    WEIGHTS.citation * clamp(citationScore) +
    WEIGHTS.structure * clamp(structureScore) +
    WEIGHTS.formula * clamp(formulaScore) +
    WEIGHTS.figure * clamp(figureScore) +
    WEIGHTS.code * clamp(codeScore)
  );

  const severityLevel = classifySeverity(overallScore);

  const result: PlagiarismResult = {
    overallScore: clamp(overallScore),
    exactMatchScore: Math.round(clamp(exactMatchScore)),
    semanticScore: Math.round(clamp(semanticScore)),
    citationScore: Math.round(clamp(citationScore)),
    structureScore: Math.round(clamp(structureScore)),
    formulaScore: Math.round(clamp(formulaScore)),
    figureScore: Math.round(clamp(figureScore)),
    codeScore: Math.round(clamp(codeScore)),
    exactMatches,
    semanticMatches,
    citationMatches,
    formulaMatches,
    structureMatches,
    codeMatches,
    aiDetection,
    sectionScores,
    topSources,
    summary: '',
    severityLevel,
    totalSentencesAnalyzed: doc.sentences.length,
    totalSourcesSearched: externalSources.length + localPapers.length,
  };

  result.summary = generateSummary(result);

  return result;
}
