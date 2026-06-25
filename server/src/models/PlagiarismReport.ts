import mongoose, { Schema, Document } from 'mongoose';

// ── Sub-interfaces ──────────────────────────────────────────────────────────

export interface IExactMatch {
  sentence: string;
  source: string;
  sourceTitle: string;
  sourceDOI?: string;
  sourceURL?: string;
  similarity: number;
}

export interface ISemanticMatch {
  sentence: string;
  source: string;
  sourceTitle: string;
  sourceDOI?: string;
  sourceURL?: string;
  similarity: number;
  confidence?: number;
}

export interface ICitationMatch {
  citation: string;
  matchedCitation: string;
  sourceTitle: string;
  similarity: number;
}

export interface IFormulaMatch {
  formula: string;
  matchedFormula: string;
  sourceTitle: string;
  similarity: number;
}

export interface IStructureMatch {
  sectionA: string;
  sectionB: string;
  sourceTitle: string;
  similarity: number;
}

export interface ICodeMatch {
  snippet: string;
  matchedSnippet: string;
  sourceTitle: string;
  similarity: number;
}

export interface IAIDetection {
  humanProbability: number;
  aiProbability: number;
  confidence: string; // 'Low' | 'Medium' | 'High'
  perplexity: number;
  burstiness: number;
  vocabularyRichness: number;
}

export interface ISectionScore {
  section: string;
  exactScore: number;
  semanticScore: number;
  overallScore: number;
  flaggedSentences: number;
  totalSentences: number;
}

export interface ITopSource {
  title: string;
  authors?: string[];
  doi?: string;
  url?: string;
  year?: number;
  similarity: number;
  matchedSentences: number;
  openAlexId?: string;
}

export interface IPlagiarismReport extends Document {
  projectId: mongoose.Types.ObjectId | string;
  generatedPaperId: mongoose.Types.ObjectId | string;
  paperTitle: string;

  // Composite scores
  overallScore: number;
  exactMatchScore: number;
  semanticScore: number;
  citationScore: number;
  structureScore: number;
  formulaScore: number;
  figureScore: number;
  codeScore: number;

  // Detailed matches
  exactMatches: IExactMatch[];
  semanticMatches: ISemanticMatch[];
  citationMatches: ICitationMatch[];
  formulaMatches: IFormulaMatch[];
  structureMatches: IStructureMatch[];
  codeMatches: ICodeMatch[];

  // AI detection
  aiDetection: IAIDetection;

  // Section-level breakdown
  sectionScores: ISectionScore[];

  // Source discovery
  topSources: ITopSource[];

  // Meta
  summary: string;
  severityLevel: 'very_low' | 'acceptable' | 'moderate' | 'high' | 'severe';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  totalSentencesAnalyzed: number;
  totalSourcesSearched: number;
  checkedAt: Date;
}

// ── Sub-schemas ─────────────────────────────────────────────────────────────

const ExactMatchSchema = new Schema({
  sentence: String,
  source: String,
  sourceTitle: String,
  sourceDOI: String,
  sourceURL: String,
  similarity: Number,
}, { _id: false });

const SemanticMatchSchema = new Schema({
  sentence: String,
  source: String,
  sourceTitle: String,
  sourceDOI: String,
  sourceURL: String,
  similarity: Number,
  confidence: Number,
}, { _id: false });

const CitationMatchSchema = new Schema({
  citation: String,
  matchedCitation: String,
  sourceTitle: String,
  similarity: Number,
}, { _id: false });

const FormulaMatchSchema = new Schema({
  formula: String,
  matchedFormula: String,
  sourceTitle: String,
  similarity: Number,
}, { _id: false });

const StructureMatchSchema = new Schema({
  sectionA: String,
  sectionB: String,
  sourceTitle: String,
  similarity: Number,
}, { _id: false });

const CodeMatchSchema = new Schema({
  snippet: String,
  matchedSnippet: String,
  sourceTitle: String,
  similarity: Number,
}, { _id: false });

const AIDetectionSchema = new Schema({
  humanProbability: { type: Number, default: 100 },
  aiProbability: { type: Number, default: 0 },
  confidence: { type: String, default: 'Low' },
  perplexity: { type: Number, default: 0 },
  burstiness: { type: Number, default: 0 },
  vocabularyRichness: { type: Number, default: 0 },
}, { _id: false });

const SectionScoreSchema = new Schema({
  section: String,
  exactScore: { type: Number, default: 0 },
  semanticScore: { type: Number, default: 0 },
  overallScore: { type: Number, default: 0 },
  flaggedSentences: { type: Number, default: 0 },
  totalSentences: { type: Number, default: 0 },
}, { _id: false });

const TopSourceSchema = new Schema({
  title: String,
  authors: [String],
  doi: String,
  url: String,
  year: Number,
  similarity: Number,
  matchedSentences: { type: Number, default: 0 },
  openAlexId: String,
}, { _id: false });

// ── Main schema ─────────────────────────────────────────────────────────────

const PlagiarismReportSchema: Schema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    generatedPaperId: { type: Schema.Types.ObjectId, ref: 'GeneratedPaper', required: true },
    paperTitle: { type: String, required: true },

    overallScore: { type: Number, min: 0, max: 100, default: 0 },
    exactMatchScore: { type: Number, min: 0, max: 100, default: 0 },
    semanticScore: { type: Number, min: 0, max: 100, default: 0 },
    citationScore: { type: Number, min: 0, max: 100, default: 0 },
    structureScore: { type: Number, min: 0, max: 100, default: 0 },
    formulaScore: { type: Number, min: 0, max: 100, default: 0 },
    figureScore: { type: Number, min: 0, max: 100, default: 0 },
    codeScore: { type: Number, min: 0, max: 100, default: 0 },

    exactMatches: [ExactMatchSchema],
    semanticMatches: [SemanticMatchSchema],
    citationMatches: [CitationMatchSchema],
    formulaMatches: [FormulaMatchSchema],
    structureMatches: [StructureMatchSchema],
    codeMatches: [CodeMatchSchema],

    aiDetection: { type: AIDetectionSchema, default: () => ({}) },
    sectionScores: [SectionScoreSchema],
    topSources: [TopSourceSchema],

    summary: { type: String, default: '' },
    severityLevel: {
      type: String,
      enum: ['very_low', 'acceptable', 'moderate', 'high', 'severe'],
      default: 'very_low',
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    processingError: String,
    totalSentencesAnalyzed: { type: Number, default: 0 },
    totalSourcesSearched: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: 'checkedAt', updatedAt: false } }
);

export default mongoose.model<IPlagiarismReport>('PlagiarismReport', PlagiarismReportSchema);
