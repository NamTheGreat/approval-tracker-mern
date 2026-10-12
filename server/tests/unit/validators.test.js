import { registerSchema, loginSchema } from '../../src/validators/authValidator.js';
import {
  createRequestSchema,
  decisionSchema,
} from '../../src/validators/requestValidator.js';

describe('Unit Tests: Zod Validation Schemas', () => {
  describe('authValidator - registerSchema', () => {
    it('should validate valid registration input and default role to employee', () => {
      const result = registerSchema.safeParse({
        name: '  John Doe  ',
        email: '  JOHN@Example.com ',
        password: 'SecurePassword123',
      });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('John Doe');
      expect(result.data.email).toBe('john@example.com');
      expect(result.data.role).toBe('employee');
    });

    it('should accept explicit valid roles (employee, manager, hr, admin)', () => {
      for (const role of ['employee', 'manager', 'hr', 'admin']) {
        const res = registerSchema.safeParse({
          name: 'Test User',
          email: 'test@example.com',
          password: 'Password123',
          role,
        });
        expect(res.success).toBe(true);
        expect(res.data.role).toBe(role);
      }
    });

    it('should reject invalid role enum', () => {
      const res = registerSchema.safeParse({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        role: 'superadmin',
      });
      expect(res.success).toBe(false);
    });

    it('should reject name shorter than 2 chars or longer than 50 chars', () => {
      const shortRes = registerSchema.safeParse({
        name: 'J',
        email: 'test@example.com',
        password: 'Password123',
      });
      expect(shortRes.success).toBe(false);

      const longRes = registerSchema.safeParse({
        name: 'A'.repeat(51),
        email: 'test@example.com',
        password: 'Password123',
      });
      expect(longRes.success).toBe(false);
    });
  });

  describe('authValidator - loginSchema', () => {
    it('should validate valid email and password', () => {
      const res = loginSchema.safeParse({
        email: 'USER@domain.com',
        password: 'anypassword',
      });
      expect(res.success).toBe(true);
      expect(res.data.email).toBe('user@domain.com');
    });

    it('should reject empty password or malformed email', () => {
      const res = loginSchema.safeParse({
        email: 'not-an-email',
        password: '',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('requestValidator - createRequestSchema', () => {
    it('should validate expense request and coerce numeric string amount', () => {
      const res = createRequestSchema.safeParse({
        type: 'expense',
        details: 'Client lunch meeting',
        amount: '125.50',
      });
      expect(res.success).toBe(true);
      expect(res.data.amount).toBe(125.5);
    });

    it('should reject expense request with zero, negative, or missing amount', () => {
      const zeroRes = createRequestSchema.safeParse({
        type: 'expense',
        details: 'Zero expense test',
        amount: 0,
      });
      expect(zeroRes.success).toBe(false);

      const negRes = createRequestSchema.safeParse({
        type: 'expense',
        details: 'Negative expense test',
        amount: -45,
      });
      expect(negRes.success).toBe(false);

      const missingRes = createRequestSchema.safeParse({
        type: 'expense',
        details: 'Missing amount test',
      });
      expect(missingRes.success).toBe(false);
    });

    it('should allow single-day leave where startDate equals endDate', () => {
      const res = createRequestSchema.safeParse({
        type: 'leave',
        details: 'Single day dental appointment',
        startDate: '2026-11-10',
        endDate: '2026-11-10',
      });
      expect(res.success).toBe(true);
    });

    it('should reject leave when startDate or endDate is missing', () => {
      const noStart = createRequestSchema.safeParse({
        type: 'leave',
        details: 'Missing start date',
        endDate: '2026-11-10',
      });
      expect(noStart.success).toBe(false);

      const noEnd = createRequestSchema.safeParse({
        type: 'leave',
        details: 'Missing end date',
        startDate: '2026-11-10',
      });
      expect(noEnd.success).toBe(false);
    });

    it('should reject details exceeding 1000 characters', () => {
      const res = createRequestSchema.safeParse({
        type: 'expense',
        details: 'X'.repeat(1001),
        amount: 50,
      });
      expect(res.success).toBe(false);
    });
  });

  describe('requestValidator - decisionSchema', () => {
    it('should default empty decision comment to empty string and trim whitespace', () => {
      const res1 = decisionSchema.safeParse({});
      expect(res1.success).toBe(true);
      expect(res1.data.comment).toBe('');

      const res2 = decisionSchema.safeParse({ comment: '  Looks good!  ' });
      expect(res2.success).toBe(true);
      expect(res2.data.comment).toBe('Looks good!');
    });

    it('should reject decision comment exceeding 500 characters', () => {
      const res = decisionSchema.safeParse({ comment: 'C'.repeat(501) });
      expect(res.success).toBe(false);
    });
  });
});
