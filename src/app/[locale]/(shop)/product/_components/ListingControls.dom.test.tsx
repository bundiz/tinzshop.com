// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LISTING } from '../listing-url';
import { ListingPriceRange } from './ListingControls';

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
