import { describe, expect, it } from 'vitest';

import { ICC_APP2, JFIF_APP0, XMP_APP1, exifApp1, includesBytes, jpeg, segment } from './__fixtures__/images';
import { stripJpegMetadata } from './jpeg-metadata';

/** The orientation the stripped image's Exif holds, read back with the fixture's own layout, or null without Exif. */
function orientationOf(bytes: Uint8Array): { order: string; value: number; entries: number } | null {
  for (let i = 2; i + 4 < bytes.length; ) {
    const marker = bytes[i + 1] ?? 0;
    if (marker === 0xda) return null;
    const length = ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0);
    if (marker === 0xe1) {
      const tiff = i + 4 + 6;
      const order = String.fromCharCode(bytes[tiff] ?? 0, bytes[tiff + 1] ?? 0);
      const view = new DataView(bytes.buffer, bytes.byteOffset);
      const little = order === 'II';
      const ifd = tiff + view.getUint32(tiff + 4, little);
      return {
        order,
        entries: view.getUint16(ifd, little),
        value: view.getUint16(ifd + 2 + 8, little),
      };
    }
    i += 2 + length;
  }
  return null;
}

describe('stripJpegMetadata', () => {
  it('returns a JPEG with no APP1 unchanged', () => {
    const input = jpeg(JFIF_APP0, ICC_APP2);
    expect(stripJpegMetadata(input)).toEqual(input);
  });

  it('removes the Exif GPS block and the XMP packet, and keeps the colour profile byte for byte', () => {
    const input = jpeg(JFIF_APP0, exifApp1({ orientation: 1 }), XMP_APP1, ICC_APP2);
    expect(includesBytes(input, 'GPSLatitude')).toBe(true);
    const output = stripJpegMetadata(input);
    expect(output).not.toBeNull();
    const stripped = output as Uint8Array;
    expect(includesBytes(stripped, [0x25, 0x88])).toBe(false);
    expect(includesBytes(stripped, 'N\0')).toBe(false);
    expect(includesBytes(stripped, 'GPSLatitude')).toBe(false);
    expect(includesBytes(stripped, 'http://ns.adobe.com/xap/1.0/')).toBe(false);
    expect(includesBytes(stripped, ICC_APP2)).toBe(true);
    expect(includesBytes(stripped, JFIF_APP0)).toBe(true);
  });

  it.each(['II', 'MM'] as const)('keeps orientation 6 in a minimal Exif in the same byte order (%s)', (order) => {
    const stripped = stripJpegMetadata(jpeg(JFIF_APP0, exifApp1({ order, orientation: 6 }), ICC_APP2));
    expect(stripped).not.toBeNull();
    expect(orientationOf(stripped as Uint8Array)).toEqual({ order, value: 6, entries: 1 });
    expect(includesBytes(stripped as Uint8Array, 'N\0')).toBe(false);
  });

  it('puts the minimal Exif where the old one was', () => {
    const stripped = stripJpegMetadata(jpeg(JFIF_APP0, exifApp1({ orientation: 3 }))) as Uint8Array;
    expect([...stripped.slice(0, 2 + JFIF_APP0.length)]).toEqual([0xff, 0xd8, ...JFIF_APP0]);
    expect(stripped[2 + JFIF_APP0.length + 1]).toBe(0xe1);
  });

  it('writes no Exif when the photo had no orientation or an invalid one', () => {
    expect(orientationOf(stripJpegMetadata(jpeg(exifApp1())) as Uint8Array)).toBeNull();
    expect(orientationOf(stripJpegMetadata(jpeg(exifApp1({ orientation: 9 }))) as Uint8Array)).toBeNull();
    expect(orientationOf(stripJpegMetadata(jpeg(exifApp1({ orientation: 0 }))) as Uint8Array)).toBeNull();
  });

  it('keeps the scan data after SOS untouched', () => {
    const input = jpeg(exifApp1({ orientation: 1 }));
    const stripped = stripJpegMetadata(input) as Uint8Array;
    expect([...stripped.slice(-8)]).toEqual([...input.slice(-8)]);
  });

  it.each([
    ['no SOI', Uint8Array.from([0x00, 0xd8, 0xff, 0xe0])],
    ['a segment running past the end', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x10, 0x00, 1, 2, 3])],
    ['no SOS', Uint8Array.from([0xff, 0xd8, ...JFIF_APP0, 0xff, 0xd9])],
    ['HTML after the magic number', Uint8Array.from([0xff, 0xd8, 0xff, ...new TextEncoder().encode('<html><script>')])],
    ['a length under two', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0xff, 0xda])],
    ['a byte that is not a marker', Uint8Array.from([0xff, 0xd8, 0x00, 0xe0, 0x00, 0x02])],
  ])('returns null for a malformed JPEG: %s', (_, bytes) => {
    expect(stripJpegMetadata(bytes)).toBeNull();
  });

  it('survives an Exif block whose offsets point outside it, dropping it with no orientation', () => {
    const broken = segment(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0, 0x49, 0x49, 42, 0, 0xff, 0xff, 0, 0]);
    const stripped = stripJpegMetadata(jpeg(broken));
    expect(stripped).not.toBeNull();
    expect(orientationOf(stripped as Uint8Array)).toBeNull();
  });
});
