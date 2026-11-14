import mongoose, { Schema, Document } from 'mongoose';

export interface IUserApiKey extends Document {
  userId: string;
  groqApiKey?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserApiKeySchema: Schema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    groqApiKey: { type: String, default: '' },
    geminiApiKey: { type: String, default: '' },
    openaiApiKey: { type: String, default: '' },
    anthropicApiKey: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model<IUserApiKey>('UserApiKey', UserApiKeySchema);
