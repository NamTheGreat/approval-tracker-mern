import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/authValidator.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Registration endpoint
router.post('/register', validate(registerSchema), authController.register);

// Login endpoint with rate limiting
router.post('/login', loginRateLimiter, validate(loginSchema), authController.login);

export default router;
