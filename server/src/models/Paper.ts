import mongoose, { Schema, Document } from 'mongoose';

export interface IPaper extends Document {
  projectId: mongoose.Types.ObjectId | string;
  title: string;
  authors: string[];
  doi?: string;
  journal?: string;
  year?: number;
  abstract?: string;
  pdfUrl?: string;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  processingError?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const PaperSchema: Schema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true },
    authors: [{ type: String }],
    doi: { type: String },
    journal: { type: String },
    year: { type: Number },
    abstract: { type: String },
    pdfUrl: { type: String },
    status: {
      type: String,
      enum: ['pending', 'processing', 'processed', 'failed'],
      default: 'pending',
    },
    processingError: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model<IPaper>('Paper', PaperSchema);
