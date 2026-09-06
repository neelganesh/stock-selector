// @vitest-environment node
/**
 * Tests for /api/profile/change-password — verifies password change flow.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest } from '@vercel/node';

vi.mock('../_auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ user: { id: 'u1', email: 'test@example.com' } }),
  UnauthorizedError: class UnauthorizedError extends Error {},
  getSupabaseAdmin: vi.fn(),
}));

import changePasswordHandler from '../profile/change-password';
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

describe('POST /api/profile/change-password', () => {
  it('returns 200 when password is changed successfully', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ user: {}, error: null }),
        admin: {
          updateUserById: vi.fn().mockResolvedValue({ user: {}, error: null }),
        },
      },
    });

    const req = makeReq('POST', { currentPassword: 'oldpass', newPassword: 'newpass123' });
    const res = mockRes();
    await changePasswordHandler(req, res);
    expect(res._status).toBe(200);
    expect((res._data as any).success).toBe(true);
  });

  it('returns 400 when currentPassword is missing', async () => {
    const req = makeReq('POST', { newPassword: 'newpass123' });
    const res = mockRes();
    await changePasswordHandler(req, res);
    expect(res._status).toBe(400);
    expect((res._data as any).error).toContain('Current password');
  });

  it('returns 400 when newPassword is too short', async () => {
    const req = makeReq('POST', { currentPassword: 'oldpass', newPassword: 'x' });
    const res = mockRes();
    await changePasswordHandler(req, res);
    expect(res._status).toBe(400);
    expect((res._data as any).error).toContain('at least');
  });

  it('returns 400 when newPassword is too long', async () => {
    const req = makeReq('POST', { currentPassword: 'oldpass', newPassword: 'x'.repeat(73) });
    const res = mockRes();
    await changePasswordHandler(req, res);
    expect(res._status).toBe(400);
    expect((res._data as any).error).toContain('fewer');
  });

  it('returns 400 when newPassword equals currentPassword', async () => {
    const req = makeReq('POST', { currentPassword: 'samepass', newPassword: 'samepass' });
    const res = mockRes();
    await changePasswordHandler(req, res);
    expect(res._status).toBe(400);
    expect((res._data as any).error).toContain('different');
  });

  it('returns 400 when current password is incorrect', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          user: null,
          error: { message: 'Invalid credentials' },
        }),
      },
    });

    const req = makeReq('POST', { currentPassword: 'wrongpass', newPassword: 'newpass123' });
    const res = mockRes();
    await changePasswordHandler(req, res);
    expect(res._status).toBe(400);
    expect((res._data as any).error).toContain('incorrect');
  });

  it('returns 500 when updateUserById fails', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ user: {}, error: null }),
        admin: {
          updateUserById: vi.fn().mockResolvedValue({ user: null, error: { message: 'update failed' } }),
        },
      },
    });

    const req = makeReq('POST', { currentPassword: 'oldpass', newPassword: 'newpass123' });
    const res = mockRes();
    await changePasswordHandler(req, res);
    expect(res._status).toBe(500);
  });

  it('returns 405 for non-POST method', async () => {
    const req = makeReq('GET');
    const res = mockRes();
    await changePasswordHandler(req, res);
    expect(res._status).toBe(405);
  });
});
