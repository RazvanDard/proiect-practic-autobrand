import { useAction, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { humanizeError } from "../lib/errors";

/**
 * Pill showing the latest USD/EUR → RON rates published by BNR.
 *
 * Behaviour:
 *   - On mount, if no rate is recorded for today, automatically calls
 *     {@link api.exchange.refreshFx}. The `autoFetched` ref ensures we only
 *     trigger one auto-fetch per page load even with React Strict Mode
 *     double-invokes.
 *   - Click to force a manual refresh at any time.
 *
 * The reactive {@link api.exchange.latest} query keeps the displayed values
 * fresh without further plumbing.
 */
export function ExchangeRateBadge() {
  const latest = useQuery(api.exchange.latest);
  const refresh = useAction(api.exchange.refreshFx);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoFetched = useRef(false);

  useEffect(() => {
    if (autoFetched.current) return;
    if (latest === undefined) return; // still loading — wait for first read

    const today = new Date().toISOString().slice(0, 10);
    const haveTodaysUsd = latest.usd?.publishedOn === today;
    const haveTodaysEur = latest.eur?.publishedOn === today;
    if (haveTodaysUsd && haveTodaysEur) return;

    autoFetched.current = true;
    setBusy(true);
    refresh({})
      .catch(() => {
        // Silent on auto-fetch — UI still shows the last good value.
      })
      .finally(() => setBusy(false));
  }, [latest, refresh]);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await refresh({});
    } catch (err) {
      setError(humanizeError(err, "Couldn't refresh BNR rates."));
    } finally {
      setBusy(false);
    }
  }

  const usd = latest?.usd;
  const eur = latest?.eur;

  return (
    <span
      className={`badge clickable${error ? " err" : ""}`}
      onClick={handleClick}
      title={error ?? "Refresh BNR rates"}
    >
      <span style={{ fontWeight: 600, color: "var(--text)" }}>BNR</span>
      <span className="mono">
        USD {usd ? usd.rate.toFixed(4) : "—"} · EUR {eur ? eur.rate.toFixed(4) : "—"}
      </span>
      {busy && <span className="muted">…</span>}
    </span>
  );
}
