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
});
