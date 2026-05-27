import { FormEvent, useEffect, useState } from "react";
import { useMutation } from "convex/react";

import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { humanizeError } from "../lib/errors";

/**
 * Modal dialog for editing a single product row.
 *
 * Props
 * -----
 * @param product  Product to edit; presence of this prop opens the dialog.
 * @param onClose  Called when the user cancels or after a successful save.
 *
 * The dialog keeps a local copy of the form state and only writes back via
 * `api.products.update` on submit, so the user can abandon edits freely.
 */
export interface EditProductDialogProps {
  product: Doc<"products"> | null;
  onClose: () => void;
}

export function EditProductDialog({ product, onClose }: EditProductDialogProps) {
  const update = useMutation(api.products.update);
  const [form, setForm] = useState({
    name: "",
    price: 0,
    currency: "USD",
    description: "",
    imageUrl: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        price: product.price,
        currency: product.currency,
        description: product.description,
        imageUrl: product.imageUrl,
      });
      setError(null);
    }
  }, [product]);

  if (!product) return null;

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await update({
        id: product!._id as Id<"products">,
        name: form.name.trim(),
        price: Number(form.price),
        priceRon: Number(form.price * 5),
        currency: form.currency.trim().toUpperCase(),
        description: form.description.trim(),
        imageUrl: form.imageUrl.trim(),
      });
      onClose();
    } catch (err) {
      setError(humanizeError(err, "Couldn't save the changes."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit product</h2>
        <form onSubmit={handleSave}>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="field" style={{ flex: 2 }}>
              <label htmlFor="price">Price</label>
              <input
                id="price"
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, price: Number(e.target.value) }))
                }
                required
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="currency">Currency</label>
              <input
                id="currency"
                type="text"
                value={form.currency}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currency: e.target.value }))
                }
                maxLength={3}
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="imageUrl">Image URL</label>
            <input
              id="imageUrl"
              type="text"
              value={form.imageUrl}
              onChange={(e) =>
                setForm((f) => ({ ...f, imageUrl: e.target.value }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              rows={4}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          {error && <div className="error">{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
