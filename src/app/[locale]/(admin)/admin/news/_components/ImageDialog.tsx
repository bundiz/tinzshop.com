'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';

import { buttonClass } from '@/components/ui/button-class';
import { useModalDialog } from '@/components/ui/use-modal-dialog';
import { NEWS_IMAGE_ALT_MAX_LENGTH } from '@/server/adapters/wordpress/sanitize';
import type { NewsImageErrorKey, NewsImageUploadState } from '@/server/controllers/news/news-image-controller';
import { NEWS_IMAGE_MAX_BYTES } from '@/server/services/media/news-image-service';

/** Sends one picture to `uploadNewsImageAction` (plan 017): the form's `file`, and the page locale added by the editor. */
export type ImageUpload = (formData: FormData) => Promise<NewsImageUploadState>;

/** The types the file chooser offers; the server checks the bytes again (D-278). */
export const NEWS_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const ACCEPTED_TYPES = new Set(NEWS_IMAGE_ACCEPT.split(','));

/**
 * The browser's quick check of a chosen file, only for a fast message: over 5 MB, or a declared type outside the four.
 * The server never trusts it and checks the content itself.
 */
export function clientImageErrorKey(file: File): NewsImageErrorKey | null {
  if (file.size > NEWS_IMAGE_MAX_BYTES) return 'imageTooLarge';
  if (!ACCEPTED_TYPES.has(file.type)) return 'imageType';
  return null;
}

/** Uploads one file and turns a rejected call (a lost connection) into the upload failure. */
export async function uploadImageFile(upload: ImageUpload, file: File): Promise<NewsImageUploadState> {
  const formData = new FormData();
  formData.append('file', file);
  try {
    return await upload(formData);
  } catch {
    // Nothing to keep: the message tells staff to try again.
    return { status: 'error', errorKey: 'imageUploadFailed' };
  }
}

/** A local preview of the chosen file, released when it changes or the dialog closes (jsdom has no object URLs). */
function usePreviewUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (file === null || typeof URL.createObjectURL !== 'function') return;
    const made = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the object URL exists only once the file is chosen
    setUrl(made);
    return () => {
      URL.revokeObjectURL(made);
      setUrl(null);
    };
  }, [file]);
  return url;
}

export type ImageDialogProps = {
  /** `insert` uploads a new picture; `alt` edits the alt text of the selected one. */
  mode: { kind: 'insert' } | { kind: 'alt'; alt: string };
  upload: ImageUpload;
  /** Called after a successful upload with the key the body stores (D-277) and the alt text, empty when none was given. */
  onInsert: (key: string, alt: string) => void;
  onSaveAlt: (alt: string) => void;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
};

/**
 * The editor's image dialog (plan 017, the shared modal behaviour): a file chooser, a local preview and the optional alt
 * text (D-284), then แทรกรูป, which uploads and inserts. With a picture selected it edits the alt text only. It sits inside
 * the article's form, so its fields have no `name` and its buttons are `type="button"`: nothing of it is posted.
 */
