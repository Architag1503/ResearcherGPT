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

    // 2. Create a report in "processing" state immediately
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

    // 4. Run the detection engine
    try {
      const result = await runPlagiarismDetection(
        generatedPaper.title || 'Untitled',
        generatedPaper.sections || [],
        generatedPaper.references || [],
        localPaperData
      );

      // 5. Update the report with results
      report.overallScore = result.overallScore;
      report.exactMatchScore = result.exactMatchScore;
      report.semanticScore = result.semanticScore;
      report.citationScore = result.citationScore;
      report.structureScore = result.structureScore;
      report.formulaScore = result.formulaScore;
      report.figureScore = result.figureScore;
      report.codeScore = result.codeScore;

      report.exactMatches = result.exactMatches as any;
      report.semanticMatches = result.semanticMatches as any;
      report.citationMatches = result.citationMatches as any;
      report.formulaMatches = result.formulaMatches as any;
      report.structureMatches = result.structureMatches as any;
      report.codeMatches = result.codeMatches as any;

      report.aiDetection = result.aiDetection;
      report.sectionScores = result.sectionScores;
      report.topSources = result.topSources;

      report.summary = result.summary;
      report.severityLevel = result.severityLevel as any;
      report.status = 'completed';
      report.totalSentencesAnalyzed = result.totalSentencesAnalyzed;
      report.totalSourcesSearched = result.totalSourcesSearched;

      await report.save();
      console.log(`✅ Plagiarism check completed for paper: ${generatedPaper.title} — Score: ${result.overallScore}%`);
    } catch (engineError: any) {
      report.status = 'failed';
      report.processingError = engineError.message || 'Engine processing error';
      await report.save();
      console.error(`❌ Plagiarism engine error:`, engineError);
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
