import { InvoicePanel } from "../components/InvoicePanel";

/**
 * Invoice extractor view.
 *
 * Delegates the entire UI to {@link InvoicePanel}. Kept as a separate page so
 * future additions (parse history, batch list, etc.) have a place to live.
 */
export function InvoicePage() {
  return <InvoicePanel />;
}
