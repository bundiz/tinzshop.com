import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ArticlesMenu, {
  CLOSED,
  activationPointer,
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
  const NEWS = '/th/news';
  const OPEN = { open: true, submenu: null };
  const WITH_SUBMENU = { open: true, submenu: NEWS };

  it('hover open, then mouse click, stays open: for the menu', () => {
    const hovered = articlesMenuReducer(CLOSED, { type: 'open' });
    expect(hovered).toEqual(OPEN);
    expect(articlesMenuReducer(hovered, { type: 'activate', pointer: 'mouse' })).toEqual(OPEN);
    // A mouse click on a closed menu (closed by Escape while hovering) opens it.
    expect(articlesMenuReducer(CLOSED, { type: 'activate', pointer: 'mouse' })).toEqual(OPEN);
  });

  it('hover open, then mouse click, stays open: for the submenu', () => {
    const hovered = articlesMenuReducer(OPEN, { type: 'openSubmenu', key: NEWS });
    expect(hovered).toEqual(WITH_SUBMENU);
    expect(articlesMenuReducer(hovered, { type: 'activateSubmenu', key: NEWS, pointer: 'mouse' })).toEqual(WITH_SUBMENU);
  });

  it('keyboard Enter toggles the menu and the submenu', () => {
    const open = articlesMenuReducer(CLOSED, { type: 'activate', pointer: 'keyboard' });
    expect(open).toEqual(OPEN);
    expect(articlesMenuReducer(open, { type: 'activate', pointer: 'keyboard' })).toEqual(CLOSED);
    const sub = articlesMenuReducer(open, { type: 'activateSubmenu', key: NEWS, pointer: 'keyboard' });
    expect(sub).toEqual(WITH_SUBMENU);
    expect(articlesMenuReducer(sub, { type: 'activateSubmenu', key: NEWS, pointer: 'keyboard' })).toEqual(OPEN);
  });

  it('touch tap toggles the menu and the submenu', () => {
    const open = articlesMenuReducer(CLOSED, { type: 'activate', pointer: 'touch' });
    expect(open).toEqual(OPEN);
    expect(articlesMenuReducer(open, { type: 'activate', pointer: 'touch' })).toEqual(CLOSED);
    const sub = articlesMenuReducer(open, { type: 'activateSubmenu', key: NEWS, pointer: 'touch' });
    expect(sub).toEqual(WITH_SUBMENU);
    expect(articlesMenuReducer(sub, { type: 'activateSubmenu', key: NEWS, pointer: 'touch' })).toEqual(OPEN);
  });

  it('closes on Escape, focus leaving or the mouse leaving, closing the submenu too', () => {
    expect(articlesMenuReducer(WITH_SUBMENU, { type: 'close' })).toEqual(CLOSED);
    expect(articlesMenuReducer(WITH_SUBMENU, { type: 'closeSubmenu' })).toEqual(OPEN);
    expect(articlesMenuReducer(WITH_SUBMENU, { type: 'open' })).toBe(WITH_SUBMENU);
  });

  it('never opens the submenu of a closed menu', () => {
    expect(articlesMenuReducer(CLOSED, { type: 'openSubmenu', key: NEWS })).toEqual(CLOSED);
    for (const pointer of ['mouse', 'touch', 'keyboard'] as const) {
      expect(articlesMenuReducer(CLOSED, { type: 'activateSubmenu', key: NEWS, pointer })).toEqual(CLOSED);
    }
  });
});

describe('activationPointer', () => {
  it('reads a click with detail 0, or an empty pointer type, as the keyboard', () => {
    expect(activationPointer(0, 'mouse')).toBe('keyboard');
    expect(activationPointer(0, undefined)).toBe('keyboard');
    expect(activationPointer(1, '')).toBe('keyboard');
  });

  it('reads a touch or pen tap as such, and any other click as the mouse', () => {
    expect(activationPointer(1, 'touch')).toBe('touch');
    expect(activationPointer(1, 'pen')).toBe('pen');
    expect(activationPointer(1, 'mouse')).toBe('mouse');
    expect(activationPointer(1, undefined)).toBe('mouse');
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
