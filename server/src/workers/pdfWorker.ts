import { Worker, Job } from 'bullmq';
import axios from 'axios';
import { bullConfig } from '../config/redis.js';
import Paper from '../models/Paper.js';
import PaperChunk from '../models/PaperChunk.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

let pdfWorker: Worker | null = null;

try {
  pdfWorker = new Worker(
    'pdf-processing',
    async (job: Job) => {
      const { paperId, filePath, projectId } = job.data;
      console.log(`[pdfWorker] Processing paper ${paperId} at path: ${filePath}`);

      try {
        // 1. Update Paper status to processing
        await Paper.findByIdAndUpdate(paperId, { status: 'processing' });

        // 2. Call Python AI service to process PDF
        // The AI service parses PDF with PyMuPDF/pdfplumber, chunks it, and creates vector records in Qdrant
        const response = await axios.post(`${AI_SERVICE_URL}/api/pdf/process`, {
          paper_id: paperId,
          project_id: projectId,
          file_path: filePath,
        });

        const { success, chunks, metadata, error } = response.data;

        if (!success) {
          throw new Error(error || 'Failed to process PDF on AI service');
        }

        // 3. Save chunks to MongoDB for fast text lookup (with page numbers and indexes)
        if (chunks && chunks.length > 0) {
          const chunkDocuments = chunks.map((c: any) => ({
            paperId,
            projectId,
            chunkIndex: c.chunk_index,
            textContent: c.text_content,
            pageNumber: c.page_number,
            qdrantId: c.qdrant_id,
          }));

          await PaperChunk.insertMany(chunkDocuments);
        }

        // 4. Update Paper metadata, status to processed
        await Paper.findByIdAndUpdate(paperId, {
          status: 'processed',
          title: metadata.title || 'Untitled',
          authors: metadata.authors || [],
          doi: metadata.doi || '',
          year: metadata.year || new Date().getFullYear(),
          abstract: metadata.abstract || '',
          journal: metadata.journal || '',
          metadata: metadata.extra_meta || {},
        });

        console.log(`[pdfWorker] Successfully processed paper: ${paperId}`);
      } catch (error: any) {
        console.error(`[pdfWorker] Error processing paper ${paperId}:`, error.message);
        await Paper.findByIdAndUpdate(paperId, {
          status: 'failed',
          processingError: error.message || 'Unknown processing error',
        });
        throw error;
      }
    },
    bullConfig
  );

  pdfWorker.on('completed', (job) => {
    console.log(`[pdfWorker] Job ${job.id} completed successfully`);
  });

  pdfWorker.on('failed', (job, err) => {
    console.error(`[pdfWorker] Job ${job?.id} failed with error:`, err);
  });

  pdfWorker.on('error', (err) => {
    console.error('[pdfWorker] Worker error:', err);
  });

  console.log('[pdfWorker] Worker initialized.');
} catch (err: any) {
  console.warn('[pdfWorker] Could not initialize — Redis unavailable. PDF processing disabled.', err.message);
}

export { pdfWorker };
