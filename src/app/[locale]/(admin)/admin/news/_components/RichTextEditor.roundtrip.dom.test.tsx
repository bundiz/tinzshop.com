// @vitest-environment jsdom
import type { Editor } from '@tiptap/core';
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sanitizeArticleHtml } from '@/server/adapters/wordpress/sanitize';
import en from '../../../../../../../messages/en.json';
import { bodyOrEmpty } from './body-roundtrip';
import RichTextEditor from './RichTextEditor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The shapes an imported WordPress body has, run through the real sanitiser: what is stored.
const RAW = `
<h2>Heading two</h2><h3>Heading three</h3><h4>Heading four</h4>
<p>Intro with a <a href="https://example.com/x">link</a>, <strong>bold</strong>, <em>italic</em><br>and a break.</p>
<ul><li>One</li><li>Two</li></ul><ol><li>First</li></ol>
<blockquote><p>Quoted</p></blockquote>
<figure class="wp-block-image"><img src="https://old.example/a.jpg" alt="a" width="10"><figcaption>Caption text</figcaption></figure>
<p><img src="https://old.example/b.jpg" alt="b"></p>
<iframe width="560" src="http://youtube.com/embed/dQw4w9WgXcQ?si=x" allowfullscreen></iframe>
<table><thead><tr><th>Name</th><th>Price</th></tr></thead><tbody><tr><td>Switch</td><td>100</td></tr></tbody></table>
<h5>Heading five</h5><p>End</p>`;
const STORED = sanitizeArticleHtml(RAW).html;

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

async function mount(initialHtml: string, onChange: (html: string) => void = () => {}) {
  await act(async () => {
    root.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Bangkok">
        <RichTextEditor label="Body" initialHtml={initialHtml} onChange={onChange} searchProducts={async () => []} />
      </NextIntlClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  return (container.querySelector('.ProseMirror') as unknown as { editor: Editor }).editor;
}

describe('editing a stored body', () => {
  it('keeps every structure when one character is typed (sanitised import fixture)', async () => {
    const onChange = vi.fn();
    const editor = await mount(STORED, onChange);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await act(async () => {
      editor.chain().focus('end').insertContent('x').run();
    });
    const html = sanitizeArticleHtml(onChange.mock.calls.at(-1)![0] as string).html;
    for (const part of [
      '<h2>Heading two</h2>', '<h3>Heading three</h3>', '<h4>Heading four</h4>', '<h5>Heading five</h5>',
      'href="https://example.com/x"', '<strong>bold</strong>', '<em>italic</em>', '<br />',
      '<ul>', '<ol>', '<blockquote>', '<figure>', '<figcaption>Caption text</figcaption>',
      'src="https://old.example/a.jpg"', 'src="https://old.example/b.jpg"',
      '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ', '<table>', '<th>', 'Switch',
    ]) {
      expect(html, part).toContain(part);
    }
  });

  it('keeps a video inserted with the toolbar through save, sanitise, reload and another edit', async () => {
    const onChange = vi.fn();
    const first = await mount('<p>Start</p>', onChange);
    await act(async () => {
      first.chain().focus('end').setYoutubeVideo({ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }).run();
    });
    const saved = sanitizeArticleHtml(onChange.mock.calls.at(-1)![0] as string).html;
    expect(saved).toContain('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ');

    act(() => root.unmount());
    root = createRoot(container);
    const again = vi.fn();
    const second = await mount(saved, again);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await act(async () => {
      second.chain().focus('end').insertContent('y').run();
    });
    expect(sanitizeArticleHtml(again.mock.calls.at(-1)![0] as string).html).toContain('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('locks the body, with a warning, when it holds something outside the schema', async () => {
    const onChange = vi.fn();
    const editor = await mount('<p>Kept</p><dl><dt>Term</dt><dd>Meaning</dd></dl>', onChange);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('cannot show or keep');
    expect(editor.isEditable).toBe(false);
    expect([...container.querySelectorAll('[role="toolbar"] button')].every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('bodyOrEmpty', () => {
  it('treats a body with no text and no media as empty', () => {
    expect(bodyOrEmpty('<p></p>')).toBe('');
    expect(bodyOrEmpty('<p> &nbsp; </p>')).toBe('');
    expect(bodyOrEmpty('<p>a</p>')).toBe('<p>a</p>');
    expect(bodyOrEmpty('<p></p><iframe src="https://www.youtube.com/embed/x"></iframe>')).not.toBe('');
  });
});
