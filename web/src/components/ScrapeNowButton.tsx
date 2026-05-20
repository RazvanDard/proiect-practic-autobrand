import { useState } from "react";
import { useAction } from "convex/react";

import { api } from "../../convex/_generated/api";
import { humanizeError } from "../lib/errors";

/**
 * Manual trigger for the same Convex action the hourly cron uses.
 *
 * Returns the insert/update counters so the operator gets immediate feedback;
 * the button is disabled while the request is in flight.
 */
export function ScrapeNowButton() {
  const runScrape = useAction(api.scrape.runScrape);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { inserted, updated } = await runScrape({});
      setResult(`+${inserted} new · ${updated} updated`);
    } catch (err) {
      setError(humanizeError(err, "Scrape failed. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <button className="primary" onClick={handleClick} disabled={busy}>
        {busy ? "Scraping…" : "Scrape now"}
      </button>
      {result && <span className="muted mono">{result}</span>}
      {error && <span className="error">{error}</span>}
    </div>
  );
}
