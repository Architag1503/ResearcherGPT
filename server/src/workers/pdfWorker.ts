import { Worker, Job } from 'bullmq';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { bullConfig } from '../config/redis.js';
import Paper from '../models/Paper.js';
import PaperChunk from '../models/PaperChunk.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const s3Client = new S3Client({
  endpoint: process.env.R2_ENDPOINT || 'https://10daf3809212776719f5a55b3f6b0f6e.r2.cloudflarestorage.com',
  region: process.env.R2_REGION || 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const streamToBuffer = async (stream: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on('data', (chunk: any) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
};

const updateProgress = async (paperId: string, stage: string, progress: number, completedStage?: string) => {
  const update: any = { currentStage: stage, progress };
  if (completedStage) {
    update.$addToSet = { completedStages: completedStage };
  }
  await Paper.findByIdAndUpdate(paperId, update);
};

let pdfWorker: Worker | null = null;

try {
  pdfWorker = new Worker(
    'pdf-processing',
    async (job: Job) => {
      const { paperId, projectId, storageUrl, checksum, reusePaperId } = job.data;
      console.log(`[pdfWorker] Processing paper ${paperId} (project: ${projectId})`);

      // Track retry count
      await Paper.findByIdAndUpdate(paperId, { $inc: { retryCount: 1 } });

      const paper = await Paper.findById(paperId);
      if (!paper) throw new Error('Paper not found in MongoDB');

      const completed = paper.completedStages || [];

      try {
        await Paper.findByIdAndUpdate(paperId, { status: 'processing', processingError: '' });

        let chunks = [];
        let metadata: any = {};

        // Stage 10: Error Recovery / Resumability
        const hasParsed = completed.includes('Parsing') && completed.includes('Chunking');

        if (reusePaperId) {
          // Stage 11: Deduplication — Reuse existing chunks and vectors
          await updateProgress(paperId, 'Vector Indexing', 80);
          console.log(`[pdfWorker] Reusing existing paper vectors (source: ${reusePaperId})`);
          
          const response = await axios.post(`${AI_SERVICE_URL}/api/pdf/process`, {
            paper_id: paperId,
            project_id: projectId,
            reuse_paper_id: reusePaperId,
            storage_url: storageUrl,
            file_path: '',
          });

          if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to reuse vectors on AI service');
          }

          metadata = response.data.metadata || {};
          await updateProgress(paperId, 'Vector Indexing', 90, 'Vector Indexing');
        } else {
          let fileBase64 = '';
          let aiServiceStorageUrl = storageUrl;

          // Step 1: Downloading from R2 (or local file fallback)
          if (!hasParsed && !completed.includes('Downloading')) {
            await updateProgress(paperId, 'Downloading', 20);
            
            if (storageUrl) {
              console.log(`[pdfWorker] Generating pre-signed URL for object storage: ${storageUrl}`);
              const bucketName = process.env.R2_BUCKET_NAME || 'researcher-gpt';
              const urlObj = new URL(storageUrl);
              const key = urlObj.pathname.replace(`/${bucketName}/`, '').replace(/^\//, '');

              const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
              const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
              // Generate a pre-signed URL valid for 15 minutes
              aiServiceStorageUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
              console.log(`[pdfWorker] Pre-signed URL generated successfully.`);
            } else if (paper.pdfUrl) {
              console.log(`[pdfWorker] Reading PDF from local file storage: ${paper.pdfUrl}`);
              if (fs.existsSync(paper.pdfUrl)) {
                fileBase64 = fs.readFileSync(paper.pdfUrl).toString('base64');
              } else {
                const relativePath = path.join('uploads', path.basename(paper.pdfUrl));
                if (fs.existsSync(relativePath)) {
                  fileBase64 = fs.readFileSync(relativePath).toString('base64');
                } else {
                  throw new Error(`Local file not found at path: ${paper.pdfUrl}`);
                }
              }
            } else {
              throw new Error('No storage URL or local path configured.');
            }
            
            await updateProgress(paperId, 'Downloading', 30, 'Downloading');
          }

          // Step 2: Parsing & Chunking on AI service
          if (!hasParsed) {
            await updateProgress(paperId, 'Parsing', 40);
            
            const response = await axios.post(`${AI_SERVICE_URL}/api/pdf/process`, {
              paper_id: paperId,
              project_id: projectId,
              file_base64: fileBase64,
              storage_url: aiServiceStorageUrl,
              file_path: '',
            }, {
              timeout: 180000, // 3 minutes timeout to give AI Service enough time
              maxBodyLength: Infinity,
              maxContentLength: Infinity
            });

            const { success, chunks: processedChunks, metadata: processedMeta, error } = response.data;
            if (!success) {
              throw new Error(error || 'Failed to process PDF on AI service');
            }

            chunks = processedChunks || [];
            metadata = processedMeta || {};

            await updateProgress(paperId, 'Chunking', 60, 'Parsing');

            // Save chunks to MongoDB
            if (chunks.length > 0) {
              // Delete existing chunks if retrying
              await PaperChunk.deleteMany({ paperId });
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
            await updateProgress(paperId, 'Embedding', 80, 'Chunking');
          } else {
            console.log('[pdfWorker] Skipping PDF download and parsing, chunks already generated.');
            // Fetch metadata and chunks from existing MongoDB state for indexing
            metadata = paper.metadata || {};
            const existingDbChunks = await PaperChunk.find({ paperId });
            chunks = existingDbChunks.map(c => ({
              chunk_index: c.chunkIndex,
              text_content: c.textContent,
              page_number: c.pageNumber,
              qdrant_id: c.qdrantId,
            }));
          }

          // Step 3: Vector Indexing
          if (!completed.includes('Vector Indexing')) {
            await updateProgress(paperId, 'Vector Indexing', 90, 'Vector Indexing');
          }
        }

        // Stage 6: Graph Construction (Trigger project graph update)
        await updateProgress(paperId, 'Graph Construction', 95);
        try {
          await axios.post(`${AI_SERVICE_URL}/api/graph/generate`, {
            project_id: projectId,
          });
          await updateProgress(paperId, 'Graph Construction', 98, 'Graph Construction');
        } catch (err: any) {
          console.warn('[pdfWorker] Graph generation warning:', err.message);
        }

        // Stage 8: Validation
        await updateProgress(paperId, 'Validation', 99);
        const dbChunksCount = await PaperChunk.countDocuments({ paperId });
        if (dbChunksCount === 0) {
          throw new Error('Validation failed: No text chunks found in database.');
        }

        // Save metadata and update status to processed
        await Paper.findByIdAndUpdate(paperId, {
          status: 'processed',
          title: metadata.title || paper.title || 'Untitled',
          authors: metadata.authors || [],
          doi: metadata.doi || '',
          year: metadata.year || new Date().getFullYear(),
          abstract: metadata.abstract || '',
          journal: metadata.journal || '',
          metadata: metadata.extra_meta || {},
          progress: 100,
          currentStage: 'Completed',
          completedStages: ['Downloading', 'Parsing', 'Chunking', 'Vector Indexing', 'Graph Construction', 'Validation', 'Completed']
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
