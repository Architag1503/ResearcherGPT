import mongoose, { Schema, Document } from 'mongoose';

export interface IPaperChunk extends Document {
  paperId: mongoose.Types.ObjectId | string;
  projectId: mongoose.Types.ObjectId | string;
  chunkIndex: number;
  textContent: string;
  pageNumber?: number;
  qdrantId?: string; // ID of the vector in Qdrant
  createdAt: Date;
}

const PaperChunkSchema: Schema = new Schema(
  {
    paperId: { type: Schema.Types.ObjectId, ref: 'Paper', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    chunkIndex: { type: Number, required: true },
    textContent: { type: String, required: true },
    pageNumber: { type: Number },
    qdrantId: { type: String, index: true },
  },
  { timestamps: true }
);

export default mongoose.model<IPaperChunk>('PaperChunk', PaperChunkSchema);
