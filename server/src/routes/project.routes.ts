import { Router } from 'express';
import {
  createProject,
  getProjects,
  getProjectById,
  deleteProject,
  triggerGraphUpdate,
  getProjectGraph,
  getProjectGaps,
  generateAIGaps,
  createProjectGap,
  generateSingleAIGap,
  updateProjectGap,
  deleteProjectGap,
  getProjectFactChecks,
  getProjectGeneratedPapers,
  updateProjectGeneratedPaper,
  deleteProjectGeneratedPaper,
  updateProject,
  generateAIDescription,
  exportProjectPaperPDF,
} from '../controllers/project.controller.js';
import {
  runPlagiarismCheck,
  getPlagiarismReports,
  getPlagiarismReportById,
  deletePlagiarismReport,
} from '../controllers/plagiarism.controller.js';
import {
  getGraphNodeLearningDetails,
  askGraphNodeQuestion,
} from '../controllers/learningNode.controller.js';

const router = Router();

router.post('/', createProject);
router.post('/generate-description', generateAIDescription);
router.get('/', getProjects);
router.get('/:projectId', getProjectById);
router.put('/:projectId', updateProject);
router.delete('/:projectId', deleteProject);
router.post('/:projectId/graph', triggerGraphUpdate);
router.get('/:projectId/graph', getProjectGraph);
router.get('/:projectId/gaps', getProjectGaps);
router.post('/:projectId/gaps', createProjectGap);
router.post('/:projectId/gaps/generate', generateAIGaps);
router.post('/:projectId/gaps/generate-single', generateSingleAIGap);
router.put('/gaps/:gapId', updateProjectGap);
router.delete('/gaps/:gapId', deleteProjectGap);
router.get('/:projectId/fact-checks', getProjectFactChecks);
router.get('/:projectId/generated-papers', getProjectGeneratedPapers);
router.put('/:projectId/generated-papers', updateProjectGeneratedPaper);
router.delete('/:projectId/generated-papers/:paperId', deleteProjectGeneratedPaper);
router.post('/:projectId/export-pdf', exportProjectPaperPDF);

// Plagiarism reports
router.post('/:projectId/plagiarism-reports/:paperId/run', runPlagiarismCheck);
router.get('/:projectId/plagiarism-reports', getPlagiarismReports);
router.get('/:projectId/plagiarism-reports/:reportId', getPlagiarismReportById);
router.delete('/:projectId/plagiarism-reports/:reportId', deletePlagiarismReport);

// Graph Node Interactive Learning
router.get('/:projectId/graph/nodes/:nodeId', getGraphNodeLearningDetails);
router.post('/:projectId/graph/nodes/:nodeId/ask', askGraphNodeQuestion);

export default router;
