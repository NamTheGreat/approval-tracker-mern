import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Request } from '../src/models/Request.js';

describe('Advanced Edge Cases, Security & Concurrency Races', () => {
  let empAToken;
  let empBToken;
  let mgr1Token;
  let mgr2Token;
  let hr1Token;
  let hr2Token;
  let adminToken;

  beforeEach(async () => {
    const [empA, empB, mgr1, mgr2, hr1, hr2, admin] = await Promise.all([
      request(app).post('/auth/register').send({
        name: 'Employee A',
        email: 'empa@edge.local',
        password: 'Password123!',
        role: 'employee',
      }),
      request(app).post('/auth/register').send({
        name: 'Employee B',
        email: 'empb@edge.local',
        password: 'Password123!',
        role: 'employee',
      }),
      request(app).post('/auth/register').send({
        name: 'Manager One',
        email: 'mgr1@edge.local',
        password: 'Password123!',
        role: 'manager',
      }),
      request(app).post('/auth/register').send({
        name: 'Manager Two',
        email: 'mgr2@edge.local',
        password: 'Password123!',
        role: 'manager',
      }),
      request(app).post('/auth/register').send({
        name: 'HR One',
        email: 'hr1@edge.local',
        password: 'Password123!',
        role: 'hr',
      }),
      request(app).post('/auth/register').send({
        name: 'HR Two',
        email: 'hr2@edge.local',
        password: 'Password123!',
        role: 'hr',
      }),
      request(app).post('/auth/register').send({
        name: 'System Admin',
        email: 'admin@edge.local',
        password: 'Password123!',
        role: 'admin',
      }),
    ]);

    empAToken = empA.body.data.token;
    empBToken = empB.body.data.token;
    mgr1Token = mgr1.body.data.token;
    mgr2Token = mgr2.body.data.token;
    hr1Token = hr1.body.data.token;
    hr2Token = hr2.body.data.token;
    adminToken = admin.body.data.token;
  });

  describe('Malformed IDs (CastError 400) & Non-Existent IDs (404)', () => {
    it('should return 400 Bad Request for malformed MongoDB ObjectIds', async () => {
      const badId = 'not-a-valid-mongo-id';

      const getRes = await request(app)
        .get(`/requests/${badId}`)
        .set('Authorization', `Bearer ${empAToken}`);
      expect(getRes.status).toBe(400);
      expect(getRes.body.error.message).toContain('Invalid ID format');

      const approveRes = await request(app)
        .post(`/requests/${badId}/approve`)
        .set('Authorization', `Bearer ${mgr1Token}`);
      expect(approveRes.status).toBe(400);
    });

    it('should return 404 Not Found for valid but non-existent ObjectIds', async () => {
      const missingId = new mongoose.Types.ObjectId().toString();

      const getRes = await request(app)
        .get(`/requests/${missingId}`)
        .set('Authorization', `Bearer ${empAToken}`);
      expect(getRes.status).toBe(404);

      const approveRes = await request(app)
        .post(`/requests/${missingId}/approve`)
        .set('Authorization', `Bearer ${mgr1Token}`);
      expect(approveRes.status).toBe(404);

      const rejectRes = await request(app)
        .post(`/requests/${missingId}/reject`)
        .set('Authorization', `Bearer ${mgr1Token}`);
      expect(rejectRes.status).toBe(404);

      const cancelRes = await request(app)
        .post(`/requests/${missingId}/cancel`)
        .set('Authorization', `Bearer ${empAToken}`);
      expect(cancelRes.status).toBe(404);
    });
  });

  describe('Cross-User Privacy & Admin Oversight', () => {
    let empARequestId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${empAToken}`)
        .send({
          type: 'expense',
          details: 'Private medical reimbursement',
          amount: 120,
        });
      empARequestId = res.body.data.request._id;
    });

    it('should forbid Employee B from viewing Employee A request or audit trail (403)', async () => {
      const detailRes = await request(app)
        .get(`/requests/${empARequestId}`)
        .set('Authorization', `Bearer ${empBToken}`);
      expect(detailRes.status).toBe(403);

      const auditRes = await request(app)
        .get(`/requests/${empARequestId}/audit`)
        .set('Authorization', `Bearer ${empBToken}`);
      expect(auditRes.status).toBe(403);
    });

    it('should forbid non-admins from querying scope=all (403), while allowing Admin (200)', async () => {
      const mgrAll = await request(app)
        .get('/requests?scope=all')
        .set('Authorization', `Bearer ${mgr1Token}`);
      expect(mgrAll.status).toBe(403);

      const adminAll = await request(app)
        .get('/requests?scope=all')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminAll.status).toBe(200);
      expect(adminAll.body.data.requests.length).toBe(1);
    });
  });

  describe('Step 2 HR Double-Approval & Approve-vs-Reject Race Conditions', () => {
    let step2RequestId;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/requests')
        .set('Authorization', `Bearer ${empAToken}`)
        .send({
          type: 'leave',
          details: 'Paternity leave',
          startDate: '2026-12-01',
          endDate: '2026-12-15',
        });
      step2RequestId = createRes.body.data.request._id;

      // Advance to Step 2 via Manager 1
      await request(app)
        .post(`/requests/${step2RequestId}/approve`)
        .set('Authorization', `Bearer ${mgr1Token}`)
        .send({ comment: 'Step 1 approved' });
    });

    it('should prevent two HR users from simultaneously approving Step 2 (200 & 409)', async () => {
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/requests/${step2RequestId}/approve`)
          .set('Authorization', `Bearer ${hr1Token}`)
          .send({ comment: 'HR 1 final approval' }),
        request(app)
          .post(`/requests/${step2RequestId}/approve`)
          .set('Authorization', `Bearer ${hr2Token}`)
          .send({ comment: 'HR 2 simultaneous final approval' }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      const finalDoc = await Request.findById(step2RequestId);
      expect(finalDoc.status).toBe('approved');
      expect(finalDoc.steps.length).toBe(2);
    });

    it('should resolve simultaneous Approve vs Reject race atomically (one 200, one 409)', async () => {
      const [approveRes, rejectRes] = await Promise.all([
        request(app)
          .post(`/requests/${step2RequestId}/approve`)
          .set('Authorization', `Bearer ${hr1Token}`)
          .send({ comment: 'HR 1 approving' }),
        request(app)
          .post(`/requests/${step2RequestId}/reject`)
          .set('Authorization', `Bearer ${hr2Token}`)
          .send({ comment: 'HR 2 rejecting simultaneously' }),
      ]);

      const statuses = [approveRes.status, rejectRes.status].sort();
      expect(statuses).toEqual([200, 409]);

      const finalDoc = await Request.findById(step2RequestId);
      expect(['approved', 'rejected']).toContain(finalDoc.status);
      expect(finalDoc.steps.length).toBe(2);
    });
  });

  describe('Deleted User Token Revocation', () => {
    it('should return 401 if the user associated with a valid JWT is deleted from DB', async () => {
      const tempUserRes = await request(app).post('/auth/register').send({
        name: 'Ephemeral User',
        email: 'ephemeral@edge.local',
        password: 'Password123!',
      });
      const tempToken = tempUserRes.body.data.token;
      const tempId = tempUserRes.body.data.user.id;

      // Delete user directly from database
      await User.findByIdAndDelete(tempId);

      // Attempt to use token
      const meRes = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${tempToken}`);

      expect(meRes.status).toBe(401);
      expect(meRes.body.error.message).toContain('no longer exists');
    });
  });
});
