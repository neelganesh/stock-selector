/**
 * AES-256-GCM helpers for the Kite publisher API key.
 *
 * The encryption key (`KITE_KEY_ENCRYPTION_KEY`) is 32 bytes — we accept
 * either a 64-char hex string or a 32+ char raw string. In dev the env var
 * can be set to any string; in prod it must be a 64-char hex string. We
 * never log the key, never return it to the client, and never write the
 * plaintext to disk or to the database.
 *
 * Storage format (text in `user_profiles.kite_api_key`):
 *
 *   v1:<base64(iv)>:<base64(authTag)>:<base64(ciphertext)>
 *
 * The `v1` prefix lets us version the format: a future migration to a
 * KMS-wrapped DEK or a different AEAD would bump to `v2:` and add a
 * `decrypt` switch.
 */
import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const VERSION = 'v1';
const PREFIX = `${VERSION}:`;

export class CryptoError extends Error {}

function getKey(): Buffer {
  const raw = process.env.KITE_KEY_ENCRYPTION_KEY;
  if (!raw) {
    throw new CryptoError(
      'KITE_KEY_ENCRYPTION_KEY is not set. Add a 64-char hex string to your env.',
    );
  }
  // Accept hex (64 chars) or any string >= 32 bytes (we hash it).
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  if (raw.length >= 32) {
    return crypto.createHash('sha256').update(raw).digest();
  }
  throw new CryptoError(
    'KITE_KEY_ENCRYPTION_KEY must be a 64-char hex string or a string of >= 32 bytes.',
  );
}

/**
 * Encrypts a UTF-8 string. Returns the storage format string.
 */
export function encrypt(plaintext: string): string {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new CryptoError('Plaintext must be a non-empty string');
  }
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/**
 * Decrypts a value produced by {@link encrypt}. Throws CryptoError on
 * any tampering or wrong key — GCM auth tag is verified.
 */
export function decrypt(value: string): string {
  if (!value || !value.startsWith(PREFIX)) {
    throw new CryptoError('Ciphertext is missing v1 prefix');
  }
  const parts = value.slice(PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new CryptoError('Ciphertext has wrong number of segments');
  }
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  if (iv.length !== IV_BYTES) {
    throw new CryptoError(`IV must be ${IV_BYTES} bytes, got ${iv.length}`);
  }
  if (tag.length !== 16) {
    throw new CryptoError(`Auth tag must be 16 bytes, got ${tag.length}`);
  }
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    // GCM auth failure: wrong key or tampered ciphertext
    throw new CryptoError('Decryption failed (bad key or tampered ciphertext)');
  }
}

/**
 * Cheap sanity check for a Kite publisher API key. Does not network-call
 * Kite — the publisher popup is the only network hop. We only verify the
 * client-side format. The real validation is the user successfully placing
 * an order via the popup.
 */
export function isValidKiteKeyFormat(value: string): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 10 || trimmed.length > 128) return false;
  if (!/^[a-z0-9_-]+$/i.test(trimmed)) return false;
  // Kite publish keys always start with "kite" or "kitepro"
  return /^(kite|kitepro)[a-z0-9_-]*$/i.test(trimmed);
}

/**
 * Returns the encrypted blob's created-at timestamp if the value is a
 * v1-format ciphertext. We don't store one explicitly — for now we just
 * return the current time so the UI can show "added" once.
 */
export function getKeyAddedAtPlaceholder(): string {
  return new Date().toISOString();
}
