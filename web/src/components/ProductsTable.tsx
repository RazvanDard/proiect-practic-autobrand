import type { Doc } from "../../convex/_generated/dataModel";
import { ProductRow } from "./ProductRow";

/**
 * Column the products table can be sorted by. Mirrors the union in
 * `convex/products.ts` — keep them in sync.
 */
export type ProductSortKey = "name" | "price" | "lastScrapedAt";
export type SortDirection = "asc" | "desc";

export interface ProductsTableProps {
  products: Doc<"products">[];
  sortKey: ProductSortKey;
  sortDirection: SortDirection;
  onSortChange: (key: ProductSortKey) => void;
  onEdit: (product: Doc<"products">) => void;
}

/**
 * Renders the catalog table with sortable headers. Sorting is performed by
 * Convex via indexes; this component only owns the visual sort marker and the
 * click → key mapping.
 */
export function ProductsTable({
  products,
  sortKey,
  sortDirection,
  onSortChange,
  onEdit,
}: ProductsTableProps) {
  const marker = (key: ProductSortKey) =>
    key === sortKey ? (
      <span className="sort-marker">{sortDirection === "asc" ? "▲" : "▼"}</span>
    ) : null;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 76 }}>Image</th>
            <th className="sortable" onClick={() => onSortChange("name")}>
              Product {marker("name")}
            </th>
            <th
              className="sortable right"
              onClick={() => onSortChange("price")}
              style={{ textAlign: "right" }}
            >
              Price {marker("price")}
            </th>
            <th className="sortable" onClick={() => onSortChange("lastScrapedAt")}>
              Last scraped {marker("lastScrapedAt")}
            </th>
            <th style={{ width: 160 }}></th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <tr>
              <td colSpan={5}>
                <div className="empty-state">
                  <h3>Nothing scraped yet</h3>
                  <p>Press <b>Scrape now</b> to fetch products from web-scraping.dev.</p>
                </div>
              </td>
            </tr>
          ) : (
            products.map((p) => (
              <ProductRow key={p._id} product={p} onEdit={onEdit} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
