export type ImagePlaceholderProps = {
  /** The accessible name, from a message key (`shop.product.imagePlaceholderAlt`). */
  label: string;
};

/** The design's `.ph` block, shown where a product has no image: a soft gradient with a faint gamepad mark. */
export default function ImagePlaceholder({ label }: ImagePlaceholderProps) {
  return (
    <div
      role="img"
      aria-label={label}
      className="grid aspect-square place-items-center bg-[radial-gradient(circle_at_50%_42%,#ffffff_0%,#f1f5fd_58%,#e6eefc_100%)]"
    >
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
