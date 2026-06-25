import { Request, Response } from 'express';
import axios from 'axios';
import AgentRun from '../models/AgentRun.js';
import Gap from '../models/Gap.js';
import FactCheck from '../models/FactCheck.js';
import GeneratedPaper from '../models/GeneratedPaper.js';
import Paper from '../models/Paper.js';
import Citation from '../models/Citation.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export const triggerAgentRun = async (req: Request, res: Response) => {
  try {
    const { projectId, query, workflowType = 'paper', format = 'IEEE', pages = 5 } = req.body;

    if (!projectId || !query) {
      return res.status(400).json({ error: 'projectId and query are required' });
    }

    // Determine steps based on workflowType
    let steps: any[] = [];
    if (workflowType === 'proposal') {
      steps = [{ name: 'Proposal Generation', status: 'pending' }];
    } else if (workflowType === 'survey') {
      steps = [{ name: 'Survey Generation', status: 'pending' }];
    } else if (workflowType === 'review') {
      steps = [{ name: 'Reviewer Agent', status: 'pending' }];
    } else {
      steps = [
        { name: 'Research Agent', status: 'pending' },
        { name: 'Literature Agent', status: 'pending' },
        { name: 'Gap Agent', status: 'pending' },
        { name: 'Citation Agent', status: 'pending' },
        { name: 'Fact Checker Agent', status: 'pending' },
        { name: 'Writing Agent', status: 'pending' },
      ];
    }

    // 1. Create a record in MongoDB to track run steps
    const run = new AgentRun({
      projectId,
      query,
      status: 'running',
      steps,
    });
    await run.save();

    // 2. Trigger AI Service async in background, sending our MongoDB runId for callbacks
    axios.post(`${AI_SERVICE_URL}/api/agent/run`, {
      run_id: run._id,
      project_id: projectId,
      query,
      workflow_type: workflowType,
      format,
      pages,
    }).catch(err => {
      console.error('[triggerAgentRun] AI Service trigger failed asynchronously:', err.message);
      AgentRun.findByIdAndUpdate(run._id, {
        status: 'failed',
        result: { error: err.message },
      }).exec();
    });

    return res.status(202).json({
      message: 'Agent run execution started successfully',
      runId: run._id,
      status: run.status,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getAgentRuns = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    const runs = await AgentRun.find({ projectId }).sort({ createdAt: -1 });
    return res.status(200).json(runs);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getAgentRunStatus = async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const run = await AgentRun.findById(runId);
    if (!run) {
      return res.status(404).json({ error: 'Agent run not found' });
    }
    return res.status(200).json(run);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const updateAgentRunStep = async (req: Request, res: Response) => {
  // Callback endpoint for FastAPI to report step progression & logs
  try {
    const { runId } = req.params;
    const { stepName, status, logs, output, overallStatus, result } = req.body;

    const run = await AgentRun.findById(runId);
    if (!run) {
      return res.status(404).json({ error: 'Agent run not found' });
    }

    if (overallStatus) {
      run.status = overallStatus;
    }
    if (result) {
      run.result = result;
    }

    // If workflow finishes successfully, parse result and persist output details to collections
    if (overallStatus === 'completed' && result) {
      const projectId = run.projectId;

      // 1. Map results to sections based on workflow structure
      let sections = result.sections || [];
      let outline = result.outline || [];

      if (!sections.length) {
        if (result.problem_statement) {
          // Proposal mapping
          sections = [
            { title: 'Problem Statement', heading: '1. Problem Statement', content: result.problem_statement },
            { title: 'Objectives', heading: '2. Research Objectives', content: result.objectives?.join('\n') || '' },
            { title: 'Research Questions', heading: '3. Research Questions', content: result.research_questions?.join('\n') || '' },
            { title: 'Methodology', heading: '4. Research Methodology', content: result.methodology || '' },
            { title: 'Expected Outcomes', heading: '5. Expected Outcomes', content: result.expected_outcomes?.join('\n') || '' },
            { title: 'Timeline', heading: '6. Project Timeline', content: result.timeline?.join('\n') || '' }
          ];
          outline = ['Problem Statement', 'Objectives', 'Research Questions', 'Methodology', 'Expected Outcomes', 'Timeline'];
        } else if (result.taxonomy) {
          // Survey mapping
          sections = [
            { title: 'Taxonomy Map', heading: 'Taxonomy Map', content: JSON.stringify(result.taxonomy, null, 2) },
            { title: 'Emerging Themes', heading: 'Emerging Themes', content: JSON.stringify(result.themes, null, 2) },
            { title: 'Survey Draft', heading: 'Survey Draft', content: result.content || '' }
          ];
          outline = ['Taxonomy Map', 'Emerging Themes', 'Survey Draft'];
        } else if (result.review) {
          // Review mapping (either nested or direct)
          const rObj = result.review || result;
          sections = [
            { title: 'Review Decision', heading: 'Acceptance Decision', content: rObj.decision || 'No Decision' },
            { title: 'Strengths', heading: 'Strengths', content: rObj.strengths?.join('\n') || '' },
            { title: 'Weaknesses', heading: 'Weaknesses', content: rObj.weaknesses?.join('\n') || '' },
            { title: 'Suggestions', heading: 'Suggestions', content: rObj.suggestions?.join('\n') || '' }
          ];
          outline = ['Review Decision', 'Strengths', 'Weaknesses', 'Suggestions'];
        }
      }

      const sanitizedSections = (sections || []).map((s: any) => ({
        title: s.title || 'Section',
        heading: s.heading || '## Section',
        content: s.content || 'Content detail under revision.'
      }));

      const paper = new GeneratedPaper({
        projectId,
        title: result.title || `Optimizing Research: ${run.query}`,
        outline: outline.length ? outline : sanitizedSections.map((s: any) => s.title),
        sections: sanitizedSections,
        references: result.citations?.map((c: any) => c.apa || c.ieee) || [],
        status: 'completed',
      });
      await paper.save();

      // 2. Save Gaps
      if (result.research_gaps && Array.isArray(result.research_gaps)) {
        let actualGaps: any[] = [];
        for (const item of result.research_gaps) {
          if (item && Array.isArray(item.researchGaps)) {
            actualGaps.push(...item.researchGaps);
          } else if (item && Array.isArray(item.gaps)) {
            actualGaps.push(...item.gaps);
          } else if (item) {
            actualGaps.push(item);
          }
        }

        for (const g of actualGaps) {
          const gap = new Gap({
            projectId,
            title: g.title || g.gap_title || 'Mined Gap',
            description: g.description || 'No description provided.',
            evidence: g.evidence || [],
            category: g.category || 'other',
            impactScore: g.impactScore || 5,
            feasibilityScore: g.feasibilityScore || 5,
          });
          await gap.save();
        }
      }

      // 3. Save FactChecks
      if (result.fact_checks && Array.isArray(result.fact_checks)) {
        for (const fc of result.fact_checks) {
          const sanitizedSources = (fc.sources || []).map((s: any) => ({
            paperId: s.paperId || undefined,
            paperTitle: s.paperTitle || s.paper || 'Reference Source',
            pageNumber: s.pageNumber || s.page || undefined,
            snippet: s.snippet || s.text || 'Claim verification source details.',
            confidenceScore: typeof s.confidenceScore === 'number' ? s.confidenceScore : 0.8,
          }));

          const check = new FactCheck({
            projectId,
            claim: fc.claim || 'Scholarly claim',
            status: fc.status || 'unverified',
            confidenceScore: fc.confidenceScore || 0,
            analysis: fc.analysis || '',
            sources: sanitizedSources,
          });
          await check.save();
        }
      }

      // 4. Save Literature Reviews to Paper collection (populates 3D graph and litreview matrix)
      if (result.literature_reviews && Array.isArray(result.literature_reviews)) {
        for (const lr of result.literature_reviews) {
          const mockTitle = `${lr.method} study by ${lr.author}`;
          const exists = await Paper.findOne({ projectId, title: mockTitle });
          if (!exists) {
            const parsedPaper = new Paper({
              projectId,
              title: mockTitle,
              authors: lr.author ? [lr.author] : ['Unknown Author'],
              year: lr.year || new Date().getFullYear(),
              abstract: `Method: ${lr.method}. Dataset: ${lr.dataset}. Results: ${lr.results}. Limitation: ${lr.limitation}.`,
              status: 'processed'
            });
            await parsedPaper.save();
          }
        }
      }

      // 5. Save Citations to Citation collection (populates Citations tab)
      if (result.citations && Array.isArray(result.citations)) {
        for (const c of result.citations) {
          const exists = await Citation.findOne({ projectId, key: c.key });
          if (!exists) {
            const styles = c.styles || {
              apa: c.apa || `${c.author || 'Author'} (${c.year || '2024'}). ${c.title || 'Title'}.`,
              mla: c.mla || `${c.author || 'Author'}. "${c.title || 'Title'}." 2024.`,
              ieee: c.ieee || `[1] ${c.author || 'Author'}, "${c.title || 'Title'}," 2024.`,
              chicago: c.chicago || `${c.author || 'Author'}. 2024. "${c.title || 'Title'}."`,
              harvard: c.harvard || `${c.author || 'Author'} 2024, '${c.title || 'Title'}'.`
            };
            const citation = new Citation({
              projectId,
              key: c.key || `Ref${Math.floor(Math.random()*1000)}`,
              doi: c.doi || '',
              title: c.title || 'Untitled Reference',
              authors: c.authors || (c.author ? [c.author] : []),
              journal: c.journal || '',
              year: c.year || new Date().getFullYear(),
              volume: c.volume || '',
              issue: c.issue || '',
              pages: c.pages || '',
              publisher: c.publisher || '',
              styles
            });
            await citation.save();
          }
        }
      }
    }

    if (stepName) {
      const stepIndex = run.steps.findIndex(s => s.name === stepName);
      if (stepIndex !== -1) {
        if (status) run.steps[stepIndex].status = status;
        if (logs) run.steps[stepIndex].logs = (run.steps[stepIndex].logs || '') + '\n' + logs;
        if (output) run.steps[stepIndex].output = output;

        if (status === 'running' && !run.steps[stepIndex].startedAt) {
          run.steps[stepIndex].startedAt = new Date();
        } else if ((status === 'completed' || status === 'failed') && !run.steps[stepIndex].completedAt) {
          run.steps[stepIndex].completedAt = new Date();
        }
      }
    }

    await run.save();
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const deleteAgentRun = async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const run = await AgentRun.findByIdAndDelete(runId);
    if (!run) {
      return res.status(404).json({ error: 'Agent run not found' });
    }
    return res.status(200).json({ success: true, message: 'Agent run deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

