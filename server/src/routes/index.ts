import { Router } from 'express';
import projectRoutes from './project.routes.js';
import paperRoutes from './paper.routes.js';
import noteRoutes from './note.routes.js';
import citationRoutes from './citation.routes.js';
import chatRoutes from './chat.routes.js';
import agentRoutes from './agent.routes.js';
import comparisonRoutes from './comparison.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import formatexRoutes from './formatex.routes.js';

const router = Router();

router.use('/projects', projectRoutes);
router.use('/projects/:projectId/formatex', formatexRoutes);
router.use('/formatex', formatexRoutes);
router.use('/papers', paperRoutes);
router.use('/notes', noteRoutes);
router.use('/citations', citationRoutes);
router.use('/chat', chatRoutes);
router.use('/agents', agentRoutes);
router.use('/comparison', comparisonRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
