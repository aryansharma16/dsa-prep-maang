import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDb() {
  mongoose.set('strictQuery', true);

  if (env.mongoUri.includes('<db_password>')) {
    throw new Error(
      'MONGO_URI still contains the literal <db_password> placeholder. ' +
        'Replace it with your real Atlas password in server/.env',
    );
  }

  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 15000 });
    console.log('[db] connected to MongoDB');
  } catch (err) {
    console.error('[db] connection failed:', err.message);
    console.error(
      '[db] if this timed out, check Atlas > Network Access allows your IP (0.0.0.0/0 for anywhere)',
    );
    throw err;
  }
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
