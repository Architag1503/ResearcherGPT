import mongoose, { Schema, Document } from 'mongoose';

export interface IFactCheckSource {
  paperId: mongoose.Types.ObjectId | string;
  paperTitle: string;
  pageNumber?: number;
  snippet: string;
  confidenceScore: number;
}

export interface IFactCheck extends Document {
  projectId: mongoose.Types.ObjectId | string;
  claim: string;
  status: 'verified' | 'refuted' | 'unverified';
  confidenceScore: number; // 0 to 1
  analysis: string;
  sources: IFactCheckSource[];
  createdAt: Date;
  updatedAt: Date;
}

const FactCheckSourceSchema = new Schema({
  paperId: { type: Schema.Types.ObjectId, ref: 'Paper', required: false },
  paperTitle: { type: String, required: true },
  pageNumber: { type: Number },
  snippet: { type: String, required: true },
  confidenceScore: { type: Number, required: true, min: 0, max: 1 },
});

const FactCheckSchema: Schema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    claim: { type: String, required: true },
    status: {
      type: String,
      enum: ['verified', 'refuted', 'unverified'],
      default: 'unverified',
    },
    confidenceScore: { type: Number, default: 0 },
    analysis: { type: String },
    sources: [FactCheckSourceSchema],
  },
  { timestamps: true }
);

export default mongoose.model<IFactCheck>('FactCheck', FactCheckSchema);
