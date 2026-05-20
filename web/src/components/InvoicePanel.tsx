import { ChangeEvent, DragEvent, useCallback, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";

import { api } from "../../convex/_generated/api";
import { humanizeError } from "../lib/errors";
import { downloadTextFile, formatMoney } from "../lib/format";

/**
 * Extracted invoice line as returned by the Convex `parseInvoice` action.
 * Mirrored locally so we don't have to import the Convex generated types.
 */
interface InvoiceLine {
  product_code: string;
  product_name: string;
  unit_price: number;
  currency: string;
  quantity: number;
}

interface ParseResult {
  fileName: string;
  parsedAt: number;
  lineItems: InvoiceLine[];
  csv: string;
}

/**
 * Invoice extraction panel.
 *
 * - Left column: drag/drop or click-to-pick dropzone.
 * - Right column: live preview of extracted line items + download CSV button.
 *
 * Workflow:
 *   1. `generateUploadUrl` mutation → presigned upload endpoint.
 *   2. `fetch(url, { method: "POST", body: file })` → returns `{ storageId }`.
 *   3. `parseInvoice({ storageId })` → `{ lineItems, csv }`.
 *
 * The component keeps the last successful parse in state so the user can
 * re-download the CSV any time without re-uploading.
 */
export function InvoicePanel() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const generateUploadUrl = useMutation(api.invoiceItems.generateUploadUrl);
  const parseInvoice = useAction(api.scrape.parseInvoice);

  const [result, setResult] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      try {
        const uploadUrl = await generateUploadUrl({});
        const uploadResp = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/pdf" },
          body: file,
        });
        if (!uploadResp.ok) {
          throw new Error(`Upload failed (${uploadResp.status})`);
        }
        const { storageId } = (await uploadResp.json()) as { storageId: string };
        const parsed = await parseInvoice({ storageId: storageId as any });

        setResult({
          fileName: file.name,
          parsedAt: Date.now(),
          lineItems: parsed.lineItems,
          csv: parsed.csv,
        });
      } catch (err) {
        setError(humanizeError(err, "Couldn't parse this PDF."));
      } finally {
        setBusy(false);
      }
    },
    [generateUploadUrl, parseInvoice],
  );

  function chooseFile() {
    inputRef.current?.click();
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void processFile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void processFile(file);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!dragActive) setDragActive(true);
  }

  function handleDragLeave() {
    setDragActive(false);
  }

  function downloadCsv() {
    if (!result) return;
    downloadTextFile(
      result.csv,
      result.fileName.replace(/\.pdf$/i, "") + "_lines.csv",
    );
  }

  const totalsByCurrency = (result?.lineItems ?? []).reduce<Record<string, number>>(
    (acc, line) => {
      const key = line.currency || "—";
      acc[key] = (acc[key] ?? 0) + line.unit_price * line.quantity;
      return acc;
    },
    {},
  );

  return (
    <div className="card invoice-panel">
      <div
        className={`dropzone${dragActive ? " active" : ""}`}
        onClick={chooseFile}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          style={{ display: "none" }}
          onChange={handleChange}
        />
        <div className="icon" aria-hidden>
          {/* simple upload glyph */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4" />
            <path d="M6 10l6-6 6 6" />
            <path d="M4 20h16" />
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 600 }}>
            {busy ? "Parsing…" : "Drop PDF invoice"}
          </div>
          <div className="muted" style={{ marginTop: 2 }}>
            or click to choose a file
          </div>
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      <div className="invoice-result">
        {!result ? (
          <div className="empty">
            <div style={{ fontWeight: 600, color: "var(--text)" }}>
              No invoice parsed yet
            </div>
            <div>
              Extracts code, name, unit price, currency, and quantity from a RO
              eFactura PDF. Drop a file on the left to begin.
            </div>
          </div>
        ) : (
          <>
            <div className="head">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {result.fileName}
                </div>
                <div className="kv-list" style={{ marginTop: 4 }}>
                  <span>
                    <strong>{result.lineItems.length}</strong> line item
                    {result.lineItems.length === 1 ? "" : "s"}
                  </span>
                  {Object.entries(totalsByCurrency).map(([cur, total]) => (
                    <span key={cur}>
                      Total <strong className="mono">{formatMoney(total, cur)}</strong>
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ghost small" onClick={() => setResult(null)}>
                  Clear
                </button>
                <button className="primary small" onClick={downloadCsv}>
                  Download CSV
                </button>
              </div>
            </div>

            <div className="invoice-table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Description</th>
                    <th className="right">Qty</th>
                    <th className="right">Unit price</th>
                  </tr>
                </thead>
                <tbody>
                  {result.lineItems.map((line, idx) => (
                    <tr key={idx}>
                      <td className="mono">{line.product_code}</td>
                      <td>{line.product_name}</td>
                      <td className="right mono">{line.quantity}</td>
                      <td className="right mono">
                        {formatMoney(line.unit_price, line.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
