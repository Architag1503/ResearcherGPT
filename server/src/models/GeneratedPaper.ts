import mongoose, { Schema, Document } from 'mongoose';

export interface IPaperSection {
  title: string;
  heading: string; // e.g. "1. Introduction"
  content: string;
}

export interface IGeneratedPaper extends Document {
  projectId: mongoose.Types.ObjectId | string;
  title: string;
  outline: string[];
  sections: IPaperSection[];
  references: string[]; // List of formatted citations
  status: 'draft' | 'finalizing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const PaperSectionSchema = new Schema({
  title: { type: String, required: true },
  heading: { type: String, required: true },
  content: { type: String, required: true },
});

const GeneratedPaperSchema: Schema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, default: 'Untitled Research Manuscript' },
    outline: [{ type: String }],
    sections: [PaperSectionSchema],
    references: [{ type: String }],
    status: {
      type: String,
      enum: ['draft', 'finalizing', 'completed', 'failed'],
      default: 'draft',
    },
  },
  { timestamps: true }
);

export default mongoose.model<IGeneratedPaper>('GeneratedPaper', GeneratedPaperSchema);
