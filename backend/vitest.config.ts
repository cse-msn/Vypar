import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 120000,
    pool: 'forks',
    fileParallelism: false,
    // Satisfy env validation at import time; the real DB URI comes from an in-memory
    // MongoDB started in each test's beforeAll (see src/tests/helpers.ts).
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-test-secret-0123456789',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/mnm_placeholder',
      STORAGE_DRIVER: 'local',
      LOCAL_STORAGE_DIR: '.storage-test',
      PUBLIC_APP_URL: 'http://localhost:5173',
      SHOP_NAME: 'MNM Fashion Test',
    },
  },
});
