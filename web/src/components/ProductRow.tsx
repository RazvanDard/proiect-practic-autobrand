import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { humanizeError } from "../lib/errors";
import { formatDateTime, formatMoney } from "../lib/format";

/**
 * Single `<tr>` for a product. Edit handler is hoisted to the parent so this
 * component only owns rendering + the delete mutation.
 */
export interface ProductRowProps {
  product: Doc<"products">;
  onEdit: (product: Doc<"products">) => void;
}

export function ProductRow({ product, onEdit }: ProductRowProps) {
  const remove = useMutation(api.products.remove);

  async function handleDelete() {
    if (!confirm(`Delete “${product.name}”?`)) return;
    try {
      await remove({ id: product._id as Id<"products"> });
    } catch (err) {
      alert(humanizeError(err, "Couldn't delete this product."));
    }
  }

  return (
    <tr>
      <td>
        {product.imageUrl ? (
          <img className="product-thumb" src={product.imageUrl} alt="" />
        ) : (
          <div className="product-thumb" />
        )}
      </td>
      <td>
        <div style={{ fontWeight: 600 }}>{product.name}</div>
        <div className="muted" style={{ maxWidth: 460, marginTop: 2 }}>
          {product.description}
        </div>
      </td>
      <td className="right mono">
        <div>{formatMoney(product.price, product.currency)}</div>
        {product.priceRon !== undefined && (
          <div className="muted">{formatMoney(product.priceRon, "RON")}</div>
        )}
      </td>
      <td className="muted">{formatDateTime(product.lastScrapedAt)}</td>
      <td>
        <div className="row-actions">
          <button className="small" onClick={() => onEdit(product)}>
            Edit
          </button>
          <button className="small danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
