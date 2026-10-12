import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../../src/models/User.js';
import { Request } from '../../src/models/Request.js';
import { AuditLog } from '../../src/models/AuditLog.js';

describe('Unit Tests: Mongoose Data Models & Indexes', () => {
  describe('User Model', () => {
    it('should normalize email to lowercase, trim fields, and hide passwordHash by default', async () => {
      const hash = await bcrypt.hash('MySecretPass1!', 10);
      const created = await User.create({
        name: '  Model Tester  ',
        email: '  MODEL.TESTER@StartupMeu.Local  ',
        passwordHash: hash,
      });

      expect(created.name).toBe('Model Tester');
      expect(created.email).toBe('model.tester@startupmeu.local');
      expect(created.role).toBe('employee');

      // Fetch without +passwordHash -> passwordHash must be undefined
      const fetchedDefault = await User.findById(created._id);
      expect(fetchedDefault.passwordHash).toBeUndefined();

      // Fetch with +passwordHash -> comparePassword works
      const fetchedWithHash = await User.findById(created._id).select('+passwordHash');
      expect(fetchedWithHash.passwordHash).toBeDefined();

      const isMatch = await fetchedWithHash.comparePassword('MySecretPass1!');
      const isWrong = await fetchedWithHash.comparePassword('WrongPassword');
      expect(isMatch).toBe(true);
      expect(isWrong).toBe(false);
    });
  });

  describe('Request Model', () => {
    it('should initialize defaults (status=pending, currentStep=1, steps=[])', async () => {
      const userId = new mongoose.Types.ObjectId();
      const reqDoc = await Request.create({
        type: 'expense',
        details: 'Monitor cable',
        amount: 25,
        createdBy: userId,
      });

      expect(reqDoc.status).toBe('pending');
      expect(reqDoc.currentStep).toBe(1);
      expect(Array.isArray(reqDoc.steps)).toBe(true);
      expect(reqDoc.steps.length).toBe(0);
    });

    it('should reject negative expense amounts at schema level', async () => {
      const userId = new mongoose.Types.ObjectId();
      await expect(
        Request.create({
          type: 'expense',
          details: 'Negative amount test',
          amount: -10,
          createdBy: userId,
        })
      ).rejects.toThrow(/Amount cannot be negative/);
    });

    it('should define compound indexes on (status, currentStep) and (createdBy, createdAt)', () => {
      const indexes = Request.schema.indexes();
      const indexFields = indexes.map(([fields]) => fields);

      expect(indexFields).toContainEqual({ status: 1, currentStep: 1 });
      expect(indexFields).toContainEqual({ createdBy: 1, createdAt: -1 });
    });
  });

  describe('AuditLog Model', () => {
    it('should reject unsupported audit action enums', async () => {
      await expect(
        AuditLog.create({
          requestId: new mongoose.Types.ObjectId(),
          actor: new mongoose.Types.ObjectId(),
          action: 'UNSUPPORTED_ACTION',
          fromStatus: 'pending',
          toStatus: 'approved',
        })
      ).rejects.toThrow(/Invalid audit action/);
    });

    it('should define compound index on (requestId, timestamp)', () => {
      const indexes = AuditLog.schema.indexes();
      const indexFields = indexes.map(([fields]) => fields);

      expect(indexFields).toContainEqual({ requestId: 1, timestamp: -1 });
    });
  });
});
