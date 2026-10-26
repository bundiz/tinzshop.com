import { execFileSync } from 'node:child_process';

export default function setup(): void {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set for the integration run');
  }
  if (!new URL(url).pathname.endsWith('_test')) {
    throw new Error('Refusing to migrate: DATABASE_URL does not name a _test database');
  }
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
