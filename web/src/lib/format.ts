/**
 * Tiny formatting helpers shared across components. Centralised so date and
 * currency display stays consistent.
 */

/**
 * Format a numeric amount with a currency suffix.
 *
 * @param value     Amount in the original currency.
 * @param currency  ISO 4217 code (USD/EUR/RON…).
 * @returns         e.g. `"24.99 USD"` or `"—"` when the value is missing.
 */
export function formatMoney(value: number | undefined | null, currency: string): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(2)} ${currency}`;
}

/**
 * Format a Unix-ms timestamp as `dd.mm.yyyy hh:mm` in local time.
 */
export function formatDateTime(ms: number | undefined): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/**
 * Trigger a download of the given text payload as a file in the browser.
 *
 * Implemented by creating an in-memory Blob URL and clicking a synthetic
 * anchor — the standard pattern for client-side file downloads.
 */
export function downloadTextFile(content: string, filename: string, mime = "text/csv"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
