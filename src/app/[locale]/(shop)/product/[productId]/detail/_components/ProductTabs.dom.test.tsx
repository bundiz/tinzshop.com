// @vitest-environment jsdom
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import th from '../../../../../../../../messages/th.json';
import ProductTabs from './ProductTabs';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
        <ProductTabs description="d" brandName="NoBrand" shippingSizeTier="large" />
      </NextIntlClientProvider>,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ProductTabs keyboard', () => {
  it('arrow keys move between the four tabs and wrap around', () => {
    const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs).toHaveLength(4);
    tabs[0]!.focus();
    for (let step = 1; step <= 3; step += 1) {
      act(() => {
        document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      });
      expect(document.activeElement).toBe(tabs[step]);
      expect(tabs[step]!.getAttribute('aria-selected')).toBe('true');
    }
    act(() => {
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(document.activeElement).toBe(tabs[0]);
  });
});
