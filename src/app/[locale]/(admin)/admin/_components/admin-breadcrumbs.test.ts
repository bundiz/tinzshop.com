import { describe, expect, it } from 'vitest';

import { adminBreadcrumbs } from './admin-breadcrumbs';

const ID = '44444444-4444-4444-8444-444444444444';

describe('adminBreadcrumbs', () => {
  it('names a section page alone, as the current page', () => {
    expect(adminBreadcrumbs('/th/admin', 'th')).toEqual([{ key: 'nav.dashboard' }]);
    expect(adminBreadcrumbs('/th/admin/news', 'th')).toEqual([{ key: 'nav.news' }]);
    expect(adminBreadcrumbs('/en/admin/users', 'en')).toEqual([{ key: 'nav.users' }]);
  });

  it('puts "all articles" (a link to the list) before the new-article and edit pages', () => {
    expect(adminBreadcrumbs('/th/admin/news/new', 'th')).toEqual([{ key: 'news.editor.back', href: '/th/admin/news' }, { key: 'news.new' }]);
    expect(adminBreadcrumbs(`/en/admin/news/${ID}`, 'en')).toEqual([{ key: 'news.editor.back', href: '/en/admin/news' }, { key: 'news.title' }]);
  });

  it('gives nothing for a path it does not know, or another locale prefix', () => {
    expect(adminBreadcrumbs('/th/admin/news/not-an-id', 'th')).toEqual([]);
    expect(adminBreadcrumbs('/th/admin/orders', 'th')).toEqual([]);
    expect(adminBreadcrumbs('/en/admin/news', 'th')).toEqual([]);
  });
});
