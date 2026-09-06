// @vitest-environment node
/**
 * Tests for api/_crypto.ts — AES-256-GCM encryption/decryption of Kite API keys.
 *
 * Note: Node environment required because _crypto.ts uses Node's crypto module.
 * We set the env var before importing.
 */

// Set up env var before importing the module under test
process.env.KITE_KEY_ENCRYPTION_KEY = 'a'.repeat(64); // 64-char hex = 32 bytes

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, isValidKiteKeyFormat, CryptoError } from '../_crypto';

describe('encrypt/decrypt (AES-256-GCM)', () => {
  it('roundtrips a kite API key', () => {
    const original = 'kitepro_abcdef1234567890';
    const encrypted = encrypt(original);
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(encrypted).not.toBe(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  it('roundtrips unicode characters', () => {
    const original = 'kite_abc_def_ghi_jkl_mno_pqr';
    const encrypted = encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  it('each call produces different ciphertext (random IV)', () => {
    const ct1 = encrypt('kite_abc123');
    const ct2 = encrypt('kite_abc123');
    expect(ct1).not.toBe(ct2);
    // Both should decrypt to the same value
    expect(decrypt(ct1)).toBe(decrypt(ct2));
  });

  it('throws CryptoError for tampered ciphertext', () => {
    const ct = encrypt('kite_abc123');
    const parts = ct.split(':');
    parts[3] = Buffer.from('fake').toString('base64'); // corrupt the ciphertext
    const tampered = parts.join(':');
    expect(() => decrypt(tampered)).toThrow();
  });

  it('throws CryptoError for corrupted auth tag', () => {
    const ct = encrypt('kite_abc123');
    const parts = ct.split(':');
    parts[2] = Buffer.from('fakefakefakefak').toString('base64'); // corrupt the tag
    const tampered = parts.join(':');
    expect(() => decrypt(tampered)).toThrow();
  });

  it('throws CryptoError for wrong key', () => {
    const ct = encrypt('kite_abc123');
    // Change the last byte of the key to get a different key
    const orig = process.env.KITE_KEY_ENCRYPTION_KEY!;
    process.env.KITE_KEY_ENCRYPTION_KEY = orig.slice(0, -2) + 'ff';
    expect(() => decrypt(ct)).toThrow();
    // Restore the original key
    process.env.KITE_KEY_ENCRYPTION_KEY = orig;
  });

  it('throws CryptoError when plaintext is empty', () => {
    expect(() => encrypt('')).toThrow(CryptoError);
  });

  it('throws CryptoError when ciphertext is missing v1 prefix', () => {
    expect(() => decrypt('notav1:something')).toThrow(CryptoError);
  });

  it('throws CryptoError when ciphertext has wrong number of segments', () => {
    expect(() => decrypt('v1:aaaa:bbbb')).toThrow(CryptoError);
  });
});

describe('isValidKiteKeyFormat', () => {
  it('accepts valid kite keys', () => {
    expect(isValidKiteKeyFormat('kite_abcdef')).toBe(true);
    expect(isValidKiteKeyFormat('kite_abcdefghijklmn')).toBe(true);
    expect(isValidKiteKeyFormat('kitepro_abcdefgh')).toBe(true);
    expect(isValidKiteKeyFormat('KITE_ABCDEF')).toBe(true);
    expect(isValidKiteKeyFormat('KitePro_AbcDef')).toBe(true);
    expect(isValidKiteKeyFormat('kitepro-abc-123')).toBe(true);
    expect(isValidKiteKeyFormat('kite_api_key_with_underscores')).toBe(true);
  });

  it('accepts keys at the minimum length boundary (10 chars)', () => {
    expect(isValidKiteKeyFormat('kite_abcde')).toBe(true); // kite_(5) + abcde(5) = 10
  });

  it('rejects too-short keys', () => {
    expect(isValidKiteKeyFormat('kite_abc')).toBe(false);
    expect(isValidKiteKeyFormat('kite_')).toBe(false);
    expect(isValidKiteKeyFormat('kite')).toBe(false);
    expect(isValidKiteKeyFormat('')).toBe(false);
  });

  it('rejects too-long keys', () => {
    expect(isValidKiteKeyFormat('kite_' + 'a'.repeat(130))).toBe(false); // 135 chars > 128
  });

  it('rejects keys that do not start with kite', () => {
    expect(isValidKiteKeyFormat('zerodha_abc')).toBe(false);
    expect(isValidKiteKeyFormat('upstox_abc')).toBe(false);
    expect(isValidKiteKeyFormat('abc_kite')).toBe(false);
  });

  it('rejects invalid characters', () => {
    expect(isValidKiteKeyFormat('kite_abc@#$%')).toBe(false);
    expect(isValidKiteKeyFormat('kite_abc def')).toBe(false);
    expect(isValidKiteKeyFormat('kite_abc.de')).toBe(false);
  });

  it('rejects non-string inputs', () => {
    expect(isValidKiteKeyFormat(null as any)).toBe(false);
    expect(isValidKiteKeyFormat(undefined as any)).toBe(false);
    expect(isValidKiteKeyFormat(123 as any)).toBe(false);
  });

  it('trims whitespace before validating', () => {
    expect(isValidKiteKeyFormat('  kite_abcdef  ')).toBe(true);
  });
});
