import { createApp } from './app';
import { connectDB, disconnectDB } from './config/db';
import { env } from './config/env';
import { logger } from './utils/logger';

async function start() {
  await connectDB();
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`MNM Fashion API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Force-exit if connections don't drain in time.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('Fatal startup error', err);
  process.exit(1);
});
