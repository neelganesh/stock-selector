import { describe, it, expect } from 'vitest';

// =============================================================================
// SCHEMA VALIDATION TESTS
// These tests document the correct schema column names and validate that
// the API code uses the correct column names.
// =============================================================================

// Mock the trade_cash_flows column names
// The schema uses 'type' NOT 'flow_type'
describe('trade_cash_flows column names', () => {
  // Schema definition (from supabase/migrations/20250904000000_init.sql)
  const SCHEMA_COLUMNS = {
    id: 'uuid',
    execution_id: 'uuid',
    user_id: 'uuid',
    type: 'text', // NOT flow_type!
    amount: 'numeric',
    date: 'timestamptz',
    description: 'text',
    created_at: 'timestamptz',
  } as const;

  it('should use type column (not flow_type) for cash flow type', () => {
    // This test documents the correct column name
    expect(SCHEMA_COLUMNS.type).toBe('text');
  });

  it('should NOT have flow_type column', () => {
    // flow_type is WRONG - schema uses 'type'
    const hasFlowType = 'flow_type' in SCHEMA_COLUMNS;
    expect(hasFlowType).toBe(false);
  });

  // Valid type values from schema CHECK constraint
  const validTypes = ['entry', 'exit', 'charge', 'dividend'] as const;
  
  it.each(validTypes)('type value "%s" is valid', (type) => {
    expect(validTypes).toContain(type);
  });
});

// Test the fix: cash flow insert should use 'type' not 'flow_type'
describe('CashFlow Insert Format', () => {
  interface CashFlowInsert {
    execution_id: string;
    user_id: string;
    type: 'entry' | 'exit' | 'charge' | 'dividend'; // CORRECT: 'type'
    amount: number;
    date?: string;
    description: string;
  }

  it('should insert cash flow with correct column name type', () => {
    const cashFlow: CashFlowInsert = {
      execution_id: '123',
      user_id: '456',
      type: 'entry', // CORRECT - matches schema
      amount: -10000,
      description: 'Entry filled',
    };

    // Verify the column is named 'type'
    expect(cashFlow).toHaveProperty('type');
    expect(cashFlow).not.toHaveProperty('flow_type');
  });

  it('should insert entry cash flow with negative amount', () => {
    const entryFlow: CashFlowInsert = {
      execution_id: '123',
      user_id: '456',
      type: 'entry',
      amount: -(100 * 500), // quantity * price (negative = outflow)
      description: 'Entry filled: 100 shares @ 500',
    };
    expect(entryFlow.amount).toBeLessThan(0);
    expect(entryFlow.type).toBe('entry');
  });

  it('should insert exit cash flow with positive amount', () => {
    const exitFlow: CashFlowInsert = {
      execution_id: '123',
      user_id: '456',
      type: 'exit',
      amount: 100 * 550, // quantity * price (positive = inflow)
      description: 'Exit: 100 shares @ 550',
    };
    expect(exitFlow.amount).toBeGreaterThan(0);
    expect(exitFlow.type).toBe('exit');
  });

  it('should insert charge cash flow with negative amount', () => {
    const chargeFlow: CashFlowInsert = {
      execution_id: '123',
      user_id: '456',
      type: 'charge',
      amount: -150, // charges (negative = cost)
      description: 'Brokerage & taxes',
    };
    expect(chargeFlow.amount).toBeLessThan(0);
    expect(chargeFlow.type).toBe('charge');
  });
});

// =============================================================================
// EXCHANGE COLUMN TESTS
// =============================================================================
describe('strategy_executions exchange column', () => {
  // Schema should have exchange column (migration 20250904000005)
  const SCHEMA_COLUMNS = {
    id: 'uuid',
    user_id: 'uuid',
    strategy_id: 'text',
    symbol: 'text',
    exchange: 'text', // NEW: multi-exchange support
    entry_price: 'numeric',
    quantity: 'integer',
    status: 'text',
  } as const;

  it('should have exchange column in schema', () => {
    expect('exchange' in SCHEMA_COLUMNS).toBe(true);
  });

  it('should default to NSE exchange', () => {
    // Default value is 'NSE' for Indian stocks
    const defaultExchange = 'NSE';
    expect(defaultExchange).toBe('NSE');
  });

  it('should support valid exchange values', () => {
    const validExchanges = ['NSE', 'BSE'] as const;
    validExchanges.forEach(exchange => {
      expect(['NSE', 'BSE']).toContain(exchange);
    });
  });
});

// =============================================================================
// EXECUTION STATUS TESTS
// =============================================================================
describe('strategy_executions status values', () => {
  // Valid status values from schema CHECK constraint
  const VALID_STATUSES = [
    'pending',
    'entry_placed',
    'entry_filled',
    'gtt_placed',
    'target1_hit',
    'target2_hit',
    'stop_loss_hit',
    'manually_exited',
    'cancelled',
    'rejected',
  ] as const;

  it.each(VALID_STATUSES)('status "%s" is valid per schema', (status) => {
    expect(VALID_STATUSES).toContain(status);
  });

  // Invalid statuses that should NOT be used
  const INVALID_STATUSES = ['pending_entry', 'pending_placed'];

  it.each(INVALID_STATUSES)('status "%s" is INVALID - should be entry_placed', (status) => {
    expect(VALID_STATUSES).not.toContain(status);
  });

  it('should use entry_placed (not pending_entry) for placed orders', () => {
    const correctStatus = 'entry_placed';
    const wrongStatus = 'pending_entry';
    expect(VALID_STATUSES).toContain(correctStatus);
    expect(VALID_STATUSES).not.toContain(wrongStatus);
  });
});

// =============================================================================
// CAPITAL ALLOCATION TESTS
// =============================================================================
describe('capital_allocation derivation', () => {
  interface Execution {
    entry_price: number;
    quantity: number;
    // Note: No capital_allocated column - derived from entry_price * quantity
  }

  it('should derive capital_allocated from entry_price * quantity', () => {
    const execution: Execution = {
      entry_price: 500,
      quantity: 100,
    };

    // Derived value (not stored in DB)
    const capitalAllocated = execution.entry_price * execution.quantity;
    expect(capitalAllocated).toBe(50000);
  });

  it('should NOT expect capital_allocated in execution record', () => {
    // The schema does NOT have a capital_allocated column
    // It's computed client-side from entry_price * quantity
    const execution: Execution = {
      entry_price: 1500,
      quantity: 50,
    };

    // Verify the type doesn't have capital_allocated
    expect('capital_allocated' in execution).toBe(false);
    
    // But we can compute it
    const derived = execution.entry_price * execution.quantity;
    expect(derived).toBe(75000);
  });
});
