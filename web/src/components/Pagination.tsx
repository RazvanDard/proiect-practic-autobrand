/**
 * Prev / Next pager wired into Convex cursor pagination.
 *
 * The parent owns the cursor stack and total count (cheaper to keep them
 * close to the query call); this component is pure UI.
 */
export interface PaginationProps {
  /** Zero-based current page index. */
  page: number;
  /** Page size used by the parent for the Convex `numItems` argument. */
  pageSize: number;
  /** Total rows after filters, returned by `api.products.count`. */
  total: number;
  /** Whether Convex reports the current page as the last one. */
  isLastPage: boolean;
  /** Called with `page + 1` for next, `page - 1` for prev. */
  onChange: (nextPage: number) => void;
}

export function Pagination({
  page,
  pageSize,
  total,
  isLastPage,
  onChange,
}: PaginationProps) {
  if (total === 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const canPrev = page > 0;
  const canNext = !isLastPage && page < totalPages - 1;

  return (
    <div className="pagination">
      <span className="muted">
        Showing <strong style={{ color: "var(--text)" }}>{from}–{to}</strong> of{" "}
        <strong style={{ color: "var(--text)" }}>{total}</strong>
      </span>
      <div className="pagination-controls">
        <button
          className="small"
          onClick={() => onChange(page - 1)}
          disabled={!canPrev}
          aria-label="Previous page"
        >
          ← Prev
        </button>
        <span className="muted mono">
          {page + 1} / {totalPages}
        </span>
        <button
          className="small"
          onClick={() => onChange(page + 1)}
          disabled={!canNext}
          aria-label="Next page"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
