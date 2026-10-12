import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';

const testMongoUri =
  process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/approval-tracker-test';

beforeAll(async () => {
  await connectDB(testMongoUri);
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await disconnectDB();
});
