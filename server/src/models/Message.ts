import mongoose, { Schema, Document } from 'mongoose';

export interface IMessageSource {
  paperId: mongoose.Types.ObjectId | string;
  paperTitle: string;
  pageNumber?: number;
  textContent: string;
  confidenceScore: number;
}

export interface IMessage extends Document {
  chatSessionId: mongoose.Types.ObjectId | string;
  role: 'user' | 'assistant';
  content: string;
  sources: IMessageSource[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSourceSchema = new Schema({
  paperId: { type: Schema.Types.ObjectId, ref: 'Paper', required: true },
  paperTitle: { type: String, required: true },
  pageNumber: { type: Number },
  textContent: { type: String, required: true },
  confidenceScore: { type: Number, required: true, min: 0, max: 1, default: 1.0 },
});

const MessageSchema: Schema = new Schema(
  {
    chatSessionId: { type: Schema.Types.ObjectId, ref: 'ChatSession', required: true, index: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    sources: [MessageSourceSchema],
  },
  { timestamps: true }
);

export default mongoose.model<IMessage>('Message', MessageSchema);
