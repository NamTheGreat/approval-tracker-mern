import express from 'express';
import cors from 'cors';
import { AppError } from './errors/AppError.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Approval Tracker API is healthy',
    timestamp: new Date().toISOString(),
  });
});

// Handle unhandled routes (404)
app.all('*', (req, res, next) => {
  next(new AppError(`Cannot ${req.method} ${req.originalUrl} - Route not found`, 404));
});

// Central error handler (must be last middleware)
app.use(errorHandler);

export default app;
