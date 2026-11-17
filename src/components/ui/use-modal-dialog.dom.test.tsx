// @vitest-environment jsdom
import { act, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useModalDialog } from './use-modal-dialog';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Harness() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  useModalDialog({ open, onClose: () => setOpen(false), containerRef: container, returnFocusRef: opener });
  return (
    <>
      <button ref={opener} id="opener" type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <div ref={container} id="dialog" hidden={!open}>
        <a id="first" href="#a">
          first
        </a>
        <button id="middle" type="button">
          middle
        </button>
        <button id="last" type="button">
          last
        </button>
      </div>
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
const key = (key: string, shiftKey = false) =>
  act(() => {
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
  });

describe('useModalDialog', () => {
  it('does nothing while closed', () => {
    expect(document.activeElement).toBe(document.body);
    expect(document.body.style.overflow).toBe('');
  });

  it('moves focus to the first focusable element and stops the page scrolling', () => {
    act(() => $('opener').click());
    expect(document.activeElement).toBe($('first'));
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('wraps Tab and Shift+Tab inside', () => {
    act(() => $('opener').click());
    act(() => $('last').focus());
    key('Tab');
    expect(document.activeElement).toBe($('first'));
    key('Tab', true);
    expect(document.activeElement).toBe($('last'));
  });

  it('pulls focus back in when it is outside the dialog', () => {
    act(() => $('opener').click());
    act(() => $('opener').focus());
    key('Tab');
    expect(document.activeElement).toBe($('first'));
  });

  it('closes on Escape, returns focus to the opener and lets the page scroll again', () => {
    act(() => $('opener').click());
    key('Escape');
    expect($('dialog').hidden).toBe(true);
    expect(document.activeElement).toBe($('opener'));
    expect(document.body.style.overflow).toBe('');
  });

  it('leaves Escape to a control inside that already handled it (an open dropdown closes, the dialog stays)', () => {
    act(() => $('opener').click());
    const handled = (event: KeyboardEvent) => {
      if (event.key === 'Escape') event.preventDefault();
    };
    $('middle').addEventListener('keydown', handled);
    act(() => $('middle').focus());
    key('Escape');
    $('middle').removeEventListener('keydown', handled);
    expect($('dialog').hidden).toBe(false);
  });
});
