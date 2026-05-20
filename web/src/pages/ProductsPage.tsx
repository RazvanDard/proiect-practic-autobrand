import { useEffect, useState } from "react";
import { useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { EditProductDialog } from "../components/EditProductDialog";
import { FilterBar } from "../components/FilterBar";
import {
  FiltersDropdown,
  type ProductFilters,
} from "../components/FiltersDropdown";
import { Pagination } from "../components/Pagination";
import {
  ProductsTable,
  type ProductSortKey,
  type SortDirection,
} from "../components/ProductsTable";
import { ScrapeNowButton } from "../components/ScrapeNowButton";
import { SortDropdown } from "../components/SortDropdown";

const EMPTY_FILTERS: ProductFilters = {
  minPriceRon: undefined,
  maxPriceRon: undefined,
  currency: undefined,
};
const PAGE_SIZE = 25;

/**
 * Products view.
 *
 * Pagination is server-side via Convex `.paginate({ numItems, cursor })`. A
 * cursor stack remembers one cursor per visited page, so Prev/Next can
 * navigate without re-issuing previous queries — the cursor at index `N` is
 * the one that, when passed to the query, returns page `N`.
 *
 * The stack is reset to `[null]` (start) whenever search, sort, or filters
 * change. A separate `api.products.count` query supplies the total row count
 * for the "Showing X–Y of Z" label.
 */
export function ProductsPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ProductFilters>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<ProductSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIdx, setPageIdx] = useState(0);
  const [editing, setEditing] = useState<Doc<"products"> | null>(null);

  // Reset to the first page whenever the result set changes shape.
  useEffect(() => {
    setCursorStack([null]);
    setPageIdx(0);
  }, [search, sortKey, sortDirection, filters]);

  const cursor = cursorStack[pageIdx] ?? null;

  const pageResult = useQuery(api.products.list, {
    search: search || undefined,
    sortKey,
    sortDirection,
    minPriceRon: filters.minPriceRon,
    maxPriceRon: filters.maxPriceRon,
    currency: filters.currency,
    paginationOpts: { numItems: PAGE_SIZE, cursor },
  });

  const total = useQuery(api.products.count, {
    search: search || undefined,
    sortKey,
    sortDirection,
    minPriceRon: filters.minPriceRon,
    maxPriceRon: filters.maxPriceRon,
    currency: filters.currency,
  });

  function toggleSort(next: ProductSortKey) {
    if (next === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(next);
      setSortDirection("asc");
    }
  }

  function changePage(next: number) {
    if (!pageResult) return;
    if (next < 0) return;

    if (next === pageIdx + 1) {
      if (pageResult.isDone) return;
      setCursorStack((stack) => {
        const trimmed = stack.slice(0, pageIdx + 1);
        return [...trimmed, pageResult.continueCursor];
      });
      setPageIdx(next);
      return;
    }
    if (next < pageIdx) {
      setPageIdx(next);
    }
  }

  const rows = pageResult?.page ?? [];

  return (
    <>
      <div className="filters-bar">
        <div className="filters-row">
          <div className="grow">
            <FilterBar value={search} onChange={setSearch} />
          </div>
          <SortDropdown
            sortKey={sortKey}
            sortDirection={sortDirection}
            onChange={(key, direction) => {
              setSortKey(key);
              setSortDirection(direction);
            }}
          />
          <FiltersDropdown value={filters} onChange={setFilters} />
          <div style={{ marginLeft: "auto" }}>
            <ScrapeNowButton />
          </div>
        </div>
      </div>

      <ProductsTable
        products={rows}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={toggleSort}
        onEdit={setEditing}
      />

      <Pagination
        page={pageIdx}
        pageSize={PAGE_SIZE}
        total={total ?? 0}
        isLastPage={pageResult?.isDone ?? true}
        onChange={changePage}
      />

      <EditProductDialog product={editing} onClose={() => setEditing(null)} />
    </>
  );
}
