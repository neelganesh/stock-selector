/**
 * Tests for /api/profile — GET (read) / PATCH (update) / DELETE (delete account).
 *
 * Auth is mocked to inject a fake user. Supabase admin is mocked per test case.
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest } from '@vercel/node';

vi.mock('../_auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ user: { id: 'u1', email: 'test@example.com' } }),
  UnauthorizedError: class UnauthorizedError extends Error {},
  getSupabaseAdmin: vi.fn(),
}));

import profileHandler from '../profile/index';
import { getSupabaseAdmin } from '../_auth';

function mockRes(): {
  _status: number;
  _data: unknown;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const res: ReturnType<typeof mockRes> = {} as ReturnType<typeof mockRes>;
  res.status = vi.fn((code: number) => { res._status = code; return res as unknown as any; });
  res.json = vi.fn((data: unknown) => { res._data = data; return res as unknown as any; });
  return res;
}

function makeReq(method: string, body?: unknown): VercelRequest {
  return { method, body: body as VercelRequest['body'], headers: {} } as unknown as VercelRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
describe('GET /api/profile', () => {
  it('returns 200 with profile data', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'p1',
                user_id: 'u1',
                email: 'test@example.com',
                full_name: 'Test User',
                paper_trading_enabled: false,
                paper_trading_capital: 100000,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-06-01T00:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    const req = makeReq('GET');
    const res = mockRes();
    await profileHandler(req, res);
    expect(res._status).toBe(200);
    expect(res._data).toMatchObject({ full_name: 'Test User' });
  });

  it('returns 404 when profile not found', async () => {
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
    await profileHandler(req, res);
    expect(res._status).toBe(404);
  });

  it('returns 500 when Supabase errors', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
          }),
        }),
      }),
    });

    const req = makeReq('GET');
    const res = mockRes();
    await profileHandler(req, res);
    expect(res._status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------
describe('PATCH /api/profile', () => {
  it('updates full_name', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'p1', user_id: 'u1', full_name: 'New Name', paper_trading_enabled: false, paper_trading_capital: 100000, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });

    const req = makeReq('PATCH', { full_name: 'New Name' });
    const res = mockRes();
    await profileHandler(req, res);
    expect(res._status).toBe(200);
    expect((res._data as any).full_name).toBe('New Name');
  });

  it('updates paper_trading_enabled', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'p1', user_id: 'u1', full_name: 'Test', paper_trading_enabled: true, paper_trading_capital: 50000, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });

    const req = makeReq('PATCH', { paper_trading_enabled: true, paper_trading_capital: 50000 });
    const res = mockRes();
    await profileHandler(req, res);
    expect(res._status).toBe(200);
    expect((res._data as any).paper_trading_capital).toBe(50000);
  });

  it('returns 400 when no allowed fields are provided', async () => {
    const req = makeReq('PATCH', { unknown_field: 'bad' });
    const res = mockRes();
    await profileHandler(req, res);
    expect(res._status).toBe(400);
    expect((res._data as any).error).toContain('No allowed fields');
  });

  it('returns 400 when body is not an object', async () => {
    const req = makeReq('PATCH', null);
    const res = mockRes();
    await profileHandler(req, res);
    expect(res._status).toBe(400);
  });

  it('rejects paper_trading_capital outside numeric bounds', async () => {
    const req = makeReq('PATCH', { paper_trading_capital: -100 });
    const res = mockRes();
    await profileHandler(req, res);
    // sanitizePatch throws for out-of-range values → handler returns 400
    expect(res._status).toBe(400);
  });

  it('returns 500 when Supabase update fails', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'update failed' } }),
            }),
          }),
        }),
      }),
    });

    const req = makeReq('PATCH', { full_name: 'New Name' });
    const res = mockRes();
    await profileHandler(req, res);
    expect(res._status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
describe('DELETE /api/profile', () => {
  it('returns 200 when account is deleted successfully', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: {
        admin: {
          deleteUser: vi.fn().mockResolvedValue({ error: null }),
        },
      },
    });

    const req = makeReq('DELETE');
    const res = mockRes();
    await profileHandler(req, res);
    expect(res._status).toBe(200);
    expect((res._data as any).success).toBe(true);
  });

  it('returns 200 when account already deleted', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: {
        admin: {
          deleteUser: vi.fn().mockResolvedValue({
            error: { message: 'User not found' },
          }),
        },
      },
    });

    const req = makeReq('DELETE');
    const res = mockRes();
    await profileHandler(req, res);
    expect(res._status).toBe(200);
    expect((res._data as any).success).toBe(true);
  });

  it('returns 500 when Supabase delete fails', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: {
        admin: {
          deleteUser: vi.fn().mockResolvedValue({
            error: { message: 'some other error' },
          }),
        },
      },
    });

    const req = makeReq('DELETE');
    const res = mockRes();
    await profileHandler(req, res);
    expect(res._status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Method not allowed
// ---------------------------------------------------------------------------
describe('Unsupported methods', () => {
  it('returns 405 for PUT', async () => {
    const req = makeReq('PUT');
    const res = mockRes();
    await profileHandler(req, res);
    expect(res._status).toBe(405);
  });
});
