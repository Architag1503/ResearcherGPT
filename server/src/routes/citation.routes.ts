import { Router } from 'express';
import {
  createCitation,
  getCitations,
  deleteCitation,
  updateCitation,
} from '../controllers/citation.controller.js';

const router = Router();

router.post('/', createCitation);
router.get('/', getCitations);
router.delete('/:citationId', deleteCitation);
router.put('/:citationId', updateCitation);

export default router;
