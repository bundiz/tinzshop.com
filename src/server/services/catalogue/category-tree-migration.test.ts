import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORY_TREE } from './categorise-by-name';

const MIGRATIONS = join(process.cwd(), 'prisma', 'migrations');
const dir = readdirSync(MIGRATIONS).find((name) => name.endsWith('_seed_category_tree'));
const sql = dir === undefined ? '' : readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8');

/** Every `('a', 'b', c)` tuple of the migration's VALUES lists, as strings. */
function tuples(): string[][] {
  return [...sql.matchAll(/^\s*\(('[^\n]*)\),?$/gm)].map((match) =>
    [...match[1].matchAll(/'((?:[^']|'')*)'|(NULL|\d+)/g)].map((part) => part[1] ?? part[2]),
  );
}

describe('the seed_category_tree migration (R5)', () => {
  it('seeds exactly CATEGORY_TREE: slugs, parents, positions and both names', () => {
    expect(dir).toBeDefined();
    const expectedCategories = CATEGORY_TREE.flatMap((platform) => [
      [platform.slug, 'NULL', String(platform.position)],
      ...platform.types.map((type) => [type.slug, platform.slug, String(type.position)]),
    ]);
    const expectedNames = CATEGORY_TREE.flatMap((platform) =>
      [platform, ...platform.types].flatMap((node) => [
        [node.slug, 'th', node.th],
        [node.slug, 'en', node.en],
      ]),
    );
    const rows = tuples();
    const categories = rows.filter((row) => row.length === 3 && /^\d+$/.test(row[2]));
    const names = rows.filter((row) => row.length === 3 && (row[1] === 'th' || row[1] === 'en'));
    const sort = (list: string[][]) => [...list].map((row) => row.join('|')).sort();
    expect(sort(categories)).toEqual(sort(expectedCategories));
    expect(sort(names)).toEqual(sort(expectedNames));
  });

  it('is idempotent: every insert skips an existing row', () => {
    expect(sql.match(/INSERT INTO/g)).toHaveLength(3);
    expect(sql.match(/ON CONFLICT \([^)]*\) DO NOTHING/g)).toHaveLength(3);
    expect(sql).not.toMatch(/\b(DELETE|UPDATE|TRUNCATE|DROP)\b/);
  });
});
