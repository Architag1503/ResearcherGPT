import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import {
  uploadPaper,
  getPapers,
  getPaperById,
  deletePaper,
} from '../controllers/paper.controller.js';

const router = Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are supported.'));
    }
  },
});

router.post('/upload', upload.single('pdf'), uploadPaper);
router.get('/', getPapers);
router.get('/:paperId', getPaperById);
router.delete('/:paperId', deletePaper);

export default router;
