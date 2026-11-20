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
    // The outline must show: no transparent border may sit beside it, since the later rule in the stylesheet would win.
    expect(classes).not.toContain('border-transparent');
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

  it("danger is the admin mockup's `.btn-danger`: sale red with white text, for a destructive confirm", () => {
    const classes = buttonClass({ variant: 'danger', size: 'admin' }).split(' ');
    expect(classes).toEqual(expect.arrayContaining(['bg-sale', 'text-white', 'hover:bg-[#b42318]']));
  });

  it('lg and block add their classes, and md and the default add none', () => {
    const large = buttonClass({ variant: 'buy', size: 'lg', block: true }).split(' ');
    expect(large).toEqual(expect.arrayContaining(['min-h-[54px]', 'text-[17px]', 'w-full']));
    const plain = buttonClass({ variant: 'buy', size: 'md' }).split(' ');
    expect(plain).not.toContain('min-h-[54px]');
    expect(plain).not.toContain('w-full');
  });

  it('md and lg keep the storefront class sets they had before the back-office sizes (D-257)', () => {
    const sorted = (value: string) => value.split(' ').sort().join(' ');
    const before =
      'inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border-[1.5px] border-transparent px-[22px] font-body text-base leading-none font-semibold whitespace-nowrap transition-[transform,background-color,border-color,box-shadow] duration-[180ms] ease-soft hover:-translate-y-px active:translate-y-px active:scale-[.985] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100';
    const brand = 'bg-brand text-white hover:bg-brand-dark';
    expect(sorted(buttonClass({ variant: 'brand' }))).toBe(sorted(`${before} ${brand}`));
    expect(sorted(buttonClass({ variant: 'brand', size: 'lg' }))).toBe(sorted(`${before} ${brand} min-h-[54px] text-[17px]`));
  });

  describe('back-office sizes (the admin mockup, D-257)', () => {
    it("admin is the mockup's `.adm .btn`: 42px from sm and 44px below it, 16px sides, 15px text, 9px corners", () => {
      const classes = buttonClass({ variant: 'line', size: 'admin' }).split(' ');
      expect(classes).toEqual(expect.arrayContaining(['min-h-11', 'sm:min-h-[42px]', 'px-4', 'text-[15px]', 'rounded-[9px]']));
      for (const storefront of ['min-h-12', 'px-[22px]', 'text-base', 'rounded-sm']) expect(classes).not.toContain(storefront);
    });

    it("adminSm is the mockup's `.btn-sm`: 34px, 12px sides, 14px text, with a 44px tap target below sm (D-221)", () => {
      const classes = buttonClass({ variant: 'line', size: 'adminSm' }).split(' ');
      expect(classes).toEqual(expect.arrayContaining(['min-h-[34px]', 'px-3', 'text-sm', 'rounded-[9px]', 'relative']));
      // 34px drawn, plus 5px above and below = 44px to tap on a phone; the pseudo-element exists only below sm.
      expect(classes).toEqual(expect.arrayContaining(['max-sm:after:absolute', 'max-sm:after:inset-x-0', 'max-sm:after:-inset-y-[5px]']));
      for (const storefront of ['min-h-12', 'min-h-11', 'px-[22px]', 'text-base', 'rounded-sm']) expect(classes).not.toContain(storefront);
    });

    it('keeps the variant colours and the shared shape', () => {
      const classes = buttonClass({ variant: 'buy', size: 'admin' }).split(' ');
      expect(classes).toEqual(expect.arrayContaining(['inline-flex', 'border-[1.5px]', 'font-semibold', 'bg-accent', 'text-ink']));
    });
  });

  it('makes a disabled button look disabled, on every variant and size', () => {
    for (const variant of ['buy', 'brand', 'line', 'ghost', 'lineApp', 'danger'] as const) {
      const classes = buttonClass({ variant, size: 'admin' }).split(' ');
      expect(classes).toEqual(expect.arrayContaining(['disabled:cursor-not-allowed', 'disabled:opacity-50']));
    }
  });
});
