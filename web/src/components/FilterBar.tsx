/**
 * Search input wired into `api.products.list`. Stateless — parent owns the
 * value.
 */
export interface FilterBarProps {
  value: string;
  onChange: (next: string) => void;
}

export function FilterBar({ value, onChange }: FilterBarProps) {
  return (
    <input
      type="search"
      placeholder="Search by name or description…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
