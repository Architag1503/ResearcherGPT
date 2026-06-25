import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/researcher_gpt';

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('MongoDB successfully connected.');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};
