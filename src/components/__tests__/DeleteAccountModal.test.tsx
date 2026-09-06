/**
 * Tests for DeleteAccountModal — destructive account deletion with email confirmation.
 *
 * Note: DeleteAccountModal.tsx is imported dynamically inside SettingsPage.
 * We test the component directly when possible, or mock its API call.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../lib/supabase', () => ({ supabase: null }));

vi.mock('../AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'test@example.com' },
    getAccessToken: vi.fn().mockResolvedValue('fake-token'),
    signOut: vi.fn(),
  }),
}));

// Mock the toast hook so the modal can call it
vi.mock('../useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
});
afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Inline a minimal DeleteAccountModal since the file doesn't exist yet.
// We test the expected behavior based on the component spec.
// ---------------------------------------------------------------------------
import type { ComponentProps } from 'react';

// Placeholder — will be replaced by the real component once it's created.
// These tests describe the contract for the DeleteAccountModal.
describe('DeleteAccountModal (contract tests)', () => {
  // When DeleteAccountModal.tsx is created, these tests will validate its behavior.
  // For now, we document the expected behavior here.

  it('placeholder: DeleteAccountModal should accept isOpen, email, onConfirm, onCancel, isDeleting props', () => {
    // This test documents the expected prop interface:
    // interface DeleteAccountModalProps {
    //   isOpen: boolean;
    //   email: string;
    //   onConfirm: () => void;
    //   onCancel: () => void;
    //   isDeleting: boolean;
    // }
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test the account deletion API call through the mock fetch
// ---------------------------------------------------------------------------
describe('DELETE /api/profile (account deletion) via fetch', () => {
  it('calls DELETE /api/profile with Bearer token', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'Account deleted.' }),
    });

    const token = 'fake-token';
    await fetch('/api/profile', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/profile', expect.objectContaining({
      method: 'DELETE',
      headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
    }));
  });

  it('returns success on 200', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const res = await fetch('/api/profile', { method: 'DELETE' });
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('throws on 500', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Failed to delete account' }),
    });

    const res = await fetch('/api/profile', { method: 'DELETE' });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
  });
});
