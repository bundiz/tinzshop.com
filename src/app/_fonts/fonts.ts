import localFont from 'next/font/local';

/*
 * The storefront's fonts (R3, D-212): Anuphan (Cadson Demak) for headings and IBM Plex Sans Thai (IBM) for
 * body text, both under the SIL Open Font License 1.1 (OFL-*.txt beside the files). Self-hosted: no request
 * to a font host at runtime. Each family is a Thai subset and a Latin subset with the mockup's unicode-range,
 * so a page downloads only the subsets its text uses. `layout.tsx` sets the four CSS variables on <html>;
 * `globals.css` composes them into `font-head` and `font-body`.
 */

export const anuphanThai = localFont({
  src: [
    { path: './anuphan-thai-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './anuphan-thai-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './anuphan-thai-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-anuphan-thai',
  display: 'swap',
  adjustFontFallback: false,
  preload: true,
  declarations: [{ prop: 'unicode-range', value: 'U+0E01-0E5B, U+200C-200D, U+25CC' }],
});

export const anuphanLatin = localFont({
  src: [
    { path: './anuphan-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './anuphan-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './anuphan-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-anuphan-latin',
  display: 'swap',
  adjustFontFallback: false,
  preload: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+2000-206F, U+20AC, U+0E3F' }],
});

export const plexThai = localFont({
  src: [
    { path: './ibm-plex-sans-thai-thai-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './ibm-plex-sans-thai-thai-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './ibm-plex-sans-thai-thai-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './ibm-plex-sans-thai-thai-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-plex-thai',
  display: 'swap',
  adjustFontFallback: false,
  preload: true,
  declarations: [{ prop: 'unicode-range', value: 'U+0E01-0E5B, U+200C-200D, U+25CC' }],
});

export const plexLatin = localFont({
  src: [
    { path: './ibm-plex-sans-thai-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './ibm-plex-sans-thai-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './ibm-plex-sans-thai-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './ibm-plex-sans-thai-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-plex-latin',
  display: 'swap',
  adjustFontFallback: false,
  preload: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+2000-206F, U+20AC, U+0E3F' }],
});
