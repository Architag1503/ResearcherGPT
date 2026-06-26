import { Request, Response } from 'express';
import { Queue } from 'bullmq';
import fs from 'fs';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import Paper from '../models/Paper.js';
import PaperChunk from '../models/PaperChunk.js';
import { bullConfig } from '../config/redis.js';

const s3Client = new S3Client({
  endpoint: process.env.R2_ENDPOINT || 'https://10daf3809212776719f5a55b3f6b0f6e.r2.cloudflarestorage.com',
  region: process.env.R2_REGION || 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

let pdfQueue: Queue | null = null;
if (process.env.DISABLE_QUEUE !== 'true') {
  try {
    pdfQueue = new Queue('pdf-processing', {
      ...bullConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    });
    pdfQueue.on('error', (err) => {
      console.warn('[paper.controller] Queue error:', err.message);
    });
  } catch (err: any) {
    console.warn('[paper.controller] BullMQ Queue init failed:', err.message);
  }
}

export const uploadPaper = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.body;
    const file = req.file;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    if (!file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    // Stage 1: Validate file size (50MB) and type
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'File size exceeds 50MB limit.' });
    }
    if (file.mimetype !== 'application/pdf') {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Only PDF files are supported.' });
    }

    const buffer = fs.readFileSync(file.path);

    // Validate magic PDF signature (%PDF-)
    const signature = buffer.toString('utf8', 0, 5);
    if (signature !== '%PDF-') {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Invalid PDF signature. File may be corrupted.' });
    }

    // Check if PDF is encrypted / password protected
    const headerStr = buffer.toString('utf8', 0, Math.min(buffer.length, 16384));
    if (headerStr.includes('/Encrypt')) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'PDF is encrypted or password-protected.' });
    }

    // Calculate SHA-256 checksum
    const hash = crypto.createHash('sha256');
    hash.update(buffer);
    const checksum = hash.digest('hex');

    // Deduplication check: check if this file is already processed in MongoDB
    const existingPaper = await Paper.findOne({ checksum, status: 'processed' });

    let storageUrl = '';
    let paper: any;

    if (existingPaper) {
      console.log(`[uploadPaper] Duplicate paper detected (checksum: ${checksum}). Reusing existing processed data.`);
      
      // Reuse PDF from R2
      storageUrl = existingPaper.storageUrl || existingPaper.pdfUrl || '';

      // Create new Paper entry for the new project
      paper = new Paper({
        projectId,
        title: existingPaper.title,
        authors: existingPaper.authors,
        doi: existingPaper.doi,
        journal: existingPaper.journal,
        year: existingPaper.year,
        abstract: existingPaper.abstract,
        pdfUrl: storageUrl,
        storageUrl,
        checksum,
        status: 'processed',
        currentStage: 'Completed',
        progress: 100,
        metadata: existingPaper.metadata,
      });
      await paper.save();

      // Duplicate database chunks to save processing time
      const existingChunks = await PaperChunk.find({ paperId: existingPaper._id });
      if (existingChunks.length > 0) {
        const newChunks = existingChunks.map((c) => ({
          paperId: paper._id,
          projectId,
          chunkIndex: c.chunkIndex,
          textContent: c.textContent,
          pageNumber: c.pageNumber,
          qdrantId: c.qdrantId,
        }));
        await PaperChunk.insertMany(newChunks);
      }
    } else {
      // Stage 1: Upload to Cloudflare R2
      const bucketName = process.env.R2_BUCKET_NAME || 'researcher-gpt';
      const key = `uploads/${Date.now()}-${file.filename || file.originalname}`;

      const uploadParams = {
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
      };

      await s3Client.send(new PutObjectCommand(uploadParams));
      storageUrl = `${process.env.R2_ENDPOINT || 'https://10daf3809212776719f5a55b3f6b0f6e.r2.cloudflarestorage.com'}/${bucketName}/${key}`;

      // Create paper record with pending status
      paper = new Paper({
        projectId,
        title: file.originalname.replace(/\.[^/.]+$/, ''),
        authors: [],
        status: 'pending',
        pdfUrl: storageUrl,
        storageUrl,
        checksum,
        currentStage: 'Queued',
        progress: 10,
      });
      await paper.save();
    }

    // Immediately delete temporary local files
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (err) {
      console.warn('[uploadPaper] Failed to delete temp local file:', err);
    }

    // Queue the PDF processing background job (only if Redis is available)
    let jobId: string | undefined;
    if (pdfQueue) {
      const job = await pdfQueue.add('pdf-processing', {
        paperId: paper._id,
        projectId,
        storageUrl,
        checksum,
        reusePaperId: existingPaper ? existingPaper._id : undefined,
        processingVersion: '1.0.0',
      });
      jobId = job.id;
    } else {
      console.warn('[uploadPaper] PDF queue unavailable — paper saved but not queued for AI processing.');
    }

    return res.status(201).json({
      message: pdfQueue
        ? 'Paper upload successful, processing queued.'
        : 'Paper saved. AI processing is unavailable (Redis not connected).',
      paper,
      jobId,
    });
  } catch (error: any) {
    console.error('[uploadPaper] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

export const getPapers = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    const papers = await Paper.find({ projectId }).sort({ createdAt: -1 });
    return res.status(200).json(papers);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getPaperById = async (req: Request, res: Response) => {
  try {
    const { paperId } = req.params;
    const paper = await Paper.findById(paperId);
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }
    return res.status(200).json(paper);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const deletePaper = async (req: Request, res: Response) => {
  try {
    const { paperId } = req.params;
    const paper = await Paper.findByIdAndDelete(paperId);
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }
    // In production: delete files from disk
    return res.status(200).json({ message: 'Paper deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
