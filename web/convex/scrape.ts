"use node";

import { v } from "convex/values";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Server-side action that asks the Python scraper service to fetch products
 * and then upserts the result into Convex.
 *
 * Two entry points exist:
 *
 * - {@link runScrape}      — public action. Called by the React app's "Scrape
 *                            now" button. Authenticated users only.
 * - {@link runScrapeCron}  — internal action invoked by `crons.ts`. No auth.
 *
 * Both delegate to {@link executeScrape}.
 *
 * Environment variables required (set with `npx convex env set`):
 *
 * - `SCRAPER_BASE_URL`      e.g. `https://scraper.example.com` or
 *                            `http://host.docker.internal:8000` for local dev.
 * - `SCRAPER_SHARED_SECRET` matching the value in `scraper/.env`.
 */

type ScrapedProduct = {
  name: string;
  price: number;
  currency: string;
  description: string;
  image_url: string;
  product_url?: string | null;
};

type ScrapeResponse = {
  products: ScrapedProduct[];
  scraped_at: string;
};

async function executeScrape(
  ctx: ActionCtx,
  triggeredBy: "cron" | "manual",
): Promise<{ inserted: number; updated: number }> {
  const baseUrl = process.env.SCRAPER_BASE_URL;
  const secret = process.env.SCRAPER_SHARED_SECRET;
  if (!baseUrl || !secret) {
    throw new Error(
      "Convex env vars SCRAPER_BASE_URL and SCRAPER_SHARED_SECRET must be set.",
    );
  }

  const runId = await ctx.runMutation(internal.scrapeRuns.startRun, {
    triggeredBy,
  });

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/scrape`, {
      method: "POST",
      headers: { "X-Scraper-Secret": secret },
    });
    if (!response.ok) {
      throw new Error(
        `scraper responded ${response.status} ${response.statusText}`,
      );
    }
    const payload = (await response.json()) as ScrapeResponse;
    const fx = await ctx.runQuery(internal.products.latestFxRates, {});

    const result = await ctx.runMutation(internal.products.upsertMany, {
      products: payload.products.map((p) => ({
        name: p.name,
        price: p.price,
        currency: p.currency,
        description: p.description,
        imageUrl: p.image_url,
        productUrl: p.product_url ?? undefined,
      })),
      scrapedAt: Date.now(),
      usdToRon: fx.usd,
      eurToRon: fx.eur,
    });

    await ctx.runMutation(internal.scrapeRuns.finishRun, {
      runId,
      status: "ok",
      productsFound: payload.products.length,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await ctx.runMutation(internal.scrapeRuns.finishRun, {
      runId,
      status: "error",
      errorMessage: message,
    });
    throw err;
  }
}

/**
 * Public action invoked by the "Scrape now" button.
 *
 * Returns the upsert counters so the UI can show a toast.
 */
export const runScrape = action({
  args: {},
  handler: async (ctx): Promise<{ inserted: number; updated: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    return executeScrape(ctx, "manual");
  },
});

/** Internal cron entry point — see {@link executeScrape}. */
export const runScrapeCron = internalAction({
  args: {},
  handler: async (ctx): Promise<{ inserted: number; updated: number }> =>
    executeScrape(ctx, "cron"),
});

/**
 * Parse an uploaded PDF invoice by proxying through the Python service.
 *
 * The React app uploads the file to Convex storage and passes the resulting
 * storage id here. We download the bytes, forward them to the scraper
 * service's `/parse-invoice`, persist the line items, and return both the line
 * items and the CSV (so the UI can offer a download immediately).
 */
type ParsedInvoiceLine = {
  product_code: string;
  product_name: string;
  unit_price: number;
  currency: string;
  quantity: number;
};

type ParseInvoiceResult = {
  batchId: string;
  lineItems: ParsedInvoiceLine[];
  csv: string;
};

export const parseInvoice = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args): Promise<ParseInvoiceResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const baseUrl = process.env.SCRAPER_BASE_URL;
    const secret = process.env.SCRAPER_SHARED_SECRET;
    if (!baseUrl || !secret) {
      throw new Error("Scraper env vars are missing.");
    }

    const blob = await ctx.storage.get(args.storageId);
    if (!blob) throw new Error("PDF blob not found in storage");

    const form = new FormData();
    form.append("file", blob, "invoice.pdf");

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/parse-invoice`, {
      method: "POST",
      headers: { "X-Scraper-Secret": secret },
      body: form,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`parse-invoice failed: ${response.status} ${text}`);
    }
    const payload = (await response.json()) as {
      line_items: ParsedInvoiceLine[];
      csv: string;
    };

    const batchId: string = await ctx.runMutation(internal.invoiceItems.saveBatch, {
      items: payload.line_items.map((i) => ({
        productCode: i.product_code,
        productName: i.product_name,
        unitPrice: i.unit_price,
        currency: i.currency,
        quantity: i.quantity,
      })),
    });

    // Storage was a transit buffer only — drop it so we don't keep PII PDFs.
    await ctx.storage.delete(args.storageId);

    return { batchId, lineItems: payload.line_items, csv: payload.csv };
  },
});
