import { describe, expect, it, vi, type Mock } from 'vitest';

import { GIF, JFIF_APP0, PNG, SVG, exifApp1, includesBytes, jpeg } from '@/server/services/media/__fixtures__/images';
import { NEWS_IMAGE_MAX_BYTES } from '@/server/services/media/news-image-service';

import { NEWS_IMAGE_UPLOADS_PER_HOUR, uploadNewsImageCommand, type NewsImageUploadDeps } from './news-image-controller';

const NOW = new Date('2026-11-18T05:30:00Z');
const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const BASE = 'https://media.example.com';
const ACTOR = { id: '11111111-1111-4111-8111-111111111111', permissions: ['backoffice.enter', 'news.manage'] as const };
/** A file name holding personal data: it must never reach a log. */
const FILE_NAME = 'somchai.j@example.com-holiday.jpg';

type Fakes = NewsImageUploadDeps & { putObject: Mock; hitRateLimit: Mock; log: Mock };

function setup(overrides: { media?: 'unset' | 'invalid'; count?: number; putObject?: Mock } = {}): Fakes {
  const putObject = overrides.putObject ?? vi.fn(async () => undefined);
  const hitRateLimit = vi.fn(async () => overrides.count ?? 1);
  const log = vi.fn();
  return {
    media: () => {
      if (overrides.media === 'unset') return { status: 'unset' };
      if (overrides.media === 'invalid') return { status: 'invalid', issues: 'MEDIA_PUBLIC_BASE_URL: must be an https URL' };
      return { status: 'ready', storage: { putObject }, publicBaseUrl: BASE };
    },
    hitRateLimit,
    now: () => NOW,
    uuid: () => UUID,
    log,
    putObject,
  };
}

function upload(bytes: Uint8Array, name = FILE_NAME, type = 'image/jpeg'): FormData {
  const data = new FormData();
  // A copy on a plain ArrayBuffer, which is what `File` takes.
  data.append('file', new File([Uint8Array.from(bytes)], name, { type }));
  return data;
}

function logged(deps: Fakes): string {
  return JSON.stringify(deps.log.mock.calls);
}

