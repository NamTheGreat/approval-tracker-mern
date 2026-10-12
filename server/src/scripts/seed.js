import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';

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

    console.log('[Seed] Clearing existing demo users...');
    const demoEmails = demoUsers.map((u) => u.email);
    await User.deleteMany({ email: { $in: demoEmails } });

    console.log('[Seed] Inserting fresh demo users...');
    for (const userData of demoUsers) {
      const user = await User.create({
        ...userData,
        passwordHash,
      });
      console.log(`  ✔ Created: [${user.role.toUpperCase()}] ${user.name} <${user.email}>`);
    }

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
