import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The per-page rule behind D-249: the back-office layout is never the check, so every page under `(admin)` and every
 * Server Action file (`actions.ts`) must call `requirePermission(` itself. Stage 1 has no other permission check, so the
 * rule is the same for both; an action file with an equivalent check would need this rule widened on purpose.
 */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const files = walk(__dirname).filter((path) => /[\\/](page\.tsx|actions\.ts)$/.test(path));

describe('the back-office permission rule', () => {
  it('finds the pages to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((path) => [path.slice(__dirname.length)]))('%s calls requirePermission(', (path) => {
    expect(readFileSync(join(__dirname, path!), 'utf8')).toContain('requirePermission(');
  });
});
