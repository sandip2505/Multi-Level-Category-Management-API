import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/constants';

interface UserPayload {
  userId: string;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

// ✅ Add explicit return type: `void`
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const header = req.headers.authorization;

    if (!header) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const token = header.split(' ')[1];
    if (!token) {
      res.status(401).json({ message: 'Token not provided' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    req.user = decoded;

    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};
