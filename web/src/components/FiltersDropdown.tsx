import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";

/**
 * Shape of the filter state. Mirrors the optional Convex `api.products.list`
 * arguments. `undefined` means "no bound".
 */
export interface ProductFilters {
  minPriceRon: number | undefined;
  maxPriceRon: number | undefined;
  currency: string | undefined;
}

export interface FiltersDropdownProps {
  value: ProductFilters;
  onChange: (next: ProductFilters) => void;
}

/**
 * Count how many filters are actively constraining results — drives the badge
 * on the trigger button.
 */
function activeCount(f: ProductFilters): number {
  return (
    (f.minPriceRon !== undefined ? 1 : 0) +
    (f.maxPriceRon !== undefined ? 1 : 0) +
    (f.currency ? 1 : 0)
  );
}

function parseNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Single-button filter trigger that opens a labeled popover with all
 * product-list filters: RON price range and source currency.
 *
 * State is hoisted — the parent owns `value` and consumes `onChange`. Changes
 * apply live; there is no separate "Apply" step. A "Reset" link clears every
 * filter at once.
 *
 * The popover dismisses on outside-click and on Escape.
 */
export function FiltersDropdown({ value, onChange }: FiltersDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currencies = useQuery(api.products.currencies);
  const count = activeCount(value);

  useEffect(() => {
    if (!open) return;
    function handleDocClick(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  function reset() {
    onChange({ minPriceRon: undefined, maxPriceRon: undefined, currency: undefined });
  }

  return (
    <div className="filters-dropdown" ref={containerRef}>
      <button
        type="button"
        className={count > 0 ? "primary" : ""}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 5h18l-7 9v6l-4-2v-4z" />
        </svg>
        Filters
        {count > 0 && <span className="filters-count">{count}</span>}
      </button>

      {open && (
        <div className="filters-popover" role="dialog" aria-label="Product filters">
          <div className="filters-popover-head">
            <div>
              <div style={{ fontWeight: 600 }}>Filter products</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Applied live · {count} active
              </div>
            </div>
            <button className="ghost small" onClick={reset} disabled={count === 0}>
              Reset
            </button>
          </div>

          <div className="filters-popover-body">
            <div className="field">
              <label htmlFor="min-ron">Minimum price (RON, converted)</label>
              <input
                id="min-ron"
                type="number"
                step="0.01"
                placeholder="e.g. 10"
                value={value.minPriceRon ?? ""}
                onChange={(e) =>
                  onChange({ ...value, minPriceRon: parseNumber(e.target.value) })
                }
              />
              <span className="muted" style={{ fontSize: 11.5 }}>
                Compared against the live BNR conversion stored on each row.
              </span>
            </div>

            <div className="field">
              <label htmlFor="max-ron">Maximum price (RON, converted)</label>
              <input
                id="max-ron"
                type="number"
                step="0.01"
                placeholder="e.g. 100"
                value={value.maxPriceRon ?? ""}
                onChange={(e) =>
                  onChange({ ...value, maxPriceRon: parseNumber(e.target.value) })
                }
              />
            </div>

            <div className="field">
              <label htmlFor="currency">Source currency</label>
              <select
                id="currency"
                value={value.currency ?? ""}
                onChange={(e) =>
                  onChange({ ...value, currency: e.target.value || undefined })
                }
              >
                <option value="">All currencies</option>
                {(currencies ?? []).map((cur) => (
                  <option key={cur} value={cur}>
                    {cur}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="filters-popover-foot">
            <button className="primary small" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
