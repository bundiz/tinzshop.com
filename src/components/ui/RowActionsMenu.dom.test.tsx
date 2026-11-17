// @vitest-environment jsdom
import { act, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RowActionsMenu, { type RowAction } from './RowActionsMenu';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const edit = vi.fn();
const block = vi.fn();
const ITEMS: RowAction[] = [
  { key: 'edit', label: 'Edit', icon: 'edit', onSelect: edit },
  { key: 'open', label: 'Open', icon: 'chevRight', href: '#open' },
  { key: 'block', label: 'Block', icon: 'lock', tone: 'danger', onSelect: block },
];

const render = (items: RowAction[] = ITEMS) =>
  act(() =>
    root.render(
      <>
        <button type="button" id="before">
          before
        </button>
        <RowActionsMenu label="Manage Somchai" items={items} />
        <button type="button" id="outside">
          outside
        </button>
      </>,
    ),
  );
const trigger = () => container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
const menu = () => document.querySelector<HTMLElement>('[role="menu"]');
const items = () => [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
const key = (target: Element, key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
  });

describe('RowActionsMenu', () => {
  it('is a menu button named for its row, closed until pressed', () => {
    render();
    expect(trigger().getAttribute('aria-label')).toBe('Manage Somchai');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().getAttribute('type')).toBe('button');
    expect(menu()).toBeNull();
  });

  it('opens on a click into a portal with every item as a menuitem, focus on the first', () => {
    render();
    act(() => trigger().click());
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(menu()).not.toBeNull();
    expect(container.contains(menu())).toBe(false);
    expect(trigger().getAttribute('aria-controls')).toBe(menu()!.id);
    expect(menu()!.getAttribute('aria-label')).toBe('Manage Somchai');
    expect(items().map((item) => item.textContent)).toEqual(['Edit', 'Open', 'Block']);
    expect(document.activeElement).toBe(items()[0]);
    for (const item of items()) expect(item.getAttribute('tabindex')).toBe('-1');
    expect(items()[1]!.tagName).toBe('A');
    expect(items()[1]!.getAttribute('href')).toBe('#open');
    expect(items()[0]!.querySelector('svg')).not.toBeNull();
  });

  it('draws a danger item in the sale red, icon included', () => {
    render();
    act(() => trigger().click());
    expect(items()[2]!.className).toContain('text-sale');
    expect(items()[0]!.className).not.toContain('text-sale');
  });

  it('opens on Enter, Space and ArrowDown at the first item, and on ArrowUp at the last', () => {
    render();
    for (const opener of ['Enter', ' ', 'ArrowDown']) {
      key(trigger(), opener);
      expect(document.activeElement).toBe(items()[0]);
      key(document.activeElement!, 'Escape');
      expect(menu()).toBeNull();
    }
    key(trigger(), 'ArrowUp');
    expect(document.activeElement).toBe(items()[2]);
  });

  it('moves with the arrows (wrapping), Home and End', () => {
    render();
    key(trigger(), 'ArrowDown');
    key(document.activeElement!, 'ArrowDown');
    expect(document.activeElement).toBe(items()[1]);
    key(document.activeElement!, 'End');
    expect(document.activeElement).toBe(items()[2]);
    key(document.activeElement!, 'ArrowDown');
    expect(document.activeElement).toBe(items()[0]);
    key(document.activeElement!, 'ArrowUp');
    expect(document.activeElement).toBe(items()[2]);
    key(document.activeElement!, 'Home');
    expect(document.activeElement).toBe(items()[0]);
  });

  it('activates an item with Enter or Space, closes, and puts focus back on the button', () => {
    edit.mockClear();
    block.mockClear();
    render();
    key(trigger(), 'ArrowDown');
    key(document.activeElement!, 'Enter');
    expect(edit).toHaveBeenCalledTimes(1);
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    key(trigger(), 'ArrowUp');
    key(document.activeElement!, ' ');
    expect(block).toHaveBeenCalledTimes(1);
    expect(menu()).toBeNull();
  });

  it('activates an item on a click', () => {
    edit.mockClear();
    render();
    act(() => trigger().click());
    act(() => items()[0]!.click());
    expect(edit).toHaveBeenCalledTimes(1);
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('closes on Escape and on Tab, focus back on the button, nothing chosen', () => {
    edit.mockClear();
    render();
    act(() => trigger().click());
    key(document.activeElement!, 'Escape');
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    act(() => trigger().click());
    key(document.activeElement!, 'Tab');
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(edit).not.toHaveBeenCalled();
  });

  it('does not let its Escape reach a dialog around it', () => {
    const outer = vi.fn();
    render();
    document.addEventListener('keydown', outer);
    act(() => trigger().click());
    key(document.activeElement!, 'Escape');
    document.removeEventListener('keydown', outer);
    expect(outer.mock.calls.every(([event]) => (event as KeyboardEvent).defaultPrevented)).toBe(true);
  });

  it('closes on a press outside, and a second click on the button closes it', () => {
    render();
    act(() => trigger().click());
    act(() => {
      document.getElementById('outside')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });
    expect(menu()).toBeNull();
    act(() => trigger().click());
    act(() => trigger().click());
    expect(menu()).toBeNull();
  });

  it('hands its button to the caller, so a dialog an item opens can return focus there', () => {
    function Harness() {
      const button = useRef<HTMLButtonElement>(null);
      const [returned, setReturned] = useState('');
      return (
        <>
          <RowActionsMenu
            label="Manage"
            buttonRef={button}
            items={[{ key: 'x', label: 'X', icon: 'edit', onSelect: () => setReturned(button.current?.getAttribute('aria-label') ?? '') }]}
          />
          <output id="returned">{returned}</output>
        </>
      );
    }
    act(() => root.render(<Harness />));
    act(() => trigger().click());
    act(() => items()[0]!.click());
    expect(document.getElementById('returned')!.textContent).toBe('Manage');
  });
});
