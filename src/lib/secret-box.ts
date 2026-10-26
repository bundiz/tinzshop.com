import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function assertKey(key: Buffer): void {
  if (key.length !== KEY_BYTES) {
    throw new Error(`Encryption key must be ${KEY_BYTES} bytes`);
  }
}

/** Encrypts a string with AES-256-GCM. Returns `v1.<iv>.<tag>.<ciphertext>`, each part base64url. */
export function encryptSecret(plaintext: string, key: Buffer): string {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/** Reverses `encryptSecret`. Throws on a bad format, the wrong key or tampering. */
export function decryptSecret(sealed: string, key: Buffer): string {
  assertKey(key);
  const parts = sealed.split(".");
  if (parts.length !== 4) {
    throw new Error("Sealed value is malformed");
  }
  const [version, ivPart, tagPart, dataPart] = parts as [
    string,
    string,
    string,
    string,
  ];
  if (version !== VERSION) {
    throw new Error("Sealed value has an unsupported version");
  }
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Sealed value is malformed");
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const data = Buffer.from(dataPart, "base64url");
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    throw new Error("Sealed value could not be decrypted");
  }
}
