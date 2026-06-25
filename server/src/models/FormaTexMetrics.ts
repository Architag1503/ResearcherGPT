import mongoose, { Document, Schema } from 'mongoose';

export interface IFormaTexMetrics extends Document {
  apiLatency: number;
  success: boolean;
  errorType: 'none' | 'compilation_failure' | 'formatting_failure' | 'template_validation_error' | 'network_error';
  targetStyle: 'IEEE' | 'Springer' | 'ACM' | 'Elsevier' | 'Harvard' | 'APA';
  action: 'format' | 'compile' | 'validate' | 'compliance';
  errorMessage?: string;
  timestamp: Date;
}

const FormaTexMetricsSchema: Schema = new Schema({
  apiLatency: { type: Number, required: true },
  success: { type: Boolean, required: true },
  errorType: { type: String, enum: ['none', 'compilation_failure', 'formatting_failure', 'template_validation_error', 'network_error'], required: true },
  targetStyle: { type: String, enum: ['IEEE', 'Springer', 'ACM', 'Elsevier', 'Harvard', 'APA'], required: true },
  action: { type: String, enum: ['format', 'compile', 'validate', 'compliance'], required: true },
  errorMessage: { type: String },
  timestamp: { type: Date, default: Date.now }
}, { collection: 'formatex_metrics' });

export default mongoose.model<IFormaTexMetrics>('FormaTexMetrics', FormaTexMetricsSchema);
