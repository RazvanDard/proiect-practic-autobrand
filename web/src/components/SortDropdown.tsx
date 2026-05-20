import type { ProductSortKey, SortDirection } from "./ProductsTable";

/**
 * Sort dropdown — surfaces the same sort capability as the clickable column
 * headers for users who don't realise the headers are interactive.
 *
 * The dropdown uses a single composite value (e.g. ``"price:desc"``) so the
 * sort key and direction stay in lock-step.
 */
export interface SortDropdownProps {
  sortKey: ProductSortKey;
  sortDirection: SortDirection;
  onChange: (key: ProductSortKey, direction: SortDirection) => void;
}

interface SortOption {
  key: ProductSortKey;
  direction: SortDirection;
  label: string;
}

const OPTIONS: SortOption[] = [
  { key: "name", direction: "asc", label: "Name (A → Z)" },
  { key: "name", direction: "desc", label: "Name (Z → A)" },
  { key: "price", direction: "asc", label: "Price (low → high)" },
  { key: "price", direction: "desc", label: "Price (high → low)" },
  { key: "lastScrapedAt", direction: "desc", label: "Recently scraped" },
  { key: "lastScrapedAt", direction: "asc", label: "Oldest first" },
];

function encode(key: ProductSortKey, direction: SortDirection): string {
  return `${key}:${direction}`;
}

export function SortDropdown({ sortKey, sortDirection, onChange }: SortDropdownProps) {
  return (
    <label className="sort-dropdown">
      <span className="sort-dropdown-label">Sort</span>
      <select
        value={encode(sortKey, sortDirection)}
        onChange={(e) => {
          const [key, direction] = e.target.value.split(":") as [
            ProductSortKey,
            SortDirection,
          ];
          onChange(key, direction);
        }}
      >
        {OPTIONS.map((opt) => (
          <option key={encode(opt.key, opt.direction)} value={encode(opt.key, opt.direction)}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
