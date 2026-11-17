// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TOAST_DURATION_MS, TOAST_LEAVE_MS, ToastProvider, useToast, type ToastApi } from './Toast';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let api: ToastApi;
function Grab() {
  api = useToast();
  return null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <ToastProvider closeLabel="ปิด">
        <Grab />
      </ToastProvider>,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const liveRegion = () => document.querySelector<HTMLElement>('[role="status"][aria-live="polite"]');
const cards = () => [...document.querySelectorAll<HTMLElement>('[data-toast]')];
const front = () => cards().find((card) => card.dataset.toast === 'front');
const closeButton = (card: HTMLElement) => card.querySelector<HTMLButtonElement>('button[aria-label="ปิด"]')!;
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('Toast', () => {
  it('has one polite live region from the start, and puts each message in it', () => {
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(liveRegion()!.textContent).toBe('');
    act(() => api.success('บันทึกการตั้งค่าเรียบร้อยแล้ว'));
    expect(liveRegion()!.textContent).toContain('บันทึกการตั้งค่าเรียบร้อยแล้ว');
    expect(front()!.textContent).toContain('บันทึกการตั้งค่าเรียบร้อยแล้ว');
  });

  it('never takes focus', () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    act(() => api.success('saved'));
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('puts the newest in front, keeps at most two older ones behind, and keeps the older ones out of the tab order', () => {
    for (const message of ['one', 'two', 'three', 'four']) act(() => api.success(message));
    // Newest first in the page too, so a screen reader browsing the stack meets the latest message first.
    expect(cards().map((card) => card.textContent)).toEqual(['four', 'three', 'two']);
    expect(front()!.textContent).toBe('four');
    const behind = cards().filter((card) => card.dataset.toast !== 'front');
    expect(behind).toHaveLength(2);
    for (const card of behind) expect(card.hasAttribute('inert')).toBe(true);
    expect(front()!.hasAttribute('inert')).toBe(false);
  });

  it('dismisses itself after the duration, fading out before it is removed', () => {
    act(() => api.success('saved'));
    advance(TOAST_DURATION_MS - 1);
    expect(cards()).toHaveLength(1);
    advance(1);
    expect(front()!.dataset.leaving).toBe('true');
    advance(TOAST_LEAVE_MS);
    expect(cards()).toHaveLength(0);
    expect(liveRegion()).not.toBeNull();
  });

  it('pauses while the pointer is over it, and runs the rest of its time after', () => {
    act(() => api.success('saved'));
    advance(1000);
    const stack = front()!.parentElement!;
    // React draws enter and leave from over and out events; jsdom has no PointerEvent, so a MouseEvent carries the type.
    act(() => stack.dispatchEvent(new MouseEvent('pointerover', { bubbles: true, relatedTarget: document.body })));
    advance(TOAST_DURATION_MS * 2);
    expect(cards()).toHaveLength(1);
    expect(front()!.dataset.leaving).toBeUndefined();
    act(() => stack.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: document.body })));
    advance(TOAST_DURATION_MS - 1000 - 1);
    expect(front()!.dataset.leaving).toBeUndefined();
    advance(1 + TOAST_LEAVE_MS);
    expect(cards()).toHaveLength(0);
  });

  it('pauses while focus is inside it', () => {
    act(() => api.success('saved'));
    act(() => closeButton(front()!).focus());
    advance(TOAST_DURATION_MS * 2);
    expect(cards()).toHaveLength(1);
    act(() => closeButton(front()!).blur());
    advance(TOAST_DURATION_MS + TOAST_LEAVE_MS);
    expect(cards()).toHaveLength(0);
  });

  it('closes at once from its close button', () => {
    act(() => api.success('saved'));
    const button = closeButton(front()!);
    expect(button.type).toBe('button');
    act(() => button.click());
    advance(TOAST_LEAVE_MS);
    expect(cards()).toHaveLength(0);
  });

  it('does not leave the next toast paused when the last one is closed under the pointer', () => {
    act(() => api.success('first'));
    const stack = front()!.parentElement!;
    act(() => stack.dispatchEvent(new MouseEvent('pointerover', { bubbles: true, relatedTarget: document.body })));
    act(() => closeButton(front()!).click());
    advance(TOAST_LEAVE_MS);
    expect(cards()).toHaveLength(0);
    act(() => api.success('second'));
    advance(TOAST_DURATION_MS + TOAST_LEAVE_MS);
    expect(cards()).toHaveLength(0);
  });

  it('refuses to work outside a provider', () => {
    const lone = createRoot(document.createElement('div'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => act(() => lone.render(<Grab />))).toThrow('ToastProvider');
    spy.mockRestore();
  });
});
