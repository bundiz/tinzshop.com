import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./secret-box";

const key = Buffer.alloc(32, 7);

describe("secret box", () => {
  it("round-trips Thai text", () => {
    const text = "โทเค็นทดสอบ";
    expect(decryptSecret(encryptSecret(text, key), key)).toBe(text);
  });

  it("produces different output each time for the same input", () => {
    expect(encryptSecret("same", key)).not.toBe(encryptSecret("same", key));
  });

  it("uses the v1.<iv>.<tag>.<ciphertext> format with a 12-byte IV", () => {
    const parts = encryptSecret("x", key).split(".");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
    expect(Buffer.from(parts[1] ?? "", "base64url")).toHaveLength(12);
  });

  it("rejects a tampered ciphertext", () => {
    const parts = encryptSecret("secret value", key).split(".");
    const last = parts[3] ?? "";
    parts[3] = (last[0] === "A" ? "B" : "A") + last.slice(1);
    expect(() => decryptSecret(parts.join("."), key)).toThrow(Error);
  });

  it("rejects the wrong key", () => {
    const sealed = encryptSecret("secret value", key);
    expect(() => decryptSecret(sealed, randomBytes(32))).toThrow(Error);
  });

  it("rejects a key that is not 32 bytes", () => {
    expect(() => encryptSecret("x", Buffer.alloc(16))).toThrow(Error);
    expect(() =>
      decryptSecret(encryptSecret("x", key), Buffer.alloc(16)),
    ).toThrow(Error);
  });

  it("rejects a malformed value", () => {
    expect(() => decryptSecret("abc", key)).toThrow(Error);
    expect(() => decryptSecret("v2.a.b.c", key)).toThrow(Error);
    const [, iv, tag, data] = encryptSecret("x", key).split(".");
    const shortIv = Buffer.alloc(8).toString("base64url");
    expect(() => decryptSecret(`v1.${shortIv}.${tag}.${data}`, key)).toThrow(
      Error,
    );
    expect(iv).toBeDefined();
  });

  it("never puts the plaintext in an error message", () => {
    const sealed = encryptSecret("hunter2-plaintext", key);
    try {
      decryptSecret(sealed, randomBytes(32));
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain("hunter2-plaintext");
    }
  });
});
