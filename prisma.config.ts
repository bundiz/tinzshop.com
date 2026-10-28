import { defineConfig, env } from 'prisma/config';

// Node's loadEnvFile never overrides variables already set, so an inline
// DATABASE_URL on the command line wins over the one in .env.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: rely on the process environment.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
