import type { ReactNode } from 'react';

export type IconName =
  | 'search'
  | 'cart'
  | 'user'
  | 'heart'
  | 'chevRight'
  | 'chevLeft'
  | 'chevDown'
  | 'menu'
  | 'truck'
  | 'card'
  | 'store'
  | 'receipt'
  | 'calendar'
  | 'package'
  | 'chat'
  | 'shield'
  | 'filter'
  | 'grid'
  | 'list'
  | 'x'
  | 'wrench'
  | 'globe'
  | 'tag'
  | 'artConsole'
  | 'artHandheld'
  | 'artPad'
  | 'artDisc'
  | 'artHead'
  | 'artKey'
  | 'artBox'
  | 'artNews';

export type IconProps = {
  name: IconName;
  /** Size and colour utilities; the default is the design's 20px `.icon`. */
  className?: string;
  /** The design draws large background icons with a thinner stroke. */
  strokeWidth?: number;
};

/** The design's inline SVG icon set (`tinzshop-redesign/_build.mjs` symbols), always decorative: `aria-hidden`. */
export default function Icon({ name, className = 'size-5', strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`block flex-none fill-none stroke-current ${className}`}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}

const PATHS: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1.3" />
      <circle cx="18" cy="20" r="1.3" />
      <path d="M2.5 3.5h2.6l2.3 11.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.5-1.2L21 7.5H6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20.5c1.4-3.6 4.4-5.5 8-5.5s6.6 1.9 8 5.5" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.4-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.6 12 20 12 20Z" />,
  chevRight: <path d="m9 6 6 6-6 6" />,
  chevLeft: <path d="m15 6-6 6 6 6" />,
  chevDown: <path d="m6 9 6 6 6-6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  truck: (
    <>
      <path d="M3 6.5h11v9H3zM14 9.5h4l3 3v3h-7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17.5" cy="17.5" r="1.8" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  store: (
    <path d="M4 9.5 5.5 4h13L20 9.5M4 9.5h16M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5.5 12v8h13v-8M10 20v-4.5h4V20" />
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  package: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  chat: <path d="M4.5 5.5h15v10h-8.5l-4.5 3.5v-3.5h-2Z" />,
  shield: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6Z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" />
    </>
  ),
  filter: <path d="M4 5h16l-6.2 7.4V19l-3.6-1.8v-4.8Z" />,
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
    </>
  ),
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  wrench: <path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 1-2-2Z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5Z" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.5V4.5h8l9 9-8 8Z" />
      <circle cx="8" cy="9" r="1.3" />
    </>
  ),
  // Product art (generic, not brand look-alikes); drawn large at strokeWidth 0.9 by ImagePlaceholder.
  artConsole: (
    <>
      <path d="M8.5 2.5h5a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2Z" />
      <path d="M15.5 4c2.5.8 3.5 2.6 3.5 5v8c0 2.4-1 4.2-3.5 5M9 6.5h4M11 18h.01" />
    </>
  ),
  artHandheld: (
    <>
      <path d="M7 6h10v12H7z" />
      <path d="M7 6H5.5A2.5 2.5 0 0 0 3 8.5v7A2.5 2.5 0 0 0 5.5 18H7M17 6h1.5A2.5 2.5 0 0 1 21 8.5v7a2.5 2.5 0 0 1-2.5 2.5H17M8.6 7.6h6.8v8.8H8.6z" />
      <circle cx="5" cy="10" r=".7" />
      <circle cx="19" cy="14" r=".7" />
    </>
  ),
  artPad: (
    <>
      <path d="M8.5 6.5h7a5.5 5.5 0 0 1 5.4 6.6l-.7 3.4A2.6 2.6 0 0 1 16 17.6L14.7 16H9.3L8 17.6a2.6 2.6 0 0 1-4.2-1.1l-.7-3.4A5.5 5.5 0 0 1 8.5 6.5Z" />
      <path d="M6.5 11h3.5M8.25 9.25v3.5M15.5 10.4h.01M17.6 12.6h.01" />
    </>
  ),
  artDisc: (
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="1.5" />
      <path d="M5 5.5h14" />
      <circle cx="12" cy="13" r="4.5" />
      <circle cx="12" cy="13" r="1.2" />
    </>
  ),
  artHead: (
    <>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="14" width="4.5" height="6.5" rx="1.5" />
      <rect x="16.5" y="14" width="4.5" height="6.5" rx="1.5" />
    </>
  ),
  artKey: (
    <>
      <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
      <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 13.5h.01M18 13.5h.01M9 14h6" />
    </>
  ),
  artBox: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9M8 5.3l8 4.5" />
    </>
  ),
  artNews: (
    <>
      <path d="M4 10v4h3l6 4V6L7 10Z" />
      <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
};
