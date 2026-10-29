import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ArticlesMenu, {
  CLOSED,
  articlesMenuReducer,
  isHoverPointer,
  shouldFlipLeft,
  type ArticlesMenuProps,
} from './ArticlesMenu';

const PROPS: ArticlesMenuProps = {
  label: 'บทความ',
  items: [
    { label: 'รีวิวสินค้า', href: '/th/news/category/reviews', submenuLabel: null, children: [] },
    {
      label: 'News',
      href: '/th/news',
      submenuLabel: 'เมนูย่อย News',
      children: [
        { label: 'Nintendo Switch 2', href: '/th/news/category/nintendo-switch-2' },
        { label: 'SONY Playstation', href: '/th/news/category/sony-playstation' },
      ],
    },
  ],
};

describe('ArticlesMenu', () => {
  it('renders a closed disclosure button that controls the panel, with every configured link in the HTML', () => {
    const html = renderToStaticMarkup(<ArticlesMenu {...PROPS} />);
    const button = html.match(/<button[^>]*>[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(button).toContain('type="button"');
    expect(button).toContain('aria-expanded="false"');
    expect(button).toContain('บทความ');
    const controls = button.match(/aria-controls="([^"]+)"/)?.[1];
    expect(controls).toBeDefined();
    expect(html).toMatch(new RegExp(`<div id="${controls}" hidden=""`));
    expect(html).toContain('href="/th/news/category/reviews"');
    expect(html).toContain('>รีวิวสินค้า</a>');
    expect(html).toContain('href="/th/news"');
    expect(html).toContain('href="/th/news/category/nintendo-switch-2"');
    expect(html).toContain('>SONY Playstation</a>');
  });

  it('gives an item with a submenu its own collapsed toggle, and none to an item without', () => {
    const html = renderToStaticMarkup(<ArticlesMenu {...PROPS} />);
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toMatch(/<button[^>]*aria-label="เมนูย่อย News"[^>]*aria-expanded="false"|<button[^>]*aria-expanded="false"[^>]*aria-label="เมนูย่อย News"/);
  });

  it('opens the News submenu to the right of the panel with a "›" chevron, as on the old site', () => {
    const html = renderToStaticMarkup(<ArticlesMenu {...PROPS} />);
    const submenu = html.match(/<ul[^>]*id="[^"]*-submenu-1"[^>]*>/)?.[0] ?? '';
    expect(submenu).toContain('md:absolute md:top-0');
    expect(submenu).toContain('md:left-full');
    expect(submenu).not.toContain('md:right-full');
    const toggle = html.match(/<button[^>]*aria-label="เมนูย่อย News"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(toggle).toContain('d="m9 6 6 6-6 6"'); // chevRight
    expect(toggle).not.toContain('d="m15 6-6 6 6 6"'); // chevLeft
  });

  it('renders nothing when there is no item', () => {
    expect(renderToStaticMarkup(<ArticlesMenu label="บทความ" items={[]} />)).toBe('');
  });
});

describe('articlesMenuReducer', () => {
  it('toggles on click, Enter or Space (the button\'s own activation)', () => {
    const open = articlesMenuReducer(CLOSED, { type: 'toggle' });
    expect(open).toEqual({ open: true, submenu: null });
    expect(articlesMenuReducer(open, { type: 'toggle' })).toEqual(CLOSED);
  });

  it('opens on hover and closes when the pointer or focus leaves, or on Escape, closing the submenu too', () => {
    const open = articlesMenuReducer(CLOSED, { type: 'open' });
    expect(open).toEqual({ open: true, submenu: null });
    const withSubmenu = articlesMenuReducer(open, { type: 'toggleSubmenu', key: '/th/news' });
    expect(withSubmenu).toEqual({ open: true, submenu: '/th/news' });
    expect(articlesMenuReducer(withSubmenu, { type: 'open' })).toBe(withSubmenu);
    expect(articlesMenuReducer(withSubmenu, { type: 'toggleSubmenu', key: '/th/news' })).toEqual(open);
    expect(articlesMenuReducer(withSubmenu, { type: 'close' })).toEqual(CLOSED);
    expect(articlesMenuReducer(withSubmenu, { type: 'closeSubmenu' })).toEqual(open);
    expect(articlesMenuReducer(open, { type: 'openSubmenu', key: '/th/news' })).toEqual(withSubmenu);
  });

  it('never opens the submenu of a closed menu', () => {
    expect(articlesMenuReducer(CLOSED, { type: 'openSubmenu', key: '/th/news' })).toEqual(CLOSED);
    expect(articlesMenuReducer(CLOSED, { type: 'toggleSubmenu', key: '/th/news' })).toEqual(CLOSED);
  });
});

describe('shouldFlipLeft', () => {
  it('flips the submenu left only when opening right would run past the viewport', () => {
    expect(shouldFlipLeft(1200, 1440)).toBe(false);
    expect(shouldFlipLeft(1440, 1440)).toBe(false);
    expect(shouldFlipLeft(1441, 1440)).toBe(true);
  });
});

describe('isHoverPointer', () => {
  it('treats only a mouse as hover, so a tap never opens and closes the menu at once', () => {
    expect(isHoverPointer('mouse')).toBe(true);
    expect(isHoverPointer('touch')).toBe(false);
    expect(isHoverPointer('pen')).toBe(false);
  });
});
