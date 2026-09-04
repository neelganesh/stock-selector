import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TradeJournalEditor } from '../TradeJournalEditor';

describe('TradeJournalEditor', () => {
  const onSave = vi.fn();

  beforeEach(() => {
    onSave.mockReset();
    onSave.mockResolvedValue(undefined);
  });

  it('renders existing notes and tags in read mode', () => {
    render(
      <TradeJournalEditor
        executionId="exec_1"
        initialNotes="Waited for breakout."
        initialTags={['breakout', 'momentum']}
        onSave={onSave}
      />
    );
    const noteEl = screen.getByText('Waited for breakout.');
    expect(noteEl).toBeTruthy();
    expect(screen.getByText('breakout')).toBeTruthy();
    expect(screen.getByText('momentum')).toBeTruthy();
  });

  it('renders empty state when no notes or tags', () => {
    render(
      <TradeJournalEditor
        executionId="exec_1"
        initialNotes=""
        initialTags={[]}
        onSave={onSave}
      />
    );
    expect(screen.getByText(/no notes yet/i)).toBeTruthy();
    expect(screen.getByText(/no tags yet/i)).toBeTruthy();
  });

  it('enters edit mode when Edit button clicked', () => {
    render(
      <TradeJournalEditor
        executionId="exec_1"
        initialNotes="Initial"
        initialTags={['momentum']}
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const textarea = screen.getByRole('textbox', { name: /notes/i }) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Initial');
    expect(screen.getByRole('button', { name: /save/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy();
  });

  it('lets user add a new tag and save', async () => {
    render(
      <TradeJournalEditor
        executionId="exec_1"
        initialNotes="Good setup"
        initialTags={['momentum']}
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const tagInput = screen.getByPlaceholderText(/add tag/i) as HTMLInputElement;
    fireEvent.change(tagInput, { target: { value: 'breakout' } });
    fireEvent.keyDown(tagInput, { key: 'Enter', code: 'Enter' });
    expect(screen.getByText('breakout')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        notes: 'Good setup',
        tags: ['momentum', 'breakout'],
      });
    });
  });

  it('lets user remove a tag in edit mode', async () => {
    render(
      <TradeJournalEditor
        executionId="exec_1"
        initialNotes=""
        initialTags={['momentum', 'breakout']}
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const removeButtons = screen.getAllByRole('button', { name: /×/ });
    fireEvent.click(removeButtons[1]);
    expect(screen.queryByText('breakout')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({ notes: '', tags: ['momentum'] });
    });
  });

  it('cancels and reverts changes', async () => {
    render(
      <TradeJournalEditor
        executionId="exec_1"
        initialNotes="Original"
        initialTags={['momentum']}
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const textarea = screen.getByRole('textbox', { name: /notes/i }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.getByText('Original')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('disables Save button when no changes are made', () => {
    render(
      <TradeJournalEditor
        executionId="exec_1"
        initialNotes="Same"
        initialTags={['momentum']}
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const saveBtn = screen.getByRole('button', { name: /save/i }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('shows saving state while onSave is pending', async () => {
    let resolveSave: () => void = () => {};
    onSave.mockImplementation(() => new Promise<void>((res) => { resolveSave = res; }));
    render(
      <TradeJournalEditor
        executionId="exec_1"
        initialNotes=""
        initialTags={['momentum']}
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    // Make a change so Save is enabled
    const textarea = screen.getByRole('textbox', { name: /notes/i }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'New note' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    const saving = await screen.findByText(/saving/i);
    expect(saving).toBeTruthy();
    resolveSave();
    await waitFor(() => {
      expect(screen.queryByText(/saving/i)).toBeNull();
    });
  });

  it('shows error message when save fails', async () => {
    onSave.mockRejectedValue(new Error('Network down'));
    render(
      <TradeJournalEditor
        executionId="exec_1"
        initialNotes=""
        initialTags={['momentum']}
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const textarea = screen.getByRole('textbox', { name: /notes/i }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'New note' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText(/network down/i)).toBeTruthy();
  });

  it('trims whitespace from new tags and ignores empties', async () => {
    render(
      <TradeJournalEditor
        executionId="exec_1"
        initialNotes=""
        initialTags={[]}
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const tagInput = screen.getByPlaceholderText(/add tag/i) as HTMLInputElement;
    fireEvent.change(tagInput, { target: { value: '  breakout  ' } });
    fireEvent.keyDown(tagInput, { key: 'Enter', code: 'Enter' });
    fireEvent.change(tagInput, { target: { value: '   ' } });
    fireEvent.keyDown(tagInput, { key: 'Enter', code: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({ notes: '', tags: ['breakout'] });
    });
  });

  it('normalizes tags to lowercase and dedupes on save', async () => {
    render(
      <TradeJournalEditor
        executionId="exec_1"
        initialNotes="Old"
        initialTags={['momentum']}
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const tagInput = screen.getByPlaceholderText(/add tag/i) as HTMLInputElement;
    fireEvent.change(tagInput, { target: { value: 'BREAKOUT' } });
    fireEvent.keyDown(tagInput, { key: 'Enter', code: 'Enter' });
    fireEvent.change(tagInput, { target: { value: 'Momentum' } });
    fireEvent.keyDown(tagInput, { key: 'Enter', code: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({ notes: 'Old', tags: ['momentum', 'breakout'] });
    });
  });
});
