import { Router } from 'express';
import {
  getUserApiKeysHandler,
  saveUserApiKeysHandler,
} from '../controllers/user.controller.js';

const router = Router();

router.get('/api-keys', getUserApiKeysHandler);
router.post('/api-keys', saveUserApiKeysHandler);

export default router;
