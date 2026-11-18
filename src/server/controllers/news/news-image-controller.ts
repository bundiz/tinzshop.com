import { can } from '@/server/services/access/access-service';
import type { PermissionKey } from '@/server/services/access/permission-keys';
import { mediaPublicUrl } from '@/server/services/media/media-url';
import type { MediaStorage } from '@/server/services/media/media-storage';
import { NEWS_IMAGE_MAX_BYTES, prepareNewsImage } from '@/server/services/media/news-image-service';

/** A key under `admin.news.error.*` in the message files. */
export type NewsImageErrorKey =
  | 'forbidden'
  | 'imageUnavailable'
  | 'imageRateLimited'
  | 'imageTooLarge'
  | 'imageType'
  | 'imageInvalid'
  | 'imageUploadFailed';

/** What the editor gets back from an upload: the key it stores (D-277), and a URL to show the picture now. */
export type NewsImageUploadState =
  | { status: 'uploaded'; key: string; url: string }
  | { status: 'error'; errorKey: NewsImageErrorKey };

export type NewsImageUploadDeps = {
  /** The storage and the base URL, or null when media storage is not configured (no `MEDIA_PUBLIC_BASE_URL`). */
  media: () => { storage: MediaStorage; publicBaseUrl: string } | null;
  /** Increments and returns the count for (key, windowStart); deletes counters older than sweepBefore (plan 014). */
  hitRateLimit: (key: string, windowStart: Date, sweepBefore: Date) => Promise<number>;
  now: () => Date;
  /** A random lower-case v4 uuid for the key. */
  uuid: () => string;
  /** The account id, key, byte size, detected type and an outcome code: never the file name, bytes or alt text. */
  log: (message: string, fields: Record<string, unknown>) => void;
};

/** At most this many uploads per account per hour (D-278). */
export const NEWS_IMAGE_UPLOADS_PER_HOUR = 60;
const HOUR_MS = 60 * 60 * 1000;

const CONTENT_ERRORS: Readonly<Record<string, { errorKey: NewsImageErrorKey; outcome: string }>> = {
  'media.empty': { errorKey: 'imageInvalid', outcome: 'empty' },
  'media.too_large': { errorKey: 'imageTooLarge', outcome: 'too_large' },
  'media.unsupported_type': { errorKey: 'imageType', outcome: 'unsupported_type' },
  'media.invalid_image': { errorKey: 'imageInvalid', outcome: 'invalid_image' },
};

const refuse = (errorKey: NewsImageErrorKey): NewsImageUploadState => ({ status: 'error', errorKey });

/** The SDK's error name and HTTP status from a `MediaStorageError`, the only details a log may hold. */
function storageFailure(error: unknown): { reason: string; status: number | null } {
  const e = error as { code?: unknown; reason?: unknown; status?: unknown } | null;
  if (e?.code !== 'media.storage_failed') return { reason: 'unexpected', status: null };
  return { reason: typeof e.reason === 'string' ? e.reason : 'unknown', status: typeof e.status === 'number' ? e.status : null };
}

/**
 * Stores one news image (plan 017, D-278). In order: `news.manage`, media configured, the account's hourly limit, the
 * declared size (before a byte is read), the content check (`prepareNewsImage`), the write. The file name and the
 * browser's declared type are never used. Writes no article: the editor puts the key in the body or the cover.
 */
export async function uploadNewsImageCommand(
  deps: NewsImageUploadDeps,
  actor: { id: string; permissions: readonly PermissionKey[] },
  formData: FormData,
): Promise<NewsImageUploadState> {
  if (!can(actor, 'news.manage')) return refuse('forbidden');
  const log = (fields: Record<string, unknown>): void => deps.log('news.image_upload', { actor: actor.id, ...fields });

  const media = deps.media();
  if (media === null) {
    log({ outcome: 'unavailable' });
    return refuse('imageUnavailable');
  }

  const now = deps.now();
  const windowStart = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
  const count = await deps.hitRateLimit(`media_upload:account:${actor.id}`, windowStart, new Date(now.getTime() - HOUR_MS));
  if (count > NEWS_IMAGE_UPLOADS_PER_HOUR) {
    log({ outcome: 'rate_limited' });
    return refuse('imageRateLimited');
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    log({ outcome: 'no_file' });
    return refuse('imageInvalid');
  }
  if (file.size > NEWS_IMAGE_MAX_BYTES) {
    log({ bytes: file.size, outcome: 'too_large' });
    return refuse('imageTooLarge');
  }

  const prepared = prepareNewsImage(new Uint8Array(await file.arrayBuffer()), now, deps.uuid());
  if (!prepared.ok) {
    const mapped = CONTENT_ERRORS[prepared.error.code] ?? { errorKey: 'imageInvalid', outcome: 'invalid_image' };
    log({ bytes: file.size, outcome: mapped.outcome });
    return refuse(mapped.errorKey);
  }

  const object = prepared.data;
  const fields = { key: object.key, bytes: object.body.length, type: object.contentType };
  try {
    await media.storage.putObject(object);
  } catch (error) {
    log({ ...fields, outcome: 'storage_failed', ...storageFailure(error) });
    return refuse('imageUploadFailed');
  }
  log({ ...fields, outcome: 'uploaded' });
  return { status: 'uploaded', key: object.key, url: mediaPublicUrl(media.publicBaseUrl, object.key) };
}
