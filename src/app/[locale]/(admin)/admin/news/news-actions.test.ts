import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  save: vi.fn(async () => ({ status: 'saved', id: 'a', slug: 's', action: 'draft' })),
  trash: vi.fn(async () => ({ status: 'done' })),
  restore: vi.fn(async () => ({ status: 'done' })),
  searchProducts: vi.fn(async () => [{ id: 'p', name: 'Switch', sku: 'NS', imageUrl: null }]),
  createCategory: vi.fn(async () => ({ status: 'created', category: { id: 'c', slug: 'guides', isListed: true, names: { th: 'คู่มือ' } } })),
  productCards: vi.fn(async () => ({ p: null })),
  uploadImage: vi.fn(async () => ({ status: 'uploaded', key: 'news/k', url: 'https://media.example.com/news/k' })),
  revalidatePath: vi.fn(),
}));

vi.mock('../_lib/require-permission', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/server/composition-root', () => ({
  getNewsAdminCommands: () => ({
    save: mocks.save,
    trash: mocks.trash,
    restore: mocks.restore,
    searchProducts: mocks.searchProducts,
    createCategory: mocks.createCategory,
    productCards: mocks.productCards,
  }),
  getNewsImageUpload: () => mocks.uploadImage,
}));

const {
  createCategoryAction,
  productCardsAction,
  restoreArticleAction,
  saveArticleAction,
  searchProductsAction,
  trashArticleAction,
  uploadNewsImageAction,
} = await import('./actions');

const idle = { status: 'idle' } as const;
const ACTOR = { id: 'actor-1', permissions: ['backoffice.enter', 'news.manage'] };

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.append(name, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue(ACTOR);
});

describe('the news Server Actions', () => {
  it('uploadNewsImageAction checks news.manage on the server and stops a signed-out visitor before the upload', async () => {
    mocks.requirePermission.mockRejectedValue(new Error('NEXT_REDIRECT'));
    const data = new FormData();
    data.append('file', new File([new Uint8Array([1])], 'x.png'));
    await expect(uploadNewsImageAction(data)).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.requirePermission).toHaveBeenCalledWith('th', expect.stringContaining('/admin/news'), 'news.manage');
    expect(mocks.uploadImage).not.toHaveBeenCalled();
  });

  it('uploadNewsImageAction passes the actor and the form to the controller and returns its state', async () => {
    const data = new FormData();
    data.append('file', new File([new Uint8Array([1])], 'x.png'));
    expect(await uploadNewsImageAction(data)).toEqual({ status: 'uploaded', key: 'news/k', url: 'https://media.example.com/news/k' });
    expect(mocks.uploadImage).toHaveBeenCalledWith(ACTOR, data);
  });

  it.each([
    ['saveArticleAction', saveArticleAction, mocks.save],
    ['trashArticleAction', trashArticleAction, mocks.trash],
    ['restoreArticleAction', restoreArticleAction, mocks.restore],
  ] as const)('%s checks news.manage on the server and stops when it is refused', async (_name, action, command) => {
    mocks.requirePermission.mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(action(idle, form({ locale: 'en' }))).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.requirePermission).toHaveBeenCalledWith('en', expect.stringContaining('/admin/news'), 'news.manage');
    expect(command).not.toHaveBeenCalled();
  });

  it('searchProductsAction checks news.manage and stops when it is refused', async () => {
    mocks.requirePermission.mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(searchProductsAction('switch', 'th')).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.requirePermission).toHaveBeenCalledWith('th', expect.stringContaining('/admin/news'), 'news.manage');
    expect(mocks.searchProducts).not.toHaveBeenCalled();
  });

  it('productCardsAction checks news.manage and stops when it is refused (D-266)', async () => {
    mocks.requirePermission.mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(productCardsAction(['p'], 'en')).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.requirePermission).toHaveBeenCalledWith('en', expect.stringContaining('/admin/news'), 'news.manage');
    expect(mocks.productCards).not.toHaveBeenCalled();
  });

  it('productCardsAction passes the actor, the ids and the locale (Thai for an unknown one) to the controller', async () => {
    expect(await productCardsAction(['p'], 'xx')).toEqual({ p: null });
    expect(mocks.productCards).toHaveBeenCalledWith(ACTOR, ['p'], 'th');
  });

  it('passes the signed-in actor and the form to the controller, and revalidates the list after a save', async () => {
    const data = form({ locale: 'en', action: 'draft' });
    expect(await saveArticleAction(idle, data)).toMatchObject({ status: 'saved' });
    expect(mocks.save).toHaveBeenCalledWith(ACTOR, data);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/en/admin/news');
  });

  it('does not revalidate when the controller refuses', async () => {
    mocks.save.mockResolvedValueOnce({ status: 'error', errorKey: 'titleRequired' } as never);
    expect(await saveArticleAction(idle, form({ locale: 'th' }))).toEqual({ status: 'error', errorKey: 'titleRequired' });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('falls back to Thai for an unknown locale field, and returns the product hits', async () => {
    await trashArticleAction(idle, form({ locale: 'xx' }));
    expect(mocks.requirePermission).toHaveBeenCalledWith('th', expect.any(String), 'news.manage');
    expect(await searchProductsAction('switch')).toEqual([{ id: 'p', name: 'Switch', sku: 'NS', imageUrl: null }]);
    expect(mocks.searchProducts).toHaveBeenCalledWith(ACTOR, 'switch');
  });

  it('createCategoryAction checks news.manage and stops when it is refused', async () => {
    mocks.requirePermission.mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(createCategoryAction('en', { thName: 'คู่มือ', enName: '' })).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.requirePermission).toHaveBeenCalledWith('en', expect.stringContaining('/admin/news'), 'news.manage');
    expect(mocks.createCategory).not.toHaveBeenCalled();
  });

  it('createCategoryAction passes the actor and the names on, and revalidates the news pages in both languages after a create only', async () => {
    const input = { thName: 'คู่มือ', enName: 'Guides' };
    expect(await createCategoryAction('xx', input)).toMatchObject({ status: 'created' });
    expect(mocks.requirePermission).toHaveBeenCalledWith('th', expect.any(String), 'news.manage');
    expect(mocks.createCategory).toHaveBeenCalledWith(ACTOR, input);
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path).sort()).toEqual([
      '/en/admin/news',
      '/en/admin/news/new',
      '/th/admin/news',
      '/th/admin/news/new',
    ]);

    mocks.revalidatePath.mockClear();
    mocks.createCategory.mockResolvedValueOnce({ status: 'error', errorKey: 'categoryExists' } as never);
    expect(await createCategoryAction('th', input)).toEqual({ status: 'error', errorKey: 'categoryExists' });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
