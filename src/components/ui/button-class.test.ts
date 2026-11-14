import { describe, expect, it } from 'vitest';
import { buttonClass } from './button-class';

describe('buttonClass', () => {
  it('always carries the base shape, 48px tall', () => {
    const classes = buttonClass({ variant: 'buy' }).split(' ');
    for (const c of ['inline-flex', 'min-h-12', 'rounded-sm', 'border-[1.5px]', 'font-body', 'font-semibold', 'ease-soft']) {
      expect(classes).toContain(c);
    }
  });

  it('buy is the yellow button with ink text', () => {
    const classes = buttonClass({ variant: 'buy' }).split(' ');
    expect(classes).toEqual(expect.arrayContaining(['bg-accent', 'text-ink', 'hover:bg-accent-2', 'active:bg-accent-press']));
  });

  it('brand is the blue button with white text', () => {
    const classes = buttonClass({ variant: 'brand' }).split(' ');
    expect(classes).toEqual(expect.arrayContaining(['bg-brand', 'text-white', 'hover:bg-brand-dark']));
  });

  it('line is the outlined button', () => {
    const classes = buttonClass({ variant: 'line' }).split(' ');
    expect(classes).toEqual(expect.arrayContaining(['border-line-2', 'bg-surface', 'text-ink', 'hover:border-ink']));
  });

  it('ghost is the outlined button for dark bands', () => {
    const classes = buttonClass({ variant: 'ghost' }).split(' ');
    expect(classes).toEqual(expect.arrayContaining(['border-white/28', 'text-white', 'hover:border-white', 'hover:bg-white/6']));
  });

  it('lineApp is LINE green with ink text, never white (R16)', () => {
    const classes = buttonClass({ variant: 'lineApp' }).split(' ');
    expect(classes).toEqual(expect.arrayContaining(['bg-line-app', 'text-ink', 'hover:bg-line-app-hover']));
    expect(classes).not.toContain('text-white');
  });

  it('lg and block add their classes, and md and the default add none', () => {
    const large = buttonClass({ variant: 'buy', size: 'lg', block: true }).split(' ');
    expect(large).toEqual(expect.arrayContaining(['min-h-[54px]', 'text-[17px]', 'w-full']));
    const plain = buttonClass({ variant: 'buy', size: 'md' }).split(' ');
    expect(plain).not.toContain('min-h-[54px]');
    expect(plain).not.toContain('w-full');
  });
});
