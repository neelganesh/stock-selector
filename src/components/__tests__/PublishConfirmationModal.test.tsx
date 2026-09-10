import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PublishConfirmationModal } from '../PublishConfirmationModal';

describe('PublishConfirmationModal', () => {
  it('renders when open', () => {
    render(<PublishConfirmationModal isOpen={true} strategyName="Test" stockCount={5} onConfirm={vi.fn()} onCancel={vi.fn()} isPublishing={false} />);
    expect(screen.getByText(/Publish to Kite/i)).toBeTruthy();
    expect(screen.getByText(/Test/i)).toBeTruthy();
  });
  it('calls onConfirm when confirmed', async () => {
    const onConfirm = vi.fn();
    render(<PublishConfirmationModal isOpen={true} strategyName="S" stockCount={3} onConfirm={onConfirm} onCancel={vi.fn()} isPublishing={false} />);
    screen.getByRole('button', { name: /Confirm Publish/i }).click();
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });
  it('calls onCancel when canceled', () => {
    const onCancel = vi.fn();
    render(<PublishConfirmationModal isOpen={true} strategyName="S" stockCount={1} onConfirm={vi.fn()} onCancel={onCancel} isPublishing={false} />);
    screen.getByRole('button', { name: /Cancel/i }).click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
  it('shows loading when isPublishing', () => {
    render(<PublishConfirmationModal isOpen={true} strategyName="S" stockCount={1} onConfirm={vi.fn()} onCancel={vi.fn()} isPublishing={true} />);
    expect(screen.getByText(/Publishing/i)).toBeTruthy();
  });
  it('renders nothing when closed', () => {
    const { container } = render(<PublishConfirmationModal isOpen={false} strategyName="S" stockCount={1} onConfirm={vi.fn()} onCancel={vi.fn()} isPublishing={false} />);
    expect(container.firstChild).toBeNull();
  });
});
