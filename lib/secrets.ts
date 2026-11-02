import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function encryptionKey() {
  const raw = process.env.APP_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(raw)) {
    throw new Error("APP_ENCRYPTION_KEY must be a 64-character hexadecimal value.");
  }
  return Buffer.from(raw, "hex");
}

/** Encrypts provider credentials before they are stored in the database. */
export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map(part => part.toString("base64url")).join(".");
}

/** Decrypts a credential only in server-side code. */
export function decryptSecret(value: string) {
  const [ivPart, tagPart, ciphertextPart, extra] = value.split(".");
  if (!ivPart || !tagPart || !ciphertextPart || extra !== undefined) {
    throw new Error("Stored AI credential has an invalid format.");
  }
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
