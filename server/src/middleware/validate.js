import { AppError } from '../errors/AppError.js';

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.errors.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      }));
      return next(new AppError('Validation failed', 400, details));
    }

    req.body = result.data;
    next();
  };
}
