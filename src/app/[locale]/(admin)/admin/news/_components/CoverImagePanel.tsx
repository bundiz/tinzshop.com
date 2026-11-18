'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';

import { buttonClass } from '@/components/ui/button-class';
import Icon from '@/components/ui/Icon';
import type { NewsImageErrorKey } from '@/server/controllers/news/news-image-controller';
import { clientImageErrorKey, NEWS_IMAGE_ACCEPT, uploadImageFile, type ImageUpload } from './ImageDialog';

/** The cover as the editor holds it: the save's `featuredImage` value and the URL to show (null: no cover). */
export type CoverState = { value: string; url: string | null };

export type CoverImagePanelProps = {
  cover: CoverState;
  onChange: (cover: CoverState) => void;
  /** Without it, or without a media base URL, uploading is off; removing still works. */
  upload?: ImageUpload;
  mediaConfigured: boolean;
};

/**
 * The cover image in the Publishing panel (plan 017, D-277, D-278): the image or an empty box (the admin mockup's
 * `.cover`), then อัปโหลดรูปหน้าปก, or เปลี่ยนรูป and ลบรูป. An upload goes to storage at once and is shown; the article
 * keeps it only when saved (the hidden `featuredImage`: `unchanged` until staff act, then `media:{key}` or `none`). An
 * imported article's cover can be replaced or removed too. Nothing is deleted from storage (D-279).
 */
export default function CoverImagePanel({ cover, onChange, upload, mediaConfigured }: CoverImagePanelProps) {
  const t = useTranslations('admin.news.editor');
  const errors = useTranslations('admin.news.error');
  const fileRef = useRef<HTMLInputElement>(null);
  const fileId = useId();
  const noteId = useId();
  const [uploading, setUploading] = useState(false);
  const [errorKey, setErrorKey] = useState<NewsImageErrorKey | null>(null);
  const canUpload = mediaConfigured && upload !== undefined && !uploading;

  async function choose(file: File | null): Promise<void> {
    if (file === null || upload === undefined) return;
    const refused = clientImageErrorKey(file);
    setErrorKey(refused);
    if (refused !== null) return;
    setUploading(true);
    const result = await uploadImageFile(upload, file);
    setUploading(false);
    if (fileRef.current !== null) fileRef.current.value = '';
    if (result.status === 'uploaded') onChange({ value: `media:${result.key}`, url: result.url });
    else setErrorKey(result.errorKey);
  }

  return (
    <section aria-labelledby="cover-heading" aria-busy={uploading} className="border-t border-line px-4 py-4">
      <input type="hidden" name="featuredImage" value={cover.value} />
      <h3 id="cover-heading" className="text-sm font-medium text-ink-2">
        {t('cover.title')}
      </h3>
      <div className="mt-1.5">
        {cover.url !== null ? (
          // eslint-disable-next-line @next/next/no-img-element -- the bucket's or the old site's URL; no image pipeline (D-127)
          <img src={cover.url} alt="" className="aspect-video w-full rounded-[12px] border-2 border-line-2 bg-sunk object-cover" />
        ) : (
          <div className="grid place-items-center gap-1 rounded-[12px] border-2 border-dashed border-line-2 bg-page px-3 py-[22px] text-center text-sm text-ink-2">
            <Icon name="image" className="size-7 text-muted" />
            {t('cover.empty')}
          </div>
        )}
      </div>
      {/* The chooser is driven by the buttons below; it has no name, so it is never posted with the article. */}
      <label htmlFor={fileId} className="sr-only">
        {t('cover.file')}
      </label>
      <input
        ref={fileRef}
        id={fileId}
        type="file"
        accept={NEWS_IMAGE_ACCEPT}
        tabIndex={-1}
        disabled={!canUpload}
        onChange={(event) => void choose(event.target.files?.[0] ?? null)}
        className="sr-only"
      />
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canUpload}
          aria-describedby={noteId}
          onClick={() => fileRef.current?.click()}
          className={buttonClass({ variant: 'line', size: 'adminSm' })}
        >
          {cover.url === null ? t('cover.upload') : t('cover.replace')}
        </button>
        {cover.url !== null ? (
          <button
            type="button"
            disabled={uploading}
            onClick={() => {
              setErrorKey(null);
              onChange({ value: 'none', url: null });
            }}
            className={buttonClass({ variant: 'line', size: 'adminSm' })}
          >
            {t('cover.remove')}
          </button>
        ) : null}
      </div>
      {errorKey !== null ? (
        <p role="alert" className="mt-2 text-sm font-medium text-sale">
          {errors(errorKey)}
        </p>
      ) : null}
      <p aria-live="polite" className="mt-1 text-sm text-ink-2">
        {uploading ? t('cover.uploading') : ''}
      </p>
      <p id={noteId} className="text-sm text-muted">
        {mediaConfigured ? t('cover.savedWithArticle') : t('mediaUnavailable')}
      </p>
    </section>
  );
}
