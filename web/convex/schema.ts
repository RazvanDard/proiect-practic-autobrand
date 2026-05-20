import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * Database schema for the proba-practica application.
 *
 * Tables
 * ------
 * - `products`         scraped product catalog. `by_name` is **unique** by
 *                      contract — every mutation that writes here must upsert.
 *                      The Convex query engine does not enforce uniqueness at
 *                      the schema layer; uniqueness is implemented in
 *                      `products.upsertMany` via name lookup before insert.
 * - `invoiceItems`     extracted invoice lines from uploaded PDFs. Kept around
 *                      so the user can re-download a CSV without re-parsing.
 * - `exchangeRates`    daily BNR snapshot of USD/EUR → RON. We keep history so
 *                      product RON prices can be reconstructed retroactively.
 * - `scrapeRuns`       audit log for the cron + manual triggers.
 *
 * `authTables` injects everything `@convex-dev/auth` requires (users, sessions,
 * auth accounts, refresh tokens, verification codes…). Do not modify those.
 */
export default defineSchema({
  ...authTables,

  products: defineTable({
    name: v.string(),
    price: v.number(),
    currency: v.string(),
    description: v.string(),
    imageUrl: v.string(),
    productUrl: v.optional(v.string()),
    /** Computed at insert time using the latest `exchangeRates` snapshot. */
    priceRon: v.optional(v.number()),
    /** ISO-4217 source code used for `priceRon` (so the UI can re-show it). */
    priceRonRate: v.optional(v.number()),
    lastScrapedAt: v.number(),
    /**
     * Lowercased concatenation of `name` and `description`. Indexed for
     * full-text search so server-side pagination + search can coexist.
     */
    searchBlob: v.optional(v.string()),
  })
    // `by_name` is used both for the uniqueness check on upsert and for
    // alphabetical sort in the UI fallback path.
    .index("by_name", ["name"])
    .index("by_price", ["price"])
    .index("by_lastScrapedAt", ["lastScrapedAt"])
    .searchIndex("by_search_blob", {
      searchField: "searchBlob",
      filterFields: ["currency"],
    }),

  invoiceItems: defineTable({
    /** Groups every line item that was extracted from the same upload. */
    batchId: v.string(),
    productCode: v.string(),
    productName: v.string(),
    unitPrice: v.number(),
    currency: v.string(),
    quantity: v.number(),
    uploadedAt: v.number(),
  }).index("by_batch", ["batchId"]),

  exchangeRates: defineTable({
    /** Source currency, e.g. "USD". RON is always the target. */
    currency: v.string(),
    /** Multiplier such that `amountRon = amountSource * rate`. */
    rate: v.number(),
    /** Publication date from BNR (YYYY-MM-DD). */
    publishedOn: v.string(),
    fetchedAt: v.number(),
  })
    .index("by_currency_publishedOn", ["currency", "publishedOn"])
    .index("by_fetchedAt", ["fetchedAt"]),

  scrapeRuns: defineTable({
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    /** "running" | "ok" | "error". Free-form string to keep schema simple. */
    status: v.string(),
    productsFound: v.optional(v.number()),
    /** Populated when `status === "error"`. */
    errorMessage: v.optional(v.string()),
    triggeredBy: v.string(), // "cron" | "manual"
  }).index("by_startedAt", ["startedAt"]),
});
