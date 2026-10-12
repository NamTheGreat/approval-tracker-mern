import { jest } from '@jest/globals';
import { AppError } from '../../src/errors/AppError.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

describe('Unit Tests: AppError & Central Error Handler Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('AppError Class', () => {
    it('should set status to "fail" for 4xx codes and "error" for 5xx codes', () => {
      const err400 = new AppError('Bad Input', 400, [{ field: 'email' }]);
      expect(err400.statusCode).toBe(400);
      expect(err400.status).toBe('fail');
      expect(err400.isOperational).toBe(true);
      expect(err400.details).toEqual([{ field: 'email' }]);

      const err500 = new AppError('Server Crash', 500);
      expect(err500.statusCode).toBe(500);
      expect(err500.status).toBe('error');
    });
  });

  describe('errorHandler Middleware', () => {
    it('should format operational AppError accurately', () => {
      const err = new AppError('Forbidden action', 403);
      errorHandler(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Forbidden action',
          statusCode: 403,
          details: null,
        },
      });
    });

    it('should transform Mongoose ValidationError into 400 with field details', () => {
      const mongooseValidationErr = {
        name: 'ValidationError',
        errors: {
          email: { path: 'email', message: 'Email is invalid' },
          role: { path: 'role', message: 'Role is not supported' },
        },
      };

      errorHandler(mongooseValidationErr, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Validation Error',
          statusCode: 400,
          details: [
            { field: 'email', message: 'Email is invalid' },
            { field: 'role', message: 'Role is not supported' },
          ],
        },
      });
    });

    it('should transform Mongoose Duplicate Key Error (11000) into 409 Conflict', () => {
      const dupKeyErr = {
        code: 11000,
        keyValue: { email: 'dup@startupmeu.local' },
      };

      errorHandler(dupKeyErr, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Duplicate value entered for email. Must be unique.',
          statusCode: 409,
          details: [{ field: 'email', value: 'dup@startupmeu.local' }],
        },
      });
    });

    it('should transform Mongoose CastError (invalid ObjectId) into 400 Bad Request', () => {
      const castErr = {
        name: 'CastError',
        kind: 'ObjectId',
        path: '_id',
        value: 'invalid-mongo-id-123',
      };

      errorHandler(castErr, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: "Invalid ID format for field '_id'",
          statusCode: 400,
          details: [{ field: '_id', value: 'invalid-mongo-id-123' }],
        },
      });
    });

    it('should transform JWT JsonWebTokenError and TokenExpiredError into 401', () => {
      const jwtErr = { name: 'JsonWebTokenError' };
      errorHandler(jwtErr, mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      const expiredErr = { name: 'TokenExpiredError' };
      errorHandler(expiredErr, mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenLastCalledWith({
        success: false,
        error: {
          message: 'Authentication token has expired. Please log in again.',
          statusCode: 401,
          details: null,
        },
      });
    });

    it('should fallback to 500 Internal Server Error for unhandled exceptions', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const unknownErr = new Error('Unexpected database socket hangup');

      errorHandler(unknownErr, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Unexpected database socket hangup',
          statusCode: 500,
          details: null,
        },
      });

      consoleSpy.mockRestore();
    });
  });
});
