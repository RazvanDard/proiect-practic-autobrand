/**
 * Convert any thrown value (Error, Convex server error, fetch failure, …)
 * into a short, human-readable string suitable for inline UI display.
 *
 * Why this exists
 * ---------------
 * Convex serialises action/mutation failures as long strings prefixed with
 * ``Uncaught Error:`` and suffixed with ``Called by client`` plus a stack
 * trace. The raw text is useful in the network panel but unkind to users.
 *
 * The helper performs three passes:
 *   1. **Pattern matching** for known failure shapes — the most specific
 *      messages live here and are rewritten to plain language.
 *   2. **Stripping** of Convex framing (``Uncaught Error:``,
 *      ``at handler (…)``, ``Called by client``, trailing whitespace).
 *   3. **Fallback** to a short generic message when nothing fits.
 *
 * Add new branches to the pattern list rather than baking translations into
 * call sites — every component should call ``humanizeError(err)`` and trust
 * the result.
 */

const STRIP_PATTERNS: RegExp[] = [
  /^Uncaught\s+Error:\s*/i,
  /\s*Called by client\s*$/i,
  /\s*at\s+handler\s*\([^)]*\)\s*/g,
  /\s*at\s+executeScrape\s*\([^)]*\)\s*/g,
  /\s*\[Request ID:[^\]]+\]\s*/g,
  /\s*\[CONVEX [^\]]+\]\s*/g,
];

interface Pattern {
  /** Substring or RegExp that identifies the error. */
  test: RegExp | string;
  /** Either a fixed string or a function deriving the message from the match. */
  message: string | ((raw: string) => string);
}

const PATTERNS: Pattern[] = [
  {
    test: /no invoice lines recognised/i,
    message:
      "We couldn't find any invoice lines in this PDF. Make sure it's a Romanian eFactura layout — other invoice templates may not be supported.",
  },
  {
    test: /expected a PDF upload/i,
    message: "Please upload a PDF file.",
  },
  {
    test: /scraper responded 401/i,
    message:
      "The scraper rejected our request. Check that SCRAPER_SHARED_SECRET matches on both sides.",
  },
  {
    test: /scraper responded 5\d\d/i,
    message:
      "The scraper service is having trouble fulfilling this request. Try again in a moment, or check the scraper logs.",
  },
  {
    test: /SCRAPER_BASE_URL and SCRAPER_SHARED_SECRET must be set/i,
    message:
      "The backend is missing the scraper configuration. Set SCRAPER_BASE_URL and SCRAPER_SHARED_SECRET in your Convex env.",
  },
  {
    test: /scraper env vars are missing/i,
    message:
      "The backend is missing the scraper configuration. Set SCRAPER_BASE_URL and SCRAPER_SHARED_SECRET in your Convex env.",
  },
  {
    test: /Failed to fetch|NetworkError|ECONN|ENOTFOUND|fetch failed/i,
    message:
      "Couldn't reach the server. Check your internet connection and try again.",
  },
  {
    test: /BNR responded/i,
    message:
      "BNR is currently unavailable. The displayed rates may be stale; try refreshing in a moment.",
  },
  {
    test: /Not signed in/i,
    message: "Your session has expired. Please sign in again.",
  },
  {
    test: /already exists/i,
    message: (raw) => raw, // already friendly — keep as-is
  },
  {
    test: /Product not found/i,
    message: "This product no longer exists — it may have been deleted in another tab.",
  },
  {
    test: /InvalidAccountId|Invalid password|wrong password/i,
    message: "Incorrect email or password.",
  },
  {
    test: /minimum.*8.*characters|password.*at least/i,
    message: "Password must be at least 8 characters.",
  },
  {
    test: /User already exists|account.*exists/i,
    message: "An account with this email already exists. Try signing in instead.",
  },
  {
    test: /Upload failed/i,
    message: "Couldn't upload the file. Please try again.",
  },
];

/**
 * Apply {@link STRIP_PATTERNS} to remove Convex/runtime framing.
 */
function stripFraming(raw: string): string {
  let out = raw;
  for (const pattern of STRIP_PATTERNS) out = out.replace(pattern, "");
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Public entry point — see file-level doc.
 *
 * @param err Anything that can be thrown. ``null`` / ``undefined`` is treated
 *            as an unknown failure.
 * @param fallback Used when no pattern matches and the stripped message is
 *                 empty. Defaults to a generic prompt.
 */
export function humanizeError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err === null || err === undefined) return fallback;
  const raw = err instanceof Error ? err.message : String(err);
  for (const pattern of PATTERNS) {
    const matches =
      typeof pattern.test === "string"
        ? raw.toLowerCase().includes(pattern.test.toLowerCase())
        : pattern.test.test(raw);
    if (matches) {
      return typeof pattern.message === "function"
        ? pattern.message(stripFraming(raw))
        : pattern.message;
    }
  }
  const cleaned = stripFraming(raw);
  return cleaned.length > 0 ? cleaned : fallback;
}
