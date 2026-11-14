import type { PlatformTone } from '@/components/domain/platform-tone';
import Icon, { type IconName } from '@/components/ui/Icon';

/** The mockup's generic product art (`_build.mjs` `a-*` symbols). */
export type ProductArt = 'console' | 'handheld' | 'pad' | 'disc' | 'head' | 'key' | 'box' | 'news';

export type ImagePlaceholderProps = {
  /**
   * The accessible name, from a message key (`shop.product.imagePlaceholderAlt`). Leave it out where the
   * block is decoration (the category tiles): it is then hidden from assistive technology.
   */
  label?: string;
  /** The mockup's `.media` tints: a platform's, or `dark` for the hero. Defaults to `other`. */
  tone?: PlatformTone | 'dark';
  /** Which drawn product icon to show. Defaults to `pad`. */
  art?: ProductArt;
  /** Extra layout utilities, e.g. a radius or an aspect ratio. */
  className?: string;
};

const ART_ICON: Record<ProductArt, IconName> = {
  console: 'artConsole',
  handheld: 'artHandheld',
  pad: 'artPad',
  disc: 'artDisc',
  head: 'artHead',
  key: 'artKey',
  box: 'artBox',
  news: 'artNews',
};

// The one place these gradients and ink colours live (plan 015, Art tints): style.css L160-168.
const TONE: Record<PlatformTone | 'dark', string> = {
  ps: 'bg-[linear-gradient(160deg,#EEF4FD_0%,#D8E6FA_100%)] text-[#0B4FAE]',
  ns: 'bg-[linear-gradient(160deg,#FDF0F2_0%,#F8D9DF_100%)] text-[#B5001F]',
  it: 'bg-[linear-gradient(160deg,#ECF7F5_0%,#D2EEE9_100%)] text-[#0A6E62]',
  other: 'bg-[linear-gradient(160deg,#F2F3F6_0%,#E1E4EA_100%)] text-[#3A4357]',
  dark: 'bg-[radial-gradient(120%_90%_at_30%_20%,#24365A_0%,#0F1A2E_60%,#0A1220_100%)] text-[#DDE6F7]',
};

/** The mockup's `.media` block, shown where a product has no image: a tinted gradient with drawn product art. */
export default function ImagePlaceholder({ label, tone = 'other', art = 'pad', className = '' }: ImagePlaceholderProps) {
  const a11y = label === undefined ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': label };

  return (
    <div {...a11y} className={`grid aspect-square place-items-center overflow-hidden ${TONE[tone]} ${className}`}>
      <Icon name={ART_ICON[art]} strokeWidth={0.9} className="size-[56%] opacity-90" />
    </div>
  );
}
