import type { PlatformTone } from '@/components/domain/platform-tone';
import Icon, { type IconName } from '@/components/ui/Icon';

/** The mockup's generic product art (`_build.mjs` `a-*` symbols). */
export type ProductArt = 'console' | 'handheld' | 'pad' | 'disc' | 'head' | 'key' | 'box' | 'news';

/** Tones the earlier design used; they go with their last users (plan 015 Task 4). */
type LegacyTone = 'default' | 'warm' | 'cool' | 'deep';

export type ImagePlaceholderProps = {
  /**
   * The accessible name, from a message key (`shop.product.imagePlaceholderAlt`). Leave it out where the
   * block is decoration (the category tiles): it is then hidden from assistive technology.
   */
  label?: string;
  /** The mockup's `.media` tints: a platform's, or `dark` for the hero. Defaults to `other`. */
  tone?: PlatformTone | 'dark' | LegacyTone;
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

const LEGACY_TONE: Record<LegacyTone, string> = {
  default: 'bg-[radial-gradient(circle_at_50%_42%,#ffffff_0%,#f1f5fd_58%,#e6eefc_100%)] text-brand opacity-100',
  warm: 'bg-[radial-gradient(circle_at_50%_42%,#ffffff_0%,#fff7e6_58%,#ffedc6_100%)] text-brand',
  cool: 'bg-[radial-gradient(circle_at_50%_42%,#ffffff_0%,#eef1f6_58%,#dfe4ee_100%)] text-brand',
  deep: 'bg-[radial-gradient(circle_at_50%_42%,#f5f8ff_0%,#dfe8fb_58%,#c9d8f7_100%)] text-brand',
};

/** The mockup's `.media` block, shown where a product has no image: a tinted gradient with drawn product art. */
export default function ImagePlaceholder({ label, tone = 'other', art = 'pad', className = '' }: ImagePlaceholderProps) {
  const a11y = label === undefined ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': label };
  const colour = tone in LEGACY_TONE ? LEGACY_TONE[tone as LegacyTone] : TONE[tone as PlatformTone | 'dark'];

  return (
    <div {...a11y} className={`grid aspect-square place-items-center overflow-hidden ${colour} ${className}`}>
      <Icon name={ART_ICON[art]} strokeWidth={0.9} className="size-[56%] opacity-90" />
    </div>
  );
}
