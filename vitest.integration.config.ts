import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const DEFAULT_TEST_DATABASE_URL = 'postgresql://postgres@127.0.0.1:5434/tinzshop_test';

const fileEnv = loadEnv('test', process.cwd(), '');
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL || fileEnv.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL;

// Global setup runs in this process, where `test.env` is not applied yet.
process.env.DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    fileParallelism: false,
    globalSetup: 'tests/integration/setup/global-setup.ts',
    env: { DATABASE_URL: testDatabaseUrl },
  },
});
