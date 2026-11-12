// @vitest-environment jsdom
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import th from '../../../../../messages/th.json';
import MobileMenu, { type MobileMenuProps } from './MobileMenu';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NAV: MobileMenuProps['navItems'] = [
  { label: 'หน้าแรก', href: '/th', isCurrent: true },
  { label: 'PlayStation 5', href: '/th/product?category=playstation-5', isCurrent: false },
  { label: 'สินค้าลดราคา', href: '#', isCurrent: false, isSale: true },
];

let container: HTMLDivElement;
let root: Root;

function mount(signedIn: boolean) {
  act(() =>
    root.render(
      <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
        <MobileMenu navItems={NAV} signedIn={signedIn} otherLocaleHref="/en" otherLocaleName="English" />
      </NextIntlClientProvider>,
    ),
  );
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  mount(false);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.style.overflow = '';
});

const button = () => container.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
const dialog = () => document.getElementById(button().getAttribute('aria-controls')!)!;
const press = (key: string, shiftKey = false) =>
  act(() => {
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
  });

describe('MobileMenu', () => {
  it('opens as a modal dialog and focuses its first link', () => {
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(dialog().getAttribute('role')).toBeNull();
    act(() => button().click());
    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(dialog().getAttribute('role')).toBe('dialog');
    expect(dialog().getAttribute('aria-modal')).toBe('true');
    expect(dialog().getAttribute('aria-label')).toBe('เมนู');
    expect(document.activeElement).toBe(dialog().querySelector('a'));
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Tinzshop หน้าแรก');
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('keeps Tab inside and closes on Escape, returning focus to the menu button', () => {
    act(() => button().click());
    const items = [...dialog().querySelectorAll<HTMLElement>('a[href], button')];
    act(() => items[items.length - 1]!.focus());
    press('Tab');
    expect(document.activeElement).toBe(items[0]);
    press('Tab', true);
    expect(document.activeElement).toBe(items[items.length - 1]);
    press('Escape');
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(dialog().getAttribute('role')).toBeNull();
    expect(document.activeElement).toBe(button());
    expect(document.body.style.overflow).toBe('');
  });

  it('closes with its close button, returning focus to the menu button', () => {
    act(() => button().click());
    act(() => dialog().querySelector<HTMLButtonElement>('button[aria-label="ปิดเมนู"]')!.click());
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button());
  });

  it('shows the sign-in entry only when signed out', () => {
    expect(dialog().querySelector('a[href="/th/sign-in"]')?.textContent).toBe('เข้าสู่ระบบ / สมัครสมาชิก');
    mount(true);
    expect(dialog().querySelector('a[href="/th/sign-in"]')).toBeNull();
    expect(dialog().textContent).not.toContain('เข้าสู่ระบบ / สมัครสมาชิก');
  });

  it('lists the nav entries, the other language and the shop rows', () => {
    const text = dialog().textContent!;
    for (const label of ['หน้าแรก', 'PlayStation 5', 'สินค้าลดราคา', 'คำสั่งซื้อของฉัน', 'ติดต่อเรื่องคืนสินค้า ประกัน หรือเคลม', 'English']) {
      expect(text).toContain(label);
    }
    expect(dialog().querySelector('a[hreflang="en"]')?.getAttribute('href')).toBe('/en');
    expect(dialog().querySelector('a[aria-current="page"]')?.textContent).toBe('หน้าแรก');
  });

  it('its LINE button is inert, with ink text', () => {
    const line = [...dialog().querySelectorAll('a')].find((a) => a.textContent === 'แชทกับร้านทาง LINE')!;
    expect(line.getAttribute('href')).toBe('#');
    expect(line.className).toContain('bg-line-app');
    expect(line.className).toContain('text-ink');
    expect(line.className).not.toContain('text-white');
  });
});
