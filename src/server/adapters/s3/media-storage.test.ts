import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';

import { createS3MediaStorage, MediaStorageError } from './media-storage';

const config = { bucket: 'example-media-dev', region: 'ap-southeast-7' };
const object = {
  key: 'news/2026/11/0f8fad5b-d9cb-469f-a165-70867728950e.png',
  body: new Uint8Array([1, 2, 3]),
  contentType: 'image/png',
  cacheControl: 'public, max-age=31536000, immutable',
};

describe('createS3MediaStorage', () => {
  it('sends one PutObjectCommand with exactly the five fields and no ACL', async () => {
    const sent: unknown[] = [];
    const storage = createS3MediaStorage(config, {
      send: async (command) => {
        sent.push(command);
        return {};
      },
    });
    await storage.putObject(object);
    expect(sent).toHaveLength(1);
    const command = sent[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    const input = (command as PutObjectCommand).input;
    expect(Object.keys(input).sort()).toEqual(['Body', 'Bucket', 'CacheControl', 'ContentType', 'Key']);
    expect(input).toEqual({
      Bucket: 'example-media-dev',
      Key: object.key,
      Body: object.body,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000, immutable',
    });
    expect(input).not.toHaveProperty('ACL');
  });

  it('turns an SDK failure into MediaStorageError holding neither the bucket nor the SDK text', async () => {
    const sdkError = Object.assign(new Error('Access Denied for bucket example-media-dev key news/x'), {
      name: 'AccessDenied',
      $metadata: { httpStatusCode: 403 },
    });
    const storage = createS3MediaStorage(config, {
      send: async () => {
        throw sdkError;
      },
    });
    const error = await storage.putObject(object).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(MediaStorageError);
    const storageError = error as MediaStorageError;
    expect(storageError.code).toBe('media.storage_failed');
    expect(storageError.message).not.toContain('example-media-dev');
    expect(storageError.message).not.toContain('Access Denied');
    expect(storageError.message).not.toContain(object.key);
    expect(storageError.cause).toBeUndefined();
    // The SDK's error name and status are kept for the log: they say what to fix and hold no key material.
    expect(storageError.reason).toBe('AccessDenied');
    expect(storageError.status).toBe(403);
  });

  it('keeps a reason only when it is a plain error name', async () => {
    const storage = createS3MediaStorage(config, {
      send: async () => {
        throw Object.assign(new Error('x'), { name: 'bucket example-media-dev' });
      },
    });
    const error = (await storage.putObject(object).catch((caught: unknown) => caught)) as MediaStorageError;
    expect(error.reason).toBe('unknown');
    expect(error.status).toBeNull();
  });
});

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return Promise.resolve(/\.(ts|tsx|mjs|js)$/.test(entry.name) ? [path] : []);
    }),
  );
  return nested.flat();
}

describe('the S3 SDK boundary (D-050)', () => {
  it('is imported only under src/server/adapters/s3/', async () => {
    const root = join(process.cwd(), 'src');
    const offenders: string[] = [];
    for (const file of await sourceFiles(root)) {
      const path = relative(root, file);
      if (path.startsWith(join('server', 'adapters', 's3'))) continue;
      if ((await readFile(file, 'utf8')).includes('@aws-sdk/client-s3')) offenders.push(path);
    }
    expect(offenders).toEqual([]);
  });
});
