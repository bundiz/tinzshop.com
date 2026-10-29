import { Client } from 'pg';
import { getDatabaseUrl } from '@/server/config';

/** Serialises catalogue sync runs across processes (plan 010). */
export const CATALOGUE_SYNC_LOCK_KEY = 6_251_010n;

/** Serialises news import runs (plan 012); distinct from the catalogue sync, so the two never block each other. */
export const NEWS_IMPORT_LOCK_KEY = 6_251_012n;

/**
 * Runs `task` only if the session-level advisory lock is free. The lock lives on a dedicated
 * connection, so it is released on every exit path, including a throwing task.
 */
export async function tryWithAdvisoryLock<T>(
  lockKey: bigint,
  task: () => Promise<T>,
): Promise<{ acquired: true; value: T } | { acquired: false }> {
  const client = new Client({ connectionString: getDatabaseUrl() });
  // A dropped connection emits 'error'; without a listener Node would crash the process.
  // Closing the session releases the lock anyway, so the failure is only noted.
  let connectionError = false;
  client.on('error', () => {
    connectionError = true;
  });
  await client.connect();
  let acquired = false;
  try {
    const result = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1::bigint) AS locked',
      [lockKey.toString()],
    );
    acquired = result.rows[0]?.locked === true;
    if (!acquired) return { acquired: false };
    const value = await task();
    return { acquired: true, value };
  } finally {
    // Never let a failed release replace the task's result or error: ending the session frees the lock.
    if (acquired && !connectionError) {
      try {
        await client.query('SELECT pg_advisory_unlock($1::bigint)', [lockKey.toString()]);
      } catch {
        // connection already gone
      }
    }
    try {
      await client.end();
    } catch {
      // already closed
    }
  }
}
