import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../lib/secrets";

const original = process.env.APP_ENCRYPTION_KEY;
const testKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

afterEach(() => {
  if (original === undefined) delete process.env.APP_ENCRYPTION_KEY;
  else process.env.APP_ENCRYPTION_KEY = original;
});

describe("AI credential encryption", () => {
  it("encrypts and decrypts without returning the original value", () => {
    process.env.APP_ENCRYPTION_KEY = testKey;
    const secret = "test-api-key-not-real";
    const encrypted = encryptSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it("rejects tampered ciphertext", () => {
    process.env.APP_ENCRYPTION_KEY = testKey;
    const encrypted = encryptSecret("sample-secret");
    const parts = encrypted.split(".");
    parts[2] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });

  it("requires a 32-byte hexadecimal encryption key", () => {
    process.env.APP_ENCRYPTION_KEY = "not-a-valid-key";
    expect(() => encryptSecret("sample-secret")).toThrow(/64-character hexadecimal/);
  });
});
