import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type Messages = { [key: string]: string | Messages };

function load(locale: string): Messages {
  const path = fileURLToPath(new URL(`../../messages/${locale}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as Messages;
}

function flatten(messages: Messages, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      out.set(path, value);
    } else {
      for (const [k, v] of flatten(value, path)) out.set(k, v);
    }
  }
  return out;
}

const th = flatten(load('th'));
const en = flatten(load('en'));

describe('message catalogues', () => {
  it('every key in th.json exists in en.json and the reverse', () => {
    expect([...th.keys()].filter((k) => !en.has(k))).toEqual([]);
    expect([...en.keys()].filter((k) => !th.has(k))).toEqual([]);
    expect(th.size).toBeGreaterThan(0);
  });

  it('no message is an empty string', () => {
    const empty = [...th, ...en].filter(([, v]) => v.trim() === '').map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it('holds every shop.auth.* key the server code can return, in both languages', () => {
    const srcDir = fileURLToPath(new URL('..', import.meta.url));
    const files = (readdirSync(srcDir, { recursive: true }) as string[])
      .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.tsx?$/.test(file))
      .map((file) => join(srcDir, file));
    const used = new Set<string>();
    for (const file of files) {
      for (const match of readFileSync(file, 'utf8').matchAll(/'(shop\.auth\.[A-Za-z]+(?:\.[A-Za-z]+)+)'/g)) used.add(match[1]!);
    }
    expect(used.size).toBeGreaterThan(15);
    // `shop.auth.password.rule.*` and `shop.auth.error.*` are written out in full where they are returned.
    const missing = [...used].filter((key) => !th.has(key) || !en.has(key));
    expect(missing).toEqual([]);
  });
});
