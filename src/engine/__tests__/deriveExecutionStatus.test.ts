import { describe, it, expect } from 'vitest';
import {
  deriveExecutionStatus,
  type ExecutionForDerivation,
  type KiteOrderForDerivation,
} from '../deriveExecutionStatus';

const baseExecution: ExecutionForDerivation = {
  id: 'exec-1',
  symbol: 'RELIANCE',
  status: 'entry_filled',
  entry_filled_price: 2500,
  stop_loss: 2400,
  target1: 2700,
  target2: 2800,
  quantity: 10,
  entry_filled_at: '2025-01-01T10:00:00.000Z',
};

describe('deriveExecutionStatus', () => {
  it('returns current status when no orders provided', () => {
    const result = deriveExecutionStatus(baseExecution, []);
    expect(result.nextStatus).toBe('entry_filled');
    expect(result.transitioned).toBe(false);
  });

  it('keeps entry_placed when no entry fill is observed', () => {
    const exec: ExecutionForDerivation = { ...baseExecution, status: 'entry_placed' };
    const orders: KiteOrderForDerivation[] = [
      { order_id: 'o1', transaction_type: 'BUY', status: 'OPEN', tradingsymbol: 'RELIANCE' },
    ];
    const result = deriveExecutionStatus(exec, orders);
    expect(result.nextStatus).toBe('entry_placed');
    expect(result.transitioned).toBe(false);
  });

  it('transitions entry_placed → entry_filled when BUY order is COMPLETE', () => {
    const exec: ExecutionForDerivation = { ...baseExecution, status: 'entry_placed' };
    const orders: KiteOrderForDerivation[] = [
      {
        order_id: 'o1',
        transaction_type: 'BUY',
        status: 'COMPLETE',
        tradingsymbol: 'RELIANCE',
        average_price: 2510,
        filled_quantity: 10,
        exchange_timestamp: '2025-01-01T10:00:30.000Z',
      },
    ];
    const result = deriveExecutionStatus(exec, orders);
    expect(result.nextStatus).toBe('entry_filled');
    expect(result.transitioned).toBe(true);
    expect(result.entryPrice).toBe(2510);
    expect(result.filledQuantity).toBe(10);
  });

  it('transitions entry_filled → target1_hit when SELL at target1 fills COMPLETE', () => {
    const orders: KiteOrderForDerivation[] = [
      {
        order_id: 'o2',
        transaction_type: 'SELL',
        status: 'COMPLETE',
        tradingsymbol: 'RELIANCE',
        average_price: 2700,
        filled_quantity: 10,
        exchange_timestamp: '2025-01-02T10:00:00.000Z',
      },
    ];
    const result = deriveExecutionStatus(baseExecution, orders);
    expect(result.nextStatus).toBe('target1_hit');
    expect(result.transitioned).toBe(true);
    expect(result.exitPrice).toBe(2700);
  });

  it('transitions entry_filled → target2_hit when SELL at target2 fills COMPLETE', () => {
    const orders: KiteOrderForDerivation[] = [
      {
        order_id: 'o3',
        transaction_type: 'SELL',
        status: 'COMPLETE',
        tradingsymbol: 'RELIANCE',
        average_price: 2800,
        filled_quantity: 10,
        exchange_timestamp: '2025-01-02T11:00:00.000Z',
      },
    ];
    const result = deriveExecutionStatus(baseExecution, orders);
    expect(result.nextStatus).toBe('target2_hit');
    expect(result.transitioned).toBe(true);
    expect(result.exitPrice).toBe(2800);
  });

  it('transitions entry_filled → stop_loss_hit when SELL at stop_loss fills COMPLETE', () => {
    const orders: KiteOrderForDerivation[] = [
      {
        order_id: 'o4',
        transaction_type: 'SELL',
        status: 'COMPLETE',
        tradingsymbol: 'RELIANCE',
        average_price: 2400,
        filled_quantity: 10,
        exchange_timestamp: '2025-01-01T11:00:00.000Z',
      },
    ];
    const result = deriveExecutionStatus(baseExecution, orders);
    expect(result.nextStatus).toBe('stop_loss_hit');
    expect(result.transitioned).toBe(true);
    expect(result.exitPrice).toBe(2400);
  });

  it('does not transition when SELL order is OPEN (not yet filled)', () => {
    const orders: KiteOrderForDerivation[] = [
      { order_id: 'o5', transaction_type: 'SELL', status: 'OPEN', tradingsymbol: 'RELIANCE' },
    ];
    const result = deriveExecutionStatus(baseExecution, orders);
    expect(result.nextStatus).toBe('entry_filled');
    expect(result.transitioned).toBe(false);
  });

  it('ignores orders for a different symbol', () => {
    const orders: KiteOrderForDerivation[] = [
      {
        order_id: 'o6',
        transaction_type: 'SELL',
        status: 'COMPLETE',
        tradingsymbol: 'TCS',
        average_price: 2400,
        filled_quantity: 10,
      },
    ];
    const result = deriveExecutionStatus(baseExecution, orders);
    expect(result.nextStatus).toBe('entry_filled');
    expect(result.transitioned).toBe(false);
  });

  it('does not regress from a terminal status (manually_exited)', () => {
    const exec: ExecutionForDerivation = { ...baseExecution, status: 'manually_exited' };
    const orders: KiteOrderForDerivation[] = [
      {
        order_id: 'o7',
        transaction_type: 'SELL',
        status: 'COMPLETE',
        tradingsymbol: 'RELIANCE',
        average_price: 2700,
        filled_quantity: 10,
      },
    ];
    const result = deriveExecutionStatus(exec, orders);
    expect(result.nextStatus).toBe('manually_exited');
    expect(result.transitioned).toBe(false);
  });

  it('prefers target2 over target1 when both SELL orders are present', () => {
    const orders: KiteOrderForDerivation[] = [
      {
        order_id: 'o8a',
        transaction_type: 'SELL',
        status: 'COMPLETE',
        tradingsymbol: 'RELIANCE',
        average_price: 2700,
        filled_quantity: 5,
        exchange_timestamp: '2025-01-02T10:00:00.000Z',
      },
      {
        order_id: 'o8b',
        transaction_type: 'SELL',
        status: 'COMPLETE',
        tradingsymbol: 'RELIANCE',
        average_price: 2800,
        filled_quantity: 5,
        exchange_timestamp: '2025-01-02T11:00:00.000Z',
      },
    ];
    const result = deriveExecutionStatus(baseExecution, orders);
    expect(result.nextStatus).toBe('target2_hit');
    expect(result.transitioned).toBe(true);
  });

  it('computes realized_pnl on transition', () => {
    const orders: KiteOrderForDerivation[] = [
      {
        order_id: 'o9',
        transaction_type: 'SELL',
        status: 'COMPLETE',
        tradingsymbol: 'RELIANCE',
        average_price: 2800,
        filled_quantity: 10,
        exchange_timestamp: '2025-01-02T10:00:00.000Z',
      },
    ];
    const result = deriveExecutionStatus(baseExecution, orders);
    // (2800 - 2500) * 10 = 3000
    expect(result.realizedPnl).toBe(3000);
  });

  it('returns negative PnL on stop loss', () => {
    const orders: KiteOrderForDerivation[] = [
      {
        order_id: 'o10',
        transaction_type: 'SELL',
        status: 'COMPLETE',
        tradingsymbol: 'RELIANCE',
        average_price: 2400,
        filled_quantity: 10,
        exchange_timestamp: '2025-01-01T11:00:00.000Z',
      },
    ];
    const result = deriveExecutionStatus(baseExecution, orders);
    // (2400 - 2500) * 10 = -1000
    expect(result.realizedPnl).toBe(-1000);
  });
});
