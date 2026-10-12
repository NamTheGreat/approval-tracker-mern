import mongoose from 'mongoose';

/**
 * Connect to MongoDB database
 * @param {string} uri - MongoDB connection string (defaults to process.env.MONGO_URI)
 */
export async function connectDB(uri = process.env.MONGO_URI) {
  try {
    const conn = await mongoose.connect(uri);
    console.log(`[Database] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] Connection failed: ${error.message}`);
    throw error;
  }
}

/**
 * Disconnect from MongoDB database (used in test teardown and graceful shutdown)
 */
export async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('[Database] MongoDB disconnected cleanly');
  } catch (error) {
    console.error(`[Database Error] Disconnection failed: ${error.message}`);
    throw error;
  }
}
