/**
 * Kite Publisher Mode Integration
 *
 * Publisher mode only requires an API key - no OAuth, no secret, no tokens needed.
 * Uses the Kite Publisher JS plugin for order placement via popup.
 *
 * Security model:
 * - The encrypted API key is stored in the database (server-side AES-256-GCM).
 * - When placing an order, the client fetches a short-lived "publish ticket"
 *   from /api/kite/publish — the server decrypts the key and returns it in
 *   the ticket. The ticket expires in 60s and is discarded after use.
 * - No key is ever written to localStorage or the browser.
 *
 * Docs: https://kite.trade/docs/connect/v3/publisher/
 */

export interface PublishTicket {
  apiKey: string;
  nonce: string;
  expiresAt: number; // unix ms
  ttlSeconds: number;
}

export interface KiteOrder {
  exchange: string;
  tradingsymbol: string;
  transaction_type: 'BUY' | 'SELL';
  quantity: number;
  order_type: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  product?: 'CNC' | 'MIS' | 'NRML';
  price?: number;
  trigger_price?: number;
  variety?: 'regular' | 'co' | 'amo';
  readonly?: boolean;
}

// Publisher.js script URL
const PUBLISHER_SCRIPT_URL = 'https://kite.trade/publisher.js?v=3';

let scriptLoaded = false;
let scriptLoadPromise: Promise<void> | null = null;

/** @internal — only for use in unit tests */
export function __resetScriptState() {
  scriptLoaded = false;
  scriptLoadPromise = null;
}

/* ------------------------------------------------------------------ */
/* Script loader                                                         */
/* ------------------------------------------------------------------ */

/**
 * Load the Kite Publisher script dynamically.
 * Safe to call multiple times — returns the same promise after first load.
 */
export function loadPublisherScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${PUBLISHER_SCRIPT_URL}"]`)) {
      scriptLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = PUBLISHER_SCRIPT_URL;
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error('Failed to load Kite Publisher script'));
    };
    document.body.appendChild(script);
  });

  return scriptLoadPromise;
}

/** True once the script has loaded and KiteConnect is available. */
export function isPublisherReady(): boolean {
  return scriptLoaded && typeof (window as unknown as Record<string, unknown>)['KiteConnect'] !== 'undefined';
}

/* ------------------------------------------------------------------ */
/* Publish ticket (server-side decryption)                               */
/* ------------------------------------------------------------------ */

/**
 * Fetch a short-lived publish ticket from the server.
 * The server decrypts the stored API key and returns it in the ticket.
 *
 * Throws if:
 * - Not authenticated (401)
 * - No API key configured (404, code: KITE_KEY_NOT_CONFIGURED)
 * - Server decryption failed (500)
 */
export async function fetchPublishTicket(): Promise<PublishTicket> {
  const token = await getAccessToken();
  const res = await fetch('/api/kite/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.status === 404) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(
      (body as { error?: string }).error || 'Kite API key not configured',
    );
    (err as Error & { code?: string }).code =
      (body as { code?: string }).code ?? 'KITE_KEY_NOT_CONFIGURED';
    throw err;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Failed to fetch publish ticket' }));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<PublishTicket>;
}

async function getAccessToken(): Promise<string | null> {
  // Lazy import to avoid bundling issues
  const { supabase } = await import('../lib/supabase.js');
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

/* ------------------------------------------------------------------ */
/* KiteConnect instance                                                  */
/* ------------------------------------------------------------------ */

/**
 * Initialize a KiteConnect instance with the API key from a publish ticket.
 * The key is only held in memory for the duration of this call.
 */
export async function initKitePublisher(ticket: PublishTicket): Promise<unknown> {
  if (!ticket.apiKey) {
    throw new Error('Publish ticket is missing API key');
  }

  // Check ticket expiry
  if (Date.now() > ticket.expiresAt) {
    throw new Error(
      'Publish ticket has expired. Please try placing the order again.',
    );
  }

  await loadPublisherScript();

  const KiteConnect = (window as unknown as Record<string, unknown>)['KiteConnect'];
  if (typeof KiteConnect !== 'function') {
    throw new Error('KiteConnect not available after script load');
  }

  // @ts-expect-error — KiteConnect constructor takes a string API key
  return new KiteConnect(ticket.apiKey);
}

/* ------------------------------------------------------------------ */
/* Place order                                                           */
/* ------------------------------------------------------------------ */

/**
 * Fetch a publish ticket and place an order via the Kite Publisher popup.
 *
 * Flow:
 * 1. Fetch publish ticket from /api/kite/publish (server decrypts key)
 * 2. Load kite.trade/publisher.js if not already loaded
 * 3. Initialize KiteConnect with the key from the ticket
 * 4. Add the order, render the button, auto-click to open the popup
 * 5. Resolve when the user closes the popup
 *
 * The key is never written to localStorage or the browser.
 */
export async function placeOrder(order: KiteOrder): Promise<void> {
  let ticket: PublishTicket;
  try {
    ticket = await fetchPublishTicket();
  } catch (err) {
    // Re-throw with context so callers can handle KITE_KEY_NOT_CONFIGURED
    throw err;
  }

  await loadPublisherScript();

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Kite Publisher timed out after 15 seconds'));
    }, 15_000);

    const processOrder = () => {
      clearTimeout(timeout);

      try {
        const KiteConnect = (window as unknown as Record<string, unknown>)['KiteConnect'];
        // @ts-expect-error — KiteConnect constructor
        const kite = new KiteConnect(ticket.apiKey);

        kite.add({
          exchange: order.exchange,
          tradingsymbol: order.tradingsymbol,
          transaction_type: order.transaction_type,
          quantity: order.quantity,
          order_type: order.order_type,
          product: order.product || 'MIS',
          ...(order.price && { price: order.price }),
          ...(order.trigger_price && { trigger_price: order.trigger_price }),
          ...(order.variety && { variety: order.variety }),
          ...(order.readonly !== undefined && { readonly: order.readonly }),
        });

        kite.finished((status: string) => {
          console.log('[kitePublisher] order finished:', status);
          resolve();
        });

        // Render in a hidden container and auto-click to open the popup
        const container = document.createElement('div');
        container.style.display = 'none';
        document.body.appendChild(container);

        try {
          kite.renderButton(container);
          const button = container.querySelector('button, a') as
            | HTMLButtonElement
            | HTMLAnchorElement
            | null;
          if (button) {
            button.click();
          }
        } finally {
          // Clean up after a short delay — the popup handles its own lifecycle
          setTimeout(() => {
            if (document.body.contains(container)) {
              document.body.removeChild(container);
            }
          }, 500);
        }
      } catch (err) {
        reject(err);
      }
    };

    const KiteConnect = (window as unknown as Record<string, unknown>)['KiteConnect'];
    if (typeof KiteConnect !== 'undefined') {
      processOrder();
    } else {
      const checkInterval = setInterval(() => {
        const KC = (window as unknown as Record<string, unknown>)['KiteConnect'];
        if (typeof KC !== 'undefined') {
          clearInterval(checkInterval);
          processOrder();
        }
      }, 100);
    }
  });
}

// Type augmentation for window
declare global {
  interface Window {
    KiteConnect: new (apiKey: string) => {
      add(order: KiteOrder): void;
      finished(callback: (status: string) => void): void;
      renderButton(container: HTMLElement): void;
    };
  }
}
