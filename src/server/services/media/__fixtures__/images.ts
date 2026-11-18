/**
 * Small images built byte by byte for the media tests (plan 017 Task 3). No real photo: the "GPS" below is a made-up
 * coordinate block, enough for a reader to find and for the tests to prove it is gone.
 */

const ascii = (text: string): number[] => [...text].map((char) => char.charCodeAt(0));
const u16be = (value: number): number[] => [(value >> 8) & 0xff, value & 0xff];
const u16le = (value: number): number[] => [value & 0xff, (value >> 8) & 0xff];
const u32be = (value: number): number[] => [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
const u32le = (value: number): number[] => [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];

/** One JPEG segment: marker, big-endian length (payload + 2), payload. */
export function segment(marker: number, payload: readonly number[]): number[] {
  return [0xff, marker, ...u16be(payload.length + 2), ...payload];
}

export const JFIF_APP0 = segment(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
/** An ICC profile segment (APP2), kept byte for byte. */
export const ICC_APP2 = segment(0xe2, [...ascii('ICC_PROFILE'), 0, 1, 1, 0x10, 0x20, 0x30, 0x40]);
/** An XMP packet (APP1) naming a place. */
export const XMP_APP1 = segment(0xe1, [
  ...ascii('http://ns.adobe.com/xap/1.0/'),
  0,
  ...ascii('<x:xmpmeta><exif:GPSLatitude>13,45.0N</exif:GPSLatitude></x:xmpmeta>'),
]);
const DQT = segment(0xdb, [0x00, ...new Array<number>(64).fill(1)]);
const SOF0 = segment(0xc0, [8, ...u16be(1), ...u16be(1), 1, 1, 0x11, 0]);
const DHT = segment(0xc4, [0x00, 1, ...new Array<number>(15).fill(0), 0]);
const SOS_AND_DATA = [...segment(0xda, [1, 1, 0, 0, 63, 0]), 0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9];

export type ByteOrder = 'II' | 'MM';

/**
 * An Exif APP1 whose IFD0 holds an orientation (when given) and a GPS IFD pointer, followed by a GPS IFD with a
 * latitude reference and a latitude: what a phone writes when location is on.
 */
export function exifApp1(options: { order?: ByteOrder; orientation?: number } = {}): number[] {
  const order = options.order ?? 'II';
  const u16 = order === 'II' ? u16le : u16be;
  const u32 = order === 'II' ? u32le : u32be;
  const entries: number[][] = [];
  if (options.orientation !== undefined) entries.push([...u16(0x0112), ...u16(3), ...u32(1), ...u16(options.orientation), 0, 0]);
  const ifd0Size = 2 + 12 * (entries.length + 1) + 4;
  const gpsOffset = 8 + ifd0Size;
  entries.push([...u16(0x8825), ...u16(4), ...u32(1), ...u32(gpsOffset)]);
  const latitudeOffset = gpsOffset + 2 + 12 * 2 + 4;
  const ifd0 = [...u16(entries.length), ...entries.flat(), ...u32(0)];
  const gps = [
    ...u16(2),
    ...u16(0x0001), ...u16(2), ...u32(2), ...ascii('N'), 0, 0, 0,
    ...u16(0x0002), ...u16(5), ...u32(3), ...u32(latitudeOffset),
    ...u32(0),
    ...u32(13), ...u32(1), ...u32(45), ...u32(1), ...u32(0), ...u32(1),
  ];
  const tiff = [...ascii(order), ...u16(42), ...u32(8), ...ifd0, ...gps];
  return segment(0xe1, [...ascii('Exif'), 0, 0, ...tiff]);
}

const SOF2 = segment(0xc2, [8, ...u16be(1), ...u16be(1), 1, 1, 0x11, 0]);
/** One scan: its SOS header, then entropy-coded bytes (which may hold 0xFF00 stuffing and RSTn markers). */
const scan = (data: readonly number[]): number[] => [...segment(0xda, [1, 1, 0, 0, 63, 0]), ...data];
/** Scan bytes that look like markers but are not: a stuffed 0xFF00 followed by an APP1 byte, and a restart marker. */
export const FIRST_SCAN_DATA = [0x12, 0xff, 0x00, 0xe1, 0x00, 0x10, 0x34, 0xff, 0xd0, 0x56];
export const SECOND_SCAN_DATA = [0x78, 0xff, 0x00, 0xed, 0x9a];

/**
 * A progressive JPEG (SOF2) with two scans: `head` segments after SOI, and `between` segments between the scans, where
 * a writer may put tables, and a crafted file metadata.
 */
export function progressiveJpeg(head: readonly (readonly number[])[], between: readonly (readonly number[])[]): Uint8Array {
  return Uint8Array.from([
    0xff, 0xd8,
    ...head.flat(),
    ...DQT, ...SOF2, ...DHT,
    ...scan(FIRST_SCAN_DATA),
    ...between.flat(),
    ...DHT,
    ...scan(SECOND_SCAN_DATA),
    0xff, 0xd9,
  ]);
}

/** A Photoshop/IPTC block (APP13) and a comment (COM), both naming a place. */
export const APP13 = segment(0xed, [...ascii('Photoshop 3.0'), 0, ...ascii('8BIM'), 0x04, 0x04, ...ascii('Sub-location: Siam')]);
export const COM = segment(0xfe, ascii('taken at 13.7563N 100.5018E'));

/** A JPEG made of the given segments between SOI and the frame, then a one-pixel frame and its scan. */
export function jpeg(...segments: readonly (readonly number[])[]): Uint8Array {
  return Uint8Array.from([0xff, 0xd8, ...segments.flat(), ...DQT, ...SOF0, ...DHT, ...SOS_AND_DATA]);
}

export const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ...u32be(13), ...ascii('IHDR'), ...u32be(1), ...u32be(1), 8, 6, 0, 0, 0, 0x1f, 0x15, 0xc4, 0x89,
  ...u32be(0), ...ascii('IEND'), 0xae, 0x42, 0x60, 0x82,
]);

export const GIF = Uint8Array.from([
  ...ascii('GIF89a'), ...u16le(1), ...u16le(1), 0x80, 0, 0,
  0, 0, 0, 0xff, 0xff, 0xff,
  0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

const VP8L = [...ascii('VP8L'), ...u32le(5), 0x2f, 0, 0, 0, 0, 0];
export const WEBP = Uint8Array.from([...ascii('RIFF'), ...u32le(4 + VP8L.length), ...ascii('WEBP'), ...VP8L]);

export const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
export const HTML = new TextEncoder().encode('<!doctype html><html><body><script>alert(1)</script></body></html>');
export const PDF = new TextEncoder().encode('%PDF-1.7\n1 0 obj << >> endobj\n%%EOF');
export const TEXT = new TextEncoder().encode('just some text, renamed .jpg');

/** Bytes containing `needle`, as a test helper for "the GPS block is gone". */
export function includesBytes(haystack: Uint8Array, needle: readonly number[] | string): boolean {
  const pattern = typeof needle === 'string' ? ascii(needle) : needle;
  outer: for (let i = 0; i + pattern.length <= haystack.length; i += 1) {
    for (let j = 0; j < pattern.length; j += 1) if (haystack[i + j] !== pattern[j]) continue outer;
    return true;
  }
  return false;
}
