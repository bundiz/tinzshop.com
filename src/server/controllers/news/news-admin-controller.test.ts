import { describe, expect, it, vi, type Mock } from 'vitest';

import { saveArticle, type NewsAdminDeps } from '@/server/services/news/news-admin-service';
import {
  restoreArticleCommand,
  saveArticleCommand,
  searchProductsCommand,
  trashArticleCommand,
  type NewsAdminCommandDeps,
} from './news-admin-controller';

const NOW = new Date('2026-11-14T10:00:00Z');
const ACTOR = { id: '11111111-1111-4111-8111-111111111111', permissions: ['backoffice.enter', 'news.manage'] as const };
const CATEGORY = '22222222-2222-4222-8222-222222222222';
const PRODUCT = '33333333-3333-4333-8333-333333333333';
const ARTICLE = '44444444-4444-4444-8444-444444444444';

function form(entries: Record<string, string | string[]> = {}): FormData {
  const data = new FormData();
  const base: Record<string, string | string[]> = {
    action: 'draft',
    thTitle: 'ข่าวใหม่',
    thExcerpt: 'สรุป',
    thBodyHtml: '<p>เนื้อหา</p>',
    categoryId: [CATEGORY],
    ...entries,
  };
  for (const [name, value] of Object.entries(base)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(name, item);
  }
  return data;
}

type Fakes = NewsAdminCommandDeps & { save: Mock; trash: Mock; restore: Mock; searchProducts: Mock; log: Mock };

function setup(overrides: Partial<NewsAdminCommandDeps> = {}): Fakes {
  const deps = {
    save: vi.fn(async () => ({ ok: true as const, data: { id: ARTICLE, slug: 'khao-mai' } })),
    trash: vi.fn(async (id: string) => ({ ok: true as const, data: { id } })),
    restore: vi.fn(async (id: string) => ({ ok: true as const, data: { id } })),
    searchProducts: vi.fn(async () => [{ id: PRODUCT, name: 'Switch', sku: 'NS-1', imageUrl: null }]),
    now: () => NOW,
    log: vi.fn(),
    ...overrides,
  };
  return deps as unknown as Fakes;
}

const sent = (deps: Fakes) => (deps.save.mock.calls[0] as unknown as [Record<string, any>])[0];

describe('saveArticleCommand: validation', () => {
  it('refuses an actor without news.manage before reading the form', async () => {
    const deps = setup();
    const state = await saveArticleCommand(deps, { id: ACTOR.id, permissions: ['backoffice.enter'] }, form());
    expect(state).toEqual({ status: 'error', errorKey: 'forbidden' });
    expect(deps.save).not.toHaveBeenCalled();
  });

  it('requires the Thai title and the Thai body', async () => {
    const deps = setup();
    expect(await saveArticleCommand(deps, ACTOR, form({ thTitle: '   ' }))).toEqual({ status: 'error', errorKey: 'titleRequired' });
    expect(await saveArticleCommand(deps, ACTOR, form({ thBodyHtml: '' }))).toEqual({ status: 'error', errorKey: 'bodyRequired' });
    expect(deps.save).not.toHaveBeenCalled();
  });

  it('takes English as a set: all blank passes null, a half-filled one is refused', async () => {
    const deps = setup();
    expect(await saveArticleCommand(deps, ACTOR, form({ enTitle: 'Title' }))).toEqual({ status: 'error', errorKey: 'englishIncomplete' });
    expect(deps.save).not.toHaveBeenCalled();

    await saveArticleCommand(deps, ACTOR, form({ enTitle: '', enExcerpt: '', enBodyHtml: '' }));
    expect(sent(deps).input.en).toBeNull();

    await saveArticleCommand(deps, ACTOR, form({ enTitle: 'Title', enBodyHtml: '<p>en</p>' }));
    expect((deps.save.mock.calls[1] as unknown as [Record<string, any>])[0].input.en).toMatchObject({ title: 'Title', bodyHtml: '<p>en</p>' });
  });

  it('refuses ids that are not uuids, and an unknown action', async () => {
    const deps = setup();
    expect(await saveArticleCommand(deps, ACTOR, form({ categoryId: ['nope'] }))).toEqual({ status: 'error', errorKey: 'invalid' });
    expect(await saveArticleCommand(deps, ACTOR, form({ productId: ['nope'] }))).toEqual({ status: 'error', errorKey: 'invalid' });
    expect(await saveArticleCommand(deps, ACTOR, form({ id: 'nope' }))).toEqual({ status: 'error', errorKey: 'invalid' });
    expect(await saveArticleCommand(deps, ACTOR, form({ action: 'review' }))).toEqual({ status: 'error', errorKey: 'invalid' });
    expect(deps.save).not.toHaveBeenCalled();
  });

  it('turns the service refusals for unknown categories and products into message keys', async () => {
    const refuse = (field: string) => async () => ({ ok: false as const, error: { code: 'news.invalid', message: 'x', messageKey: 'k', details: { field } } });
    const categories = setup({ save: vi.fn(refuse('categoryIds')) });
    expect(await saveArticleCommand(categories, ACTOR, form({ action: 'publish' }))).toEqual({ status: 'error', errorKey: 'categories' });
    const products = setup({ save: vi.fn(refuse('productIds')) });
    expect(await saveArticleCommand(products, ACTOR, form({ productId: [PRODUCT] }))).toEqual({ status: 'error', errorKey: 'products' });
    const excerpt = setup({ save: vi.fn(refuse('th.excerpt')) });
    expect(await saveArticleCommand(excerpt, ACTOR, form({ action: 'publish' }))).toEqual({ status: 'error', errorKey: 'excerptRequired' });
    const missing = setup({ save: vi.fn(async () => ({ ok: false as const, error: { code: 'news.not_found', message: 'x', messageKey: 'k' } })) });
    expect(await saveArticleCommand(missing, ACTOR, form({ id: ARTICLE }))).toEqual({ status: 'error', errorKey: 'notFound' });
  });
});

