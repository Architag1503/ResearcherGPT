import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
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

// Disable ETag generation to prevent 304 Not Modified empty body responses on dynamic REST APIs
app.set('etag', false);

// Disable caching for all API responses so clients always receive fresh 200 OK data
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Enable CORS
app.use(cors({
  origin: '*', // Allow all in dev, secure in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'Expires',
    'X-Requested-With',
    'Accept',
    'Origin',
    'x-user-id',
    'X-User-Id',
    'x-user-email',
    'X-User-Email',
    'x-user-name',
    'X-User-Name',
    'x-groq-api-key',
    'X-Groq-Api-Key',
    'x-gemini-api-key',
    'X-Gemini-Api-Key',
    'x-openai-api-key',
    'X-Openai-Api-Key',
    'x-anthropic-api-key',
    'X-Anthropic-Api-Key',
  ],
}));

// Increase body size limit to 50MB — the Writing Agent sends the full generated
// paper (~1–5MB) back through the /api/agents/:runId/step progress callback.
// The default 100KB limit was silently dropping these payloads and stalling the run at 98%.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('uploads'));

// Auth Middleware: Support Clerk JWT token, custom user headers, and dev fallback
app.use((req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const headerUserId = (req.headers['x-user-id'] as string) || (req.headers['X-User-Id'] as string);
  const headerEmail = (req.headers['x-user-email'] as string) || (req.headers['X-User-Email'] as string);
  const headerName = (req.headers['x-user-name'] as string) || (req.headers['X-User-Name'] as string);

  let extractedUserId: string | null = null;
  let extractedEmail: string | null = headerEmail || null;
  let extractedName: string | null = headerName || null;

  // 1. Try decoding Clerk JWT from Bearer token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token && token !== 'mock-token') {
      try {
        const decoded = jwt.decode(token) as any;
        if (decoded && decoded.sub) {
          extractedUserId = decoded.sub;
        }
      } catch (err) {
        // Ignore decode errors and proceed
      }
    }
  }

  // 2. Fallback to X-User-Id header sent by client
  if (!extractedUserId && headerUserId && headerUserId.trim()) {
    extractedUserId = headerUserId.trim();
  }

  // 3. If an authenticated user ID was extracted, attach to req.user
  if (extractedUserId) {
    (req as any).user = {
      id: extractedUserId,
      name: extractedName || 'Researcher',
      email: extractedEmail || `${extractedUserId}@user.researchergpt.io`,
      role: 'researcher',
    };
    return next();
  }

  // 4. Offline Dev / Mock Auth Bypass (only when unauthenticated)
  const allowDevBypass =
    process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_MOCK_AUTH === 'true';

  if (allowDevBypass) {
    (req as any).user = {
      id: '666a7b29d5b51a0211a7c501',
      name: 'Dr. Sarah Jenkins',
      email: 'sarah.jenkins@university.edu',
      role: 'researcher',
    };
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
