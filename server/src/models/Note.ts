import mongoose, { Schema, Document } from 'mongoose';

export interface INote extends Document {
  projectId: mongoose.Types.ObjectId | string;
  paperId?: mongoose.Types.ObjectId | string; // Optional reference to a specific paper
  title: string;
  content: string; // TipTap content (HTML or JSON)
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema: Schema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    paperId: { type: Schema.Types.ObjectId, ref: 'Paper' },
    title: { type: String, required: true, default: 'Untitled Note' },
    content: { type: String, default: '' },
    tags: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.model<INote>('Note', NoteSchema);
