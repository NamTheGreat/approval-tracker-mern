import request from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { authenticate, authorizeRoles } from '../src/middleware/auth.js';

describe('API Foundation & Central Error Handling', () => {
  it('GET /health - should return 200 and healthy status', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Approval Tracker API is healthy');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /unhandled-route - should return standard 404 error shape', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.statusCode).toBe(404);
    expect(res.body.error.message).toContain('Route not found');
  });
});

describe('Authentication: POST /auth/register', () => {
  it('should reject registration when validation fails (Zod 400)', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'A', // too short (< 2)
      email: 'invalid-email',
      password: '123', // too short (< 8)
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Validation failed');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(3);
  });

  it('should successfully register a new employee user (201)', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'Alice Employee',
      email: 'alice@startupmeu.local',
      password: 'Password123!',
      role: 'employee',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe('alice@startupmeu.local');
    expect(res.body.data.user.role).toBe('employee');
    expect(res.body.data.user.passwordHash).toBeUndefined(); // ensure hash not leaked
    expect(res.body.data.token).toBeDefined();

    // Verify persisted in DB
    const userInDb = await User.findOne({ email: 'alice@startupmeu.local' });
    expect(userInDb).not.toBeNull();
  });

  it('should reject duplicate email registration with 409 Conflict', async () => {
    // First registration
    await request(app).post('/auth/register').send({
      name: 'Bob Duplicate',
      email: 'bob@startupmeu.local',
      password: 'Password123!',
    });

    // Attempt second registration with same email
    const res = await request(app).post('/auth/register').send({
      name: 'Bob Duplicate 2',
      email: 'bob@startupmeu.local',
      password: 'Password123!',
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.statusCode).toBe(409);
    expect(res.body.error.message).toContain('already exists');
  });
});

describe('Authentication: POST /auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/auth/register').send({
      name: 'Login Tester',
      email: 'logintester@startupmeu.local',
      password: 'Password123!',
      role: 'manager',
    });
  });

  it('should reject login for non-existent email with 401', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'nonexistent@startupmeu.local',
      password: 'Password123!',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('should reject login with wrong password with 401', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'logintester@startupmeu.local',
      password: 'WrongPassword999!',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('should successfully log in with correct credentials (200)', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'logintester@startupmeu.local',
      password: 'Password123!',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('logintester@startupmeu.local');
    expect(res.body.data.user.role).toBe('manager');
    expect(res.body.data.token).toBeDefined();
  });
});

describe('Authentication Middleware: GET /auth/me', () => {
  let employeeToken;

  beforeEach(async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'Auth Token Tester',
      email: 'tokenuser@startupmeu.local',
      password: 'Password123!',
      role: 'employee',
    });
    employeeToken = res.body.data.token;
  });

  it('should return 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Authentication required');
  });

  it('should return 401 when Authorization token is invalid or malformed', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid.tampered.token');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Invalid authentication token');
  });

  it('should return current user profile when valid token is provided', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('tokenuser@startupmeu.local');
    expect(res.body.data.user.role).toBe('employee');
  });
});

describe('RBAC Middleware: authorizeRoles', () => {
  let employeeToken;
  let managerToken;

  beforeEach(async () => {
    const empRes = await request(app).post('/auth/register').send({
      name: 'Emp RBAC',
      email: 'emp_rbac@startupmeu.local',
      password: 'Password123!',
      role: 'employee',
    });
    employeeToken = empRes.body.data.token;

    const mgrRes = await request(app).post('/auth/register').send({
      name: 'Mgr RBAC',
      email: 'mgr_rbac@startupmeu.local',
      password: 'Password123!',
      role: 'manager',
    });
    managerToken = mgrRes.body.data.token;
  });

  it('should forbid employee from accessing manager-only route (403)', async () => {
    const res = await request(app)
      .get('/auth/manager-check')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.statusCode).toBe(403);
    expect(res.body.error.message).toContain('Forbidden');
  });

  it('should allow manager to access manager-only route (200)', async () => {
    const res = await request(app)
      .get('/auth/manager-check')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Access granted to manager/admin');
  });
});

describe('Rate Limiting: POST /auth/login', () => {
  it('should return 429 when exceeding maximum login attempts', async () => {
    // Send 10 requests to reach threshold
    for (let i = 0; i < 10; i++) {
      await request(app).post('/auth/login').send({
        email: 'invalid@startupmeu.local',
        password: 'Password123!',
      });
    }

    // 11th request should be blocked by rate limiter
    const throttledRes = await request(app).post('/auth/login').send({
      email: 'invalid@startupmeu.local',
      password: 'Password123!',
    });

    expect(throttledRes.status).toBe(429);
    expect(throttledRes.body.success).toBe(false);
    expect(throttledRes.body.error.statusCode).toBe(429);
    expect(throttledRes.body.error.message).toContain('Too many login attempts');
  });
});

