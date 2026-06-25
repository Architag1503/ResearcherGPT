import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
import { connectDB } from './config/db.js';
import { connectRedis } from './config/redis.js';
import masterRouter from './routes/index.js';

// Load env FIRST before anything else
dotenv.config();

// Conditionally start background job workers (requires Redis >= 5)
if (process.env.DISABLE_QUEUE !== 'true') {
  Promise.all([
    import('./workers/pdfWorker.js'),
    import('./workers/graphWorker.js'),
  ]).catch((err) => {
    console.warn('[server] Failed to load queue workers:', err.message);
  });
} else {
  console.log('[server] DISABLE_QUEUE=true — Background job workers skipped.');
}

// Ensure uploads folder exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: '*', // Allow all in dev, secure in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Increase body size limit to 50MB — the Writing Agent sends the full generated
// paper (~1–5MB) back through the /api/agents/:runId/step progress callback.
// The default 100KB limit was silently dropping these payloads and stalling the run at 98%.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('uploads'));

// Developer Mock Auth Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  // In development, if Clerk token is not present, we attach a default researcher user
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    (req as any).user = {
      id: '666a7b29d5b51a0211a7c501', // Mock MongoDB ObjectId string
      name: 'Dr. Sarah Jenkins',
      email: 'sarah.jenkins@university.edu',
      role: 'researcher',
    };
  } else {
    // In production, decode JWT from Clerk
    // For this implementation, we simulate verifying the JWT header
    const token = authHeader.split(' ')[1];
    if (token === 'mock-token') {
      (req as any).user = {
        id: '666a7b29d5b51a0211a7c501',
        name: 'Dr. Sarah Jenkins',
        email: 'sarah.jenkins@university.edu',
        role: 'researcher',
      };
    } else {
      // Decode Clerk jwt here (optional fallback validation)
      (req as any).user = { id: '666a7b29d5b51a0211a7c501', role: 'researcher' };
    }
  }
  next();
});

// Swagger API Document Setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ResearcherGPT API Gateway Docs',
      version: '1.0.0',
      description: 'API specifications for ResearcherGPT full-stack application.',
    },
    servers: [
      {
        url: `http://localhost:${PORT}/api`,
      },
    ],
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Mount routes
app.use('/api', masterRouter);

// Base route
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    message: 'ResearcherGPT Express Gateway Running.',
    docs: `http://localhost:${PORT}/docs`,
  });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[ServerError]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Start Servers
const start = async () => {
  await connectDB();
  if (process.env.DISABLE_QUEUE !== 'true') {
    await connectRedis();
  }
  app.listen(PORT, () => {
    console.log(`Express gateway running at http://localhost:${PORT}`);
    console.log(`API Swagger Docs available at http://localhost:${PORT}/docs`);
  });
};

start();

export default app;
