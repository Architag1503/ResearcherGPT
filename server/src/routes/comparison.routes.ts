import { Router } from 'express';
import { getComparisonMatrix } from '../controllers/comparison.controller.js';

const router = Router();

router.get('/matrix', getComparisonMatrix);

export default router;
