export type ButtonVariant = 'buy' | 'brand' | 'line' | 'ghost' | 'lineApp' | 'danger';
export type ButtonSize = 'md' | 'lg' | 'admin' | 'adminSm';

// Height, side padding, text size and corners live in SIZE, so a back-office size replaces them rather than competing.
const BASE =
  'inline-flex items-center justify-center gap-2 border-[1.5px] border-transparent font-body leading-none font-semibold whitespace-nowrap transition-[transform,background-color,border-color,box-shadow] duration-[180ms] ease-soft hover:-translate-y-px active:translate-y-px active:scale-[.985]';

const STOREFRONT = 'min-h-12 rounded-sm px-[22px] text-base';

const VARIANT: Record<ButtonVariant, string> = {
  buy: 'bg-accent text-ink hover:bg-accent-2 hover:shadow-[0_8px_20px_-8px_rgba(254,166,1,.75)] active:bg-accent-press',
  // The mockup's `.btn-dark`.
  brand: 'bg-brand text-white hover:bg-brand-dark',
  line: 'border-line-2 bg-surface text-ink hover:border-ink',
  ghost: 'border-white/28 text-white hover:border-white hover:bg-white/6',
  // The LINE app's green carries ink text, never white (R16).
  lineApp: 'bg-line-app text-ink hover:bg-line-app-hover',
  // The admin mockup's `.btn-danger` (and its hover): the confirm button of a destructive action (D-261).
  danger: 'bg-sale text-white hover:bg-[#b42318]',
};

const SIZE: Record<ButtonSize, string> = {
  // The storefront's `.btn` (`style.css`); md and lg keep exactly the class sets they had before the back-office sizes.
  md: STOREFRONT,
  lg: `${STOREFRONT} min-h-[54px] text-[17px]`,
  // The back office's denser sizes (`admin.css`, D-257). `.adm .btn`: 42px from `sm`, 44px on a phone (D-221).
  admin: 'min-h-11 rounded-[9px] px-4 text-[15px] sm:min-h-[42px]',
  // `.btn-sm`: drawn 34px tall everywhere; below `sm` an invisible 5px above and below makes the tap target 44px (D-221).
  adminSm: 'relative min-h-[34px] rounded-[9px] px-3 text-sm max-sm:after:absolute max-sm:after:inset-x-0 max-sm:after:-inset-y-[5px]',
};

/**
 * The class string of a button or a link drawn as one (the mockup's `.btn`, plan 015). The storefront uses `md` and `lg`;
 * the back office uses `admin` and `adminSm` (D-257).
 */
export function buttonClass({
  variant,
  size = 'md',
  block = false,
}: {
  variant: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}): string {
  return [BASE, VARIANT[variant], SIZE[size], block ? 'w-full' : ''].filter(Boolean).join(' ');
}
