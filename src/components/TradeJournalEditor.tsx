import { useState, useRef } from 'react';

export interface TradeJournalSavePayload {
  notes: string;
  tags: string[];
}

export interface TradeJournalEditorProps {
  executionId: string;
  initialNotes: string;
  initialTags: string[];
  onSave: (payload: TradeJournalSavePayload) => Promise<void> | void;
}

const normalizeTag = (raw: string): string => raw.trim().toLowerCase();

const normalizeTagList = (tags: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const n = normalizeTag(t);
    if (!n) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
};

export function TradeJournalEditor({
  executionId,
  initialNotes,
  initialTags,
  onSave,
}: TradeJournalEditorProps) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagDraft, setTagDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tagInputRef = useRef<HTMLInputElement | null>(null);

  // Normalize initial tags once so dirty comparison is always normalized vs normalized
  const normalizedInitialTags = normalizeTagList(initialTags);
  const normalizedInitialNotes = initialNotes;

  const dirty =
    notes !== normalizedInitialNotes ||
    JSON.stringify(normalizeTagList(tags)) !== JSON.stringify(normalizedInitialTags);

  const handleEdit = () => {
    setNotes(normalizedInitialNotes);
    setTags([...normalizedInitialTags]);
    setTagDraft('');
    setError(null);
    setEditing(true);
  };

  const handleCancel = () => {
    setNotes(normalizedInitialNotes);
    setTags([...normalizedInitialTags]);
    setTagDraft('');
    setError(null);
    setEditing(false);
  };

  const addTag = (raw: string) => {
    const normalized = normalizeTag(raw);
    if (!normalized) return;
    setTags((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (tagDraft.trim()) {
        addTag(tagDraft);
        setTagDraft('');
      }
    } else if (e.key === 'Backspace' && !tagDraft && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const cleanedTags = normalizeTagList(tags);
      await onSave({ notes, tags: cleanedTags });
      setTags(cleanedTags);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save journal');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div
        data-testid={`journal-read-${executionId}`}
        className="rounded-xl border border-slate-200/60 bg-slate-50/30 p-3 space-y-2"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Trade Journal
          </span>
          <button
            type="button"
            onClick={handleEdit}
            className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800"
          >
            Edit
          </button>
        </div>

        {initialNotes ? (
          <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{initialNotes}</p>
        ) : (
          <p className="text-xs text-slate-400 italic">No notes yet.</p>
        )}

        {initialTags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {initialTags.map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No tags yet.</p>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid={`journal-edit-${executionId}`}
      className="rounded-xl border border-indigo-200 bg-white p-3 space-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
          Editing Journal
        </span>
        <span className="text-[10px] text-slate-400">
          {dirty ? 'Unsaved changes' : 'No changes'}
        </span>
      </div>

      <label className="block">
        <span className="sr-only">Notes</span>
        <textarea
          aria-label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="What did you learn? What was the setup?"
          className="w-full text-xs rounded-lg border border-slate-200 p-2 focus:border-indigo-400 focus:outline-none"
        />
      </label>

      <div className="flex flex-wrap gap-1 items-center">
        {tags.map((tag) => (
          <span
            key={tag}
            className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1"
          >
            {tag}
            <button
              type="button"
              aria-label={`× ${tag}`}
              onClick={() => removeTag(tag)}
              className="text-indigo-500 hover:text-rose-600"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={tagInputRef}
          type="text"
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={handleTagKeyDown}
          placeholder="Add tag, press Enter"
          className="flex-1 min-w-[120px] text-[10px] rounded-full border border-slate-200 px-2 py-0.5 focus:border-indigo-400 focus:outline-none"
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-rose-700 font-bold">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
