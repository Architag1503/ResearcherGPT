import mongoose, { Schema, Document } from 'mongoose';

export interface IResearchGap extends Document {
  projectId: mongoose.Types.ObjectId | string;
  title: string;
  description: string;
  evidence: string[]; // Quotes from papers showing the gap
  sources: mongoose.Types.ObjectId[] | string[]; // Paper references
  category: 'methodological' | 'empirical' | 'theoretical' | 'dataset' | 'other';
  impactScore: number; // 1-10 rating
  feasibilityScore: number; // 1-10 rating
  createdAt: Date;
  updatedAt: Date;
}

const ResearchGapSchema: Schema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    evidence: [{ type: String }],
    sources: [{ type: Schema.Types.ObjectId, ref: 'Paper' }],
    category: {
      type: String,
      enum: ['methodological', 'empirical', 'theoretical', 'dataset', 'other'],
      default: 'other',
    },
    impactScore: { type: Number, min: 1, max: 10, default: 5 },
    feasibilityScore: { type: Number, min: 1, max: 10, default: 5 },
  },
  { timestamps: true }
);

export default mongoose.model<IResearchGap>('ResearchGap', ResearchGapSchema);
