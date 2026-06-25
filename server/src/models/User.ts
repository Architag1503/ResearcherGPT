import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  clerkId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: 'student' | 'researcher' | 'professor' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    avatarUrl: { type: String },
    role: {
      type: String,
      enum: ['student', 'researcher', 'professor', 'admin'],
      default: 'researcher',
    },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
