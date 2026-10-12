import { AppError } from '../errors/AppError.js';

/**
 * Generic Request Validation Middleware using Zod
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {'body'|'query'|'params'} source - Property on the Express request object to validate
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.errors.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));

      return next(new AppError('Validation failed', 400, details));
    }

    // Replace the request source with the parsed (sanitized & coerced) data
    req[source] = result.data;
    next();
  };
}
