import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { GTTMonitor } from '../GTTMonitor';

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

const sampleGTTs = [
  {
    id: 1001,
    user_id: 'user-1',
    tradingsymbol: 'RELIANCE',
    exchange: 'NSE',
    trigger_values: [2400, 2700],
    last_price: 2500,
    status: 'active',
    expires_at: '2025-12-31T06:30:00.000Z',
    created_at: '2025-01-15T10:00:00.000Z',
    updated_at: '2025-01-15T10:00:00.000Z',
    orders: [
      { transaction_type: 'SELL', quantity: 50, product: 'CNC', order_type: 'LIMIT', price: 2700 },
    ],
  },
  {
    id: 1002,
    user_id: 'user-1',
    tradingsymbol: 'TCS',
    exchange: 'NSE',
    trigger_values: [3200],
    last_price: 3300,
    status: 'triggered',
    expires_at: '2025-06-30T06:30:00.000Z',
    created_at: '2025-01-10T08:00:00.000Z',
    updated_at: '2025-01-12T14:00:00.000Z',
    orders: [
      { transaction_type: 'SELL', quantity: 25, product: 'CNC', order_type: 'LIMIT', price: 3200 },
    ],
  },
  {
    id: 1003,
    user_id: 'user-1',
    tradingsymbol: 'INFY',
    exchange: 'NSE',
    trigger_values: [1500, 1700],
    last_price: 1600,
    status: 'expired',
    expires_at: '2024-12-31T06:30:00.000Z',
    created_at: '2024-12-01T09:00:00.000Z',
    updated_at: '2024-12-31T06:30:00.000Z',
    orders: [
      { transaction_type: 'SELL', quantity: 40, product: 'CNC', order_type: 'LIMIT', price: 1700 },
    ],
  },
];

describe('GTTMonitor', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // never resolves
    render(<GTTMonitor />);
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it('fetches GTTs from /api/kite/gtt on mount', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => sampleGTTs,
    });

    render(<GTTMonitor />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/kite/gtt', expect.objectContaining({ method: 'GET' }));
    });
  });

  it('displays active GTTs with trigger prices, expiry, and status', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => sampleGTTs,
    });

    render(<GTTMonitor />);

    await waitFor(() => {
      expect(screen.getByText('RELIANCE')).toBeDefined();
    });

    expect(screen.getByText('RELIANCE')).toBeDefined();
    expect(screen.getByText('TCS')).toBeDefined();
    // Expiry date rendered in a "Expires:" line
    expect(screen.getAllByText(/Dec 2025|2025/).length).toBeGreaterThan(0);
    // Status badge
    expect(screen.getAllByText(/active/i).length).toBeGreaterThan(0);
  });

  it('hides expired/cancelled GTTs by default (active filter)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => sampleGTTs,
    });

    render(<GTTMonitor defaultFilter="active" />);

    await waitFor(() => {
      expect(screen.getByText('RELIANCE')).toBeDefined();
    });

    // Active and triggered should show
    expect(screen.getByText('RELIANCE')).toBeDefined();
    expect(screen.getByText('TCS')).toBeDefined();
    // Expired should be hidden
    expect(screen.queryByText('INFY')).toBeNull();
  });

  it('shows all GTTs when "all" filter is selected', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => sampleGTTs,
    });

    render(<GTTMonitor defaultFilter="all" />);

    await waitFor(() => {
      expect(screen.getByText('INFY')).toBeDefined();
    });

    expect(screen.getByText('RELIANCE')).toBeDefined();
    expect(screen.getByText('TCS')).toBeDefined();
    expect(screen.getByText('INFY')).toBeDefined();
  });

  it('renders empty state when no GTTs', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    render(<GTTMonitor />);

    await waitFor(() => {
      expect(screen.getByText(/no.*gtt/i)).toBeDefined();
    });
  });

  it('renders error state on fetch failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    render(<GTTMonitor />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeDefined();
    });
  });

  it('shows login prompt when not authenticated (401)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    render(<GTTMonitor />);

    await waitFor(() => {
      expect(screen.getByText(/log.?in/i)).toBeDefined();
    });
  });

  it('Cancel button calls DELETE /api/kite/gtt with id', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => sampleGTTs,
    });

    // Auto-confirm dialogs
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<GTTMonitor />);

    await waitFor(() => {
      expect(screen.getByText('RELIANCE')).toBeDefined();
    });

    const relianceRow = screen.getByText('RELIANCE').closest('[data-gtt-row]');
    const cancelBtn = within(relianceRow as HTMLElement).getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/kite/gtt?id=1001',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    confirmSpy.mockRestore();
  });

  it('Modify button opens edit mode and saves via PUT /api/kite/gtt', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => sampleGTTs,
    });

    render(<GTTMonitor />);

    await waitFor(() => {
      expect(screen.getByText('RELIANCE')).toBeDefined();
    });

    const relianceRow = screen.getByText('RELIANCE').closest('[data-gtt-row]');
    const modifyBtn = within(relianceRow as HTMLElement).getByRole('button', { name: /modify/i });
    fireEvent.click(modifyBtn);

    // Edit UI visible
    const triggerInput = within(relianceRow as HTMLElement).getByLabelText(/trigger/i) as HTMLInputElement;
    fireEvent.change(triggerInput, { target: { value: '2450' } });

    // Mock the PUT call response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 1001, trigger_values: [2450] }),
    });

    const saveBtn = within(relianceRow as HTMLElement).getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/kite/gtt',
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  it('refreshes on demand via refresh button', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sampleGTTs,
    });

    render(<GTTMonitor />);

    await waitFor(() => {
      expect(screen.getByText('RELIANCE')).toBeDefined();
    });

    const callsAfterLoad = fetchMock.mock.calls.length;
    const refreshBtn = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterLoad);
    });
  });

  it('polls every 30 seconds by default', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sampleGTTs,
    });

    render(<GTTMonitor pollIntervalMs={30000} />);

    // Wait for initial fetch (microtasks)
    await new Promise((resolve) => setTimeout(resolve, 0));
    const initialCalls = fetchMock.mock.calls.length;

    // Advance 30s
    vi.advanceTimersByTime(30000);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock.mock.calls.length).toBeGreaterThan(initialCalls);

    vi.useRealTimers();
  });
});
