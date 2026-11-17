// @vitest-environment jsdom
import { NextIntlClientProvider } from 'next-intl';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../../../../../../messages/en.json';
import th from '../../../../../../../messages/th.json';
import DateTimePicker from './DateTimePicker';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 07:03 UTC is 14:03 on Tuesday 17 November 2026 in Bangkok.
const NOW = new Date('2026-11-17T07:03:00Z');

function Harness({ locale, initial }: { locale: 'th' | 'en'; initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <NextIntlClientProvider locale={locale} messages={locale === 'th' ? th : en} timeZone="Asia/Bangkok">
      <form>
        <label id="publish-at-label" htmlFor="publish-at">
          when
        </label>
        <DateTimePicker id="publish-at" name="publishAt" labelId="publish-at-label" locale={locale} value={value} onChange={setValue} />
      </form>
      <p id="outside">elsewhere</p>
    </NextIntlClientProvider>
  );
}

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

async function mount(locale: 'th' | 'en', initial = '') {
  await act(async () => root.render(<Harness locale={locale} initial={initial} />));
}

const trigger = () => container.querySelector<HTMLButtonElement>('#publish-at')!;
const hidden = () => container.querySelector<HTMLInputElement>('input[type="hidden"][name="publishAt"]')!;
const dialog = () => container.querySelector<HTMLElement>('[role="dialog"]');
const day = (iso: string) => container.querySelector<HTMLButtonElement>(`[data-day="${iso}"] button`)!;
function timeButton(column: 'hour' | 'minute', text: string): HTMLButtonElement {
  const group = container.querySelector(`[role="group"][data-column="${column}"]`)!;
  return [...group.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === text)!;
}
async function click(element: HTMLElement) {
  await act(async () => element.click());
}

describe('DateTimePicker', () => {
  it('is closed at first, shows the placeholder and submits nothing', async () => {
    await mount('th');
    expect(dialog()).toBeNull();
    expect(trigger().type).toBe('button');
    expect(trigger().getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().textContent).toContain('เลือกวันและเวลา');
    expect(trigger().getAttribute('aria-labelledby')).toBe('publish-at-label publish-at');
    expect(hidden().value).toBe('');
  });

  it('opens on the current Bangkok month, with the Buddhist-era year in Thai', async () => {
    await mount('th');
    await click(trigger());
    expect(dialog()).not.toBeNull();
    expect(dialog()!.getAttribute('aria-label')).not.toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(dialog()!.textContent).toContain('พฤศจิกายน 2569');
    expect(dialog()!.textContent).toContain('อา.');
  });

  it('shows the Gregorian year in English', async () => {
    await mount('en');
    await click(trigger());
    expect(dialog()!.textContent).toContain('November 2026');
  });

  it('sets the value from a day, an hour and a minute, keeping the time when the day changes', async () => {
    await mount('en');
    await click(trigger());
    await click(day('2026-11-20'));
    expect(hidden().value).toBe('2026-11-20T09:00');
    await click(timeButton('hour', '15'));
    await click(timeButton('minute', '30'));
    expect(hidden().value).toBe('2026-11-20T15:30');
    expect(trigger().textContent).toContain('20 Nov 2026 · 15:30');
    expect(timeButton('hour', '15').getAttribute('aria-pressed')).toBe('true');
    await click(day('2026-11-25'));
    expect(hidden().value).toBe('2026-11-25T15:30');
  });

  it('writes the trigger in the Thai date style', async () => {
    await mount('th');
    await click(trigger());
    await click(day('2026-11-20'));
    expect(trigger().textContent).toContain('20 พ.ย. 2569 · 09:00');
  });

  it('disables days before today and, today, the times already past', async () => {
    await mount('en');
    await click(trigger());
    expect(day('2026-11-16').disabled).toBe(true);
    expect(day('2026-11-17').disabled).toBe(false);
    // No day yet: the time cannot be picked.
    expect(timeButton('hour', '15').disabled).toBe(true);
    await click(day('2026-11-17'));
    // 09:00 has passed today, so the first open slot is taken.
    expect(hidden().value).toBe('2026-11-17T14:05');
    expect(timeButton('hour', '13').disabled).toBe(true);
    expect(timeButton('hour', '14').disabled).toBe(false);
    expect(timeButton('minute', '00').disabled).toBe(true);
    expect(timeButton('minute', '05').disabled).toBe(false);
    await click(timeButton('hour', '16'));
    expect(timeButton('minute', '00').disabled).toBe(false);
    // Back to a later day: nothing is disabled.
    await click(day('2026-11-18'));
    expect(timeButton('hour', '00').disabled).toBe(false);
  });

  it('works in Bangkok time when the browser is in another zone', async () => {
    const zone = process.env.TZ;
    // 12:30 UTC: 19:30 on the 17th in Bangkok, already 01:30 on the 18th in Auckland.
    process.env.TZ = 'Pacific/Auckland';
    vi.setSystemTime(new Date('2026-11-17T12:30:00Z'));
    try {
      expect(new Date().getDate()).toBe(18);
      await mount('en');
      await click(trigger());
      expect(day('2026-11-16').disabled).toBe(true);
      expect(day('2026-11-17').disabled).toBe(false);
      await click(day('2026-11-17'));
      expect(hidden().value).toBe('2026-11-17T19:30');
      await click(day('2026-11-20'));
      await click(timeButton('hour', '08'));
      expect(hidden().value).toBe('2026-11-20T08:30');
      expect(trigger().textContent).toContain('20 Nov 2026 · 08:30');
    } finally {
      process.env.TZ = zone;
    }
  });

  it('closes on Escape and on a click outside, returning focus to the trigger', async () => {
    await mount('en');
    await click(trigger());
    expect(dialog()!.contains(document.activeElement)).toBe(true);
    await act(async () => {
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    await click(trigger());
    await act(async () => {
      container.querySelector('#outside')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('empties the value with Clear and closes with Done', async () => {
    await mount('en', '2026-12-28T09:00');
    await click(trigger());
    const buttons = [...dialog()!.querySelectorAll<HTMLButtonElement>('button')];
    await click(buttons.find((button) => button.textContent === 'Clear')!);
    expect(hidden().value).toBe('');
    expect(trigger().textContent).toContain('Pick a date and time');
    await click([...dialog()!.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Done')!);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('shows a stored value off the 5-minute grid and submits it unchanged', async () => {
    await mount('en', '2026-12-28T09:07');
    expect(hidden().value).toBe('2026-12-28T09:07');
    expect(trigger().textContent).toContain('28 Dec 2026 · 09:07');
    await click(trigger());
    expect(dialog()!.textContent).toContain('December 2026');
    expect(day('2026-12-28').closest('td')!.getAttribute('aria-selected')).toBe('true');
    expect(timeButton('minute', '07').getAttribute('aria-pressed')).toBe('true');
    await click([...dialog()!.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Done')!);
    expect(hidden().value).toBe('2026-12-28T09:07');
  });
});
