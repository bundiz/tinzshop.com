export type ImagePlaceholderProps = {
  /**
   * The accessible name, from a message key (`shop.product.imagePlaceholderAlt`). Leave it out where the
   * block is decoration (the category tiles): it is then hidden from assistive technology.
   */
  label?: string;
  /** The design's `.ph` tints: `default`, `.ph-warm`, `.ph-cool` and `.ph-deep`. */
  tone?: 'default' | 'warm' | 'cool' | 'deep';
  /** Extra layout utilities, e.g. a radius. */
  className?: string;
};

const TONE: Record<NonNullable<ImagePlaceholderProps['tone']>, string> = {
  default: 'bg-[radial-gradient(circle_at_50%_42%,#ffffff_0%,#f1f5fd_58%,#e6eefc_100%)]',
  warm: 'bg-[radial-gradient(circle_at_50%_42%,#ffffff_0%,#fff7e6_58%,#ffedc6_100%)]',
  cool: 'bg-[radial-gradient(circle_at_50%_42%,#ffffff_0%,#eef1f6_58%,#dfe4ee_100%)]',
  deep: 'bg-[radial-gradient(circle_at_50%_42%,#f5f8ff_0%,#dfe8fb_58%,#c9d8f7_100%)]',
};

/** The design's `.ph` block, shown where a product has no image: a soft gradient with a faint gamepad mark. */
export default function ImagePlaceholder({ label, tone = 'default', className = '' }: ImagePlaceholderProps) {
  const a11y = label === undefined ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': label };

  return (
    <div {...a11y} className={`grid aspect-square place-items-center overflow-hidden ${TONE[tone]} ${className}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="w-[42%] fill-none stroke-primary opacity-30"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8.5 6.5h7a5.5 5.5 0 0 1 5.4 6.6l-.7 3.4A2.6 2.6 0 0 1 16 17.6L14.7 16H9.3L8 17.6a2.6 2.6 0 0 1-4.2-1.1l-.7-3.4A5.5 5.5 0 0 1 8.5 6.5Z" />
        <path d="M6.5 11h3.5M8.25 9.25v3.5" />
        <circle cx="15.5" cy="10.4" r=".8" className="fill-primary" />
        <circle cx="17.6" cy="12.6" r=".8" className="fill-primary" />
      </svg>
    </div>
  );
}
