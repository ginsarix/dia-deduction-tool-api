import { describe, expect, test, vi } from "vitest";

// Mock the env module before importing aes-256-gcm so the key is available
// when the module initialises. The key must be a 32-byte Buffer (AES-256).
vi.mock("../config/env.js", () => ({
  env: { DIA_PWD_SECRET_KEY: Buffer.alloc(32, 0xab) },
}));

const { aesDecrypt, aesEncrypt } = await import("./aes-256-gcm.js");

describe("aesEncrypt / aesDecrypt", () => {
  test("round-trip: decrypt(encrypt(x)) === x", () => {
    const plaintext = "super-secret-password!";
    expect(aesDecrypt(aesEncrypt(plaintext))).toBe(plaintext);
  });

  test("handles empty string round-trip", () => {
    expect(aesDecrypt(aesEncrypt(""))).toBe("");
  });

  test("handles unicode and special characters", () => {
    const plaintext = "şifre: 🔑 Türkçe & <test>";
    expect(aesDecrypt(aesEncrypt(plaintext))).toBe(plaintext);
  });

  test("produces different ciphertext for the same plaintext each call (random IV)", () => {
    const plaintext = "same-input";
    const ct1 = aesEncrypt(plaintext);
    const ct2 = aesEncrypt(plaintext);
    // Different IVs → different base64 output, even for identical plaintext
    expect(ct1).not.toBe(ct2);
  });

  test("throws when the ciphertext is tampered", () => {
    const ciphertext = aesEncrypt("legitimate data");
    // Flip a byte in the middle to corrupt the auth tag or ciphertext
    const buf = Buffer.from(ciphertext, "base64");
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString("base64");

    expect(() => aesDecrypt(tampered)).toThrow();
  });
});
