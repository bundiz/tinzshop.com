// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LISTING } from '../listing-url';
import {
  ListingCheck,
  ListingFilterPanel,
  ListingFilterPanelProvider,
  ListingFilterToggle,
  ListingPriceRange,
  ListingSortSelect,
} from './ListingControls';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LABELS = { min: 'ราคาต่ำสุด', max: 'ราคาสูงสุด', minPlaceholder: 'ต่ำสุด', maxPlaceholder: 'สูงสุด' };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  push.mockClear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (minBaht: number | null) =>
  act(() => root.render(<ListingPriceRange locale="th" active={{ ...DEFAULT_LISTING, minBaht }} labels={LABELS} />));

const minInput = () => container.querySelector<HTMLInputElement>('input[aria-label="ราคาต่ำสุด"]')!;

/** Types into a controlled input the way a browser does: set the value, then fire `input`. */
function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const pressEnter = (input: HTMLInputElement) =>
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });

describe('ListingPriceRange', () => {
  it('applies on Enter and keeps the same, focused input when the URL value changes', () => {
    render(null);
    const input = minInput();
    input.focus();
    type(input, '1500');
    pressEnter(input);
    expect(push).toHaveBeenCalledExactlyOnceWith('/th/product?min=1500', { scroll: false });

    // The new URL arrives: the input is resynced, not remounted, and keeps focus.
    render(1500);
    expect(minInput()).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('1500');

    // A change from elsewhere (back/forward) replaces what the input shows.
    render(200);
    expect(minInput()).toBe(input);
    expect(input.value).toBe('200');
  });

  it('applies a change once when Enter is followed by blur', () => {
    render(null);
    const input = minInput();
    input.focus();
    type(input, '900');
    pressEnter(input);
    act(() => input.blur());
    expect(push).toHaveBeenCalledOnce();
  });

  it('applies the same price again after the listing moved away and back', () => {
    render(null);
    const input = minInput();
    type(input, '500');
    pressEnter(input);
    expect(push).toHaveBeenLastCalledWith('/th/product?min=500', { scroll: false });

    // The new URL arrives, then a chip or ล้างทั้งหมด (a server link) removes the bound again.
    render(500);
    render(null);
    expect(input.value).toBe('');

    type(input, '500');
    pressEnter(input);
    expect(push).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenLastCalledWith('/th/product?min=500', { scroll: false });
  });

  it('puts an invalid entry back to the URL value without navigating', () => {
    render(1000);
    const input = minInput();
    type(input, '1.5');
    pressEnter(input);
    expect(push).not.toHaveBeenCalled();
    expect(input.value).toBe('1000');

    type(input, '');
    pressEnter(input);
    expect(push).toHaveBeenCalledExactlyOnceWith('/th/product', { scroll: false });
  });
});

/** A controllable `matchMedia`: `widen()` flips every query to matching and tells its listeners. */
function mockMatchMedia() {
  const listeners = new Set<() => void>();
  let matches = false;
  window.matchMedia = ((query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  })) as unknown as typeof window.matchMedia;
  return {
    widen: () =>
      act(() => {
        matches = true;
        listeners.forEach((listener) => listener());
      }),
  };
}

function Sheet({ checked = false, minBaht = null }: { checked?: boolean; minBaht?: number | null }) {
  return (
    <ListingFilterPanelProvider>
      <ListingFilterToggle label="ตัวกรอง" />
      <ListingFilterPanel label="ตัวกรองสินค้า" heading="ตัวกรอง" closeLabel="ปิดตัวกรอง" applyLabel="แสดง 5 รายการ">
        <ListingCheck label="มีสินค้า" checked={checked} href="/th/product?in_stock=1" />
        <ListingPriceRange locale="th" active={{ ...DEFAULT_LISTING, minBaht }} labels={LABELS} />
      </ListingFilterPanel>
    </ListingFilterPanelProvider>
  );
}

const toggle = () => container.querySelector<HTMLButtonElement>('button[aria-controls="listing-filters"]')!;
const panel = () => container.querySelector<HTMLElement>('#listing-filters')!;
const checkbox = () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
const openSheet = () => act(() => toggle().click());
const escape = () => act(() => void document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));

