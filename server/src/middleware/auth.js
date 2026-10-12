import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { AppError } from '../errors/AppError.js';

/**
 * Authentication Middleware
 * Validates the JWT Bearer token and attaches the authenticated user to `req.user`.
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(
        new AppError('Authentication required. Missing or malformed token.', 401)
      );
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next(new AppError('Authentication token missing.', 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify the user still exists in the database
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(
        new AppError('The user belonging to this token no longer exists.', 401)
      );
    }

    // Attach user profile to request object
    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    // JWT verification errors (expired, malformed) are caught and handled by central errorHandler
    next(error);
  }
}

/**
 * Role-Based Access Control (RBAC) Middleware
 * Restricts access to routes based on allowed user roles.
 * @param {...string} allowedRoles - List of authorized roles ('employee', 'manager', 'hr', 'admin')
 */
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
