import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: 'student' | 'researcher' | 'professor' | 'admin';
  };
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const allowDevBypass =
    process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_MOCK_AUTH === 'true';

  if (!authHeader) {
    if (!allowDevBypass) {
      return res.status(401).json({ error: 'Authorization header is required.' });
    }
    req.user = {
      id: '666a7b29d5b51a0211a7c501',
      name: 'Dr. Sarah Jenkins',
      email: 'sarah.jenkins@university.edu',
      role: 'researcher',
    };
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (token === 'mock-token') {
    if (!allowDevBypass) {
      return res.status(401).json({ error: 'Mock authentication is disabled in production.' });
    }
    req.user = {
      id: '666a7b29d5b51a0211a7c501',
      name: 'Dr. Sarah Jenkins',
      email: 'sarah.jenkins@university.edu',
      role: 'researcher',
    };
    return next();
  }

  // Simulated Clerk JWT verify: extract basic header fields
  try {
    if (!token) {
      return res.status(401).json({ error: 'Bearer token is missing.' });
    }
    req.user = {
      id: 'clerk_user_id_123',
      name: 'Academic Scholar',
      email: 'scholar@university.edu',
      role: 'researcher', // default role
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Access token is invalid or expired.' });
  }
};
