'use client';

import { createContext, useEffect, useRef, useState } from 'react';

import { MAX_EMBED_WIDTH, MIN_EMBED_WIDTH } from '@/server/adapters/wordpress/sanitize';

/**
 * Whether the body is read-only (R13, R14). `RichTextEditor` provides it: the lock is decided after the node views are
 * first drawn and `setEditable` alone does not redraw them, so a node view reads this to drop its resize handle.
 */
export const BodyLockedContext = createContext(false);

/** One arrow-key step of the resize handle, in percent. */
const EMBED_WIDTH_STEP = 5;

/** A width in percent of the column, rounded to a whole number and kept from 40 to 100. */
export function clampEmbedWidth(value: number): number {
  return Math.min(MAX_EMBED_WIDTH, Math.max(MIN_EMBED_WIDTH, Math.round(value)));
}

/** A node's `width` attribute as the width it is drawn at: 40 to 99, or 100 when it has none (D-273). */
export function embedWidthOf(attribute: unknown): number {
  return typeof attribute === 'number' && Number.isInteger(attribute) && attribute >= MIN_EMBED_WIDTH && attribute < MAX_EMBED_WIDTH
    ? attribute
    : MAX_EMBED_WIDTH;
}

/** The style of a card's or a video's frame at a width: centred, or nothing at full width (D-273). */
export function embedFrameStyle(width: number): { width: string; marginInline: string } | undefined {
  return width < MAX_EMBED_WIDTH ? { width: `${width}%`, marginInline: 'auto' } : undefined;
}

// A 14px brand square on the frame's bottom-right corner, with a 44px hit area below `sm` (D-221). Revealed like the
// card's remove button: on hover, focus inside the frame or selection, and always on a screen with no hover.
const HANDLE =
  'absolute -right-1.5 -bottom-1.5 z-20 size-3.5 cursor-nwse-resize touch-none rounded-[4px] border-2 border-surface bg-brand shadow-1 transition-opacity duration-[130ms] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand max-sm:after:absolute max-sm:after:-inset-[15px]';
const HANDLE_HIDDEN =
  'pointer-events-none opacity-0 group-hover/embed:pointer-events-auto group-hover/embed:opacity-100 group-focus-within/embed:pointer-events-auto group-focus-within/embed:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100';

const ARROWS: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 };

/**
 * The corner handle that resizes a product card or a top-level YouTube video (D-273), or an uploaded image alone in a
 * top-level paragraph (D-283), in the news editor. It sits as a direct child of the node view's frame (`NodeViewWrapper`);
 * the column it measures against is the node's own block, as wide as the writing area (the frame's parent), or what
 * `columnOf` returns (an image's paragraph). A drag moves the frame's right edge with the pointer while the frame stays
 * centred: the width changes by twice the pointer's travel, from the width the frame had when the drag began (measured,
 * so an image drawn smaller than the column at 100% does not jump), as a whole-number percentage from 40 to 100, drawn
 * live through `onDraft` with a readout, and committed once on release through `onCommit` (one transaction, one undo
 * step). It is a `slider`: the
 * arrow keys step 5%, Home and End go to 40% and 100%. Its events are handled on the element itself and stopped there,
 * so ProseMirror never sees the press and never starts the node's drag-to-move; a native `dragstart` during the
 * gesture is cancelled too.
 */
