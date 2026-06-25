import mongoose, { Schema, Document } from 'mongoose';

export interface IAgentStep {
  name: string; // 'Research Agent', 'Literature Agent', etc.
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  logs?: string;
  output?: Record<string, any>;
}

export interface IAgentRun extends Document {
  projectId: mongoose.Types.ObjectId | string;
  query: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  steps: IAgentStep[];
  result?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const AgentStepSchema = new Schema({
  name: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending',
  },
  startedAt: { type: Date },
  completedAt: { type: Date },
  logs: { type: String },
  output: { type: Schema.Types.Mixed },
});

const AgentRunSchema: Schema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    query: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
    },
    steps: [AgentStepSchema],
    result: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export default mongoose.model<IAgentRun>('AgentRun', AgentRunSchema);
