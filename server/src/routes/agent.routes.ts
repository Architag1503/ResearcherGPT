import { Router } from 'express';
import {
  triggerAgentRun,
  getAgentRuns,
  getAgentRunStatus,
  updateAgentRunStep,
  deleteAgentRun,
} from '../controllers/agent.controller.js';

const router = Router();

router.post('/run', triggerAgentRun);
router.get('/', getAgentRuns);
router.get('/:runId', getAgentRunStatus);
router.post('/:runId/step', updateAgentRunStep);
router.delete('/:runId', deleteAgentRun);

export default router;
