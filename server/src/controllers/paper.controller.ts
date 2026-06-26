import { Request, Response } from 'express';
import { Queue } from 'bullmq';
import fs from 'fs';
import Paper from '../models/Paper.js';
import { bullConfig } from '../config/redis.js';

let pdfQueue: Queue | null = null;
if (process.env.DISABLE_QUEUE !== 'true') {
  try {
    pdfQueue = new Queue('pdf-processing', bullConfig);
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

    // 1. Create paper record
    const paper = new Paper({
      projectId,
      title: file.originalname.replace(/\.[^/.]+$/, ""), // remove extension
      authors: [],
      status: 'pending',
      pdfUrl: file.path,
    });

    await paper.save();

    // 2. Queue the PDF processing background job (only if Redis is available)
    let jobId: string | undefined;
    if (pdfQueue) {
      let fileBase64: string | undefined;
      try {
        if (fs.existsSync(file.path)) {
          fileBase64 = fs.readFileSync(file.path).toString('base64');
        }
      } catch (err: any) {
        console.warn('[uploadPaper] Failed to read file for queuing:', err.message);
      }

      const job = await pdfQueue.add('pdf-processing', {
        paperId: paper._id,
        filePath: file.path,
        fileBase64,
        projectId,
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