describe('saveArticleCommand: caps', () => {
  it('refuses a title longer than 300 characters in either language, and accepts exactly 300', async () => {
    const deps = setup();
    expect(await saveArticleCommand(deps, ACTOR, form({ thTitle: 'ก'.repeat(301) }))).toEqual({ status: 'error', errorKey: 'invalid' });
    expect(await saveArticleCommand(deps, ACTOR, form({ enTitle: 'a'.repeat(301), enBodyHtml: '<p>x</p>' }))).toEqual({ status: 'error', errorKey: 'invalid' });
    expect(deps.save).not.toHaveBeenCalled();
    expect((await saveArticleCommand(deps, ACTOR, form({ thTitle: 'ก'.repeat(300) }))).status).toBe('saved');
  });

  it('refuses "publish later" with no date, but not "now" or a draft', async () => {
    const deps = setup();
    expect(await saveArticleCommand(deps, ACTOR, form({ action: 'publish', when: 'later', publishAt: '' }))).toEqual({ status: 'error', errorKey: 'publishAtRequired' });
    expect(deps.save).not.toHaveBeenCalled();
    expect((await saveArticleCommand(deps, ACTOR, form({ action: 'publish', when: 'now' }))).status).toBe('saved');
    expect((await saveArticleCommand(deps, ACTOR, form({ action: 'publish', when: 'later', publishAt: '2026-11-20T09:00' }))).status).toBe('saved');
  });
});

