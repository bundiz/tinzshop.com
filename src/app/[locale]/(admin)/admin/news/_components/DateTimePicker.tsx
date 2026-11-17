'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { DayPicker, TZDate, type ChevronProps, type DayButtonProps, type Matcher } from 'react-day-picker';
import { th as thaiCalendar } from 'react-day-picker/locale/th';

import { buttonClass } from '@/components/ui/button-class';
import Icon from '@/components/ui/Icon';

export type DateTimePickerProps = {
  /** The trigger button's id; the visible label points at it with `htmlFor`. */
  id: string;
  /** The hidden input's name: the form posts the value under it. */
  name: string;
  /** The visible label's id, so the trigger is read as the label followed by the chosen value. */
  labelId: string;
  locale: string;
  /** Bangkok local time, `YYYY-MM-DDTHH:mm`, or empty when nothing is chosen. */
  value: string;
  onChange: (value: string) => void;
};

const BANGKOK = 'Asia/Bangkok';
// Thailand keeps +07:00 all year (no daylight saving), so Bangkok wall time is UTC plus seven hours.
const BANGKOK_OFFSET_MS = 7 * 3_600_000;
const DEFAULT_HOUR = 9;
const MINUTE_STEP = 5;
const LAST_SLOT = 23 * 60 + 55;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const GRID_MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, index) => index * MINUTE_STEP);

type Parts = { date: string; hour: number; minute: number };

const pad = (n: number) => String(n).padStart(2, '0');

function parse(value: string): Parts | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  return match === null ? null : { date: match[1]!, hour: Number(match[2]), minute: Number(match[3]) };
}

function compose({ date, hour, minute }: Parts): string {
  return `${date}T${pad(hour)}:${pad(minute)}`;
}

/** Today in Bangkok, and the minutes since its midnight, whatever zone the browser is in. */
function bangkokNow(): { date: string; minutes: number } {
  const iso = new Date(Date.now() + BANGKOK_OFFSET_MS).toISOString();
  return { date: iso.slice(0, 10), minutes: Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16)) };
}

/** A `YYYY-MM-DD` as the calendar's day: midnight in Bangkok. */
function bangkokDay(date: string): TZDate {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new TZDate(year, month - 1, day, BANGKOK);
}

