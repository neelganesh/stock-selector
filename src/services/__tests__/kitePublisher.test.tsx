/**
 * Tests for src/services/kitePublisher.ts
 *
 * The service deals with:
 * 1. loadPublisherScript — dynamic script loading
 * 2. isPublisherReady — state check
 * 3. fetchPublishTicket — network call to /api/kite/publish
 * 4. initKitePublisher — ticket + script -> KiteConnect instance
 * 5. placeOrder — full order flow
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the supabase module (used for getAccessToken inside fetchPublishTicket)
// ---------------------------------------------------------------------------
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'fake-token' } },
      }),
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock framer-motion to avoid animation issues in tests
// ---------------------------------------------------------------------------
vi.mock('framer-motion', () => ({
  motion: {
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
}));

// ---------------------------------------------------------------------------
// Global fetch mock (reset per test)
// ---------------------------------------------------------------------------
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
});
afterEach(() => {
  fetchMock.mockReset();
  __resetScriptState();
});

// ---------------------------------------------------------------------------
// Import the service AFTER mocks are set up
// ---------------------------------------------------------------------------
import {
  loadPublisherScript,
  isPublisherReady,
  fetchPublishTicket,
  initKitePublisher,
  placeOrder,
  __resetScriptState,
} from '../../services/kitePublisher';
import type { PublishTicket, KiteOrder } from '../../services/kitePublisher';

// ---------------------------------------------------------------------------
// loadPublisherScript
// ---------------------------------------------------------------------------
describe('loadPublisherScript', () => {
  afterEach(() => {
    // Reset the loaded state by clearing the injected script tag
    const existing = document.querySelector(`script[src="https://kite.trade/publisher.js?v=3"]`);
    if (existing) existing.remove();
    // Reset the module-level scriptLoaded flag by re-importing
    // (Vitest caches modules, so we use vi.resetModules in beforeEach instead)
  });

  it('appends a script tag to the document body', async () => {
    const promise = loadPublisherScript();
    const appended = document.querySelector(`script[src="https://kite.trade/publisher.js?v=3"]`);
    expect(appended).toBeTruthy();
    // Resolve the pending script onload
    const script = appended as HTMLScriptElement;
    script.dispatchEvent(new Event('load'));
    await promise;
    expect(isPublisherReady()).toBe(false); // still false — KiteConnect not set
  });

  it('returns the same promise when called multiple times', () => {
    const p1 = loadPublisherScript();
    const p2 = loadPublisherScript();
    expect(p1).toBe(p2);
    // Clean up
    const script = document.querySelector(`script[src="https://kite.trade/publisher.js?v=3"]`);
    script?.dispatchEvent(new Event('load'));
  });
});

// ---------------------------------------------------------------------------
// fetchPublishTicket
// ---------------------------------------------------------------------------
describe('fetchPublishTicket', () => {
  it('returns a PublishTicket on success', async () => {
    const mockTicket: PublishTicket = {
      apiKey: 'kite_api_key_123',
      nonce: 'abc123',
      expiresAt: Date.now() + 60_000,
      ttlSeconds: 60,
    };
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mockTicket,
    });

    const ticket = await fetchPublishTicket();
    expect(ticket.apiKey).toBe('kite_api_key_123');
    expect(fetchMock).toHaveBeenCalledWith('/api/kite/publish', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer fake-token' }),
    }));
  });

  it('throws with KITE_KEY_NOT_CONFIGURED code when 404', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Kite API key not configured', code: 'KITE_KEY_NOT_CONFIGURED' }),
    });

    await expect(fetchPublishTicket()).rejects.toMatchObject({
      code: 'KITE_KEY_NOT_CONFIGURED',
    });
  });

  it('throws when response is not ok', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    });

    await expect(fetchPublishTicket()).rejects.toThrow('Internal server error');
  });
});

// ---------------------------------------------------------------------------
// initKitePublisher
// ---------------------------------------------------------------------------
describe('initKitePublisher', () => {
  beforeEach(() => {
    // Make sure KiteConnect is NOT present initially
    delete (window as any).KiteConnect;
  });

  afterEach(() => {
    delete (window as any).KiteConnect;
  });

  it('throws when ticket is missing apiKey', async () => {
    const ticket: PublishTicket = {
      apiKey: '',
      nonce: 'abc',
      expiresAt: Date.now() + 60_000,
      ttlSeconds: 60,
    };
    await expect(initKitePublisher(ticket)).rejects.toThrow('missing API key');
  });

  it('throws when ticket has expired', async () => {
    const ticket: PublishTicket = {
      apiKey: 'kite_key',
      nonce: 'abc',
      expiresAt: Date.now() - 1000, // expired
      ttlSeconds: 60,
    };
    await expect(initKitePublisher(ticket)).rejects.toThrow('expired');
  });
});

// ---------------------------------------------------------------------------
// placeOrder
// ---------------------------------------------------------------------------
describe('placeOrder', () => {
  beforeEach(() => {
    delete (window as any).KiteConnect;
  });

  afterEach(() => {
    delete (window as any).KiteConnect;
  });

  it('throws KITE_KEY_NOT_CONFIGURED when no key is saved', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ code: 'KITE_KEY_NOT_CONFIGURED' }),
    });

    const order: KiteOrder = {
      exchange: 'NSE',
      tradingsymbol: 'RELIANCE',
      transaction_type: 'BUY',
      quantity: 1,
      order_type: 'MARKET',
    };

    await expect(placeOrder(order)).rejects.toMatchObject({
      code: 'KITE_KEY_NOT_CONFIGURED',
    });
  });

  it('throws when /api/kite/publish returns non-ok', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Decryption failed' }),
    });

    const order: KiteOrder = {
      exchange: 'NSE',
      tradingsymbol: 'RELIANCE',
      transaction_type: 'BUY',
      quantity: 1,
      order_type: 'MARKET',
    };

    await expect(placeOrder(order)).rejects.toThrow('Decryption failed');
  });
});

// ---------------------------------------------------------------------------
// KiteOrder interface — structural test
// ---------------------------------------------------------------------------
describe('KiteOrder type', () => {
  it('accepts a valid order shape', () => {
    const order: KiteOrder = {
      exchange: 'NSE',
      tradingsymbol: 'RELIANCE',
      transaction_type: 'BUY',
      quantity: 10,
      order_type: 'LIMIT',
      product: 'CNC',
      price: 2500,
      trigger_price: 2450,
      variety: 'regular',
    };
    expect(order.transaction_type).toBe('BUY');
    expect(order.product).toBe('CNC');
  });
});
