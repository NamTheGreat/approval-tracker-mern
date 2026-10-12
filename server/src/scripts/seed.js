import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Request } from '../models/Request.js';
import { AuditLog } from '../models/AuditLog.js';

const DEMO_PASSWORD = 'Password123!';

const demoUsers = [
  {
    name: 'Demo Employee',
    email: 'employee@startupmeu.local',
    role: 'employee',
  },
  {
    name: 'Demo Manager',
    email: 'manager@startupmeu.local',
    role: 'manager',
  },
  {
    name: 'Demo HR',
    email: 'hr@startupmeu.local',
    role: 'hr',
  },
  {
    name: 'Demo Admin',
    email: 'admin@startupmeu.local',
    role: 'admin',
  },
];

async function seedDatabase() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/approval-tracker';
    console.log(`[Seed] Connecting to MongoDB: ${mongoUri}`);
    await connectDB(mongoUri);

    console.log('[Seed] Generating hashed password for demo accounts...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, salt);

    console.log('[Seed] Resetting demo collections...');
    const demoEmails = demoUsers.map((u) => u.email);
    const existingUsers = await User.find({ email: { $in: demoEmails } });
    const existingUserIds = existingUsers.map((u) => u._id);

    if (existingUserIds.length > 0) {
      await Request.deleteMany({ createdBy: { $in: existingUserIds } });
      await AuditLog.deleteMany({ actor: { $in: existingUserIds } });
    }
    await User.deleteMany({ email: { $in: demoEmails } });

    console.log('[Seed] Inserting fresh demo users...');
    const userMap = {};
    for (const userData of demoUsers) {
      const user = await User.create({
        ...userData,
        passwordHash,
      });
      userMap[user.role] = user;
      console.log(`  ✔ Created: [${user.role.toUpperCase()}] ${user.name} <${user.email}>`);
    }

    console.log('[Seed] Creating demo approval requests across workflow stages...');
    // 1. Pending at Step 1 (Manager approval pending)
    const req1 = await Request.create({
      type: 'expense',
      details: 'AWS Cloud Hosting & Development Infrastructure',
      amount: 450.0,
      createdBy: userMap.employee._id,
      status: 'pending',
      currentStep: 1,
      steps: [],
    });
    await AuditLog.create({
      requestId: req1._id,
      actor: userMap.employee._id,
      action: 'CREATED',
      fromStatus: 'none',
      toStatus: 'pending',
      comment: 'Initial expense submission for Q4 cloud usage',
    });

    // 2. Pending at Step 2 (Manager approved, HR approval pending)
    const req2 = await Request.create({
      type: 'leave',
      details: 'Annual Vacation & Family Trip',
      startDate: new Date(Date.now() + 7 * 86400000),
      endDate: new Date(Date.now() + 14 * 86400000),
      createdBy: userMap.employee._id,
      status: 'pending',
      currentStep: 2,
      steps: [
        {
          step: 1,
          approver: userMap.manager._id,
          decision: 'approved',
          comment: 'Approved by Engineering Manager. Coverage arranged.',
          decidedAt: new Date(Date.now() - 3600000),
        },
      ],
    });
    await AuditLog.create({
      requestId: req2._id,
      actor: userMap.employee._id,
      action: 'CREATED',
      fromStatus: 'none',
      toStatus: 'pending',
      comment: 'Leave request submitted',
      timestamp: new Date(Date.now() - 7200000),
    });
    await AuditLog.create({
      requestId: req2._id,
      actor: userMap.manager._id,
      action: 'APPROVED_STEP_1',
      fromStatus: 'pending',
      toStatus: 'pending',
      comment: 'Approved by Engineering Manager. Coverage arranged.',
      timestamp: new Date(Date.now() - 3600000),
    });

    // 3. Fully Approved (Both Manager and HR approved)
    const req3 = await Request.create({
      type: 'expense',
      details: 'Ergonomic Standing Desk and Monitor Arm',
      amount: 680.0,
      createdBy: userMap.employee._id,
      status: 'approved',
      currentStep: 2,
      steps: [
        {
          step: 1,
          approver: userMap.manager._id,
          decision: 'approved',
          comment: 'Approved within ergonomics budget.',
          decidedAt: new Date(Date.now() - 86400000),
        },
        {
          step: 2,
          approver: userMap.hr._id,
          decision: 'approved',
          comment: 'HR verified receipt. Reimbursement processed.',
          decidedAt: new Date(Date.now() - 43200000),
        },
      ],
    });
    await AuditLog.create({
      requestId: req3._id,
      actor: userMap.employee._id,
      action: 'CREATED',
      fromStatus: 'none',
      toStatus: 'pending',
      timestamp: new Date(Date.now() - 172800000),
    });
    await AuditLog.create({
      requestId: req3._id,
      actor: userMap.manager._id,
      action: 'APPROVED_STEP_1',
      fromStatus: 'pending',
      toStatus: 'pending',
      comment: 'Approved within ergonomics budget.',
      timestamp: new Date(Date.now() - 86400000),
    });
    await AuditLog.create({
      requestId: req3._id,
      actor: userMap.hr._id,
      action: 'APPROVED_STEP_2',
      fromStatus: 'pending',
      toStatus: 'approved',
      comment: 'HR verified receipt. Reimbursement processed.',
      timestamp: new Date(Date.now() - 43200000),
    });

    // 4. Rejected at Step 1
    const req4 = await Request.create({
      type: 'expense',
      details: 'Luxury First-Class Train Ticket',
      amount: 1400.0,
      createdBy: userMap.employee._id,
      status: 'rejected',
      currentStep: 1,
      steps: [
        {
          step: 1,
          approver: userMap.manager._id,
          decision: 'rejected',
          comment: 'Travel policy allows standard economy tickets only.',
          decidedAt: new Date(Date.now() - 10800000),
        },
      ],
    });
    await AuditLog.create({
      requestId: req4._id,
      actor: userMap.employee._id,
      action: 'CREATED',
      fromStatus: 'none',
      toStatus: 'pending',
      timestamp: new Date(Date.now() - 21600000),
    });
    await AuditLog.create({
      requestId: req4._id,
      actor: userMap.manager._id,
      action: 'REJECTED',
      fromStatus: 'pending',
      toStatus: 'rejected',
      comment: 'Travel policy allows standard economy tickets only.',
      timestamp: new Date(Date.now() - 10800000),
    });

    console.log('  ✔ Created 4 sample requests across pending, approved, and rejected states with audit logs.');

    console.log('\n=========================================');
    console.log('Seed completed successfully!');
    console.log('Demo Credentials (all accounts):');
    console.log(`Password: ${DEMO_PASSWORD}`);
    console.log('Emails:');
    demoUsers.forEach((u) => {
      console.log(` - ${u.role}: ${u.email}`);
    });
    console.log('=========================================\n');

    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error(`[Seed Error] Failed to seed database: ${error.message}`);
    await disconnectDB();
    process.exit(1);
  }
}

seedDatabase();
