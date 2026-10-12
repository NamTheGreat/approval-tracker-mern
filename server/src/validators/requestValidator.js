import { z } from 'zod';

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

export const decisionSchema = z.object({
  comment: z
    .string()
    .trim()
    .max(500, 'Comment cannot exceed 500 characters')
    .optional()
    .default(''),
});
