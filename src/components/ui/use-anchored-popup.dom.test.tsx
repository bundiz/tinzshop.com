// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAnchoredPopup } from './use-anchored-popup';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let rect = { top: 100, bottom: 144, left: 40, width: 200 };
const realHeight = window.innerHeight;
const realWidth = window.innerWidth;

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  setViewport(1024, 768);
  rect = { top: 100, bottom: 144, left: 40, width: 200 };
  vi.spyOn(HTMLButtonElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ ...rect, right: rect.left + rect.width, height: rect.bottom - rect.top, x: rect.left, y: rect.top, toJSON: () => ({}) }) as DOMRect,
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  setViewport(realWidth, realHeight);
});

function Harness({ open, sizeToMax = false }: { open: boolean; sizeToMax?: boolean }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  useAnchoredPopup({ open, anchorRef: anchor, popupRef: popup, maxHeight: 280, sizeToMax });
  return (
    <>
      <button ref={anchor} type="button">
        anchor
      </button>
      {open
        ? createPortal(
            <div ref={popup} data-popup="" style={{ position: 'fixed' }}>
              <div data-inner="" />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

const popup = () => document.querySelector<HTMLElement>('[data-popup]')!;
const render = (node: React.ReactNode) => act(() => root.render(node));

describe('useAnchoredPopup', () => {
  it('places the popup 6px below the anchor, at least as wide, capped to the room below', () => {
    render(<Harness open />);
    expect(popup().style.top).toBe('150px');
    expect(popup().style.bottom).toBe('');
    expect(popup().style.minWidth).toBe('200px');
    expect(popup().style.left).toBe('40px');
    expect(popup().style.maxHeight).toBe('280px');
  });

  it('flips above the anchor when a full-height popup does not fit below, capped to the room above', () => {
    rect = { top: 700, bottom: 744, left: 40, width: 200 };
    render(<Harness open sizeToMax />);
    expect(popup().style.top).toBe('');
    expect(popup().style.bottom).toBe(`${768 - 700 + 6}px`);
    expect(popup().style.maxHeight).toBe('280px');
  });

  it('measures the popup itself unless told to size to the maximum (an empty popup fits below)', () => {
    rect = { top: 700, bottom: 744, left: 40, width: 200 };
    render(<Harness open />);
    expect(popup().style.top).toBe('750px');
    expect(popup().style.maxHeight).toBe(`${768 - 744 - 6 - 8}px`);
  });

  it('keeps the popup inside the viewport on the right', () => {
    rect = { top: 100, bottom: 144, left: 1000, width: 200 };
    render(<Harness open />);
    expect(popup().style.left).toBe(`${1024 - 8 - 200}px`);
  });

  it('re-places on resize and on a page scroll, but not on a scroll inside the popup', () => {
    render(<Harness open />);
    rect = { top: 300, bottom: 344, left: 40, width: 200 };
    act(() => {
      popup().querySelector('[data-inner]')!.dispatchEvent(new Event('scroll'));
    });
    expect(popup().style.top).toBe('150px');
    act(() => {
      document.dispatchEvent(new Event('scroll'));
    });
    expect(popup().style.top).toBe('350px');
    rect = { top: 400, bottom: 444, left: 40, width: 200 };
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(popup().style.top).toBe('450px');
  });

  it('stops listening once closed', () => {
    render(<Harness open />);
    render(<Harness open={false} />);
    expect(document.querySelector('[data-popup]')).toBeNull();
    expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow();
  });
});
