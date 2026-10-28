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
    <section aria-label={t('gallery.label')} className="rounded-(--radius) bg-bg p-4">
      <div className="overflow-hidden rounded-(--radius) border border-border">
        {current !== undefined ? (
          // A plain <img>: the live Shopee image hosts are not known, so no next/image remote config.
          <img src={current} alt={name} loading="lazy" className="aspect-square w-full bg-bg object-contain" />
        ) : (
          <ImagePlaceholder label={t('imagePlaceholderAlt')} />
        )}
      </div>
      {imageUrls.length > 1 && (
        <>
          <p aria-live="polite" className="sr-only">
            {t('gallery.image', { index: index + 1, total: imageUrls.length })}
          </p>
          <ul className="mt-2.5 grid grid-cols-5 gap-2">
            {imageUrls.map((url, position) => (
              <li key={`${position}-${url}`} className="min-w-0">
                <button
                  type="button"
                  aria-label={t('gallery.thumbnail', { index: position + 1 })}
                  aria-pressed={position === index}
                  onClick={() => setIndex(position)}
                  className={`block w-full cursor-pointer overflow-hidden rounded-(--radius-sm) border-2 ${
                    position === index ? 'border-primary' : 'border-border hover:border-[#9ebdf0]'
                  }`}
                >
                  <img src={url} alt="" loading="lazy" className="aspect-square w-full bg-bg object-contain" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
