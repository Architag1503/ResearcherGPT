import { Router } from 'express';
import {
  createSession,
  getSessions,
  getMessages,
  sendMessage,
  updateSession,
  deleteSession,
} from '../controllers/chat.controller.js';

const router = Router();

router.post('/sessions', createSession);
router.get('/sessions', getSessions);
router.put('/sessions/:sessionId', updateSession);
router.delete('/sessions/:sessionId', deleteSession);
router.get('/sessions/:sessionId/messages', getMessages);
router.post('/sessions/:sessionId/messages', sendMessage);

export default router;

