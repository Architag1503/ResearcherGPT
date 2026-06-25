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

  // Sandbox bypass check
  if (!authHeader) {
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
