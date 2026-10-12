import { z } from 'zod';

/**
 * Validation schema for creating a new leave or expense request.
 * Enforces conditional requirements based on the request type:
 * - Expense: requires a positive amount
 * - Leave: requires valid start and end dates where endDate >= startDate
 */
export const createRequestSchema = z
  .object({
    type: z.enum(['leave', 'expense'], {
      required_error: "Type is required and must be either 'leave' or 'expense'",
      invalid_type_error: "Type must be either 'leave' or 'expense'",
    }),
    details: z
      .string({ required_error: 'Details are required' })
      .trim()
      .min(5, 'Details must be at least 5 characters long')
      .max(1000, 'Details cannot exceed 1000 characters'),
    amount: z
      .coerce.number({ invalid_type_error: 'Amount must be a valid number' })
      .positive('Amount must be greater than 0')
      .optional(),
    startDate: z
      .coerce.date({ invalid_type_error: 'Start date must be a valid date' })
      .optional(),
    endDate: z
      .coerce.date({ invalid_type_error: 'End date must be a valid date' })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'expense') {
      if (data.amount === undefined || data.amount === null || data.amount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A positive amount is required for expense requests',
          path: ['amount'],
        });
      }
    }

    if (data.type === 'leave') {
      if (!data.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Start date is required for leave requests',
          path: ['startDate'],
        });
      }

      if (!data.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'End date is required for leave requests',
          path: ['endDate'],
        });
      }

      if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'End date cannot be earlier than start date',
          path: ['endDate'],
        });
      }
    }
  });

/**
 * Validation schema for approval/rejection decision comments.
 */
export const decisionSchema = z.object({
  comment: z
    .string()
    .trim()
    .max(500, 'Comment cannot exceed 500 characters')
    .optional()
    .default(''),
});

/**
 * Validation schema for query parameters on request list endpoints.
 */
export const queryRequestsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  type: z.enum(['leave', 'expense']).optional(),
  scope: z.enum(['mine', 'pending_for_me', 'all']).optional(),
});
