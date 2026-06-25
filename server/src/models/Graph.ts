import mongoose, { Schema, Document } from 'mongoose';

export interface IGraphNode {
  id: string; // unique string identifier
  label: string; // display text
  type: 'paper' | 'author' | 'method' | 'dataset' | 'keyword' | 'concept';
  val?: number; // visual scale/size
  color?: string;
}

export interface IGraphLink {
  source: string; // id of source node
  target: string; // id of target node
  label: string;  // relationship description, e.g. "authored"
}

export interface IKnowledgeGraph extends Document {
  projectId: mongoose.Types.ObjectId | string;
  nodes: IGraphNode[];
  links: IGraphLink[];
  createdAt: Date;
  updatedAt: Date;
}

const GraphNodeSchema = new Schema({
  id: { type: String, required: true },
  label: { type: String, required: true },
  type: {
    type: String,
    enum: ['paper', 'author', 'method', 'dataset', 'keyword', 'concept'],
    required: true,
  },
  val: { type: Number, default: 1 },
  color: { type: String },
});

const GraphLinkSchema = new Schema({
  source: { type: String, required: true },
  target: { type: String, required: true },
  label: { type: String, required: true },
});

const KnowledgeGraphSchema: Schema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, unique: true, index: true },
    nodes: [GraphNodeSchema],
    links: [GraphLinkSchema],
  },
  { timestamps: true }
);

export default mongoose.model<IKnowledgeGraph>('KnowledgeGraph', KnowledgeGraphSchema);
