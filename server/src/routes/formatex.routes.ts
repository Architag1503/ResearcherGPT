import { Router } from 'express';
import {
  formatManuscript,
  compileLatexSource,
  validateFormattingSource,
  generateComplianceReportSource,
  repairPaper,
  repairAllPapers,
  autoCorrect,
} from '../controllers/formatex.controller.js';

const router = Router({ mergeParams: true });

// Core formatting endpoints
router.post('/format', formatManuscript);
router.post('/compile', compileLatexSource);
router.post('/validate', validateFormattingSource);
router.post('/compliance', generateComplianceReportSource);
router.post('/auto-correct', autoCorrect);

// Paper repair endpoints (FormaTeX enhancement pass on existing content)
router.post('/repair/:paperId', repairPaper);
router.post('/:projectId/repair-all', repairAllPapers);

export default router;
