import { Request, Response } from 'express';
import Project from '../models/Project.js';
import Paper from '../models/Paper.js';
import Citation from '../models/Citation.js';
import Gap from '../models/Gap.js';
import AgentRun from '../models/AgentRun.js';
import GeneratedPaper from '../models/GeneratedPaper.js';
import mongoose from 'mongoose';
import FormaTexMetrics from '../models/FormaTexMetrics.js';

/**
 * GET /api/dashboard/stats
 * Returns real aggregate counts for the authenticated user's workspace.
 */
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'mock_user_id';

    // Get all projects belonging to this user
    const projects = await Project.find({ userId }).sort({ createdAt: 1 });
    const projectIds = projects.map((p) => p._id);

    // Run all counts in parallel
    const [paperCount, citationCount, gapCount, agentRunCount, manuscriptCount, activeAgentCount, formatexStats] =
      await Promise.all([
        Paper.countDocuments({ projectId: { $in: projectIds } }),
        Citation.countDocuments({ projectId: { $in: projectIds } }),
        Gap.countDocuments({ projectId: { $in: projectIds } }),
        AgentRun.countDocuments({ projectId: { $in: projectIds } }),
        GeneratedPaper.countDocuments({ projectId: { $in: projectIds } }),
        AgentRun.countDocuments({
          projectId: { $in: projectIds },
          status: 'running',
        }),
        FormaTexMetrics.aggregate([
          {
            $group: {
              _id: null,
              avgLatency: { $avg: '$apiLatency' },
              totalCalls: { $sum: 1 },
              successCount: { $sum: { $cond: [{ $eq: ['$success', true] }, 1, 0] } }
            }
          }
        ])
      ]);

    // Build monthly trend data for the past 6 months
    const now = new Date();
    const monthlyTrend = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 0, 23, 59, 59);
        const monthLabel = monthStart.toLocaleString('default', { month: 'short' });

        return Promise.all([
          Paper.countDocuments({
            projectId: { $in: projectIds },
            createdAt: { $lte: monthEnd },
          }),
          Citation.countDocuments({
            projectId: { $in: projectIds },
            createdAt: { $lte: monthEnd },
          }),
        ]).then(([papers, citations]) => ({
          month: monthLabel,
          papers,
          citations,
        }));
      })
    );

    const formattedFormatexStats = formatexStats.length > 0 ? {
      avgLatency: Math.round(formatexStats[0].avgLatency),
      totalCalls: formatexStats[0].totalCalls,
      successRate: Math.round((formatexStats[0].successCount / formatexStats[0].totalCalls) * 100)
    } : {
      avgLatency: 0,
      totalCalls: 0,
      successRate: 100
    };

    return res.status(200).json({
      projects: projects.length,
      papers: paperCount,
      citations: citationCount,
      researchGaps: gapCount,
      agentRuns: agentRunCount,
      manuscripts: manuscriptCount,
      activeAgents: activeAgentCount,
      trend: monthlyTrend,
      formatexMetrics: formattedFormatexStats
    });
  } catch (error: any) {
    console.error('[getDashboardStats] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