describe('uploadNewsImageCommand', () => {
  it('stores a permitted upload and returns its key and URL', async () => {
    const deps = setup();
    const result = await uploadNewsImageCommand(deps, ACTOR, upload(PNG, 'picture.jpg'));
    const key = `news/2026/11/${UUID}.png`;
    expect(result).toEqual({ status: 'uploaded', key, url: `${BASE}/${key}` });
    expect(deps.putObject).toHaveBeenCalledWith({
      key,
      body: PNG,
      contentType: 'image/png',
      cacheControl: 'public, max-age=31536000, immutable',
    });
  });

  it('counts the upload against the account, once an hour window', async () => {
    const deps = setup();
    await uploadNewsImageCommand(deps, ACTOR, upload(PNG));
    expect(deps.hitRateLimit).toHaveBeenCalledWith(
      `media_upload:account:${ACTOR.id}`,
      new Date('2026-11-18T05:00:00Z'),
      new Date('2026-11-18T04:30:00Z'),
    );
  });

  it.each([
    ['a role without news.manage', { id: ACTOR.id, permissions: ['backoffice.enter'] as const }],
    ['a customer', { id: ACTOR.id, permissions: [] as const }],
  ])('refuses %s before the file is read, the rate counted or the storage called', async (_, actor) => {
    const deps = setup();
    const data = upload(PNG);
    const file = data.get('file') as File;
    const read = vi.spyOn(file, 'arrayBuffer');
    expect(await uploadNewsImageCommand(deps, actor, data)).toEqual({ status: 'error', errorKey: 'forbidden' });
    expect(read).not.toHaveBeenCalled();
    expect(deps.hitRateLimit).not.toHaveBeenCalled();
    expect(deps.putObject).not.toHaveBeenCalled();
  });

  it('answers imageUnavailable when media storage is not configured, before counting', async () => {
    const deps = setup({ media: 'unset' });
    expect(await uploadNewsImageCommand(deps, ACTOR, upload(PNG))).toEqual({ status: 'error', errorKey: 'imageUnavailable' });
    expect(deps.hitRateLimit).not.toHaveBeenCalled();
  });

  it('refuses with imageMisconfigured when a media setting is malformed, logging the variable and storing nothing (D-282)', async () => {
    const deps = setup({ media: 'invalid' });
    expect(await uploadNewsImageCommand(deps, ACTOR, upload(PNG))).toEqual({ status: 'error', errorKey: 'imageMisconfigured' });
    expect(deps.hitRateLimit).not.toHaveBeenCalled();
    expect(deps.putObject).not.toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledWith('news.image_upload', {
      actor: ACTOR.id,
      outcome: 'misconfigured',
      issues: 'MEDIA_PUBLIC_BASE_URL: must be an https URL',
    });
  });

  it(`takes the ${NEWS_IMAGE_UPLOADS_PER_HOUR}th upload in an hour and refuses the next`, async () => {
    expect((await uploadNewsImageCommand(setup({ count: NEWS_IMAGE_UPLOADS_PER_HOUR }), ACTOR, upload(PNG))).status).toBe('uploaded');
    const deps = setup({ count: NEWS_IMAGE_UPLOADS_PER_HOUR + 1 });
    expect(await uploadNewsImageCommand(deps, ACTOR, upload(PNG))).toEqual({ status: 'error', errorKey: 'imageRateLimited' });
    expect(deps.putObject).not.toHaveBeenCalled();
  });

  it('refuses a file over the limit from its size, without reading its bytes', async () => {
    const deps = setup();
    const big = new Uint8Array(NEWS_IMAGE_MAX_BYTES + 1);
    big.set(PNG);
    const data = upload(big);
    const file = data.get('file') as File;
    const read = vi.spyOn(file, 'arrayBuffer');
    expect(await uploadNewsImageCommand(deps, ACTOR, data)).toEqual({ status: 'error', errorKey: 'imageTooLarge' });
    expect(read).not.toHaveBeenCalled();
    expect(deps.putObject).not.toHaveBeenCalled();
  });

  it.each([
    ['an SVG named .jpg and declared image/jpeg', SVG, 'imageType'],
    ['a PNG signature followed by HTML', Uint8Array.from([...PNG.slice(0, 8), ...new TextEncoder().encode('<html>')]), 'imageInvalid'],
    ['an empty file', new Uint8Array(), 'imageInvalid'],
  ])('maps %s to its message key and stores nothing', async (_, bytes, errorKey) => {
    const deps = setup();
    expect(await uploadNewsImageCommand(deps, ACTOR, upload(bytes))).toEqual({ status: 'error', errorKey });
    expect(deps.putObject).not.toHaveBeenCalled();
  });

  it('refuses a form with no file, or a text field named file', async () => {
    const deps = setup();
    expect(await uploadNewsImageCommand(deps, ACTOR, new FormData())).toEqual({ status: 'error', errorKey: 'imageInvalid' });
    const text = new FormData();
    text.append('file', 'not a file');
    expect(await uploadNewsImageCommand(deps, ACTOR, text)).toEqual({ status: 'error', errorKey: 'imageInvalid' });
  });

  it('stores the detected type, never the declared one', async () => {
    const deps = setup();
    await uploadNewsImageCommand(deps, ACTOR, upload(GIF, 'clip.png', 'image/png'));
    expect(deps.putObject.mock.calls[0]?.[0]).toMatchObject({ contentType: 'image/gif' });
  });

  it('stores a JPEG without its location data', async () => {
    const deps = setup();
    await uploadNewsImageCommand(deps, ACTOR, upload(jpeg(JFIF_APP0, exifApp1({ orientation: 6 }))));
    const stored = (deps.putObject.mock.calls[0]?.[0] as { body: Uint8Array }).body;
    expect(includesBytes(stored, [0x25, 0x88])).toBe(false);
  });

  it('maps a storage failure to imageUploadFailed and logs the reason code only', async () => {
    const failure = Object.assign(new Error('media.storage_failed'), { code: 'media.storage_failed', reason: 'AccessDenied', status: 403 });
    const deps = setup({ putObject: vi.fn(async () => Promise.reject(failure)) });
    expect(await uploadNewsImageCommand(deps, ACTOR, upload(PNG))).toEqual({ status: 'error', errorKey: 'imageUploadFailed' });
    expect(deps.log).toHaveBeenCalledWith(
      'news.image_upload',
      expect.objectContaining({ actor: ACTOR.id, outcome: 'storage_failed', reason: 'AccessDenied', status: 403 }),
    );
  });

  it('logs the account, key, size, type and outcome, and never the file name or the bytes', async () => {
    const deps = setup();
    const body = jpeg(JFIF_APP0);
    await uploadNewsImageCommand(deps, ACTOR, upload(body));
    expect(deps.log).toHaveBeenCalledWith('news.image_upload', {
      actor: ACTOR.id,
      key: `news/2026/11/${UUID}.jpg`,
      bytes: body.length,
      type: 'image/jpeg',
      outcome: 'uploaded',
    });
    const text = logged(deps);
    expect(text).not.toContain('somchai');
    expect(text).not.toContain('example.com-holiday');
    expect(text).not.toContain('JFIF');
  });

  it('logs a refusal with its outcome code and still no file name', async () => {
    const deps = setup();
    await uploadNewsImageCommand(deps, ACTOR, upload(SVG));
    expect(deps.log).toHaveBeenCalledWith('news.image_upload', expect.objectContaining({ actor: ACTOR.id, outcome: 'unsupported_type' }));
    expect(logged(deps)).not.toContain('somchai');
    expect(logged(deps)).not.toContain('svg');
  });
});
