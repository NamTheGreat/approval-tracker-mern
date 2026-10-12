import request from 'supertest';
import app from '../src/app.js';
import { Request } from '../src/models/Request.js';
import { AuditLog } from '../src/models/AuditLog.js';

describe('Leave & Expense Approval Engine API', () => {
  let employeeToken;
  let employeeId;

  let managerToken;
  let managerId;

  let manager2Token;
  let manager2Id;

  let hrToken;
  let hrId;

  let otherEmployeeToken;

  beforeEach(async () => {
    // 1. Register Employee
    const empRes = await request(app).post('/auth/register').send({
      name: 'Alice Employee',
      email: 'alice@test.local',
      password: 'Password123!',
      role: 'employee',
    });
    employeeToken = empRes.body.data.token;
    employeeId = empRes.body.data.user.id;

    // 2. Register Another Employee
    const otherEmpRes = await request(app).post('/auth/register').send({
      name: 'Charlie Other',
      email: 'charlie@test.local',
      password: 'Password123!',
      role: 'employee',
    });
    otherEmployeeToken = otherEmpRes.body.data.token;

    // 3. Register Primary Manager
    const mgrRes = await request(app).post('/auth/register').send({
      name: 'Bob Manager',
      email: 'bob@test.local',
      password: 'Password123!',
      role: 'manager',
    });
    managerToken = mgrRes.body.data.token;
    managerId = mgrRes.body.data.user.id;

    // 4. Register Second Manager (for concurrency tests)
    const mgr2Res = await request(app).post('/auth/register').send({
      name: 'Dave Manager 2',
      email: 'dave@test.local',
      password: 'Password123!',
      role: 'manager',
    });
    manager2Token = mgr2Res.body.data.token;
    manager2Id = mgr2Res.body.data.user.id;

    // 5. Register HR
    const hrRes = await request(app).post('/auth/register').send({
      name: 'Helen HR',
      email: 'helen@test.local',
      password: 'Password123!',
      role: 'hr',
    });
    hrToken = hrRes.body.data.token;
    hrId = hrRes.body.data.user.id;
  });

  describe('Request Creation (POST /requests)', () => {
    it('should reject invalid payloads with Zod 400', async () => {
      // Missing amount for expense
      const res1 = await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          type: 'expense',
          details: 'Dinner with client',
        });
      expect(res1.status).toBe(400);
      expect(res1.body.error.message).toBe('Validation failed');

      // Invalid dates for leave (endDate < startDate)
      const res2 = await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          type: 'leave',
          details: 'Medical leave',
          startDate: '2026-11-10',
          endDate: '2026-11-05',
        });
      expect(res2.status).toBe(400);
      expect(res2.body.error.message).toBe('Validation failed');
    });

    it('should create an expense request and initialize audit log (201)', async () => {
      const res = await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          type: 'expense',
          details: 'Office supplies purchase',
          amount: 249.99,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.request).toBeDefined();
      expect(res.body.data.request.status).toBe('pending');
      expect(res.body.data.request.currentStep).toBe(1);
      expect(res.body.data.request.amount).toBe(249.99);

      // Verify Audit Log
      const auditLogs = await AuditLog.find({ requestId: res.body.data.request._id });
      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].action).toBe('CREATED');
      expect(auditLogs[0].fromStatus).toBe('none');
      expect(auditLogs[0].toStatus).toBe('pending');
    });

    it('should create a leave request with dates (201)', async () => {
      const res = await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          type: 'leave',
          details: 'Annual family holiday',
          startDate: '2026-12-01',
          endDate: '2026-12-10',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.request.type).toBe('leave');
      expect(res.body.data.request.startDate).toBeDefined();
      expect(res.body.data.request.endDate).toBeDefined();
    });
  });

  describe('Sequential 2-Step Approval Workflow', () => {
    let requestId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          type: 'leave',
          details: 'Conference attendance',
          startDate: '2026-11-15',
          endDate: '2026-11-18',
        });
      requestId = res.body.data.request._id;
    });

    it('Step 1: Manager approves -> advances to Step 2 while remaining pending', async () => {
      const res = await request(app)
        .post(`/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ comment: 'Approved by manager, proceed to HR' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.request.currentStep).toBe(2);
      expect(res.body.data.request.status).toBe('pending');
      expect(res.body.data.request.steps.length).toBe(1);
      expect(res.body.data.request.steps[0].step).toBe(1);
      expect(res.body.data.request.steps[0].decision).toBe('approved');
      expect(res.body.data.request.steps[0].comment).toBe('Approved by manager, proceed to HR');

      // Audit Log check
      const logs = await AuditLog.find({ requestId }).sort({ timestamp: 1 });
      expect(logs.length).toBe(2);
      expect(logs[1].action).toBe('APPROVED_STEP_1');
      expect(logs[1].toStatus).toBe('pending');
    });

    it('Step 2: HR approves -> marks request as fully approved', async () => {
      // 1. Step 1 approval
      await request(app)
        .post(`/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ comment: 'Manager OK' });

      // 2. Step 2 HR approval
      const res = await request(app)
        .post(`/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ comment: 'HR verified and approved' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.request.status).toBe('approved');
      expect(res.body.data.request.steps.length).toBe(2);
      expect(res.body.data.request.steps[1].step).toBe(2);
      expect(res.body.data.request.steps[1].decision).toBe('approved');

      // Audit Log check
      const logs = await AuditLog.find({ requestId }).sort({ timestamp: 1 });
      expect(logs.length).toBe(3);
      expect(logs[2].action).toBe('APPROVED_STEP_2');
      expect(logs[2].toStatus).toBe('approved');
    });
  });

  describe('Approval Rules & Edge Cases', () => {
    let requestId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          type: 'expense',
          details: 'Software licenses',
          amount: 500,
        });
      requestId = res.body.data.request._id;
    });

    it('should forbid approver from approving their own request (403)', async () => {
      // Manager creates their own request
      const mgrRequestRes = await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          type: 'expense',
          details: 'Manager business trip',
          amount: 800,
        });
      const mgrReqId = mgrRequestRes.body.data.request._id;

      // Manager attempts to approve their own request
      const res = await request(app)
        .post(`/requests/${mgrReqId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ comment: 'Self approval attempt' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('cannot approve their own request');
    });

    it('should reject out-of-order approval (HR cannot approve Step 1)', async () => {
      const res = await request(app)
        .post(`/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ comment: 'HR trying Step 1 prematurely' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Step 1 approval requires a Manager role');
    });

    it('should reject non-approvers (employee role) from approval endpoint (403)', async () => {
      const res = await request(app)
        .post(`/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${otherEmployeeToken}`)
        .send({ comment: 'Employee approval attempt' });

      expect(res.status).toBe(403);
    });

    it('should lock approved requests against further modifications (409)', async () => {
      // Step 1
      await request(app)
        .post(`/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);
      // Step 2
      await request(app)
        .post(`/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${hrToken}`);

      // Attempt another approval on locked request
      const res = await request(app)
        .post(`/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('already approved');
    });

    it('should support rejection and lock request as rejected (200 then 409)', async () => {
      const res = await request(app)
        .post(`/requests/${requestId}/reject`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ comment: 'Budget exceeded' });

      expect(res.status).toBe(200);
      expect(res.body.data.request.status).toBe('rejected');

      // Attempting to approve after rejection must fail
      const tryApprove = await request(app)
        .post(`/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${hrToken}`);

      expect(tryApprove.status).toBe(409);
      expect(tryApprove.body.error.message).toContain('already rejected');
    });

    it('should allow owner to cancel pending request (200), and block cancellation by non-owner (403)', async () => {
      // Non-owner attempts to cancel
      const nonOwnerCancel = await request(app)
        .post(`/requests/${requestId}/cancel`)
        .set('Authorization', `Bearer ${otherEmployeeToken}`);
      expect(nonOwnerCancel.status).toBe(403);

      // Owner cancels
      const ownerCancel = await request(app)
        .post(`/requests/${requestId}/cancel`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(ownerCancel.status).toBe(200);
      expect(ownerCancel.body.data.request.status).toBe('cancelled');

      // Attempting to approve a cancelled request must fail
      const tryApprove = await request(app)
        .post(`/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(tryApprove.status).toBe(409);
    });
  });

  describe('Concurrency & Double-Approval Race Condition Protection', () => {
    it('should allow exactly ONE concurrent approval to succeed and reject the other with 409', async () => {
      // Create request
      const createRes = await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          type: 'expense',
          details: 'Concurrency stress test item',
          amount: 300,
        });
      const reqId = createRes.body.data.request._id;

      // Two distinct managers attempt to approve Step 1 at the EXACT same instant
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/requests/${reqId}/approve`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ comment: 'Concurrent approve from Manager 1' }),
        request(app)
          .post(`/requests/${reqId}/approve`)
          .set('Authorization', `Bearer ${manager2Token}`)
          .send({ comment: 'Concurrent approve from Manager 2' }),
      ]);

      const statuses = [res1.status, res2.status].sort();

      // Exactly one must be 200 (Success) and one must be 409 (Conflict due to atomic filter mismatch)
      expect(statuses).toEqual([200, 409]);

      // Verify request state in database
      const dbRequest = await Request.findById(reqId);
      expect(dbRequest.currentStep).toBe(2);
      expect(dbRequest.status).toBe('pending');
      expect(dbRequest.steps.length).toBe(1); // exactly one step recorded, never duplicated
    });
  });

  describe('Audit Trail (GET /requests/:id/audit)', () => {
    it('should return chronological audit history with populated actor profile', async () => {
      // 1. Create request
      const createRes = await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          type: 'leave',
          details: 'Study leave',
          startDate: '2026-11-20',
          endDate: '2026-11-25',
        });
      const reqId = createRes.body.data.request._id;

      // 2. Manager approves Step 1
      await request(app)
        .post(`/requests/${reqId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ comment: 'Manager study leave approval' });

      // 3. Fetch audit trail
      const auditRes = await request(app)
        .get(`/requests/${reqId}/audit`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(auditRes.status).toBe(200);
      expect(auditRes.body.success).toBe(true);
      expect(Array.isArray(auditRes.body.data.auditTrail)).toBe(true);
      expect(auditRes.body.data.auditTrail.length).toBe(2);

      const [entry1, entry2] = auditRes.body.data.auditTrail;
      expect(entry1.action).toBe('CREATED');
      expect(entry1.actor.name).toBe('Alice Employee');

      expect(entry2.action).toBe('APPROVED_STEP_1');
      expect(entry2.actor.name).toBe('Bob Manager');
      expect(entry2.comment).toBe('Manager study leave approval');
    });
  });

  describe('Listing & Scoping (GET /requests)', () => {
    beforeEach(async () => {
      // Employee creates 2 requests
      await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ type: 'expense', details: 'Item 1', amount: 10 });

      await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ type: 'leave', details: 'Item 2', startDate: '2026-12-01', endDate: '2026-12-02' });

      // Other employee creates 1 request
      await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${otherEmployeeToken}`)
        .send({ type: 'expense', details: 'Other Item', amount: 20 });
    });

    it('scope=mine should return only the caller requests with pagination', async () => {
      const res = await request(app)
        .get('/requests?scope=mine&limit=10')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.requests.length).toBe(2);
      expect(res.body.data.pagination.total).toBe(2);
      expect(res.body.data.pagination.totalPages).toBe(1);
    });

    it('scope=pending_for_me for manager should return Step 1 requests created by others', async () => {
      const res = await request(app)
        .get('/requests?scope=pending_for_me')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      // All 3 pending requests created by employees are at Step 1
      expect(res.body.data.requests.length).toBe(3);
      res.body.data.requests.forEach((r) => {
        expect(r.status).toBe('pending');
        expect(r.currentStep).toBe(1);
      });
    });
  });
});
