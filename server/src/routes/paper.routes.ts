import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import {
  uploadPaper,
  getPapers,
  getPaperById,
  deletePaper,
  getPaperPdf,
  uploadVisualImage,
} from '../controllers/paper.controller.js';

const router = Router();

// Configure multer storage for PDFs
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

// Configure multer storage for Images (Diagrams, Tables, Formulas)
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const cleanOrig = (file.originalname || 'visual').replace(/[^a-zA-Z0-9.-]/g, '_');
    const ext = path.extname(cleanOrig) || '.png';
    const base = path.basename(cleanOrig, ext).substring(0, 30);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `visual-${base}-${uniqueSuffix}${ext}`);
  },
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'image/gif'];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(png|jpg|jpeg|webp|svg|gif)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (PNG, JPG, WebP, SVG) are supported.'));
    }
  },
});

router.post('/upload', upload.single('pdf'), uploadPaper);
router.post('/upload-image', imageUpload.single('image'), uploadVisualImage);
router.get('/', getPapers);
router.get('/:paperId', getPaperById);
router.get('/:paperId/pdf', getPaperPdf);
router.delete('/:paperId', deletePaper);

export default router;
