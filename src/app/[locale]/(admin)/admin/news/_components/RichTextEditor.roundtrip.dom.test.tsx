// @vitest-environment jsdom
import type { Editor } from '@tiptap/core';
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sanitizeArticleHtml } from '@/server/adapters/wordpress/sanitize';
import en from '../../../../../../../messages/en.json';
import posts from '@/server/adapters/wordpress/__fixtures__/posts-page.json';
import { bodyOrEmpty, normaliseBody, wouldLoseContent } from './body-roundtrip';
import { youtubeEmbedFromUrl } from './youtube-embed';
import RichTextEditor from './RichTextEditor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// A hand-written body in the shapes an import produces, run through the real sanitiser to give what is stored. The
// real fixture posts are tested separately below.
const RAW = `
<h2>Heading two</h2><h3>Heading three</h3><h4>Heading four</h4>
<p>Intro with a <a href="https://example.com/x">link</a>, <strong>bold</strong>, <em>italic</em><br>and a break.</p>
<ul><li>One</li><li>Two</li></ul><ol><li>First</li></ol>
<blockquote><p>Quoted</p></blockquote>
<figure class="wp-block-image"><img src="https://old.example/a.jpg" alt="a" width="10"><figcaption>Caption text</figcaption></figure>
<p><img src="https://old.example/b.jpg" alt="b"></p>
<iframe width="560" src="http://youtube.com/embed/dQw4w9WgXcQ?si=x" allowfullscreen></iframe>
<table><tbody><tr><th>Name</th><th>Price</th></tr><tr><td>Switch</td><td>100</td></tr></tbody></table>
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
      '<iframe src="https://youtube.com/embed/dQw4w9WgXcQ?si=x" allowfullscreen>', '<table>', '<th>', 'Switch',
    ]) {
      expect(html, part).toContain(part);
    }
  });

  it('keeps a video inserted with the toolbar through save, sanitise, reload and another edit', async () => {
    const onChange = vi.fn();
    const first = await mount('<p>Start</p>', onChange);
    await act(async () => {
      first.chain().focus('end').insertContent({ type: 'youtube', attrs: { src: youtubeEmbedFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), fullscreen: true } }).run();
    });
    const saved = sanitizeArticleHtml(onChange.mock.calls.at(-1)![0] as string).html;
    expect(saved).toContain('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" allowfullscreen></iframe>');

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

describe('product cards in a stored body (D-245)', () => {
  const A = '7d1b0a52-3a8e-4f0c-9b8a-2a7c1e4d5f60';
  const B = '11111111-2222-4333-8444-555555555555';
  const card = (id: string) => `<tinz-product data-id="${id}"></tinz-product>`;

  it('stays unlocked after a one-character edit and saves with both cards', async () => {
    const stored = sanitizeArticleHtml(`<p>one</p>${card(A)}<p>two</p>${card(B)}<p>three</p>`).html;
    expect(stored).toContain(card(A));
    const onChange = vi.fn();
    const editor = await mount(stored, onChange);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(editor.isEditable).toBe(true);
    expect(wouldLoseContent(stored, editor.getHTML())).toBe(false);
    await act(async () => {
      editor.chain().focus('end').insertContent('x').run();
    });
    const saved = sanitizeArticleHtml(onChange.mock.calls.at(-1)![0] as string).html;
    expect(saved).toContain(`<p>two</p>${card(B)}<p>three`);
    expect(saved).toContain(`<p>one</p>${card(A)}<p>two</p>`);
    expect(saved.match(/<tinz-product /g)).toHaveLength(2);
  });

  it('normaliseBody keeps data-id like any other element', () => {
    expect(normaliseBody(card(A))).toContain(`data-id="${A}"`);
    expect(normaliseBody(card(A))).not.toBe(normaliseBody(card(B)));
    expect(normaliseBody(`<p>x</p>${card(A)}`)).not.toBe(normaliseBody('<p>x</p>'));
  });

  it('locks a body with a card whose id is not a uuid, which the sanitiser would drop, so nothing is lost silently', async () => {
    const stored = `<p>one</p><tinz-product data-id="123"></tinz-product><p>two</p>`;
    const editor = await mount(stored);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(editor.isEditable).toBe(false);
    expect(wouldLoseContent(stored, editor.getHTML())).toBe(true);
  });
});

describe('product cards are top level only (R16)', () => {
  const A = '7d1b0a52-3a8e-4f0c-9b8a-2a7c1e4d5f60';
  const card = `<tinz-product data-id="${A}"></tinz-product>`;

  it('locks a stored body with a card inside a list item, a quote or a cell, instead of changing it silently', async () => {
    for (const stored of [
      `<ol><li>one</li><li>two${card}</li></ol>`,
      `<blockquote><p>q</p>${card}</blockquote>`,
      `<table><tbody><tr><td>a${card}</td></tr></tbody></table>`,
    ]) {
      expect(sanitizeArticleHtml(stored).html, stored).not.toContain('tinz-product');
      expect(wouldLoseContent(stored, stored), stored).toBe(true);
      const editor = await mount(stored);
      expect(container.querySelector('[role="alert"]'), stored).not.toBeNull();
      expect(editor.isEditable).toBe(false);
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  it('cannot create a card inside a list item, a quote or a cell; the toolbar position is after the top-level block', async () => {
    const editor = await mount('<ul><li>one</li></ul><blockquote><p>q</p></blockquote><p>end</p>');
    const attrs = { id: A, name: 'Switch' };
    // The schema refuses a card as a child of a list item, a quote, a table cell or a figure, and accepts it in the document.
    const { schema } = editor;
    const cardNode = schema.nodes.productCard!.create(attrs);
    for (const name of ['listItem', 'blockquote', 'tableCell', 'tableHeader', 'figure']) {
      expect(schema.nodes[name]!.contentMatch.matchType(cardNode.type), name).toBeNull();
    }
    expect(schema.nodes.doc!.contentMatch.matchType(cardNode.type)).not.toBeNull();
    editor.commands.setTextSelection(3);
    // After the first top-level block it is accepted, and the saved body keeps list and card as siblings.
    const { $to } = editor.state.selection;
    const at = $to.after(1);
    await act(async () => {
      editor.chain().focus().insertContentAt(at, { type: 'productCard', attrs }).run();
    });
    const saved = sanitizeArticleHtml(editor.getHTML()).html;
    expect(saved).toContain(`</ul>${card}<blockquote>`);
    expect(saved).not.toContain('<li>one<tinz-product');
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

// What the body means, counted without the guard's own normaliser: the independent check on it.
function facts(html: string) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const count = (selector: string) => doc.querySelectorAll(selector).length;
  return {
    text: (doc.body.textContent ?? '').replace(/[ \t\r\n\f]+/g, ''),
    tags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'figure', 'figcaption', 'table', 'thead', 'tfoot', 'tr', 'th', 'td', 'strong', 'em', 'br', 'img'].map((tag) => `${tag}:${count(tag)}`),
    links: [...doc.querySelectorAll('a')].map((a) => `${a.getAttribute('href')}>${a.textContent}`),
    images: [...doc.querySelectorAll('img')].map((img) => `${img.getAttribute('src')}|${img.getAttribute('alt') ?? ''}`),
    frames: [...doc.querySelectorAll('iframe')].map((frame) => `${frame.getAttribute('src')}|${frame.hasAttribute('allowfullscreen')}`),
  };
}

describe('the real import fixture (posts-page.json), sanitised as the import does', () => {
  for (const post of posts as { id: number; content: { rendered: string } }[]) {
    it(`post ${post.id}: round-trips with no loss, edited or not, or the editor locks`, async () => {
      const stored = sanitizeArticleHtml(post.content.rendered).html;
      const onChange = vi.fn();
      const editor = await mount(stored, onChange);
      const locked = container.querySelector('[role="alert"]') !== null;
      if (locked) {
        expect(editor.isEditable).toBe(false);
        return;
      }
      expect(facts(sanitizeArticleHtml(editor.getHTML()).html)).toEqual(facts(stored));
      await act(async () => {
        editor.chain().focus('end').insertContent('x').run();
      });
      const edited = facts(sanitizeArticleHtml(onChange.mock.calls.at(-1)![0] as string).html);
      const original = facts(stored);
      expect(edited.text).toBe(`${original.text}x`);
      expect({ ...edited, text: '' }).toEqual({ ...original, text: '' });
    });
  }

  it('posts 5492 and 479 are not locked', async () => {
    for (const post of (posts as { id: number; content: { rendered: string } }[]).filter((entry) => [5492, 479].includes(entry.id))) {
      act(() => root.unmount());
      root = createRoot(container);
      await mount(sanitizeArticleHtml(post.content.rendered).html);
      expect(container.querySelector('[role="alert"]'), String(post.id)).toBeNull();
    }
  });
});

describe('embeds, tables and the toolbar link rules (R14)', () => {
  const lossy = async (stored: string) => {
    const editor = await mount(stored);
    return wouldLoseContent(stored, editor.getHTML());
  };
  const embed = (src: string) => `<iframe src="${src}" allowfullscreen=""></iframe>`;

  it('keeps a playlist embed and a parameterised embed exactly', async () => {
    for (const src of ['https://www.youtube.com/embed/videoseries?list=PLabc', 'https://www.youtube.com/embed/abcdefghijk?start=30&amp;end=60&amp;list=PL1&amp;si=zz']) {
      const stored = sanitizeArticleHtml(embed(src)).html;
      const editor = await mount(stored);
      expect(sanitizeArticleHtml(editor.getHTML()).html, src).toBe(stored);
      expect(container.querySelector('[role="alert"]')).toBeNull();
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  it('counts a lost parameter or a nocookie host as loss', () => {
    const stored = embed('https://www.youtube.com/embed/abcdefghijk?start=30');
    expect(wouldLoseContent(stored, embed('https://www.youtube.com/embed/abcdefghijk'))).toBe(true);
    expect(wouldLoseContent(stored, embed('https://www.youtube-nocookie.com/embed/abcdefghijk?start=30'))).toBe(true);
    expect(wouldLoseContent(stored, stored)).toBe(false);
  });

  it('keeps an embed and a table inside a figure', async () => {
    for (const stored of [
      '<figure><iframe src="https://www.youtube.com/embed/abcdefghijk" allowfullscreen=""></iframe></figure>',
      '<figure><table><tbody><tr><td>a</td></tr></tbody></table><figcaption>c</figcaption></figure>',
    ]) {
      expect(await lossy(stored), stored).toBe(false);
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  it('locks a table with a head or foot section instead of reordering its rows', async () => {
    for (const stored of [
      '<table><thead><tr><td>H</td></tr></thead><tbody><tr><td>B</td></tr></tbody></table>',
      '<table><tbody><tr><td>B</td></tr></tbody><tfoot><tr><td>F</td></tr></tfoot></table>',
      '<table><tfoot><tr><td>F</td></tr></tfoot><tbody><tr><td>B</td></tr></tbody></table>',
    ]) {
      await mount(stored);
      expect(container.querySelector('[role="alert"]'), stored).not.toBeNull();
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  it('ignores only harmless differences: mark order, spacing, a lone <p> in a quote or item', () => {
    expect(normaliseBody('<p><em><strong>x</strong></em></p>')).toBe(normaliseBody('<p><strong><em>x</em></strong></p>'));
    expect(normaliseBody('<p>a  b\n</p>')).toBe(normaliseBody('<p>a b</p>'));
    expect(normaliseBody('<blockquote>Q</blockquote><ul><li>One<ul><li>x</li></ul></li></ul>')).toBe(normaliseBody('<blockquote><p>Q</p></blockquote><ul><li><p>One</p><ul><li>x</li></ul></li></ul>'));
    expect(normaliseBody('<p>a&nbsp;&nbsp;b</p>')).not.toBe(normaliseBody('<p>a b</p>'));
    expect(normaliseBody('<p><a href="https://x.example/">x</a></p>')).not.toBe(normaliseBody('<p>x</p>'));
    expect(normaliseBody('<p><strong>a</strong></p>')).not.toBe(normaliseBody('<p>a</p>'));
  });

  it('accepts only single-video links for the toolbar, and never writes a nocookie host', () => {
    expect(youtubeEmbedFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(youtubeEmbedFromUrl('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?start=42');
    expect(youtubeEmbedFromUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(youtubeEmbedFromUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(youtubeEmbedFromUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBeNull();
    for (const refused of ['https://www.youtube.com/playlist?list=PLabc', 'https://www.youtube.com/watch?list=PLabc', 'https://www.youtube.com/embed/videoseries?list=PLabc', 'https://example.com/watch?v=dQw4w9WgXcQ', 'javascript:alert(1)', 'nope']) {
      expect(youtubeEmbedFromUrl(refused), refused).toBeNull();
    }
  });

  it('the toolbar dialog refuses a playlist link with a message and inserts nothing', async () => {
    const onChange = vi.fn();
    await mount('<p>a</p>', onChange);
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Insert YouTube video"]')!.click());
    const input = document.querySelector<HTMLInputElement>('[role="dialog"] input[type="url"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'https://www.youtube.com/playlist?list=PLabc');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const ok = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((button) => button.textContent === 'Insert video')!;
    await act(async () => ok.click());
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain('Playlist links are not accepted');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('the embed width of a card or a video (D-273)', () => {
  const A = '7d1b0a52-3a8e-4f0c-9b8a-2a7c1e4d5f60';
  const SRC = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
  const card = (width?: string) => `<tinz-product data-id="${A}"${width === undefined ? '' : ` data-width="${width}"`}></tinz-product>`;
  const video = (width?: string) => `<iframe src="${SRC}" allowfullscreen${width === undefined ? '' : ` data-width="${width}"`}></iframe>`;

  it('a stored card and video at a width are not locked, and come back byte-identical, edited or not', async () => {
    const stored = sanitizeArticleHtml(`<p>a</p>${card('60')}${video('75')}<p>b</p>`).html;
    expect(stored).toBe(`<p>a</p>${card('60')}${video('75')}<p>b</p>`);
    const onChange = vi.fn();
    const editor = await mount(stored, onChange);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(editor.isEditable).toBe(true);
    expect(wouldLoseContent(stored, editor.getHTML())).toBe(false);
    expect(sanitizeArticleHtml(editor.getHTML()).html).toBe(stored);
    expect(normaliseBody(sanitizeArticleHtml(editor.getHTML()).html)).toBe(normaliseBody(stored));
    await act(async () => {
      editor.chain().focus('end').insertContent('x').run();
    });
    expect(sanitizeArticleHtml(onChange.mock.calls.at(-1)![0] as string).html).toBe(`<p>a</p>${card('60')}${video('75')}<p>bx</p>`);
  });

  it('keeps a stored width on a video inside a figure, which the editor does not offer to resize', async () => {
    const stored = sanitizeArticleHtml(`<figure>${video('60')}<figcaption>c</figcaption></figure>`).html;
    expect(stored).toContain('data-width="60"');
    const editor = await mount(stored);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(sanitizeArticleHtml(editor.getHTML()).html).toBe(stored);
  });

  it('counts a changed, added or lost width as a difference', () => {
    expect(normaliseBody(card('60'))).not.toBe(normaliseBody(card()));
    expect(normaliseBody(card('60'))).not.toBe(normaliseBody(card('45')));
    expect(normaliseBody(video('60'))).not.toBe(normaliseBody(video()));
    expect(normaliseBody(video('60'))).not.toBe(normaliseBody(video('45')));
    expect(wouldLoseContent(card('60'), card())).toBe(true);
    expect(wouldLoseContent(video('60'), video('60'))).toBe(false);
  });
});

describe('uploaded images in a stored body (plan 017, D-277)', () => {
  const KEY = 'news/2026/11/0f8fad5b-d9cb-469f-a165-70867728950e.jpg';
  const KEY2 = 'news/2026/12/1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed.png';

  it('a stored body with keyed images, inline and in a figure, is not locked and comes back byte for byte, edited or not', async () => {
    const stored = sanitizeArticleHtml(
      `<p>a</p><p><img data-media-key="${KEY}" alt="รูป"></p><figure><img data-media-key="${KEY2}" alt="b"><figcaption>c</figcaption></figure><p>b</p>`,
    ).html;
    expect(stored).toContain(`<img data-media-key="${KEY}" alt="รูป" />`);
    const onChange = vi.fn();
    const editor = await mount(stored, onChange);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(editor.isEditable).toBe(true);
    expect(wouldLoseContent(stored, editor.getHTML())).toBe(false);
    expect(editor.getHTML()).not.toContain('src=');
    expect(sanitizeArticleHtml(editor.getHTML()).html).toBe(stored);
    await act(async () => {
      editor.chain().focus('end').insertContent('x').run();
    });
    expect(sanitizeArticleHtml(onChange.mock.calls.at(-1)![0] as string).html).toBe(stored.replace('<p>b</p>', '<p>bx</p>'));
  });

  it('counts a lost or changed key as a difference', () => {
    const keyed = `<p><img data-media-key="${KEY}" alt="a" /></p>`;
    expect(normaliseBody(keyed)).not.toBe(normaliseBody('<p><img alt="a" /></p>'));
    expect(normaliseBody(keyed)).not.toBe(normaliseBody(`<p><img data-media-key="${KEY2}" alt="a" /></p>`));
    expect(wouldLoseContent(keyed, keyed)).toBe(false);
  });

  it('still keeps an imported image\'s src exactly', async () => {
    const stored = sanitizeArticleHtml('<p><img src="https://old.example/b.jpg" alt="b"></p>').html;
    const editor = await mount(stored);
    expect(sanitizeArticleHtml(editor.getHTML()).html).toBe(stored);
  });
});

describe('the embed width of an uploaded image (D-283)', () => {
  const KEY = 'news/2026/11/0f8fad5b-d9cb-469f-a165-70867728950e.jpg';
  const image = (width?: string) => `<p><img data-media-key="${KEY}" alt="รูป"${width === undefined ? '' : ` data-width="${width}"`} /></p>`;

  it('a stored body with a sized uploaded image is not locked and comes back byte for byte, edited or not', async () => {
    const stored = sanitizeArticleHtml(`<p>a</p>${image('60')}<p>b</p>`).html;
    expect(stored).toBe(`<p>a</p>${image('60')}<p>b</p>`);
    const onChange = vi.fn();
    const editor = await mount(stored, onChange);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(editor.isEditable).toBe(true);
    expect(wouldLoseContent(stored, editor.getHTML())).toBe(false);
    expect(sanitizeArticleHtml(editor.getHTML()).html).toBe(stored);
    await act(async () => {
      editor.chain().focus('end').insertContent('x').run();
    });
    expect(sanitizeArticleHtml(onChange.mock.calls.at(-1)![0] as string).html).toBe(`<p>a</p>${image('60')}<p>bx</p>`);
  });

  it('counts a changed, added or lost image width as a difference', () => {
    expect(normaliseBody(image('60'))).not.toBe(normaliseBody(image()));
    expect(normaliseBody(image('60'))).not.toBe(normaliseBody(image('45')));
    expect(wouldLoseContent(image('60'), image())).toBe(true);
    expect(wouldLoseContent(image('60'), image('60'))).toBe(false);
  });
});