describe('saveArticleCommand: what reaches the service', () => {
  it('passes the actor, the lists and the Thai-time publish date as UTC', async () => {
    const deps = setup();
    const state = await saveArticleCommand(
      deps,
      ACTOR,
      form({ id: ARTICLE, action: 'publish', publishAt: '2026-11-20T09:00', tag: ['Switch 2', 'มือใหม่'], productId: [PRODUCT], slug: 'my-slug', bylineName: 'Nok' }),
    );
    expect(state).toEqual({ status: 'saved', id: ARTICLE, slug: 'khao-mai', action: 'publish' });
    expect(sent(deps)).toMatchObject({
      id: ARTICLE,
      editorId: ACTOR.id,
      action: 'publish',
      now: NOW,
      input: { slug: 'my-slug', bylineName: 'Nok', categoryIds: [CATEGORY], tagNames: ['Switch 2', 'มือใหม่'], productIds: [PRODUCT] },
    });
    expect(sent(deps).publishAt.toISOString()).toBe('2026-11-20T02:00:00.000Z');
  });

  it('refuses a publish date that is not a local date and time', async () => {
    const deps = setup();
    expect(await saveArticleCommand(deps, ACTOR, form({ action: 'publish', publishAt: 'tomorrow' }))).toEqual({ status: 'error', errorKey: 'publishAtInvalid' });
    expect(await saveArticleCommand(deps, ACTOR, form({ action: 'publish', publishAt: '2026-13-40T99:00' }))).toEqual({ status: 'error', errorKey: 'publishAtInvalid' });
    expect(deps.save).not.toHaveBeenCalled();
  });

  it('treats an empty publish date as none', async () => {
    const deps = setup();
    await saveArticleCommand(deps, ACTOR, form({ action: 'publish', publishAt: '' }));
    expect(sent(deps).publishAt).toBeNull();
  });

  it('publishes now when the chosen time is already past (the service rule, end to end)', async () => {
    const news = {
      listAdminArticles: vi.fn(),
      findAdminArticle: vi.fn(async () => null),
      findExistingCategoryIds: vi.fn(async (ids: readonly string[]) => [...ids]),
      findListedCategoryIds: vi.fn(async (ids: readonly string[]) => [...ids]),
      findExistingProductIds: vi.fn(async (ids: readonly string[]) => [...ids]),
      findEditorFirstName: vi.fn(async () => 'Editor'),
      saveArticle: vi.fn(async () => ({ id: ARTICLE, slug: 's' })),
      setArticleDeleted: vi.fn(async () => true),
    };
    const serviceDeps = { news, sanitize: (html: string) => html, now: () => NOW } as unknown as NewsAdminDeps;
    const deps = setup({ save: (request) => saveArticle(serviceDeps, request) });
    const state = await saveArticleCommand(deps, ACTOR, form({ action: 'publish', publishAt: '2026-11-01T09:00' }));
    expect(state.status).toBe('saved');
    const written = (news.saveArticle.mock.calls[0] as unknown as [{ status: string; publishedAt: Date }])[0];
    expect(written.status).toBe('published');
    expect(written.publishedAt).toEqual(NOW);
  });

  it('logs ids and the action, never the title or body text', async () => {
    const deps = setup();
    await saveArticleCommand(deps, ACTOR, form({ thTitle: 'SECRET-TITLE', thBodyHtml: '<p>SECRET-BODY</p>' }));
    const logged = JSON.stringify(deps.log.mock.calls);
    expect(logged).toContain(ARTICLE);
    expect(logged).not.toContain('SECRET');
  });
});

describe('trash, restore and the product search', () => {
  it('trashes and restores by uuid, refusing without news.manage or with a bad id', async () => {
    const deps = setup();
    expect(await trashArticleCommand(deps, ACTOR, form({ id: ARTICLE }))).toEqual({ status: 'done' });
    expect(deps.trash).toHaveBeenCalledWith(ARTICLE, ACTOR.id);
    expect(await restoreArticleCommand(deps, ACTOR, form({ id: ARTICLE }))).toEqual({ status: 'done' });
    expect(deps.restore).toHaveBeenCalledWith(ARTICLE, ACTOR.id);
    expect(await trashArticleCommand(deps, ACTOR, form({ id: 'x' }))).toEqual({ status: 'error', errorKey: 'invalid' });
    expect(await restoreArticleCommand(deps, { id: ACTOR.id, permissions: [] }, form({ id: ARTICLE }))).toEqual({ status: 'error', errorKey: 'forbidden' });
  });

  it('searches products for news.manage only, and returns nothing for a blank query', async () => {
    const deps = setup();
    expect(await searchProductsCommand(deps, ACTOR, ' switch ')).toHaveLength(1);
    expect(deps.searchProducts).toHaveBeenCalledWith('switch');
    expect(await searchProductsCommand(deps, ACTOR, '   ')).toEqual([]);
    expect(await searchProductsCommand(deps, { id: ACTOR.id, permissions: [] }, 'switch')).toEqual([]);
    expect(deps.searchProducts).toHaveBeenCalledTimes(1);
  });
});
