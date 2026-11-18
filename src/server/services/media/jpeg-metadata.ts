/**
 * Removes a JPEG's location data before it is stored (plan 017, D-278): every APP1 segment (Exif, which holds GPS, and
 * XMP) is dropped, and when the dropped Exif held a valid orientation a minimal Exif holding only that tag is written
 * back in its place, so the photo is not shown sideways. Every other segment (the colour profile included) and the
 * scan data are kept byte for byte; nothing is re-encoded.
 */

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const APP1 = 0xe1;
const ORIENTATION_TAG = 0x0112;
const TYPE_SHORT = 3;
const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"

type Orientation = { readonly littleEndian: boolean; readonly value: number };

/** Markers that stand alone, with no length: TEM and RST0 to RST7. */
function isStandalone(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

function startsWith(bytes: Uint8Array, offset: number, prefix: readonly number[]): boolean {
  return prefix.every((byte, i) => bytes[offset + i] === byte);
}

/** The orientation an Exif payload's IFD0 holds (1 to 8), or null when it has none, a bad one, or does not parse. */
function readOrientation(bytes: Uint8Array, start: number, end: number): Orientation | null {
  const tiff = start + EXIF_HEADER.length;
  if (end - tiff < 8 || !startsWith(bytes, start, EXIF_HEADER)) return null;
  const order = String.fromCharCode(bytes[tiff] ?? 0, bytes[tiff + 1] ?? 0);
  if (order !== 'II' && order !== 'MM') return null;
  const littleEndian = order === 'II';
  const view = new DataView(bytes.buffer, bytes.byteOffset + tiff, end - tiff);
  if (view.getUint16(2, littleEndian) !== 42) return null;
  const ifd = view.getUint32(4, littleEndian);
  if (ifd + 2 > view.byteLength) return null;
  const count = view.getUint16(ifd, littleEndian);
  for (let i = 0; i < count; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > view.byteLength) return null;
    if (view.getUint16(entry, littleEndian) !== ORIENTATION_TAG) continue;
    if (view.getUint16(entry + 2, littleEndian) !== TYPE_SHORT || view.getUint32(entry + 4, littleEndian) !== 1) return null;
    const value = view.getUint16(entry + 8, littleEndian);
    return value >= 1 && value <= 8 ? { littleEndian, value } : null;
  }
  return null;
}

/** An APP1 segment holding a TIFF header and an IFD0 with the orientation tag only. */
function minimalExif({ littleEndian, value }: Orientation): Uint8Array {
  const payload = new Uint8Array(EXIF_HEADER.length + 8 + 2 + 12 + 4);
  payload.set(EXIF_HEADER);
  const view = new DataView(payload.buffer, EXIF_HEADER.length);
  view.setUint8(0, littleEndian ? 0x49 : 0x4d);
  view.setUint8(1, littleEndian ? 0x49 : 0x4d);
  view.setUint16(2, 42, littleEndian);
  view.setUint32(4, 8, littleEndian);
  view.setUint16(8, 1, littleEndian);
  view.setUint16(10, ORIENTATION_TAG, littleEndian);
  view.setUint16(12, TYPE_SHORT, littleEndian);
  view.setUint32(14, 1, littleEndian);
  view.setUint16(18, value, littleEndian);
  view.setUint32(22, 0, littleEndian);
  const length = payload.length + 2;
  return Uint8Array.from([0xff, APP1, (length >> 8) & 0xff, length & 0xff, ...payload]);
}

/**
 * The JPEG without its APP1 segments (and with a minimal orientation Exif where the first Exif was, when it held one),
 * or null for a malformed JPEG: no SOI, a byte where a marker should be, a segment running past the end, or no SOS.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array | null {
  if (bytes[0] !== 0xff || bytes[1] !== SOI) return null;
  const kept: Uint8Array[] = [bytes.subarray(0, 2)];
  let exifAt: number | null = null;
  let orientation: Orientation | null = null;
  let changed = false;
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    let markerAt = i + 1;
    // A marker may be preceded by any number of 0xFF fill bytes.
    while (bytes[markerAt] === 0xff) markerAt += 1;
    const marker = bytes[markerAt];
    if (marker === undefined || marker === SOI || marker === EOI || marker === 0x00) return null;
    if (marker === SOS) {
      kept.push(bytes.subarray(i));
      if (!changed) return bytes;
      if (orientation !== null && exifAt !== null) kept.splice(exifAt, 0, minimalExif(orientation));
      const out = new Uint8Array(kept.reduce((total, part) => total + part.length, 0));
      let at = 0;
      for (const part of kept) {
        out.set(part, at);
        at += part.length;
      }
      return out;
    }
    if (isStandalone(marker)) {
      kept.push(bytes.subarray(i, markerAt + 1));
      i = markerAt + 1;
      continue;
    }
    if (markerAt + 2 >= bytes.length) return null;
    const length = ((bytes[markerAt + 1] ?? 0) << 8) | (bytes[markerAt + 2] ?? 0);
    const end = markerAt + 1 + length;
    if (length < 2 || end > bytes.length) return null;
    if (marker === APP1) {
      changed = true;
      if (exifAt === null && startsWith(bytes, markerAt + 3, EXIF_HEADER)) {
        exifAt = kept.length;
        orientation = readOrientation(bytes, markerAt + 3, end);
      }
    } else {
      kept.push(bytes.subarray(i, end));
    }
    i = end;
  }
  return null;
}
