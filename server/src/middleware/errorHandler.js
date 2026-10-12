import { AppError } from '../errors/AppError.js';

/**
 * Central Error-Handling Middleware
 * Guarantees a consistent JSON error response shape across the entire API.
 */
export function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details || null;

  // Handle Mongoose Validation Error (e.g. required fields missing or enum invalid)
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Handle Mongoose Duplicate Key Error (code 11000, e.g. duplicate email)
  if (err.code === 11000) {
    statusCode = 409;
    const duplicatedField = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value entered for ${duplicatedField}. Must be unique.`;
    details = [{ field: duplicatedField, value: err.keyValue?.[duplicatedField] }];
  }

  // Handle Mongoose Invalid ObjectId (CastError)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    message = `Invalid ID format for field '${err.path}'`;
    details = [{ field: err.path, value: err.value }];
  }

  // Handle JWT Verification Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token. Please log in again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired. Please log in again.';
  }

  // Log unhandled non-operational errors for debugging
  if (statusCode === 500) {
    console.error('[Unhandled Server Error]:', err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      details,
    },
  });
}
