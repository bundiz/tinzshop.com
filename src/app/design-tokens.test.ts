import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, 'globals.css'), 'utf8');

/** The value a custom property is given in the `@theme` block (the first definition). */
function token(name: string): string | undefined {
  const match = css.match(new RegExp(`${name.replace(/[-]/g, '\\-')}:\\s*([^;]+);`));
  return match?.[1]?.trim().replace(/\s+/g, ' ');
}

// Plan 015, Global Constraints > Tokens (D-191, D-193).
const COLOURS: Record<string, string> = {
  page: '#f4f5f7', surface: '#ffffff', sunk: '#edeff2', ink: '#10141c', 'ink-2': '#394150', muted: '#636b7a',
  line: '#e1e4ea', 'line-2': '#cdd2da',
  navy: '#0e1b4d', 'navy-2': '#142867', 'navy-3': '#1d3a8a', 'on-navy': '#e9edf5', 'on-navy-2': '#a9b4c8',
  brand: '#1863dc', 'brand-dark': '#0056a7', 'brand-soft': '#e8f0fd',
  accent: '#fea601', 'accent-2': '#ffb733', 'accent-press': '#e08f00', 'accent-soft': '#fff4dc',
  ps: '#0b5fd0', 'ps-soft': '#e7f0fc', 'ps-ink': '#08489e',
  ns: '#e4002b', 'ns-soft': '#fde8ec', 'ns-ink': '#b00022',
  it: '#0e8f7e', 'it-soft': '#e2f5f2', 'it-ink': '#086b5e',
  other: '#7a8394',
  ok: '#0b7d44', 'ok-soft': '#e6f5ec', 'ok-ink': '#0a5a33',
  sale: '#d12a1c', warn: '#9a5b00', 'warn-soft': '#fff4dc',
  'line-app': '#06c755', 'line-app-hover': '#05b04b', 'line-app-soft': '#e9f9f0',
};

const RADII: Record<string, string> = { sm: '8px', md: '12px', lg: '18px', xl: '22px', '2xl': '28px' };

const SHADOWS: Record<string, string> = {
  '1': '0 1px 2px rgba(16, 20, 28, 0.06), 0 1px 1px rgba(16, 20, 28, 0.04)',
  '2': '0 10px 30px -12px rgba(16, 20, 28, 0.22), 0 2px 6px rgba(16, 20, 28, 0.06)',
};

const BREAKPOINTS: Record<string, string> = { sm: '40rem', md: '53.75rem', lg: '64rem', xl: '73.75rem' };

function sourceFiles(dir: string, extensions: string[] = ['.tsx']): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path, extensions);
    return extensions.some((extension) => path.endsWith(extension)) ? [path] : [];
  });
}

// Plan 015, Global Constraints > Retired tokens: the old design's names, removed in Task 9.
const RETIRED_COLOURS = [
  'primary', 'primary-dark', 'primary-deep', 'primary-soft', 'accent-dark', 'danger', 'success', 'success-soft',
  'text', 'text-muted', 'text-subtle', 'bg', 'bg-subtle', 'border',
];
const RETIRED_PROPERTIES = [
  ...RETIRED_COLOURS.map((name) => `--color-${name}`),
  '--font-sans', '--radius', '--shadow-card', '--shadow-hover', '--breakpoint-xs',
];

/** A custom property name, matched whole (so `--radius` does not match `--radius-sm`). */
function property(name: string): RegExp {
  return new RegExp(`${name.replace(/[-]/g, '\\-')}(?![\\w-])`);
}

const UTILITY_PREFIX =
  '(?:bg|text|border(?:-[trblxyse])?|ring|ring-offset|outline|fill|stroke|from|via|to|divide|placeholder|decoration|accent|caret|shadow)';
/** A utility class built on a retired colour, e.g. `bg-primary`, `hover:text-text-muted`, `border-border`. */
const RETIRED_CLASS = new RegExp(`(?<![\\w-])${UTILITY_PREFIX}-(?:${RETIRED_COLOURS.join('|')})(?![\\w-])`);
/** The retired radius and shadow variables used directly, and the retired `xs:` breakpoint variant. */
const RETIRED_USE = /rounded-\(--radius|var\(--radius\)|--shadow-card|--shadow-hover|(?<![\w-])xs:/;

/** Phrases the mockup carries that are not true of the shop (plan 015 Review Focus 1, R5). */
const MADE_UP_TEXT = [
  'Switch 2', 'สัปดาห์นี้', 'ซื้อคู่กันบ่อย', 'ถูกกว่าซื้อแยก', 'คุ้มกว่า', 'เครื่องประกันร้าน', 'เลขพัสดุ', 'รอข้อมูลจากร้าน',
  'เบอร์ร้าน',
];

/** Every string value in a message file, with its dotted key. */
function messageValues(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return [[path, node]];
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) => messageValues(value, path ? `${path}.${key}` : key));
  }
  return [];
}

describe('design tokens (globals.css)', () => {
  it.each(Object.entries(COLOURS))('defines --color-%s', (name, value) => {
    expect(token(`--color-${name}`)).toBe(value);
  });

  it.each(Object.entries(RADII))('defines --radius-%s', (name, value) => {
    expect(token(`--radius-${name}`)).toBe(value);
  });

  it.each(Object.entries(SHADOWS))('defines --shadow-%s', (name, value) => {
    expect(token(`--shadow-${name}`)).toBe(value);
  });

  it('defines the soft easing', () => {
    expect(token('--ease-soft')).toBe('cubic-bezier(0.2, 0.7, 0.2, 1)');
  });

  it.each(Object.entries(BREAKPOINTS))('defines --breakpoint-%s', (name, value) => {
    expect(token(`--breakpoint-${name}`)).toBe(value);
  });

  it('defines no --breakpoint-xs', () => {
    expect(css).not.toContain('--breakpoint-xs');
  });

  it('defines the two font stacks from the four font variables', () => {
    expect(css).toMatch(/--font-head:\s*var\(--font-anuphan-latin\)/);
    expect(css).toMatch(/--font-body:\s*var\(--font-plex-latin\)/);
  });

  it('uses no arbitrary min-[…] breakpoint variant in any component', () => {
    const offenders = sourceFiles(join(__dirname, '..')).filter((file) =>
      /min-\[/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('no retired token remains', () => {
    const defined = RETIRED_PROPERTIES.filter((name) => new RegExp(`${name.replace(/[-]/g, '\\-')}\\s*:`).test(css));
    expect(defined).toEqual([]);

    const offenders = sourceFiles(join(__dirname, '..'), ['.ts', '.tsx', '.css'])
      .filter((file) => !file.includes(join('src', 'generated')) && !file.endsWith('design-tokens.test.ts'))
      .flatMap((file) => {
        const text = readFileSync(file, 'utf8');
        const found = [RETIRED_CLASS, RETIRED_USE, ...RETIRED_PROPERTIES.map(property)]
          .map((pattern) => text.match(pattern)?.[0])
          .filter(Boolean);
        return found.map((match) => `${file}: ${match}`);
      });
    expect(offenders).toEqual([]);
  });

  it('no made-up storefront text remains', () => {
    const messages = JSON.parse(readFileSync(join(__dirname, '..', '..', 'messages', 'th.json'), 'utf8'));
    const offenders = messageValues(messages).filter(([, value]) => MADE_UP_TEXT.some((phrase) => value.includes(phrase)));
    expect(offenders).toEqual([]);
  });
});
