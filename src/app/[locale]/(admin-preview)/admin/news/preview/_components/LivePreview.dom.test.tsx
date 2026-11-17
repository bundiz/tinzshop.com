// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../../../../../../../messages/en.json';
import type { NewsArticleDetail } from '@/server/services/news/news-read-service';
import LivePreview from './LivePreview';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// The real action is a Server Action; every test passes its own stand-in.
vi.mock('../actions', () => ({ previewArticleAction: async () => null }));

const SESSION = '99999999-9999-4999-8999-999999999999';

/** A stand-in for the browser's `BroadcastChannel`: records what the preview posts, and lets a test speak as the editor. */
class FakeChannel {
  static all: FakeChannel[] = [];
  posted: unknown[] = [];
  closed = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  constructor(readonly name: string) {
    FakeChannel.all.push(this);
  }
  postMessage(data: unknown): void {
    this.posted.push(data);
  }
  close(): void {
    this.closed = true;
  }
  receive(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

type Pending = { draft: unknown; resolve: (detail: NewsArticleDetail | null) => void; reject: (error: Error) => void };

let container: HTMLDivElement;
let root: Root;
let pending: Pending[];
const action = vi.fn(
  (_locale: string, draft: unknown) =>
    new Promise<NewsArticleDetail | null>((resolve, reject) => {
      pending.push({ draft, resolve, reject });
    }),
);

beforeEach(() => {
  FakeChannel.all = [];
  pending = [];
  action.mockClear();
  vi.stubGlobal('BroadcastChannel', FakeChannel);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function mount(): Promise<FakeChannel> {
  await act(async () => {
    root.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Bangkok">
        <LivePreview
          locale="en"
          session={SESSION}
          articlesMenu={[]}
          customer={null}
          action={action}
          renderArticle={(detail) => <article>{detail.title}</article>}
        />
      </NextIntlClientProvider>,
    );
  });
  return FakeChannel.all[0]!;
}

const bar = () => container.querySelector('[role="status"]')!.textContent;
const draft = (title: string) => ({ type: 'draft', draft: { title } });
/** What the action answers: the article as data (D-253 as fixed on 2026-11-17), drawn in the browser. */
const detail = (title: string) => ({ title }) as NewsArticleDetail;

describe('LivePreview (D-253)', () => {
  it('joins the session channel and asks the editor for its draft, waiting meanwhile', async () => {
    const channel = await mount();
    expect(channel.name).toBe(`tinz-news-preview:${SESSION}`);
    expect(channel.posted).toEqual([{ type: 'ready' }]);
    expect(bar()).toBe('Waiting for the editor…');
  });

  it('draws each draft from the data the action returns, under the unsaved-preview bar', async () => {
    const channel = await mount();
    await act(async () => channel.receive(draft('One')));
    expect(action).toHaveBeenCalledWith('en', { title: 'One' });
    await act(async () => pending[0]!.resolve(detail('One')));
    expect(container.querySelector('article')?.textContent).toBe('One');
    expect(bar()).toBe('Unsaved preview. It follows what you type in the editor; customers cannot see it.');
  });

  it('never lets a slow, older answer replace a newer one', async () => {
    const channel = await mount();
    await act(async () => {
      channel.receive(draft('Old'));
      channel.receive(draft('New'));
    });
    await act(async () => pending[1]!.resolve(detail('New')));
    await act(async () => pending[0]!.resolve(detail('Old')));
    expect(container.querySelector('article')?.textContent).toBe('New');
  });

  it('keeps the last version and says so when the editor closes, or when an answer fails', async () => {
    const channel = await mount();
    await act(async () => channel.receive(draft('One')));
    await act(async () => pending[0]!.resolve(detail('One')));

    await act(async () => channel.receive(draft('Two')));
    await act(async () => pending[1]!.reject(new Error('network')));
    expect(bar()).toBe('The latest version could not be shown; the previous one is still on screen.');
    expect(container.querySelector('article')?.textContent).toBe('One');

    await act(async () => channel.receive(draft('Three')));
    await act(async () => pending[2]!.resolve(null));
    expect(bar()).toBe('The latest version could not be shown; the previous one is still on screen.');

    await act(async () => channel.receive({ type: 'closed' }));
    expect(bar()).toBe('The editor was closed. This preview will not update any more.');
    expect(container.querySelector('article')?.textContent).toBe('One');
  });

  it('says no editor is answering when nothing comes within three seconds', async () => {
    vi.useFakeTimers();
    await mount();
    await act(async () => vi.advanceTimersByTime(2_900));
    expect(bar()).toBe('Waiting for the editor…');
    await act(async () => vi.advanceTimersByTime(200));
    expect(bar()).toBe('Nothing has come from the editor. Press “Preview” in the news editor again.');
  });

  it('ignores messages of another shape, and closes its channel when it goes away', async () => {
    const channel = await mount();
    await act(async () => {
      channel.receive({ type: 'draft' });
      channel.receive('draft');
      channel.receive({ type: 'ready' });
    });
    expect(action).not.toHaveBeenCalled();
    act(() => root.unmount());
    root = createRoot(container);
    expect(channel.closed).toBe(true);
  });

  // A Server Action that returned the rendered page sent client components the preview route never loads, so React could
  // not find them in its client manifest ("Could not find the module … ArticlesMenu.tsx"). The action returns data; the
  // client draws it with the storefront's own component.
  it('draws the storefront article page in the browser: the action returns data, never a rendered element', () => {
    const here = join(process.cwd(), 'src/app/[locale]/(admin-preview)/admin/news/preview');
    const actions = readFileSync(join(here, 'actions.ts'), 'utf8');
    const preview = readFileSync(join(here, '_components/LivePreview.tsx'), 'utf8');
    expect(actions).not.toMatch(/createElement|import NewsArticleView|return\s*\(?\s*<[A-Za-z]/);
    expect(preview).toMatch(/import NewsArticleView from/);
  });
});