/** The calendar's day back to `YYYY-MM-DD` in Bangkok. */
function isoDay(date: Date): string {
  return new Date(date.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** Whole minutes from Bangkok midnight; on today, a time below `now` has passed. */
const minutesOf = (hour: number, minute: number) => hour * 60 + minute;

/**
 * The "publish later" date and time (plan 016, D-256): a button styled like the panel's inputs that opens a small calendar
 * popover. The date grid is react-day-picker, styled here after shadcn's Calendar; the time is two columns of buttons, hours
 * and minutes in 5-minute steps. Everything is Bangkok time whatever the browser's zone, and the form receives it through a
 * hidden input as `YYYY-MM-DDTHH:mm`, as the old `datetime-local` sent it. Days before today and, today, times already past
 * cannot be picked (the server still publishes a past time at once, ruling R8). A stored minute off the 5-minute grid is
 * shown and kept until changed. Not modal: it closes on Escape, a click outside, focus leaving it, or "Done".
 */
export default function DateTimePicker({ id, name, labelId, locale, value, onChange }: DateTimePickerProps) {
  const t = useTranslations('admin.news.editor.picker');
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const hourColumn = useRef<HTMLDivElement>(null);
  const minuteColumn = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  const hourHeadingId = useId();
  const minuteHeadingId = useId();

  const thai = locale === 'th';
  const parts = parse(value);
  const now = bangkokNow();
  const firstSlotToday = Math.ceil(now.minutes / MINUTE_STEP) * MINUTE_STEP;
  const isToday = parts?.date === now.date;

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const container = popover.current;
    // react-day-picker's autoFocus puts focus on the chosen day or today; if it could not, the dialog itself takes it.
    if (container !== null && !container.contains(document.activeElement)) container.focus();
    for (const column of [hourColumn.current, minuteColumn.current]) {
      const chosen = column?.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (column && chosen) column.scrollTop = chosen.offsetTop - (column.clientHeight - chosen.offsetHeight) / 2;
    }
    const outside = (target: EventTarget | null) =>
      target instanceof Node && !(popover.current?.contains(target) ?? false) && !(trigger.current?.contains(target) ?? false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close(true);
    };
    // Focus goes back to the trigger first; a click on another control then moves it there, as the browser does.
    const onPointerDown = (event: PointerEvent | MouseEvent) => {
      if (outside(event.target)) close(true);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (outside(event.target)) close(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open, close]);

  /** On today, a time already past moves to the first open slot. */
  function upcoming(next: Parts): Parts {
    if (next.date !== now.date || minutesOf(next.hour, next.minute) >= now.minutes) return next;
    const hour = Math.max(next.hour, Math.floor(firstSlotToday / 60));
    const minute = hour * 60 >= now.minutes ? next.minute : Math.ceil((now.minutes - hour * 60) / MINUTE_STEP) * MINUTE_STEP;
    return { date: next.date, hour, minute };
  }

  const pickDay = (date: string) => onChange(compose(upcoming({ date, hour: parts?.hour ?? DEFAULT_HOUR, minute: parts?.minute ?? 0 })));
  const pickHour = (hour: number) => parts && onChange(compose(upcoming({ ...parts, hour })));
  const pickMinute = (minute: number) => parts && onChange(compose({ ...parts, minute }));

  const minutes = parts && parts.minute % MINUTE_STEP !== 0 ? [...GRID_MINUTES, parts.minute].sort((a, b) => a - b) : GRID_MINUTES;
  const disabledDays: Matcher[] = [{ before: bangkokDay(now.date) }];
  if (firstSlotToday > LAST_SLOT) disabledDays.push(bangkokDay(now.date));

  const dateFormat = new Intl.DateTimeFormat(thai ? 'th' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const display = parts
    ? `${dateFormat.format(new Date(`${parts.date}T00:00:00Z`))} · ${pad(parts.hour)}:${pad(parts.minute)}`
    : value;
  // `th` formats in the Buddhist era (2569); the caption and the day names for a screen reader use it too.
  const captionFormat = new Intl.DateTimeFormat(thai ? 'th' : 'en', { month: 'long', year: 'numeric', timeZone: BANGKOK });
  const dayLabelFormat = new Intl.DateTimeFormat(thai ? 'th' : 'en-GB', { dateStyle: 'full', timeZone: BANGKOK });

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        ref={trigger}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-labelledby={`${labelId} ${id}`}
        onClick={() => (open ? close(true) : setOpen(true))}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-sm border-[1.5px] border-line-2 bg-surface px-3 text-left text-ink hover:border-ink"
      >
        <span className={display === '' ? 'text-muted' : 'tabular-nums'}>{display === '' ? t('placeholder') : display}</span>
        <Icon name="calendar" className="size-5 text-muted" />
      </button>
      {open ? (
        <div
          ref={popover}
          id={dialogId}
          role="dialog"
          aria-label={t('dialog')}
          tabIndex={-1}
          className="absolute top-full right-0 z-40 mt-1.5 w-max max-w-[calc(100vw-2rem)] rounded-md border border-line bg-surface p-3 shadow-1"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <DayPicker
              mode="single"
              required
              selected={parts ? bangkokDay(parts.date) : undefined}
              onSelect={(date) => pickDay(isoDay(date))}
              defaultMonth={bangkokDay(parts?.date ?? now.date)}
              startMonth={bangkokDay(now.date)}
              timeZone={BANGKOK}
              disabled={disabledDays}
              showOutsideDays
              autoFocus
              navLayout="around"
              lang={thai ? 'th' : 'en'}
              locale={thai ? thaiCalendar : undefined}
              formatters={{ formatCaption: (month) => captionFormat.format(month) }}
              labels={{
                labelGrid: (month) => captionFormat.format(month),
                labelPrevious: () => t('previousMonth'),
                labelNext: () => t('nextMonth'),
                labelDayButton: (date, modifiers) =>
                  [dayLabelFormat.format(date), modifiers.today ? t('today') : '', modifiers.selected ? t('selected') : ''].filter(Boolean).join(', '),
              }}
              classNames={CALENDAR_CLASSES}
              components={{ Chevron: CalendarChevron, DayButton: CalendarDayButton }}
            />
            <div className="grid grid-cols-2 gap-2 border-t border-line pt-3 sm:w-[148px] sm:border-t-0 sm:border-l sm:pt-0 sm:pl-3">
              <TimeColumn
                kind="hour"
                headingId={hourHeadingId}
                heading={t('hour')}
                columnRef={hourColumn}
                values={HOURS}
                chosen={parts?.hour}
                isDisabled={(hour) => parts === null || (isToday && minutesOf(hour, 55) < now.minutes)}
                onPick={pickHour}
              />
              <TimeColumn
                kind="minute"
                headingId={minuteHeadingId}
                heading={t('minute')}
                columnRef={minuteColumn}
                values={minutes}
                chosen={parts?.minute}
                isDisabled={(minute) => parts === null || (isToday && minutesOf(parts.hour, minute) < now.minutes)}
                onPick={pickMinute}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2 border-t border-line pt-3">
            <button type="button" onClick={() => onChange('')} className={CLEAR_BUTTON}>
              {t('clear')}
            </button>
            <button type="button" onClick={() => close(true)} className={buttonClass({ variant: 'brand', size: 'adminSm' })}>
              {t('done')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// The admin mockup's `.btn-text btn-sm` (D-257): 34px, with a 44px tap target below `sm` (D-221).
const CLEAR_BUTTON =
  'relative inline-flex min-h-[34px] cursor-pointer items-center justify-center rounded-[9px] px-3 text-sm font-semibold text-ink-2 transition-colors hover:bg-sunk hover:text-ink max-sm:after:absolute max-sm:after:inset-x-0 max-sm:after:-inset-y-[5px]';

// shadcn's Calendar look on our tokens. Keys are react-day-picker 10's `UI` names; the day's state is drawn by CalendarDayButton.
const CALENDAR_CLASSES = {
  root: 'w-fit',
  months: 'flex flex-col',
  month: 'grid grid-cols-[auto_1fr_auto] items-center gap-y-3',
  month_caption: 'flex h-9 items-center justify-center',
  caption_label: 'font-head text-sm font-semibold text-ink',
  button_previous:
    'inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-ink-2 hover:bg-sunk hover:text-ink aria-disabled:pointer-events-none aria-disabled:opacity-40',
  button_next:
    'inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-ink-2 hover:bg-sunk hover:text-ink aria-disabled:pointer-events-none aria-disabled:opacity-40',
  month_grid: 'col-span-3 border-collapse',
  weekday: 'h-8 w-9 p-0 text-[13px] font-normal text-muted sm:w-11',
  day: 'p-0 text-center',
  hidden: 'invisible',
};

function CalendarChevron({ orientation }: ChevronProps) {
  return <Icon name={orientation === 'right' ? 'chevRight' : 'chevLeft'} className="size-4" />;
}

/** A day: selected is the brand blue, today a grey tile, other months and past days muted. Keeps the library's focus moving. */
function CalendarDayButton({ day: _day, modifiers, className, ...props }: DayButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);
  const state = modifiers.selected
    ? 'bg-brand font-semibold text-white hover:bg-brand-dark'
    : modifiers.today
      ? 'bg-sunk font-semibold text-ink hover:bg-line'
      : modifiers.outside
        ? 'text-muted hover:bg-sunk'
        : 'text-ink hover:bg-sunk';
  return (
    <button
      ref={ref}
      {...props}
      className={`${className ?? ''} inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent sm:size-11 ${state}`}
    />
  );
}

/** One column of time buttons (hours or minutes), scrolled on open so the chosen one shows. */
function TimeColumn({
  kind,
  headingId,
  heading,
  columnRef,
  values,
  chosen,
  isDisabled,
  onPick,
}: {
  kind: 'hour' | 'minute';
  headingId: string;
  heading: string;
  columnRef: React.RefObject<HTMLDivElement | null>;
  values: number[];
  chosen: number | undefined;
  isDisabled: (value: number) => boolean;
  onPick: (value: number) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <p id={headingId} className="mb-1 text-center text-[13px] whitespace-nowrap text-muted">
        {heading}
      </p>
      <div
        ref={columnRef}
        role="group"
        aria-labelledby={headingId}
        data-column={kind}
        className="relative grid max-h-48 gap-1 overflow-y-auto overscroll-contain pr-0.5 sm:max-h-[17.5rem]"
      >
        {values.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={chosen === value}
            disabled={isDisabled(value)}
            onClick={() => onPick(value)}
            className={`min-h-9 w-full cursor-pointer rounded-md text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${
              chosen === value ? 'bg-brand font-semibold text-white hover:bg-brand-dark' : 'text-ink hover:bg-sunk'
            }`}
          >
            {pad(value)}
          </button>
        ))}
      </div>
    </div>
  );
}
