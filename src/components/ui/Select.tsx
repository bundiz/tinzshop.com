'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

import Icon from './Icon';

export type SelectOption = { value: string; label: string; disabled?: boolean };

/**
 * `md` is the storefront's and a form's 44px `.select`; `compact` the back-office filter bar's 42px (`.fbar .select`);
 * `small` a table row's 34px (`.bulk .select`); `toolbar` the news editor's 38px block type (`.ed-block`). Below `sm`
 * every size gives a 44px tap target (D-221).
 */
export type SelectSize = 'md' | 'compact' | 'small' | 'toolbar';

export type SelectProps = {
  options: readonly SelectOption[];
  /** Controlled: the chosen value. Leave out and use `defaultValue` for an uncontrolled select. */
  value?: string;
  defaultValue?: string;
  /** Called with the new value when a different option is chosen. */
  onChange?: (value: string) => void;
  /** The hidden input's name: a form posts the value under it, as it would a native select's. */
  name?: string;
  /** The trigger's id, for a `<label htmlFor>`. */
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  size?: SelectSize;
  disabled?: boolean;
  /** Extra classes on the trigger (width, margins). */
  className?: string;
};

const MAX_HEIGHT = 280;
const GAP = 6;
const MARGIN = 8;
const TYPEAHEAD_MS = 500;

const BASE =
  'relative inline-flex max-w-full min-w-0 cursor-pointer items-center rounded-sm border-[1.5px] bg-surface text-left text-ink transition-colors enabled:hover:border-ink focus-visible:border-ink aria-expanded:border-ink disabled:cursor-not-allowed disabled:opacity-40';

const SIZE: Record<SelectSize, string> = {
  md: 'min-h-11 gap-3 border-line-2 pr-3 pl-3.5 text-[15px]',
  compact: 'min-h-11 gap-3 border-line-2 pr-3 pl-3.5 text-[14.5px] sm:min-h-[42px]',
  // 34px, with an invisible 5px above and below on a phone for a 44px tap target (as `buttonClass`'s `adminSm`).
  small: 'min-h-[34px] gap-2 border-line-2 pr-2.5 pl-3 text-sm max-sm:after:absolute max-sm:after:inset-x-0 max-sm:after:-inset-y-[5px]',
  toolbar: 'min-h-11 gap-2 border-line pr-2 pl-2.5 text-sm font-medium sm:min-h-[38px]',
};

const CHEVRON: Record<SelectSize, string> = {
  md: 'size-4 text-ink',
  compact: 'size-4 text-ink',
  small: 'size-4 text-ink',
  toolbar: 'size-3.5 text-muted',
};

/** The first enabled index from `start` stepping by `step`, or `fallback` when there is none. */
function enabledFrom(options: readonly SelectOption[], start: number, step: 1 | -1, fallback: number): number {
  for (let index = start; index >= 0 && index < options.length; index += step) {
    if (options[index]?.disabled !== true) return index;
  }
  return fallback;
}

/**
 * The site's dropdown (D-258): a select-only combobox (WAI-ARIA APG) in place of the browser's native `<select>`, whose
 * popup cannot be styled. The trigger is a `button` with `role="combobox"`, so a `<label htmlFor>` names and focuses it;
 * focus stays on it while the list is open and `aria-activedescendant` points at the active option. Keys: Enter, Space and
 * the arrows open; the arrows, Home, End and typed first letters (Thai too) move; Enter or Space chooses; Escape and Tab
 * close without choosing. A press outside closes it. The list is drawn in a portal with fixed positioning, so a table's
 * scroll box cannot clip it; it opens below the trigger, or above when there is no room below, at least as wide as the
 * trigger. The trigger is as wide as the longest label (as a native select is) but never wider than its container, and
 * truncates. Not modal: no focus trap and no scroll lock.
 */
