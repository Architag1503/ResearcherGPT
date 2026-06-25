import mongoose, { Schema, Document } from 'mongoose';

export interface ICitation extends Document {
  projectId: mongoose.Types.ObjectId | string;
  paperId?: mongoose.Types.ObjectId | string; // Optional internal paper ref
  key: string; // e.g. "AuthorYear"
  doi?: string;
  title: string;
  authors: string[];
  journal?: string;
  year?: number;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  styles: {
    apa?: string;
    mla?: string;
    ieee?: string;
    chicago?: string;
    harvard?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const CitationSchema: Schema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    paperId: { type: Schema.Types.ObjectId, ref: 'Paper' },
    key: { type: String, required: true, index: true },
    doi: { type: String },
    title: { type: String, required: true },
    authors: [{ type: String }],
    journal: { type: String },
    year: { type: Number },
    volume: { type: String },
    issue: { type: String },
    pages: { type: String },
    publisher: { type: String },
    styles: {
      apa: { type: String },
      mla: { type: String },
      ieee: { type: String },
      chicago: { type: String },
      harvard: { type: String },
    },
  },
  { timestamps: true }
);

export default mongoose.model<ICitation>('Citation', CitationSchema);
