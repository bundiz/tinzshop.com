// @vitest-environment jsdom
import { act, useActionState, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog';

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
  document.body.style.overflow = '';
});

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const dialog = () => document.querySelector<HTMLElement>('[role="alertdialog"]');
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find((b) => b.textContent === text)!;

function CallbackHarness({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={opener} id="opener" type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Block this account?"
        text="Somchai will be signed out."
        confirmLabel="Block"
        cancelLabel="Cancel"
        tone="danger"
        icon="lock"
        onConfirm={() => {
          onConfirm();
          setOpen(false);
        }}
        returnFocusRef={opener}
      />
    </>
  );
}

/** A form outside the dialog, submitted by the dialog's button; the dialog stays up while the action runs. */
function FormHarness({ action }: { action: (previous: string, formData: FormData) => Promise<string> }) {
  const [state, formAction, pending] = useActionState(action, 'idle');
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (state !== 'idle') setOpen(false);
  }, [state]);
  return (
    <>
      <form id="the-form" action={formAction}>
        <input type="hidden" name="id" value="42" />
      </form>
      <button ref={opener} id="opener" type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Move to trash?"
        text="It leaves the site."
        confirmLabel="Move to trash"
        cancelLabel="Cancel"
        form="the-form"
        pending={pending}
        returnFocusRef={opener}
      />
    </>
  );
}

describe('ConfirmDialog', () => {
  it('is an alertdialog named and described by its title and text, with the danger tile and button', () => {
    act(() => root.render(<CallbackHarness onConfirm={() => {}} />));
    expect(dialog()).toBeNull();
    act(() => $('opener').click());
    const panel = dialog()!;
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect($(panel.getAttribute('aria-labelledby')!).textContent).toBe('Block this account?');
    expect($(panel.getAttribute('aria-describedby')!).textContent).toBe('Somchai will be signed out.');
    expect(panel.querySelector('[data-confirm-icon] svg')).not.toBeNull();
    expect(button('Block').className).toContain('bg-sale');
    expect(container.contains(panel)).toBe(false);
  });

  it('starts on the cancel button, and cancel closes and returns focus', () => {
    const onConfirm = vi.fn();
    act(() => root.render(<CallbackHarness onConfirm={onConfirm} />));
    act(() => $('opener').click());
    expect(document.activeElement).toBe(button('Cancel'));
    act(() => button('Cancel').click());
    expect(dialog()).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(document.activeElement).toBe($('opener'));
  });

  it('calls onConfirm', () => {
    const onConfirm = vi.fn();
    act(() => root.render(<CallbackHarness onConfirm={onConfirm} />));
    act(() => $('opener').click());
    act(() => button('Block').click());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
  });

  it('submits the named form, stays open and disabled while the action runs, and closes on the result', async () => {
    let finish: (value: string) => void = () => {};
    const action = vi.fn((_previous: string, _formData: FormData) => new Promise<string>((resolve) => (finish = resolve)));
    act(() => root.render(<FormHarness action={action} />));
    act(() => $('opener').click());
    expect(dialog()!.querySelector('[data-confirm-icon]')).toBeNull();
    const confirm = button('Move to trash');
    expect(confirm.getAttribute('type')).toBe('submit');
    expect(confirm.getAttribute('form')).toBe('the-form');
    expect(confirm.className).not.toContain('bg-sale');
    await act(async () => confirm.click());
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]![1].get('id')).toBe('42');
    expect(dialog()).not.toBeNull();
    expect(button('Move to trash').disabled).toBe(true);
    await act(async () => finish('done'));
    expect(dialog()).toBeNull();
  });
});
