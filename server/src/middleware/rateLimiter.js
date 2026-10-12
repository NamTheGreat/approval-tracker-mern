import rateLimit from 'express-rate-limit';
import { AppError } from '../errors/AppError.js';

/**
 * Rate Limiter for Login Endpoint
 * Limits consecutive login attempts per IP to prevent brute-force attacks.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per windowMs
  standardHeaders: true, // Return standard `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res, next) => {
    next(
      new AppError(
        'Too many login attempts from this IP, please try again after 15 minutes',
        429
      )
    );
  },
});
