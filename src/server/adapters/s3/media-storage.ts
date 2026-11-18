import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import type { MediaObject, MediaStorage } from '@/server/services/media/media-storage';

export type S3MediaStorageConfig = {
  readonly bucket: string;
  readonly region: string;
};

export type S3MediaStorageOptions = {
  /** Sends one command. Defaults to a real client; tests inject a fake. */
  send?: (command: PutObjectCommand) => Promise<unknown>;
};

/** A whole upload, retries included, gives up after this long rather than hanging the editor. */
const PUT_TIMEOUT_MS = 30_000;

/**
 * Every failure of a write to the bucket. The message is the code only: never the bucket, the key or the SDK's text.
 * `reason` is the SDK's error name (such as `AccessDenied` or `NoSuchBucket`) and `status` its HTTP status, so a log
 * says what to fix without holding key material.
 */
export class MediaStorageError extends Error {
  readonly code = 'media.storage_failed';
  readonly reason: string;
  readonly status: number | null;

  constructor(reason: string, status: number | null) {
    super('media.storage_failed');
    this.name = 'MediaStorageError';
    this.reason = reason;
    this.status = status;
  }
}

function toMediaStorageError(error: unknown): MediaStorageError {
  const e = error as { name?: unknown; $metadata?: { httpStatusCode?: unknown } } | null;
  const name = typeof e?.name === 'string' && /^[A-Za-z]{1,64}$/.test(e.name) ? e.name : 'unknown';
  const status = typeof e?.$metadata?.httpStatusCode === 'number' ? e.$metadata.httpStatusCode : null;
  return new MediaStorageError(name, status);
}

function defaultSend(config: S3MediaStorageConfig): (command: PutObjectCommand) => Promise<unknown> {
  // Region only: credentials come from the SDK's default chain, an access key on a developer's machine and an IAM
  // role on AWS (D-275). The config module never reads them.
  const client = new S3Client({ region: config.region });
  return (command) => client.send(command, { abortSignal: AbortSignal.timeout(PUT_TIMEOUT_MS) });
}

/** The S3 implementation of `MediaStorage` (plan 017): the only importer of `@aws-sdk/client-s3` (D-050). */
export function createS3MediaStorage(config: S3MediaStorageConfig, options: S3MediaStorageOptions = {}): MediaStorage {
  const send = options.send ?? defaultSend(config);
  return {
    async putObject(input: MediaObject): Promise<void> {
      // No ACL: the bucket has ACLs disabled, and `news/*` is public through the bucket policy (D-276).
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: input.cacheControl,
      });
      try {
        await send(command);
      } catch (error) {
        throw toMediaStorageError(error);
      }
    },
  };
}
