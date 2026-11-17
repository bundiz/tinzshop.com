// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Select, { type SelectOption } from './Select';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OPTIONS: SelectOption[] = [
  { value: '', label: 'All roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'blogger', label: 'Blogger' },
  { value: 'blue', label: 'Blue', disabled: true },
  { value: 'bluebird', label: 'Bluebird' },
  { value: 'h2', label: 'หัวข้อ 2' },
  { value: 'p', label: 'ย่อหน้า' },
];

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

const render = (node: React.ReactNode) => act(() => root.render(node));
const trigger = () => container.querySelector<HTMLButtonElement>('[role="combobox"]')!;
const listbox = () => document.querySelector<HTMLElement>('[role="listbox"]');
const options = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')];
/** The text the trigger shows (the chosen option's label). */
const shown = () => trigger().querySelector('[data-select-label]')?.textContent;
const active = () => document.getElementById(trigger().getAttribute('aria-activedescendant') ?? '')?.textContent;
const key = (key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
  });
const type = (text: string) => {
  for (const char of text) key(char);
};
const open = () => act(() => trigger().click());

describe('Select', () => {
  it('is a select-only combobox: closed, it names no list and shows the chosen label', () => {
    render(<Select options={OPTIONS} defaultValue="blogger" aria-label="Role" />);
    expect(trigger().tagName).toBe('BUTTON');
    expect(trigger().type).toBe('button');
    expect(trigger().getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().getAttribute('aria-label')).toBe('Role');
    expect(trigger().hasAttribute('aria-activedescendant')).toBe(false);
    expect(shown()).toBe('Blogger');
    expect(listbox()).toBeNull();
  });

  it('opens on click with the listbox wired to the trigger and the chosen option active and selected', () => {
    render(<Select options={OPTIONS} defaultValue="blogger" aria-label="Role" />);
    open();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(trigger().getAttribute('aria-controls')).toBe(listbox()!.id);
    expect(listbox()!.getAttribute('aria-label')).toBe('Role');
    expect(options()).toHaveLength(OPTIONS.length);
    expect(options().filter((option) => option.getAttribute('aria-selected') === 'true').map((option) => option.textContent)).toEqual(['Blogger']);
    expect(options()[3]!.getAttribute('aria-disabled')).toBe('true');
    expect(active()).toBe('Blogger');
    // Focus stays on the trigger.
    expect(document.activeElement).toBe(trigger());
  });

  it('opens with ArrowDown, and the arrows, Home and End move the active option, skipping a disabled one', () => {
    render(<Select options={OPTIONS} defaultValue="blogger" aria-label="Role" />);
    act(() => trigger().focus());
    key('ArrowDown');
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(active()).toBe('Blogger');
    key('ArrowDown');
    expect(active()).toBe('Bluebird');
    key('ArrowUp');
    expect(active()).toBe('Blogger');
    key('End');
    expect(active()).toBe('ย่อหน้า');
    key('ArrowDown');
    expect(active()).toBe('ย่อหน้า');
    key('Home');
    expect(active()).toBe('All roles');
    key('ArrowUp');
    expect(active()).toBe('All roles');
  });

  it('opens with ArrowUp, Enter and Space too', () => {
    render(<Select options={OPTIONS} aria-label="Role" />);
    for (const opener of ['ArrowUp', 'Enter', ' ']) {
      key(opener);
      expect(trigger().getAttribute('aria-expanded')).toBe('true');
      key('Escape');
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('moves by typing the first letters, in Thai too, and a repeated letter cycles', () => {
    render(<Select options={OPTIONS} aria-label="Role" />);
    key('ArrowDown');
    type('blu');
    expect(active()).toBe('Bluebird');
    // A pause starts a new search.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.advanceTimersByTime(1000);
      type('ห');
      expect(active()).toBe('หัวข้อ 2');
      vi.advanceTimersByTime(1000);
      type('b');
      expect(active()).toBe('Blogger');
      type('b');
      expect(active()).toBe('Bluebird');
    } finally {
      vi.useRealTimers();
    }
  });

  it('selects with Enter: calls onChange, closes, keeps focus and shows the new label', () => {
    const onChange = vi.fn();
    render(<Select options={OPTIONS} defaultValue="admin" onChange={onChange} aria-label="Role" />);
    act(() => trigger().focus());
    key('ArrowDown');
    key('ArrowDown');
    key('Enter');
    expect(onChange).toHaveBeenCalledWith('blogger');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(listbox()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(shown()).toBe('Blogger');
  });

  it('selects with Space and with a click on an option, and never calls onChange for the same value', () => {
    const onChange = vi.fn();
    render(<Select options={OPTIONS} defaultValue="admin" onChange={onChange} aria-label="Role" />);
    key('ArrowDown');
    key(' ');
    expect(onChange).not.toHaveBeenCalled();
    open();
    act(() => options()[5]!.click());
    expect(onChange).toHaveBeenCalledWith('h2');
    expect(shown()).toBe('หัวข้อ 2');
    open();
    act(() => options()[3]!.click());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(listbox()).not.toBeNull();
  });

  it('closes on Escape and on Tab without changing the value', () => {
    const onChange = vi.fn();
    render(<Select options={OPTIONS} defaultValue="admin" onChange={onChange} aria-label="Role" />);
    key('ArrowDown');
    key('ArrowDown');
    key('Escape');
    expect(listbox()).toBeNull();
    key('ArrowDown');
    key('ArrowDown');
    key('Tab');
    expect(listbox()).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(shown()).toBe('Admin');
  });

  it('closes on a pointer press outside, and the trigger toggles it', () => {
    render(<Select options={OPTIONS} aria-label="Role" />);
    open();
    act(() => {
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });
    expect(listbox()).toBeNull();
    open();
    open();
    expect(listbox()).toBeNull();
  });

  it('posts its value under its name through a hidden input, as a native select would', () => {
    render(
      <form id="f">
        <Select name="role" options={OPTIONS} defaultValue="" aria-label="Role" />
      </form>,
    );
    const form = container.querySelector('form')!;
    expect(new FormData(form).get('role')).toBe('');
    key('ArrowDown');
    key('ArrowDown');
    key('Enter');
    expect(new FormData(form).get('role')).toBe('admin');
    expect([...new FormData(form).keys()]).toEqual(['role']);
  });

  it('goes back to its default value when its form is reset', () => {
    render(
      <form>
        <Select name="role" options={OPTIONS} defaultValue="blogger" aria-label="Role" />
      </form>,
    );
    key('ArrowDown');
    key('Home');
    key('Enter');
    expect(shown()).toBe('All roles');
    act(() => container.querySelector('form')!.reset());
    expect(shown()).toBe('Blogger');
    expect(new FormData(container.querySelector('form')!).get('role')).toBe('blogger');
  });

  it('shows the first option when no value is given, as a native select does', () => {
    render(<Select name="role" options={OPTIONS} aria-label="Role" />);
    expect(shown()).toBe('All roles');
  });

  it('when controlled, shows the value it is given and reports a choice through onChange', () => {
    function Controlled() {
      const [value, setValue] = useState('admin');
      return <Select options={OPTIONS} value={value} onChange={setValue} aria-label="Role" />;
    }
    render(<Controlled />);
    expect(shown()).toBe('Admin');
    key('ArrowDown');
    key('End');
    key('Enter');
    expect(shown()).toBe('ย่อหน้า');

    const onChange = vi.fn();
    render(<Select options={OPTIONS} value="admin" onChange={onChange} aria-label="Role" />);
    key('ArrowDown');
    key('End');
    key('Enter');
    expect(onChange).toHaveBeenCalledWith('p');
    expect(shown()).toBe('Admin');
  });

  it('does nothing while disabled', () => {
    const onChange = vi.fn();
    render(<Select options={OPTIONS} onChange={onChange} disabled aria-label="Role" />);
    expect(trigger().disabled).toBe(true);
    open();
    key('ArrowDown');
    expect(listbox()).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes its open list when it becomes disabled (the editor locks)', () => {
    render(<Select options={OPTIONS} aria-label="Role" />);
    open();
    expect(listbox()).not.toBeNull();
    render(<Select options={OPTIONS} aria-label="Role" disabled />);
    expect(listbox()).toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('is named and focused by its label', () => {
    render(
      <>
        <label htmlFor="users-role">Role</label>
        <Select id="users-role" options={OPTIONS} />
      </>,
    );
    expect(trigger().id).toBe('users-role');
    expect([...trigger().labels].map((label) => label.textContent)).toEqual(['Role']);
    act(() => container.querySelector('label')!.click());
    expect(document.activeElement).toBe(trigger());
    // A label click is a click on the trigger, so the list opens, named by the label's text.
    expect(listbox()!.getAttribute('aria-label')).toBe('Role');
  });

  it('takes aria-labelledby for the trigger and the list', () => {
    render(
      <>
        <span id="heading">Block type</span>
        <Select aria-labelledby="heading" options={OPTIONS} />
      </>,
    );
    expect(trigger().getAttribute('aria-labelledby')).toBe('heading');
    open();
    expect(listbox()!.getAttribute('aria-labelledby')).toBe('heading');
  });
});
