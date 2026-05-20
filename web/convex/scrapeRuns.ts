import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Audit-log helpers for `scrapeRuns`.
 *
 * Every scrape (cron- or button-triggered) creates a row when it starts and
 * patches it when it finishes. The UI surfaces the most recent rows so the
 * operator can see at a glance whether the last cron tick succeeded.
 */

/** Insert a new "running" row. Returns the new doc id. */
export const startRun = internalMutation({
  args: { triggeredBy: v.string() },
  handler: async (ctx, args) =>
    ctx.db.insert("scrapeRuns", {
      startedAt: Date.now(),
      status: "running",
      triggeredBy: args.triggeredBy,
    }),
});

/** Patch a row created by {@link startRun} with the final state. */
export const finishRun = internalMutation({
  args: {
    runId: v.id("scrapeRuns"),
    status: v.string(),
    productsFound: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      finishedAt: Date.now(),
      status: args.status,
      productsFound: args.productsFound,
      errorMessage: args.errorMessage,
    });
  },
});

/** Most-recent `limit` runs for the UI badge. */
export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    return ctx.db
      .query("scrapeRuns")
      .withIndex("by_startedAt")
      .order("desc")
      .take(args.limit ?? 10);
  },
});
