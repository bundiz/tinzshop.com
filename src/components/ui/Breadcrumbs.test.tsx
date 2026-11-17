import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Breadcrumbs from './Breadcrumbs';

const html = renderToStaticMarkup(
  <Breadcrumbs
    label="Where you are"
    items={[{ label: 'Home', href: '/th' }, { label: 'PlayStation 5', href: '/th/product?category=playstation-5' }, { label: 'Controller' }]}
  />,
);

describe('Breadcrumbs', () => {
  it('is a navigation landmark with the given label', () => {
    expect(html).toMatch(/^<nav aria-label="Where you are"/);
  });

  it('is an ordered list with one item per crumb', () => {
    expect(html).toMatch(/<nav[^>]*><ol[^>]*>/);
    expect(html.match(/<li[ >]/g)).toHaveLength(3);
    expect(html).toMatch(/<li[^>]*><svg[^>]*aria-hidden="true"/);
  });

  it('links the items that have an href', () => {
    expect(html).toMatch(/<a[^>]*href="\/th"[^>]*>Home<\/a>/);
    expect(html).toMatch(/<a[^>]*href="\/th\/product\?category=playstation-5"[^>]*>PlayStation 5<\/a>/);
  });

  it('marks the last item, which has no href, as the current page', () => {
    expect(html).toContain('<span aria-current="page"');
    expect(html).toMatch(/<span aria-current="page"[^>]*>Controller<\/span>/);
    expect(html).not.toMatch(/<a[^>]*>Controller/);
  });

  it('separates items with chevrons that are hidden from assistive technology', () => {
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(2);
  });

  it('gives each link a 44px tap target below sm', () => {
    expect(html).toContain('min-h-11');
    expect(html).toContain('sm:min-h-8');
  });

  it('draws the bar variant for a box drawn around it: no padding or border of its own, the current page in ink', () => {
    const bar = renderToStaticMarkup(<Breadcrumbs variant="bar" label="Where you are" items={[{ label: 'News', href: '/th/admin/news' }, { label: 'New article' }]} />);
    expect(bar).toMatch(/^<nav aria-label="Where you are" class="min-w-0 text-sm text-muted">/);
    expect(bar).toMatch(/<span aria-current="page" class="[^"]*text-ink[^"]*">New article<\/span>/);
    expect(html).not.toContain('text-ink"');
  });
});
