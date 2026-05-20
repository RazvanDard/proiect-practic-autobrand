import { useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import { ExchangeRateBadge } from "./ExchangeRateBadge";
import { SignOutButton } from "./SignOutButton";

interface TopBarProps {
  title: string;
  hint?: string;
}

/**
 * Persistent header rendered above every view inside the authenticated shell.
 *
 * Shows the active page title, the live BNR rate pill, the latest scrape
 * status, the signed-in user's email, and a sign-out button.
 */
export function TopBar({ title, hint }: TopBarProps) {
  const me = useQuery(api.users.me);
  const recentRuns = useQuery(api.scrapeRuns.recent, { limit: 1 });
  const lastRun = recentRuns?.[0];

  return (
    <div className="topbar">
      <div className="topbar-title">
        <h1>{title}</h1>
        {hint && <span className="hint">{hint}</span>}
      </div>
      <div className="topbar-meta">
        <ExchangeRateBadge />
        {lastRun && (
          <span
            className={`badge ${
              lastRun.status === "ok"
                ? "ok"
                : lastRun.status === "error"
                  ? "err"
                  : ""
            }`}
            title={lastRun.errorMessage ?? undefined}
          >
            <span className="dot" />
            {lastRun.status === "ok"
              ? `Last scrape · ${lastRun.productsFound ?? 0} items`
              : lastRun.status === "error"
                ? "Last scrape failed"
                : "Scraping…"}
          </span>
        )}
        {me?.email && <span className="muted">{me.email}</span>}
        <SignOutButton />
      </div>
    </div>
  );
}
