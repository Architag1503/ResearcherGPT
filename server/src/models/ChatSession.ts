import mongoose, { Schema, Document } from 'mongoose';

export interface IChatSession extends Document {
  projectId: mongoose.Types.ObjectId | string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSessionSchema: Schema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, default: 'New Chat Session' },
  },
  { timestamps: true }
);

export default mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);
