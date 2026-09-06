// @vitest-environment node
/**
 * Tests for POST /api/profile (password change) — verifies password change flow.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest } from '@vercel/node';

vi.mock('../_auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ user: { id: 'u1', email: 'test@example.com' } }),
  UnauthorizedError: class UnauthorizedError extends Error {},
  getSupabaseAdmin: vi.fn(),
}));

// Import the consolidated profile handler — POST is handled by handlePost
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

function makeReq(body?: unknown): VercelRequest {
  return { method: 'POST', body: body as VercelRequest['body'], headers: {} } as unknown as VercelRequest;
}

beforeEach(() => { vi.clearAllMocks(); });

describe('POST /api/profile (password change)', () => {
  it('returns 200 when password is changed successfully', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ user: {}, error: null }),
        admin: {
          updateUserById: vi.fn().mockResolvedValue({ user: {}, error: null }),
        },
      },
    });

    const req = makeReq({ currentPassword: 'oldpass', newPassword: 'newpass123' });
    const res = mockRes();
    await profileHandler(req, res);
    expect(res._status).toBe(200);
    expect((res._data as any).success).toBe(true);
  });

  it('returns 200 with snake_case field names (legacy frontend)', async () => {
    (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ user: {}, error: null }),
        admin: {
          updateUserById: vi.fn().mockResolvedValue({ user: {}, error: null }),
        },
      },
    });

    const req = makeReq({ current_password: 'oldpass', new_password: 'newpass123' });
    const res = mockRes();
    await profileHandler(req, res);
    expect(res._status).toBe(200);
    expect((res._data as any).success).toBe(true);
  });

  it('returns 400 when currentPassword is missing', async () => {
    const req = makeReq({ newPassword: 'newpass123' });
    const res = mockRes();
    await profileHandler(req, res);
    expect(res._status).toBe(400);
    expect((res._data as any).error).toContain('Current password');
  });

  it('returns 400 when newPassword is too short', async () => {
    const req = makeReq({ currentPassword: 'oldpass', newPassword: 'x' });
    const res = mockRes();
    await profileHandler(req, res);
    expect(res._status).toBe(400);
    expect((res._data as any).error).toContain('at least');
  });

  it('returns 400 when newPassword is too long', async () => {
    const req = makeReq({ currentPassword: 'oldpass', newPassword: 'x'.repeat(73) });
    const res = mockRes();
    await profileHandler(req, res);
    expect(res._status).toBe(400);
    expect((res._data as any).error).toContain('fewer');
  });

  it('returns 400 when newPassword equals currentPassword', async () => {
    const req = makeReq({ currentPassword: 'samepass', newPassword: 'samepass' });
    const res = mockRes();
    await profileHandler(req, res);
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

    const req = makeReq({ currentPassword: 'wrongpass', newPassword: 'newpass123' });
    const res = mockRes();
    await profileHandler(req, res);
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

    const req = makeReq({ currentPassword: 'oldpass', newPassword: 'newpass123' });
    const res = mockRes();
    await profileHandler(req, res);
    expect(res._status).toBe(500);
  });
});