export default function ImageDialog({ mode, upload, onInsert, onSaveAlt, onClose, returnFocusRef }: ImageDialogProps) {
  const t = useTranslations('admin.news.editor.imageDialog');
  const errors = useTranslations('admin.news.error');
  const container = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const fileId = useId();
  const altId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState(mode.kind === 'alt' ? mode.alt : '');
  const [errorKey, setErrorKey] = useState<NewsImageErrorKey | null>(null);
  const [uploading, setUploading] = useState(false);
  // A press of แทรกรูป with no file chosen: said beside the file field, which gets the focus (the button never looks dead).
  const [fileMissing, setFileMissing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = usePreviewUrl(file);
  useModalDialog({ open: true, onClose: () => (uploading ? undefined : onClose()), containerRef: container, returnFocusRef });

  const inserting = mode.kind === 'insert';
  const altText = alt.trim();

  function choose(chosen: File | null): void {
    setErrorKey(null);
    if (chosen === null) {
      setFile(null);
      return;
    }
    const refused = clientImageErrorKey(chosen);
    setErrorKey(refused);
    setFile(refused === null ? chosen : null);
  }

  async function submit(): Promise<void> {
    if (uploading) return;
    if (inserting && file === null) {
      setFileMissing(true);
      fileInput.current?.focus();
      return;
    }
    setFileMissing(false);
    if (!inserting) {
      onSaveAlt(altText);
      return;
    }
    if (file === null) return;
    setUploading(true);
    setErrorKey(null);
    const result = await uploadImageFile(upload, file);
    setUploading(false);
    if (result.status === 'uploaded') onInsert(result.key, altText);
    else setErrorKey(result.errorKey);
  }

  return (
    <div className="fixed inset-0 z-60 grid place-items-center bg-ink/50 p-4">
      <div
        ref={container}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={uploading}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[480px] overflow-y-auto rounded-md bg-surface p-5 shadow-1"
      >
        <h2 id={titleId} className="font-head text-xl font-bold text-ink">
          {inserting ? t('title') : t('altTitle')}
        </h2>
        {inserting ? (
          <div className="mt-3.5">
            <label htmlFor={fileId} className="mb-1 block font-semibold text-ink">
              {t('file')}
            </label>
            <input
              ref={fileInput}
              id={fileId}
              type="file"
              accept={NEWS_IMAGE_ACCEPT}
              disabled={uploading}
              onChange={(event) => {
                setFileMissing(false);
                choose(event.target.files?.[0] ?? null);
              }}
              aria-invalid={fileMissing ? true : undefined}
              aria-describedby={fileMissing ? `${fileId}-missing ${fileId}-hint` : `${fileId}-hint`}
              className="block w-full min-w-0 text-ink file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-sm file:border-[1.5px] file:border-line-2 file:bg-surface file:px-3 file:font-semibold file:text-ink"
            />
            {fileMissing ? (
              <p id={`${fileId}-missing`} role="alert" className="mt-1 text-sm font-medium text-sale">
                {t('fileMissing')}
              </p>
            ) : null}
            <p id={`${fileId}-hint`} className="mt-1 text-sm text-muted">
              {t('fileHint')}
            </p>
            {preview !== null ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local object URL, shown before the upload
              <img src={preview} alt={t('previewAlt')} className="mt-3 max-h-48 w-full rounded-sm bg-sunk object-contain" />
            ) : null}
          </div>
        ) : null}
        <div className="mt-3.5">
          <label htmlFor={altId} className="mb-1 block font-semibold text-ink">
            {t('alt')} <span className="font-normal text-muted">({t('optional')})</span>
          </label>
          <input
            id={altId}
            type="text"
            lang="th"
            value={alt}
            maxLength={NEWS_IMAGE_ALT_MAX_LENGTH}
            disabled={uploading}
            onChange={(event) => setAlt(event.target.value)}
            onKeyDown={(event) => {
              // The dialog sits inside the article's form: Enter must never submit it.
              if (event.key === 'Enter') {
                event.preventDefault();
                void submit();
              }
            }}
            aria-describedby={`${altId}-hint`}
            className="min-h-11 w-full rounded-sm border-[1.5px] border-line-2 bg-surface px-3 text-ink"
          />
          <p id={`${altId}-hint`} className="mt-1 text-sm text-muted">
            {t('altHint')}
          </p>
        </div>
        {errorKey !== null ? (
          <p role="alert" className="mt-3 text-sm font-medium text-sale">
            {errors(errorKey)}
          </p>
        ) : null}
        <p aria-live="polite" className="mt-3 text-sm text-ink-2">
          {uploading ? t('uploading') : ''}
        </p>
        <div className="mt-3 flex flex-wrap justify-end gap-2.5">
          <button type="button" onClick={onClose} disabled={uploading} className={buttonClass({ variant: 'line', size: 'admin' })}>
            {t('cancel')}
          </button>
          <button type="button" onClick={() => void submit()} disabled={uploading} className={buttonClass({ variant: 'brand', size: 'admin' })}>
            {inserting ? t('insert') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
