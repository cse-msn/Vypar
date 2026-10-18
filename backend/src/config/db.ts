import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

mongoose.set('strictQuery', true);

export async function connectDB(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB connection error', err));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: !env.isProd, // build indexes automatically outside production
  });
  return mongoose;
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
