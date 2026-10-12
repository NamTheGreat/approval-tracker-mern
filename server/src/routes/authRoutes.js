import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/authValidator.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Registration endpoint
router.post('/register', validate(registerSchema), authController.register);

// Login endpoint with rate limiting
router.post('/login', loginRateLimiter, validate(loginSchema), authController.login);

// Retrieve current authenticated user profile
router.get('/me', authenticate, (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
});

export default router;
