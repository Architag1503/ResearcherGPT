import { Router } from 'express';
import {
  createCitation,
  getCitations,
  deleteCitation,
  updateCitation,
  searchAcademicPapers,
} from '../controllers/citation.controller.js';

const router = Router();

router.get('/search', searchAcademicPapers);
router.post('/', createCitation);
router.get('/', getCitations);
router.delete('/:citationId', deleteCitation);
router.put('/:citationId', updateCitation);

export default router;