describe('the filter sheet below lg', () => {
  let media: ReturnType<typeof mockMatchMedia>;
  beforeEach(() => {
    media = mockMatchMedia();
  });

  it('the open sheet is a modal dialog; Escape closes it and focus returns to ตัวกรอง', () => {
    act(() => root.render(<Sheet />));
    expect(panel().getAttribute('role')).toBe('complementary');
    expect(panel().getAttribute('aria-modal')).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');

    openSheet();
    expect(panel().getAttribute('role')).toBe('dialog');
    expect(panel().getAttribute('aria-modal')).toBe('true');
    expect(panel().className).toMatch(/(^| )block( |$)/);
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(panel().contains(document.activeElement)).toBe(true);

    escape();
    expect(panel().getAttribute('role')).toBe('complementary');
    expect(panel().className).toMatch(/(^| )hidden( |$)/);
    expect(document.activeElement).toBe(toggle());
  });

  it('a checkbox change inside the open sheet keeps it open and keeps focus', () => {
    act(() => root.render(<Sheet />));
    openSheet();
    checkbox().focus();
    act(() => checkbox().click());
    expect(push).toHaveBeenCalledExactlyOnceWith('/th/product?in_stock=1', { scroll: false });

    // The server re-renders with the new URL: same elements, still open, focus still on the box.
    const box = checkbox();
    act(() => root.render(<Sheet checked />));
    expect(checkbox()).toBe(box);
    expect(box.checked).toBe(true);
    expect(panel().getAttribute('role')).toBe('dialog');
    expect(document.activeElement).toBe(box);
  });

  it('the price input keeps focus after Enter inside the sheet', () => {
    act(() => root.render(<Sheet />));
    openSheet();
    const input = minInput();
    input.focus();
    type(input, '2500');
    pressEnter(input);
    expect(push).toHaveBeenCalledExactlyOnceWith('/th/product?min=2500', { scroll: false });
    act(() => root.render(<Sheet minBaht={2500} />));
    expect(minInput()).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(panel().getAttribute('role')).toBe('dialog');
  });

  it('widening past lg closes the sheet and drops the dialog role', () => {
    act(() => root.render(<Sheet />));
    openSheet();
    expect(panel().getAttribute('role')).toBe('dialog');
    media.widen();
    expect(panel().getAttribute('role')).toBe('complementary');
    expect(panel().getAttribute('aria-modal')).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(document.body.style.overflow).toBe('');
  });

  it('แสดง N รายการ closes the sheet', () => {
    act(() => root.render(<Sheet />));
    openSheet();
    const apply = [...panel().querySelectorAll('button')].find((button) => button.textContent === 'แสดง 5 รายการ')!;
    act(() => apply.click());
    expect(panel().getAttribute('role')).toBe('complementary');
    expect(document.activeElement).toBe(toggle());
  });

  it('the close button closes the sheet', () => {
    act(() => root.render(<Sheet />));
    openSheet();
    act(() => panel().querySelector<HTMLButtonElement>('button[aria-label="ปิดตัวกรอง"]')!.click());
    expect(panel().getAttribute('role')).toBe('complementary');
  });
});

describe('ListingSortSelect (D-258)', () => {
  const SORTS = { recommended: 'แนะนำ', best_selling: 'ขายดี', newest: 'มาใหม่', price_asc: 'ราคาต่ำไปสูง', price_desc: 'ราคาสูงไปต่ำ' };

  it('is the themed list, named by its label, and navigates without scrolling on a choice', () => {
    act(() => root.render(<ListingSortSelect locale="th" active={{ ...DEFAULT_LISTING, category: 'playstation-5' }} label="เรียงตาม" options={SORTS} />));
    expect(container.querySelector('select')).toBeNull();
    const trigger = container.querySelector<HTMLButtonElement>('[role="combobox"]')!;
    expect(trigger.getAttribute('aria-label')).toBe('เรียงตาม');
    expect(trigger.textContent).toContain('แนะนำ');
    act(() => trigger.click());
    expect([...document.querySelectorAll('[role="option"]')].map((option) => option.textContent)).toEqual(Object.values(SORTS));
    act(() => document.querySelectorAll<HTMLElement>('[role="option"]')[3]!.click());
    expect(push).toHaveBeenCalledExactlyOnceWith('/th/product?category=playstation-5&sort=price_asc', { scroll: false });
  });
});
