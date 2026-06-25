import { Worker, Job } from 'bullmq';
import axios from 'axios';
import { bullConfig } from '../config/redis.js';
import KnowledgeGraph from '../models/Graph.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

let graphWorker: Worker | null = null;

try {
  graphWorker = new Worker(
    'knowledge-graph-generation',
    async (job: Job) => {
      const { projectId } = job.data;
      console.log(`[graphWorker] Generating knowledge graph for project: ${projectId}`);

      try {
        // 1. Call AI service to extract nodes and relations
        const response = await axios.post(`${AI_SERVICE_URL}/api/graph/generate`, {
          project_id: projectId,
        });

        const { success, nodes, links, error } = response.data;

        if (!success) {
          throw new Error(error || 'Failed to generate knowledge graph on AI service');
        }

        // 2. Save/Update graph in MongoDB
        await KnowledgeGraph.findOneAndUpdate(
          { projectId },
          { nodes, links },
          { upsert: true, new: true }
        );

        console.log(`[graphWorker] Graph generated successfully for project: ${projectId}`);
      } catch (error: any) {
        console.error(`[graphWorker] Error generating graph for ${projectId}:`, error.message);
        throw error;
      }
    },
    bullConfig
  );

  graphWorker.on('completed', (job) => {
    console.log(`[graphWorker] Job ${job.id} completed successfully`);
  });

  graphWorker.on('failed', (job, err) => {
    console.error(`[graphWorker] Job ${job?.id} failed with error:`, err);
  });

  graphWorker.on('error', (err) => {
    console.error('[graphWorker] Worker error:', err);
  });

  console.log('[graphWorker] Worker initialized.');
} catch (err: any) {
  console.warn('[graphWorker] Could not initialize — Redis unavailable. Graph generation disabled.', err.message);
}

export { graphWorker };