export default function EmbedResizeHandle({
  label,
  width,
  selected,
  onDraft,
  onCommit,
  columnOf,
}: {
  label: string;
  /** The stored width, 40 to 100. */
  width: number;
  selected: boolean;
  /** The width to draw while dragging, or null when the drag ends. */
  onDraft: (width: number | null) => void;
  /** The new width, 40 to 100, once per change. */
  onCommit: (width: number) => void;
  /** The element whose width is 100%; by default the frame's parent. */
  columnOf?: (handle: HTMLElement) => Element | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const latest = useRef({ width, onDraft, onCommit, columnOf });
  useEffect(() => {
    latest.current = { width, onDraft, onCommit, columnOf };
  });

  useEffect(() => {
    const handle = ref.current;
    if (handle === null) return;
    let gesture: { pointerId: number | undefined; column: DOMRect; startX: number; startWidth: number; width: number } | null = null;
    const cancelDrag = (event: Event) => event.preventDefault();
    const stop = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const end = (commit: boolean) => (event: PointerEvent) => {
      if (gesture === null) return;
      stop(event);
      const { pointerId, width: next } = gesture;
      gesture = null;
      if (pointerId !== undefined && handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
      window.removeEventListener('dragstart', cancelDrag, true);
      setDragging(null);
      latest.current.onDraft(null);
      if (commit && next !== latest.current.width) latest.current.onCommit(next);
    };
    const listeners: [string, (event: never) => void][] = [
      [
        'pointerdown',
        (event: PointerEvent) => {
          if (event.button !== 0) return;
          stop(event);
          const columnOf = latest.current.columnOf ?? ((element: HTMLElement) => element.parentElement?.parentElement ?? null);
          const column = columnOf(handle)?.getBoundingClientRect();
          if (column === undefined) return;
          const frame = handle.parentElement?.getBoundingClientRect().width ?? 0;
          const startWidth = frame > 0 && column.width > 0 ? (frame / column.width) * 100 : latest.current.width;
          gesture = { pointerId: event.pointerId, column, startX: event.clientX, startWidth, width: latest.current.width };
          if (event.pointerId !== undefined) handle.setPointerCapture?.(event.pointerId);
          window.addEventListener('dragstart', cancelDrag, true);
          handle.focus({ preventScroll: true });
          setDragging(gesture.width);
        },
      ],
      [
        'pointermove',
        (event: PointerEvent) => {
          if (gesture === null) return;
          stop(event);
          const { column, startX, startWidth } = gesture;
          if (column.width <= 0) return;
          gesture.width = clampEmbedWidth(startWidth + ((2 * (event.clientX - startX)) / column.width) * 100);
          setDragging(gesture.width);
          latest.current.onDraft(gesture.width);
        },
      ],
      ['pointerup', end(true)],
      ['pointercancel', end(false)],
      ['mousedown', stop],
      ['mouseup', stop],
      ['click', stop],
      ['touchstart', (event: TouchEvent) => event.stopPropagation()],
      [
        'keydown',
        (event: KeyboardEvent) => {
          const now = latest.current.width;
          const step = ARROWS[event.key];
          const next = step !== undefined ? now + step * EMBED_WIDTH_STEP : event.key === 'Home' ? MIN_EMBED_WIDTH : event.key === 'End' ? MAX_EMBED_WIDTH : null;
          if (next === null) return;
          stop(event);
          const clamped = clampEmbedWidth(next);
          if (clamped !== now) latest.current.onCommit(clamped);
        },
      ],
    ];
    for (const [type, listener] of listeners) handle.addEventListener(type, listener as EventListener);
    return () => {
      for (const [type, listener] of listeners) handle.removeEventListener(type, listener as EventListener);
      window.removeEventListener('dragstart', cancelDrag, true);
    };
  }, []);

  const value = dragging ?? width;
  return (
    <>
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={label}
        title={label}
        aria-orientation="horizontal"
        aria-valuemin={MIN_EMBED_WIDTH}
        aria-valuemax={MAX_EMBED_WIDTH}
        aria-valuenow={value}
        aria-valuetext={`${value}%`}
        draggable={false}
        data-resize-handle=""
        className={`${HANDLE} ${selected || dragging !== null ? '' : HANDLE_HIDDEN}`}
      />
      {dragging !== null ? (
        <span aria-hidden="true" className="pointer-events-none absolute right-4 bottom-4 z-20 rounded-sm bg-ink px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums shadow-1">
          {dragging}%
        </span>
      ) : null}
    </>
  );
}
