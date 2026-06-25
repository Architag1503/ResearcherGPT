import { Request, Response } from 'express';
import axios from 'axios';
import Paper from '../models/Paper.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export const getComparisonMatrix = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    // 1. Fetch papers for project to verify they exist and are processed
    const papers = await Paper.find({ projectId, status: 'processed' });
    if (papers.length === 0) {
      return res.status(200).json({
        columns: ['Title', 'Authors', 'Year', 'Accuracy', 'Method/Models', 'Dataset', 'Strengths', 'Weaknesses'],
        rows: [],
      });
    }

    // 2. Query FastAPI comparison agent
    const response = await axios.post(`${AI_SERVICE_URL}/api/comparison/matrix`, {
      project_id: projectId,
      paper_ids: papers.map(p => p._id.toString()),
    });

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('[getComparisonMatrix] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
