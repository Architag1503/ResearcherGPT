import { Request, Response } from 'express';
import PlagiarismReport from '../models/PlagiarismReport.js';
import GeneratedPaper from '../models/GeneratedPaper.js';
import Paper from '../models/Paper.js';
import PaperChunk from '../models/PaperChunk.js';
import { runPlagiarismDetection } from '../utils/plagiarismEngine.js';

/**
 * POST /:projectId/plagiarism-reports/:paperId/run
 * Trigger a plagiarism check on a saved (generated) research paper.
 */
export const runPlagiarismCheck = async (req: Request, res: Response) => {
  try {
    const { projectId, paperId } = req.params;

    // 1. Find the target generated paper
    const generatedPaper = await GeneratedPaper.findById(paperId);
    if (!generatedPaper) {
      return res.status(404).json({ error: 'Generated paper not found' });
    }

    // 2. Clean up any previous dangling/stuck reports for this paper in "processing" state
    await PlagiarismReport.deleteMany({
      projectId,
      generatedPaperId: paperId,
      status: 'processing',
    });

    // Create a new report in "processing" state
    const report = new PlagiarismReport({
      projectId,
      generatedPaperId: paperId,
      paperTitle: generatedPaper.title || 'Untitled',
      status: 'processing',
    });
    await report.save();

    // Return the processing report immediately — run detection async
    res.status(202).json(report);

    // 3. Gather local corpus papers (uploaded PDFs with extracted text)
    const localPapers = await Paper.find({
      projectId,
      status: 'processed',
    });

    const localPaperData: { title: string; content: string; doi?: string; url?: string; references?: string[] }[] = [];

    for (const lp of localPapers) {
      // Get paper chunks to reconstruct content
      const chunks = await PaperChunk.find({ paperId: lp._id }).sort({ chunkIndex: 1 });
      const content = chunks.map(c => c.textContent).join('\n');

      if (content.length > 50) {
        localPaperData.push({
          title: lp.title,
          content,
          doi: lp.doi,
          url: lp.pdfUrl,
        });
      }
    }

    // 4. Run the detection engine with a 45-second timeout guard
    try {
      const detectionPromise = runPlagiarismDetection(
        generatedPaper.title || 'Untitled',
        generatedPaper.sections || [],
        generatedPaper.references || [],
        localPaperData
      );

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Plagiarism analysis timed out after 45s')), 45000)
      );

      const result = await Promise.race([detectionPromise, timeoutPromise]);

      // Verify report was not deleted by the user while running
      const stillExists = await PlagiarismReport.findById(report._id);
      if (!stillExists) {
        console.log(`[plagiarism] Report ${report._id} was deleted by user during processing. Skipping save.`);
        return;
      }

      // 5. Update the report with results
      stillExists.overallScore = result.overallScore;
      stillExists.exactMatchScore = result.exactMatchScore;
      stillExists.semanticScore = result.semanticScore;
      stillExists.citationScore = result.citationScore;
      stillExists.structureScore = result.structureScore;
      stillExists.formulaScore = result.formulaScore;
      stillExists.figureScore = result.figureScore;
      stillExists.codeScore = result.codeScore;

      stillExists.exactMatches = result.exactMatches as any;
      stillExists.semanticMatches = result.semanticMatches as any;
      stillExists.citationMatches = result.citationMatches as any;
      stillExists.formulaMatches = result.formulaMatches as any;
      stillExists.structureMatches = result.structureMatches as any;
      stillExists.codeMatches = result.codeMatches as any;

      stillExists.aiDetection = result.aiDetection;
      stillExists.sectionScores = result.sectionScores;
      stillExists.topSources = result.topSources;

      stillExists.summary = result.summary;
      stillExists.severityLevel = result.severityLevel as any;
      stillExists.status = 'completed';
      stillExists.totalSentencesAnalyzed = result.totalSentencesAnalyzed;
      stillExists.totalSourcesSearched = result.totalSourcesSearched;

      await stillExists.save();
      console.log(`✅ Plagiarism check completed for paper: ${generatedPaper.title} — Score: ${result.overallScore}%`);
    } catch (engineError: any) {
      console.error(`❌ Plagiarism engine error:`, engineError);
      const stillExists = await PlagiarismReport.findById(report._id);
      if (stillExists) {
        stillExists.status = 'failed';
        stillExists.processingError = engineError.message || 'Engine processing error';
        await stillExists.save();
      }
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /:projectId/plagiarism-reports
 * List all plagiarism reports for a project.
 */
export const getPlagiarismReports = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const reports = await PlagiarismReport.find({ projectId }).sort({ checkedAt: -1 });
    return res.status(200).json(reports);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /:projectId/plagiarism-reports/:reportId
 * Get a single plagiarism report by ID.
 */
export const getPlagiarismReportById = async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const report = await PlagiarismReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    return res.status(200).json(report);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE /:projectId/plagiarism-reports/:reportId
 * Delete a plagiarism report.
 */
export const deletePlagiarismReport = async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    await PlagiarismReport.findByIdAndDelete(reportId);
    return res.status(200).json({ message: 'Report deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
