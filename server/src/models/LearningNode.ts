import mongoose, { Schema, Document } from 'mongoose';

export interface ILearningNode extends Document {
  projectId: mongoose.Types.ObjectId | string;
  nodeId: string;
  label: string;
  type: string;
  explanations: {
    beginner: string;
    intermediate: string;
    research: string;
  };
  whySeeingThis: string;
  connections: {
    direct: string[];
    indirect: string[];
    mostImportant: string[];
    explanation: string;
  };
  typeSpecificData: Record<string, any>;
  learningAssets: {
    summary: string;
    notes: string;
    flashcards: Array<{ question: string; answer: string }>;
    quizQuestions: Array<{ question: string; options?: string[]; answer: string; explanation?: string }>;
    mcqs: Array<{ question: string; options: string[]; answer: string; explanation?: string }>;
    vivaQuestions: Array<{ question: string; answer: string }>;
    interviewQuestions: Array<{ question: string; answer: string }>;
    revisionNotes: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const LearningNodeSchema: Schema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    nodeId: { type: String, required: true, index: true },
    label: { type: String, required: true },
    type: { type: String, required: true },
    explanations: {
      beginner: { type: String, required: true },
      intermediate: { type: String, required: true },
      research: { type: String, required: true },
    },
    whySeeingThis: { type: String, required: true },
    connections: {
      direct: [{ type: String }],
      indirect: [{ type: String }],
      mostImportant: [{ type: String }],
      explanation: { type: String, required: true },
    },
    typeSpecificData: { type: Schema.Types.Mixed, default: {} },
    learningAssets: {
      summary: { type: String },
      notes: { type: String },
      flashcards: [
        {
          question: { type: String, required: true },
          answer: { type: String, required: true },
        },
      ],
      quizQuestions: [
        {
          question: { type: String, required: true },
          options: [{ type: String }],
          answer: { type: String, required: true },
          explanation: { type: String },
        },
      ],
      mcqs: [
        {
          question: { type: String, required: true },
          options: [{ type: String, required: true }],
          answer: { type: String, required: true },
          explanation: { type: String },
        },
      ],
      vivaQuestions: [
        {
          question: { type: String, required: true },
          answer: { type: String, required: true },
        },
      ],
      interviewQuestions: [
        {
          question: { type: String, required: true },
          answer: { type: String, required: true },
        },
      ],
      revisionNotes: { type: String },
    },
  },
  { timestamps: true }
);

// Compound index to ensure uniqueness per project node
LearningNodeSchema.index({ projectId: 1, nodeId: 1 }, { unique: true });

export default mongoose.model<ILearningNode>('LearningNode', LearningNodeSchema);
