'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import ImagePlaceholder from '@/components/domain/ImagePlaceholder';

export type GalleryProps = {
  /** Shopee image URLs, in position order. */
  imageUrls: string[];
  /** The product name: every image's alt text. */
  name: string;
};

/** The product images: one large image, and a thumbnail per image that switches it. */
export default function Gallery({ imageUrls, name }: GalleryProps) {
  const t = useTranslations('shop.product');
  const [index, setIndex] = useState(0);
  const current = imageUrls[index] ?? imageUrls[0];

  return (
    <section aria-label={t('gallery.label')} className="lg:sticky lg:top-[140px]">
      <div className="overflow-hidden rounded-xl border border-line bg-surface p-4">
        {current !== undefined ? (
          // A plain <img>: the live Shopee image hosts are not known, so no next/image remote config.
          // Eager: it is the largest image above the fold; thumbnails stay lazy.
          <img src={current} alt={name} loading="eager" className="aspect-square w-full rounded-[14px] bg-surface object-contain" />
        ) : (
          <ImagePlaceholder label={t('imagePlaceholderAlt')} className="aspect-square rounded-[14px]" />
        )}
      </div>
      {imageUrls.length > 1 && (
        <>
          <p aria-live="polite" className="sr-only">
            {t('gallery.image', { index: index + 1, total: imageUrls.length })}
          </p>
          <ul className="mt-2.5 grid grid-cols-5 gap-2.5">
            {imageUrls.map((url, position) => (
              <li key={`${position}-${url}`} className="min-w-0">
                <button
                  type="button"
                  aria-label={t('gallery.thumbnail', { index: position + 1 })}
                  aria-pressed={position === index}
                  onClick={() => setIndex(position)}
                  className={`block w-full cursor-pointer overflow-hidden rounded-md border-2 bg-surface ${
                    position === index ? 'border-ink' : 'border-transparent hover:border-line-2'
                  }`}
                >
                  <img src={url} alt="" loading="lazy" className="aspect-square w-full bg-surface object-contain" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
