export type ButtonVariant = 'buy' | 'brand' | 'line' | 'ghost' | 'lineApp';
export type ButtonSize = 'md' | 'lg';

const BASE =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border-[1.5px] border-transparent px-[22px] font-body text-base leading-none font-semibold whitespace-nowrap transition-[transform,background-color,border-color,box-shadow] duration-[180ms] ease-soft hover:-translate-y-px active:translate-y-px active:scale-[.985]';

const VARIANT: Record<ButtonVariant, string> = {
  buy: 'bg-accent text-ink hover:bg-accent-2 hover:shadow-[0_8px_20px_-8px_rgba(254,166,1,.75)] active:bg-accent-press',
  // The mockup's `.btn-dark`.
  brand: 'bg-brand text-white hover:bg-brand-dark',
  line: 'border-line-2 bg-surface text-ink hover:border-ink',
  ghost: 'border-white/28 text-white hover:border-white hover:bg-white/6',
  // The LINE app's green carries ink text, never white (R16).
  lineApp: 'bg-line-app text-ink hover:bg-line-app-hover',
};

const SIZE: Record<ButtonSize, string> = {
  md: '',
  lg: 'min-h-[54px] text-[17px]',
};

/** The class string of a button or a link drawn as one (the mockup's `.btn`, plan 015). */
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
