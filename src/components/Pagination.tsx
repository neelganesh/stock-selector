import { useMemo } from 'react';

interface PaginationProps {
  currentPage: number; // 1-based
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Show "Page X of Y" beside the buttons. Defaults to true. */
  showLabel?: boolean;
  /** Optional className for the outer container. */
  className?: string;
}

/**
 * Compact, Apple-style pagination.
 * - 1 2 3 … N with current page highlighted
 * - Prev / Next with arrow icons; disabled at edges
 * - Ellipsis only when there are many pages; never collapses to one button
 * - Keyboard accessible; buttons are real <button>s
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showLabel = true,
  className = '',
}: PaginationProps) {
  const items = useMemo(() => buildPageItems(currentPage, totalPages), [currentPage, totalPages]);

  if (totalPages <= 1) return null;

  const go = (p: number) => {
    if (p < 1 || p > totalPages || p === currentPage) return;
    onPageChange(p);
  };

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={`flex flex-wrap items-center justify-between gap-3 ${className}`}
    >
      {showLabel && (
        <span className="text-xs font-medium text-[color:var(--text-tertiary)] tabular-nums">
          Page <span className="text-[color:var(--text-secondary)] font-bold">{currentPage}</span> of{' '}
          <span className="text-[color:var(--text-secondary)] font-bold">{totalPages}</span>
        </span>
      )}

      <div className="flex items-center gap-1.5">
        <PagerButton
          onClick={() => go(currentPage - 1)}
          disabled={currentPage === 1}
          ariaLabel="Previous page"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="hidden sm:inline">Prev</span>
        </PagerButton>

        <div className="flex items-center gap-1">
          {items.map((item, idx) =>
            item === '…' ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1.5 text-xs text-[color:var(--text-tertiary)] select-none"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <PagerButton
                key={item}
                onClick={() => go(item)}
                active={item === currentPage}
                ariaLabel={`Go to page ${item}`}
                ariaCurrent={item === currentPage ? 'page' : undefined}
              >
                {item}
              </PagerButton>
            )
          )}
        </div>

        <PagerButton
          onClick={() => go(currentPage + 1)}
          disabled={currentPage === totalPages}
          ariaLabel="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </PagerButton>
      </div>
    </nav>
  );
}

function PagerButton({
  children,
  onClick,
  disabled = false,
  active = false,
  ariaLabel,
  ariaCurrent,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  ariaLabel: string;
  ariaCurrent?: 'page' | undefined;
}) {
  const base =
    'inline-flex items-center justify-center gap-1 min-w-[34px] h-8 px-2.5 rounded-lg text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-blue)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--ground)]';
  const tone = active
    ? 'bg-[color:var(--elevated-3)] text-[color:var(--text-primary)] shadow-sm'
    : disabled
      ? 'text-[color:var(--text-quaternary)] cursor-not-allowed'
      : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--elevated-2)] hover:text-[color:var(--text-primary)]';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      className={`${base} ${tone}`}
    >
      {children}
    </button>
  );
}

/**
 * Build a windowed page list.
 * Always: 1 … (current-1) current (current+1) … last
 * Small totals: render every page.
 */
function buildPageItems(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result: (number | '…')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push('…');
    result.push(p);
    prev = p;
  }
  return result;
}
