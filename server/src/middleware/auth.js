import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { AppError } from '../errors/AppError.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return next(new AppError('Authentication required. Missing or malformed token.', 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    req.user = user.toProfile();
    next();
  } catch (error) {
    next(error);
  }
}

export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('User not authenticated.', 401));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError('Forbidden. You do not have permission to perform this action.', 403)
      );
    }
    next();
  };
}
