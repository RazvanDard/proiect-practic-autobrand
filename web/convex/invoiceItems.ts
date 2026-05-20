import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Convex helpers for the `invoiceItems` table.
 *
 * The action in `scrape.ts` calls {@link saveBatch} internally; the React app
 * reads {@link listBatch} when it re-renders after a PDF upload, and uses
 * {@link generateUploadUrl} to obtain a presigned URL for the file.
 */

/**
 * Returns a presigned upload URL the browser can `PUT` the PDF to.
 *
 * Convex storage is the simplest way to ship binary content from the browser
 * to a Convex action without writing custom HTTP routes. The flow is:
 *
 *   1. UI calls `generateUploadUrl` → gets back `{ url }`.
 *   2. UI does `fetch(url, { method: "POST", body: file })`.
 *   3. UI calls the `parseInvoice` action with the returned `storageId`.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    return ctx.storage.generateUploadUrl();
  },
});

/**
 * Persist every line item from one PDF parse and return the synthetic
 * `batchId` that ties them together. Called from the `parseInvoice` action.
 */
export const saveBatch = internalMutation({
  args: {
    items: v.array(
      v.object({
        productCode: v.string(),
        productName: v.string(),
        unitPrice: v.number(),
        currency: v.string(),
        quantity: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const batchId = crypto.randomUUID();
    const uploadedAt = Date.now();
    for (const item of args.items) {
      await ctx.db.insert("invoiceItems", {
        batchId,
        productCode: item.productCode,
        productName: item.productName,
        unitPrice: item.unitPrice,
        currency: item.currency,
        quantity: item.quantity,
        uploadedAt,
      });
    }
    return batchId;
  },
});

/**
 * List the line items belonging to a given batch.
 */
export const listBatch = query({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    return ctx.db
      .query("invoiceItems")
      .withIndex("by_batch", (q) => q.eq("batchId", args.batchId))
      .collect();
  },
});
