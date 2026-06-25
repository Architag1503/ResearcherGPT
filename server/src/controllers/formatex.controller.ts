import { Request, Response } from 'express';
import { FormaTeXService } from '../services/formatex.service.js';
import GeneratedPaper from '../models/GeneratedPaper.js';
import axios from 'axios';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export const formatManuscript = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { style, manuscript } = req.body;

    if (!style) {
      return res.status(400).json({ error: 'style is required' });
    }

    let sourceManuscript = manuscript;

    // Fallback: load latest generated paper for this project if not provided in body
    if (!sourceManuscript) {
      const paper = await GeneratedPaper.findOne({ projectId }).sort({ createdAt: -1 });
      if (!paper) {
        return res.status(404).json({ error: 'No manuscript found for this project in the database. Please provide a manuscript body.' });
      }
      sourceManuscript = {
        title: paper.title,
        sections: paper.sections,
        references: paper.references,
      };
    }

    const styleUpper = style.toUpperCase();
    let result: { latex: string };

    switch (styleUpper) {
      case 'SPRINGER':
        result = await FormaTeXService.formatSpringer(sourceManuscript);
        break;
      case 'ACM':
        result = await FormaTeXService.formatACM(sourceManuscript);
        break;
      case 'ELSEVIER':
        result = await FormaTeXService.formatElsevier(sourceManuscript);
        break;
      case 'HARVARD':
        result = await FormaTeXService.formatHarvard(sourceManuscript);
        break;
      case 'APA':
        result = await FormaTeXService.formatAPA(sourceManuscript);
        break;
      case 'IEEE':
      default:
        result = await FormaTeXService.formatIEEE(sourceManuscript);
        break;
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[formatManuscript] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

export const compileLatexSource = async (req: Request, res: Response) => {
  try {
    const { latex, engine, style } = req.body;
    if (!latex) {
      return res.status(400).json({ error: 'latex is required' });
    }

    const result = await FormaTeXService.compileLatex(latex, engine || 'pdflatex', style || 'IEEE');
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[compileLatexSource] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

export const validateFormattingSource = async (req: Request, res: Response) => {
  try {
    const { latex, style } = req.body;
    if (!latex) {
      return res.status(400).json({ error: 'latex is required' });
    }

    const result = await FormaTeXService.validateFormatting(latex, style || 'IEEE');
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[validateFormattingSource] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

export const generateComplianceReportSource = async (req: Request, res: Response) => {
  try {
    const { latex, style } = req.body;
    if (!latex) {
      return res.status(400).json({ error: 'latex is required' });
    }
    if (!style) {
      return res.status(400).json({ error: 'style is required (IEEE, Springer, ACM, Elsevier, Harvard, APA)' });
    }

    const result = await FormaTeXService.generateComplianceReport(latex, style);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[generateComplianceReportSource] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Repairs a single saved paper by running the FormaTeX content enhancement pass.
 * POST /api/formatex/repair/:paperId  (projectId in body)
 */
export const repairPaper = async (req: Request, res: Response) => {
  try {
    const { paperId } = req.params;
    const { projectId } = req.body;

    if (!paperId || !projectId) {
      return res.status(400).json({ error: 'paperId (URL param) and projectId (body) are required' });
    }

    // Delegate to Python AI service for content enhancement
    const aiRes = await axios.post(
      `${AI_SERVICE_URL}/api/formatex/repair-paper`,
      { paper_id: paperId, project_id: projectId },
      { timeout: 60000 }
    );

    return res.status(200).json(aiRes.data);
  } catch (error: any) {
    console.error('[repairPaper] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Repairs ALL saved papers for a project by running the FormaTeX content enhancement pass on each.
 * POST /api/formatex/:projectId/repair-all
 */
export const repairAllPapers = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    // Fetch all papers for this project from MongoDB
    const papers = await GeneratedPaper.find({ projectId }).sort({ createdAt: -1 });

    if (!papers || papers.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No papers to repair',
        repairedCount: 0,
      });
    }

    const results: any[] = [];

    for (const paper of papers) {
      try {
        // Call Python AI service to enhance sections
        const aiRes = await axios.post(
          `${AI_SERVICE_URL}/api/formatex/repair-sections`,
          { sections: paper.sections },
          { timeout: 30000 }
        );

        if (aiRes.data.success && aiRes.data.sections) {
          paper.sections = aiRes.data.sections;
          await paper.save();
          results.push({ paperId: paper._id.toString(), status: 'repaired', title: paper.title });
        } else {
          results.push({
            paperId: paper._id.toString(),
            status: 'skipped',
            reason: aiRes.data.error || 'No sections returned',
          });
        }
      } catch (paperErr: any) {
        results.push({ paperId: paper._id.toString(), status: 'failed', reason: paperErr.message });
      }
    }

    const repairedCount = results.filter((r) => r.status === 'repaired').length;

    return res.status(200).json({
      success: true,
      message: `FormaTeX enhancement complete. ${repairedCount}/${papers.length} papers repaired.`,
      repairedCount,
      results,
    });
  } catch (error: any) {
    console.error('[repairAllPapers] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * AI formatting corrector endpoint for writing workspace
 * POST /api/formatex/auto-correct
 */
export const autoCorrect = async (req: Request, res: Response) => {
  try {
    const { htmlContent } = req.body;
    if (!htmlContent) {
      return res.status(400).json({ error: 'htmlContent is required' });
    }

    const aiRes = await axios.post(
      `${AI_SERVICE_URL}/api/formatex/auto-correct`,
      { html_content: htmlContent },
      { timeout: 30000 }
    );

    return res.status(200).json(aiRes.data);
  } catch (error: any) {
    console.error('[autoCorrect] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
