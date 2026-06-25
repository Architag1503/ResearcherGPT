import { Request, Response, NextFunction } from 'express';
import logger from './logger.js';

let totalRequests = 0;
let totalErrors = 0;
const responseTimes: number[] = [];

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  totalRequests++;
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const timeMs = (diff[0] * 1e9 + diff[1]) / 1e6; // convert nanoseconds to milliseconds
    responseTimes.push(timeMs);

    if (res.statusCode >= 400) {
      totalErrors++;
    }

    logger.http(`${req.method} ${req.originalUrl} - Status: ${res.statusCode} - Time: ${timeMs.toFixed(2)}ms`);
  });

  next();
};

export const getPerformanceMetrics = (req: Request, res: Response) => {
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0.0;

  res.json({
    totalRequests,
    totalErrors,
    averageResponseTimeMs: parseFloat(avgResponseTime.toFixed(2)),
    cacheHitsCount: 0 // placeholder
  });
};
