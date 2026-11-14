// @vitest-environment jsdom
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import th from '../../../../../messages/th.json';
import AccountMenu from './AccountMenu';

vi.mock('../(auth)/actions', () => ({ signOutAction: async () => {} }));

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
        <button id="elsewhere">elsewhere</button>
        <AccountMenu firstName="Tester" />
      </NextIntlClientProvider>,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const toggle = () => container.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
const panel = () => document.getElementById(toggle().getAttribute('aria-controls')!)!;

describe('AccountMenu', () => {
  it('starts closed, and the toggle opens and closes the sign-out panel', () => {
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(panel().hidden).toBe(true);
    act(() => toggle().click());
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(panel().hidden).toBe(false);
    expect(panel().textContent).toContain('ออกจากระบบ');
    act(() => toggle().click());
    expect(panel().hidden).toBe(true);
  });

  it('the button shows สวัสดี คุณ{name} and บัญชีของฉัน', () => {
    expect(toggle().textContent).toContain('สวัสดี คุณTester');
    expect(toggle().textContent).toContain('บัญชีของฉัน');
    expect(toggle().getAttribute('aria-label')).toBe('บัญชีของ Tester');
  });

  it('closes on Escape and gives focus back to the button', () => {
    act(() => toggle().click());
    const signOut = panel().querySelector<HTMLButtonElement>('button[type="submit"]')!;
    act(() => signOut.focus());
    act(() => {
      signOut.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(panel().hidden).toBe(true);
    expect(document.activeElement).toBe(toggle());
  });

  it('closes on Escape when focus is elsewhere on the page', () => {
    act(() => toggle().click());
    act(() => document.getElementById('elsewhere')!.focus());
    // A mouse click does not move focus into the menu, so it is still open while focus is elsewhere.
    expect(panel().hidden).toBe(false);
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(panel().hidden).toBe(true);
  });

  it('closes on a press outside, and stays open on a press inside', () => {
    act(() => toggle().click());
    act(() => {
      panel().dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(panel().hidden).toBe(false);
    act(() => {
      document.getElementById('elsewhere')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(panel().hidden).toBe(true);
  });

  it('closes when focus moves out of the menu', () => {
    act(() => toggle().click());
    act(() => toggle().focus());
    act(() => document.getElementById('elsewhere')!.focus());
    expect(panel().hidden).toBe(true);
  });
});