export default function Select({
  options,
  value,
  defaultValue,
  onChange,
  name,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  size = 'md',
  disabled = false,
  className = '',
}: SelectProps) {
  const baseId = useId();
  const triggerId = id ?? `${baseId}-trigger`;
  const listId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? options[0]?.value ?? '');
  const found = options.findIndex((option) => option.value === (controlled ? value : internal));
  // A value that is not among the options shows and posts the first option, as a native select does.
  const selectedIndex = found === -1 ? 0 : found;
  const selected = options[selectedIndex];

  const [expanded, setOpen] = useState(false);
  // A disabled select never shows its list.
  const open = expanded && !disabled;
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [listName, setListName] = useState<string | undefined>(undefined);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });
  // What a form reset goes back to, read when the reset happens.
  const resetValue = useRef(defaultValue ?? options[0]?.value ?? '');
  useEffect(() => {
    resetValue.current = defaultValue ?? options[0]?.value ?? '';
  });

  const close = useCallback(() => setOpen(false), []);

  function show(index: number): void {
    setActiveIndex(index);
    // The list's name: the trigger's own aria-label, else its `<label>`'s text (aria-labelledby is passed through).
    setListName(ariaLabel ?? trigger.current?.labels?.[0]?.textContent ?? undefined);
    setOpen(true);
  }

  function choose(index: number): void {
    const option = options[index];
    if (option === undefined || option.disabled === true) return;
    setOpen(false);
    if (index === selectedIndex && found !== -1) return;
    if (!controlled) setInternal(option.value);
    onChange?.(option.value);
  }

  /** Moves to the next option whose label starts with what was typed in the last half second; one letter repeated cycles. */
  function typeahead(char: string, from: number): number {
    const now = Date.now();
    const text = (now - typed.current.at > TYPEAHEAD_MS ? char : typed.current.text + char).toLocaleLowerCase();
    typed.current = { text, at: now };
    const repeated = [...text].every((letter) => letter === text[0]);
    const prefix = repeated ? [...text][0]! : text;
    const start = repeated ? from + 1 : from;
    for (let step = 0; step < options.length; step += 1) {
      const index = (start + step) % options.length;
      const option = options[index]!;
      if (option.disabled !== true && option.label.toLocaleLowerCase().startsWith(prefix)) return index;
    }
    return from;
  }

  const typing = () => typed.current.text !== '' && Date.now() - typed.current.at <= TYPEAHEAD_MS;
  const printable = (event: KeyboardEvent) => event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (disabled) return;
    const { key } = event;
    const first = enabledFrom(options, 0, 1, 0);
    const last = enabledFrom(options, options.length - 1, -1, options.length - 1);
    if (!open) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        event.preventDefault();
        show(options[selectedIndex]?.disabled === true ? first : selectedIndex);
      } else if (key === 'Home' || key === 'End') {
        event.preventDefault();
        show(key === 'Home' ? first : last);
      } else if (printable(event)) {
        event.preventDefault();
        show(typeahead(key, selectedIndex));
      }
      return;
    }
    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex(enabledFrom(options, activeIndex + 1, 1, activeIndex));
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (event.altKey) choose(activeIndex);
        else setActiveIndex(enabledFrom(options, activeIndex - 1, -1, activeIndex));
        return;
      case 'Home':
        event.preventDefault();
        setActiveIndex(first);
        return;
      case 'End':
        event.preventDefault();
        setActiveIndex(last);
        return;
      case 'Enter':
        event.preventDefault();
        choose(activeIndex);
        return;
      case 'Escape':
        event.preventDefault();
        // A dialog around the select must not close with it.
        event.stopPropagation();
        close();
        return;
      case 'Tab':
        close();
        return;
      case ' ':
        event.preventDefault();
        if (typing()) setActiveIndex(typeahead(key, activeIndex));
        else choose(activeIndex);
        return;
      default:
        if (printable(event)) {
          event.preventDefault();
          setActiveIndex(typeahead(key, activeIndex));
        }
    }
  }

  // An uncontrolled select goes back to its default when its form is reset (React resets a form after its action).
  useEffect(() => {
    const form = trigger.current?.form;
    if (controlled || form === null || form === undefined) return;
    const onReset = () => setInternal(resetValue.current);
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, [controlled]);

  // Place the list below the trigger, or above it when there is more room there, and keep it placed while anything scrolls.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const button = trigger.current;
      const popup = list.current;
      if (button === null || popup === null) return;
      const rect = button.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - GAP - MARGIN;
      const above = rect.top - GAP - MARGIN;
      const up = Math.min(MAX_HEIGHT, popup.scrollHeight) > below && above > below;
      popup.style.minWidth = `${rect.width}px`;
      popup.style.maxHeight = `${Math.max(0, Math.min(MAX_HEIGHT, up ? above : below))}px`;
      popup.style.top = up ? '' : `${rect.bottom + GAP}px`;
      popup.style.bottom = up ? `${window.innerHeight - rect.top + GAP}px` : '';
      const width = Math.max(popup.offsetWidth, rect.width);
      popup.style.left = `${Math.max(MARGIN, Math.min(rect.left, window.innerWidth - MARGIN - width))}px`;
    };
    place();
    const onScroll = (event: Event) => {
      if (event.target !== list.current) place();
    };
    window.addEventListener('resize', place);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  // Keep the active option in view (on open, the chosen one).
  useLayoutEffect(() => {
    const popup = list.current;
    const option = open ? popup?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`) : null;
    if (popup === null || option === null || option === undefined) return;
    if (option.offsetTop < popup.scrollTop) popup.scrollTop = option.offsetTop - 4;
    else if (option.offsetTop + option.offsetHeight > popup.scrollTop + popup.clientHeight) {
      popup.scrollTop = option.offsetTop + option.offsetHeight - popup.clientHeight + 4;
    }
  }, [open, activeIndex]);

  // A press outside closes it; focus then goes wherever the press puts it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent | MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && !(trigger.current?.contains(target) ?? false) && !(list.current?.contains(target) ?? false)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  return (
    <>
      {name === undefined ? null : <input type="hidden" name={name} value={selected?.value ?? ''} />}
      <button
        ref={trigger}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        disabled={disabled}
        onClick={() => {
          // Safari does not focus a clicked button; the keys must work after a click.
          trigger.current?.focus();
          if (open) close();
          else show(selectedIndex);
        }}
        onKeyDown={onKeyDown}
        // Space opens on keydown; stop the button's own Space click on keyup.
        onKeyUp={(event) => {
          if (event.key === ' ') event.preventDefault();
        }}
        onBlur={close}
        className={`${BASE} ${SIZE[size]} ${className}`}
      >
        {/* Every label in one grid cell: the trigger is as wide as the longest, and the chosen one shows. */}
        <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)]">
          {options.map((option, index) =>
            index === selectedIndex ? (
              <span key={index} data-select-label="" className="col-start-1 row-start-1 truncate">
                {option.label}
              </span>
            ) : (
              <span key={index} aria-hidden="true" className="invisible col-start-1 row-start-1 h-0 truncate">
                {option.label}
              </span>
            ),
          )}
        </span>
        <Icon name="chevDown" className={`${CHEVRON[size]} transition-transform duration-150 ease-out ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <ul
              ref={list}
              id={listId}
              role="listbox"
              aria-label={ariaLabelledBy === undefined ? listName : undefined}
              aria-labelledby={ariaLabelledBy}
              tabIndex={-1}
              // Keep focus on the trigger when the list or its scrollbar is pressed.
              onMouseDown={(event) => event.preventDefault()}
              style={{ position: 'fixed', maxHeight: MAX_HEIGHT }}
              className="z-80 w-max max-w-[calc(100vw-16px)] overflow-y-auto overscroll-contain rounded-md border border-line bg-surface p-1 shadow-1"
            >
              {options.map((option, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <li
                    key={index}
                    id={optionId(index)}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled === true ? true : undefined}
                    onPointerMove={() => {
                      if (option.disabled !== true && activeIndex !== index) setActiveIndex(index);
                    }}
                    onClick={() => choose(index)}
                    className={`flex min-h-11 items-center gap-3 rounded-[7px] px-3 py-1 text-[14.5px] leading-[1.45] sm:min-h-9 ${
                      option.disabled === true ? 'cursor-default text-muted' : 'cursor-pointer text-ink'
                    } ${isSelected ? 'font-semibold' : ''} ${index === activeIndex && option.disabled !== true ? 'bg-sunk' : ''}`}
                  >
                    <span className="min-w-0 flex-1">{option.label}</span>
                    <Icon name="check" className={`size-4 text-ink ${isSelected ? '' : 'invisible'}`} strokeWidth={2.2} />
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </>
  );
}
