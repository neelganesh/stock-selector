import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  reconcileExecutions,
  applyStatusTransitions,
  type ExecutionForReconciliation,
  type KiteOrderForReconciliation,
} from '../reconciliation';

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

const makeExec = (overrides: Partial<ExecutionForReconciliation> = {}): ExecutionForReconciliation => ({
  id: 'exec-1',
  symbol: 'RELIANCE',
  status: 'entry_filled',
  entry_filled_price: 2500,
  stop_loss: 2400,
  target1: 2700,
  target2: 2800,
  quantity: 10,
  entry_filled_at: '2025-01-01T10:00:00.000Z',
  ...overrides,
});

const makeOrder = (overrides: Partial<KiteOrderForReconciliation> = {}): KiteOrderForReconciliation => ({
  order_id: 'o1',
  transaction_type: 'BUY',
  status: 'COMPLETE',
  tradingsymbol: 'RELIANCE',
  average_price: 2510,
  filled_quantity: 10,
  exchange_timestamp: '2025-01-01T10:01:00.000Z',
  ...overrides,
});

describe('reconcileExecutions', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
  });

  it('returns no discrepancies when executions and orders match', () => {
    const execs = [makeExec({ status: 'entry_filled' })];
    const orders = [makeOrder({ transaction_type: 'SELL', status: 'OPEN', average_price: undefined })];
    const result = reconcileExecutions(execs, orders);
    expect(result.discrepancies).toHaveLength(0);
    expect(result.transitions).toHaveLength(0);
  });

  it('detects missing_in_kite discrepancy when local execution has entry_order_id but Kite has no matching order', () => {
    const execs = [makeExec({ entry_order_id: 'o-missing', status: 'entry_placed' })];
    const orders: KiteOrderForReconciliation[] = [];
    const result = reconcileExecutions(execs, orders);
    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0].type).toBe('missing_in_kite');
    expect(result.discrepancies[0].symbol).toBe('RELIANCE');
  });

  it('flags status_mismatch when Kite shows BUY COMPLETE but local is still entry_placed', () => {
    const execs = [makeExec({ status: 'entry_placed', entry_order_id: 'o1' })];
    const orders = [makeOrder({ status: 'COMPLETE' })];
    const result = reconcileExecutions(execs, orders);
    const mismatches = result.discrepancies.filter((d) => d.type === 'status_mismatch');
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].severity).toBe('warning');
  });

  it('returns a pending transition for entry_placed → entry_filled on BUY COMPLETE', () => {
    const execs = [makeExec({ status: 'entry_placed', entry_order_id: 'o1' })];
    const orders = [makeOrder({ status: 'COMPLETE' })];
    const result = reconcileExecutions(execs, orders);
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].fromStatus).toBe('entry_placed');
    expect(result.transitions[0].toStatus).toBe('entry_filled');
    expect(result.transitions[0].executionId).toBe('exec-1');
  });

  it('returns a pending transition for entry_filled → target1_hit on SELL COMPLETE at target', () => {
    const execs = [makeExec({ status: 'entry_filled' })];
    const orders = [makeOrder({ transaction_type: 'SELL', status: 'COMPLETE', average_price: 2700 })];
    const result = reconcileExecutions(execs, orders);
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].toStatus).toBe('target1_hit');
  });

  it('returns a pending transition for entry_filled → stop_loss_hit on SELL COMPLETE at stop', () => {
    const execs = [makeExec({ status: 'entry_filled' })];
    const orders = [makeOrder({ transaction_type: 'SELL', status: 'COMPLETE', average_price: 2400 })];
    const result = reconcileExecutions(execs, orders);
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].toStatus).toBe('stop_loss_hit');
  });

  it('ignores orders for symbols not in executions', () => {
    const execs = [makeExec({ symbol: 'RELIANCE' })];
    const orders = [makeOrder({ tradingsymbol: 'TCS' })];
    const result = reconcileExecutions(execs, orders);
    expect(result.transitions).toHaveLength(0);
    expect(result.discrepancies).toHaveLength(0);
  });

  it('skips terminal statuses (no transitions for already-exited trades)', () => {
    const execs = [makeExec({ status: 'manually_exited' })];
    const orders = [makeOrder({ transaction_type: 'SELL', status: 'COMPLETE', average_price: 2700 })];
    const result = reconcileExecutions(execs, orders);
    expect(result.transitions).toHaveLength(0);
    expect(result.discrepancies).toHaveLength(0);
  });
});

describe('applyStatusTransitions', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'exec-1', status: 'entry_filled' }),
    });
  });

  it('PATCHes each transition to /api/executions/[id]', async () => {
    const transitions = [
      {
        executionId: 'exec-1',
        fromStatus: 'entry_placed',
        toStatus: 'entry_filled',
        patch: { status: 'entry_filled', entry_filled_price: 2510 },
        realizedPnl: undefined,
      },
    ];

    const results = await applyStatusTransitions(transitions);
    expect(results).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/executions/exec-1',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'entry_filled', entry_filled_price: 2510 }),
      })
    );
  });

  it('returns failures when PATCH returns non-ok', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    });

    const transitions = [
      {
        executionId: 'exec-1',
        fromStatus: 'entry_placed',
        toStatus: 'entry_filled',
        patch: { status: 'entry_filled' },
        realizedPnl: undefined,
      },
    ];

    const results = await applyStatusTransitions(transitions);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toBeTruthy();
  });

  it('handles empty transitions array gracefully', async () => {
    const results = await applyStatusTransitions([]);
    expect(results).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
