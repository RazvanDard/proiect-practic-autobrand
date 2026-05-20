import { internalAction, action, query, internalMutation, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * BNR exchange-rate ingestion.
 *
 * BNR publishes daily reference rates in XML at
 * <https://www.bnr.ro/nbrfxrates.xml>. We fetch it once per day (and on-demand
 * from the UI), parse out USD and EUR, and store a row per currency.
 *
 * No XML library is bundled with Convex's Node runtime, but the payload is
 * tiny and structurally rigid — a couple of regular expressions are more than
 * enough to extract the two rates we care about.
 */

const BNR_URL = "https://www.bnr.ro/nbrfxrates.xml";

/** Pulls the published-on date and the USD/EUR rates out of the BNR XML. */
function parseBnrXml(xml: string): {
  publishedOn: string;
  rates: Record<string, number>;
} {
  const dateMatch = xml.match(/<Cube date="(\d{4}-\d{2}-\d{2})">/);
  const publishedOn = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

  const rates: Record<string, number> = {};
  const rateRe = /<Rate currency="([A-Z]{3})"(?: multiplier="(\d+)")?>([\d.]+)<\/Rate>/g;
  let m: RegExpExecArray | null;
  while ((m = rateRe.exec(xml)) !== null) {
    const code = m[1];
    const multiplier = m[2] ? Number(m[2]) : 1;
    const value = Number(m[3]);
    if (Number.isFinite(value) && Number.isFinite(multiplier) && multiplier > 0) {
      rates[code] = value / multiplier;
    }
  }
  return { publishedOn, rates };
}

/** Persist one rate row, deduplicating on `(currency, publishedOn)`. */
export const upsertRate = internalMutation({
  args: {
    currency: v.string(),
    rate: v.number(),
    publishedOn: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("exchangeRates")
      .withIndex("by_currency_publishedOn", (q) =>
        q.eq("currency", args.currency).eq("publishedOn", args.publishedOn),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        rate: args.rate,
        fetchedAt: Date.now(),
      });
      return existing._id;
    }
    return ctx.db.insert("exchangeRates", {
      currency: args.currency,
      rate: args.rate,
      publishedOn: args.publishedOn,
      fetchedAt: Date.now(),
    });
  },
});

/**
 * Fetch the current BNR rates and upsert USD + EUR.
 *
 * Returned to the UI so the "Refresh FX" button can show the new values
 * immediately instead of waiting for the reactive query.
 */
type FxSnapshot = { publishedOn: string; usd?: number; eur?: number };

async function fetchAndStore(ctx: ActionCtx): Promise<FxSnapshot> {
  const res = await fetch(BNR_URL, { headers: { "User-Agent": "proba-practica" } });
  if (!res.ok) throw new Error(`BNR responded ${res.status}`);
  const xml = await res.text();
  const { publishedOn, rates } = parseBnrXml(xml);

  const result: { publishedOn: string; usd?: number; eur?: number } = { publishedOn };
  if (rates.USD) {
    await ctx.runMutation(internal.exchange.upsertRate, {
      currency: "USD",
      rate: rates.USD,
      publishedOn,
    });
    result.usd = rates.USD;
  }
  if (rates.EUR) {
    await ctx.runMutation(internal.exchange.upsertRate, {
      currency: "EUR",
      rate: rates.EUR,
      publishedOn,
    });
    result.eur = rates.EUR;
  }
  return result;
}

/** Cron entry point (no auth). */
export const refreshFxCron = internalAction({
  args: {},
  handler: async (ctx): Promise<FxSnapshot> => fetchAndStore(ctx),
});

/** Manual entry point used by the "Refresh FX" UI button. */
export const refreshFx = action({
  args: {},
  handler: async (ctx): Promise<FxSnapshot> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    return fetchAndStore(ctx);
  },
});

/** Latest snapshot per currency, for the UI badge. */
export const latest = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const pickLatest = async (currency: string) =>
      ctx.db
        .query("exchangeRates")
        .withIndex("by_currency_publishedOn", (q) => q.eq("currency", currency))
        .order("desc")
        .first();
    const [usd, eur] = await Promise.all([pickLatest("USD"), pickLatest("EUR")]);
    return { usd, eur };
  },
});
