/**
 * The media storage port (plan 017, D-050): where uploaded files are written. The only implementation is
 * `createS3MediaStorage` in `src/server/adapters/s3/`; no service, controller or page names S3. A failure is thrown as
 * the adapter's `MediaStorageError` (code `media.storage_failed`).
 */
export type MediaObject = {
  /** A media key, `news/{yyyy}/{mm}/{uuid}.{ext}` (D-278); never a name from the browser. */
  readonly key: string;
  readonly body: Uint8Array;
  /** The detected type, never the browser's. */
  readonly contentType: string;
  readonly cacheControl: string;
};

export type MediaStorage = {
  putObject(input: MediaObject): Promise<void>;
};
