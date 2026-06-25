import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware.js';

export const checkRole = (allowedRoles: ('student' | 'researcher' | 'professor' | 'admin')[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required for this operation.' });
    }

    const hasPermission = allowedRoles.includes(user.role);
    if (!hasPermission) {
      return res.status(403).json({
        error: `Access Denied: Required permission role level not met. Required: [${allowedRoles.join(', ')}], Current: ${user.role}`
      });
    }

    next();
  };
};
