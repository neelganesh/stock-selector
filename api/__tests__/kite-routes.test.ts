/**
 * Tests for the Kite API route handlers.
 *
 * Each handler is imported and called directly with a mock VercelRequest/VercelResponse.
 * Auth and crypto are mocked to isolate the route logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---------------------------------------------------------------------------
// Mock _auth — inject a fake authenticated user
// ---------------------------------------------------------------------------
vi.mock('../_auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ user: { id: 'u1', email: 'test@example.com' } }),
  UnauthorizedError: class UnauthorizedError extends Error {},
  getSupabaseAdmin: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock _crypto — deterministic encrypt/decrypt so we can verify the logic
// ---------------------------------------------------------------------------
vi.mock('../_crypto', () => {
  const CryptoError = class CryptoError extends Error {};
  return {
    encrypt: vi.fn((v: string) => `v1:mockIv:mockTagLong:${Buffer.from(v).toString('base64')}`),
    decrypt: vi.fn((v: string) => {
      const parts = v.split(':');
      if (parts.length !== 4) throw new Error('invalid');
      // For values with tag < 10 chars (e.g. 'v1:bad:tag:ct'), throw CryptoError
      // (key-status handler catches CryptoError → working:false)
      if (parts[2].length < 10) {
        throw new CryptoError('invalid auth tag');
      }
      return Buffer.from(parts[3], 'base64').toString('utf8');
    }),
    isValidKiteKeyFormat: vi.fn((v: string) => /^kite/i.test(v) && v.length >= 10),
    CryptoError,
  };
});

// ---------------------------------------------------------------------------
// Imports — must come AFTER vi.mock()
// ---------------------------------------------------------------------------
import saveKeyHandler from '../kite/save-key';
import deleteKeyHandler from '../kite/delete-key';
import keyStatusHandler from '../kite/key-status';
import publishHandler from '../kite/publish';
import { getSupabaseAdmin } from '../_auth';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
function mockRes(): {
  _status: number;
  _data: unknown;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const res: ReturnType<typeof mockRes> = {} as ReturnType<typeof mockRes>;
  res.status = vi.fn((code: number) => { res._status = code; return res as unknown as VercelResponse; });
  res.json = vi.fn((data: unknown) => { res._data = data; return res as unknown as VercelResponse; });
  return res;
}

function makeReq(method: string, body?: unknown): VercelRequest {
  return { method, body: body as VercelRequest['body'], headers: {} } as unknown as VercelRequest;
}

// ---------------------------------------------------------------------------
// POST /api/kite/save-key
// ---------------------------------------------------------------------------
describe('POST /api/kite/save-key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for missing api_key', async () => {
    const req = makeReq('POST', {});
    const res = mockRes();
    await saveKeyHandler(req, res);
    expect(res._status).toBe(400);
    expect((res._data as any).error).toContain('required');
  });

  it('returns 400 for empty string api_key', async () => {
    const req = makeReq('POST', { api_key: '   ' });
    const res = mockRes();
    await saveKeyHandler(req, res);
    expect(res._status).toBe(400);
  });

  it('returns 400 for invalid format', async () => {
    const req = makeReq('POST', { api_key: 'not-a-kite-key' });
    const res = mockRes();
    await saveKeyHandler(req, res);
    expect(res._status).toBe(400);
    expect((res._data as any).success).toBe(false);
  });

  it('returns 200 for valid key', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    const req = makeReq('POST', { api_key: 'kite_abcdefghij' });
    const res = mockRes();
    await saveKeyHandler(req, res);
    expect(res._status).toBe(200);
    expect((res._data as any).success).toBe(true);
  });

  it('returns 405 for non-POST method', async () => {
    const req = makeReq('GET');
    const res = mockRes();
    await saveKeyHandler(req, res);
    expect(res._status).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/kite/delete-key
// ---------------------------------------------------------------------------
describe('DELETE /api/kite/delete-key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and clears the key', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    const req = makeReq('DELETE');
    const res = mockRes();
    await deleteKeyHandler(req, res);
    expect(res._status).toBe(200);
    expect((res._data as any).success).toBe(true);
  });

  it('returns 500 when Supabase errors', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'db error' } }),
        }),
      }),
    });

    const req = makeReq('DELETE');
    const res = mockRes();
    await deleteKeyHandler(req, res);
    expect(res._status).toBe(500);
  });

  it('returns 405 for non-DELETE method', async () => {
    const req = makeReq('POST');
    const res = mockRes();
    await deleteKeyHandler(req, res);
    expect(res._status).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// GET /api/kite/key-status
// ---------------------------------------------------------------------------
describe('GET /api/kite/key-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns configured:false when no key is stored', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    const req = makeReq('GET');
    const res = mockRes();
    await keyStatusHandler(req, res);
    expect(res._status).toBe(200);
    expect((res._data as any).configured).toBe(false);
  });

  it('returns configured:true, working:true when key decrypts successfully', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { kite_api_key: 'v1:mockIv:mockTagLong:a2l0ZV9rZXk=', updated_at: '2024-01-01T00:00:00Z' },
              error: null,
            }),
          }),
        }),
      }),
    });

    const req = makeReq('GET');
    const res = mockRes();
    await keyStatusHandler(req, res);
    expect(res._status).toBe(200);
    expect((res._data as any).configured).toBe(true);
    expect((res._data as any).working).toBe(true);
  });

  it('returns configured:true, working:false when decrypt throws CryptoError', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { kite_api_key: 'v1:bad:tag:ct', updated_at: '2024-01-01T00:00:00Z' },
              error: null,
            }),
          }),
        }),
      }),
    });

    const req = makeReq('GET');
    const res = mockRes();
    await keyStatusHandler(req, res);
    expect(res._status).toBe(200);
    expect((res._data as any).configured).toBe(true);
    expect((res._data as any).working).toBe(false);
  });

  it('returns 405 for non-GET method', async () => {
    const req = makeReq('POST');
    const res = mockRes();
    await keyStatusHandler(req, res);
    expect(res._status).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// POST /api/kite/publish
// ---------------------------------------------------------------------------
describe('POST /api/kite/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when no key is configured', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    const req = makeReq('POST');
    const res = mockRes();
    await publishHandler(req, res);
    expect(res._status).toBe(404);
    expect((res._data as any).code).toBe('KITE_KEY_NOT_CONFIGURED');
  });

  it('returns 200 with apiKey when key decrypts successfully', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { kite_api_key: 'v1:mockIv:mockTagLong:a2l0ZV9rZXk=' },
              error: null,
            }),
          }),
        }),
      }),
    });

    const req = makeReq('POST');
    const res = mockRes();
    await publishHandler(req, res);
    expect(res._status).toBe(200);
    expect((res._data as any).apiKey).toBeTruthy();
    expect((res._data as any).nonce).toBeTruthy();
    expect((res._data as any).ttlSeconds).toBe(60);
  });

  it('returns 500 when decrypt fails', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { kite_api_key: 'v1:bad:tag:ct' },
              error: null,
            }),
          }),
        }),
      }),
    });

    const req = makeReq('POST');
    const res = mockRes();
    await publishHandler(req, res);
    expect(res._status).toBe(500);
    expect((res._data as any).code).toBe('KITE_KEY_DECRYPT_FAILED');
  });

  it('returns 405 for non-POST method', async () => {
    const req = makeReq('GET');
    const res = mockRes();
    await publishHandler(req, res);
    expect(res._status).toBe(405);
  });
});
