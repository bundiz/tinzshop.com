// @vitest-environment jsdom
import { act, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Drawer from './Drawer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Harness() {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={opener} id="opener" type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Edit user"
        closeLabel="Close"
        returnFocusRef={opener}
        footer={
          <button id="save" type="button">
            Save
          </button>
        }
      >
        <input id="field" />
      </Drawer>
    </>
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.style.overflow = '';
});

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const open = () => act(() => $('opener').click());
const key = (key: string, shiftKey = false) =>
  act(() => {
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
  });

describe('Drawer', () => {
  it('renders nothing while closed', () => {
    expect(dialog()).toBeNull();
  });

  it('is a modal dialog named by its title, in a portal, with the body and the footer', () => {
    open();
    const panel = dialog()!;
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(panel.getAttribute('aria-labelledby')!)!.textContent).toBe('Edit user');
    expect(container.contains(panel)).toBe(false);
    expect(panel.contains($('field'))).toBe(true);
    expect(panel.contains($('save'))).toBe(true);
    expect(panel.querySelector('button[aria-label="Close"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('moves focus in (the close button first) and keeps Tab inside', () => {
    open();
    const close = dialog()!.querySelector<HTMLElement>('button[aria-label="Close"]')!;
    expect(document.activeElement).toBe(close);
    key('Tab', true);
    expect(document.activeElement).toBe($('save'));
    key('Tab');
    expect(document.activeElement).toBe(close);
  });

  it('closes on Escape and returns focus to the opener', () => {
    open();
    key('Escape');
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe($('opener'));
    expect(document.body.style.overflow).toBe('');
  });

  it('closes with the close button and with a press on the scrim', () => {
    open();
    act(() => dialog()!.querySelector<HTMLElement>('button[aria-label="Close"]')!.click());
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe($('opener'));
    open();
    act(() => document.querySelector<HTMLElement>('[data-scrim]')!.click());
    expect(dialog()).toBeNull();
  });
});
