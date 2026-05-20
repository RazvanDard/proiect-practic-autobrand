import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Sort key accepted by {@link list}. Mirrors the columns exposed in the UI; if
 * you add a column, extend this union AND the switch in `list`.
 */
const SORT_KEYS = v.union(
  v.literal("name"),
  v.literal("price"),
  v.literal("lastScrapedAt"),
);

/** Build the lowercased blob used by the `by_search_blob` search index. */
function buildSearchBlob(name: string, description: string): string {
  return `${name} ${description}`.toLowerCase();
}

/**
 * List products with optional filtering and sorting.
 *
 * Auth-gated: any signed-in user can read. Filtering is done in JS rather than
 * via Convex indexes because the dataset (≤ 100 rows) doesn't justify the
 * extra schema surface. Sorting honours the index `by_name` / `by_price` /
 * `by_lastScrapedAt` for cheap O(log n) traversal.
 *
 * @param search        Case-insensitive substring matched against `name` and
 *                      `description`. Empty/undefined returns everything.
 * @param sortKey       Column to sort by. Defaults to `name`.
 * @param sortDirection `"asc"` (default) or `"desc"`.
 */
/**
 * Argument set shared by {@link list} and {@link count}. Kept in one place so
 * the two queries stay in lockstep (count must apply identical filters).
 */
const FILTER_ARGS = {
  search: v.optional(v.string()),
  sortKey: v.optional(SORT_KEYS),
  sortDirection: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  /** Lower bound applied to the **RON-converted** price. */
  minPriceRon: v.optional(v.number()),
  /** Upper bound applied to the **RON-converted** price. */
  maxPriceRon: v.optional(v.number()),
  /** Original (scraped) currency to keep. ISO 4217. */
  currency: v.optional(v.string()),
};

/**
 * Server-side paginated products query.
 *
 * Two query strategies:
 *
 *   1. **Search active** — uses the `by_search_blob` search index. Convex
 *      orders results by relevance to the search term; the user-supplied
 *      `sortKey` / `sortDirection` are ignored in this branch by design,
 *      since search indexes cannot also order by arbitrary fields.
 *   2. **No search** — uses one of `by_name`, `by_price`, `by_lastScrapedAt`
 *      regular indexes, honouring `sortDirection`.
 *
 * Range filters (`minPriceRon` / `maxPriceRon`) and `currency` are applied
 * with `.filter()` predicates so they're evaluated at the storage layer, not
 * in JS. Rows missing `priceRon` are excluded when a range bound is set
 * (we cannot honour a bound we cannot compute).
 *
 * Pagination is cursor-based: pass `paginationOpts.cursor = null` to start,
 * then echo back `result.continueCursor` for the next page.
 */
export const list = query({
  args: { ...FILTER_ARGS, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const search = args.search?.trim().toLowerCase();
    const currencyUpper = args.currency?.toUpperCase();
    const minPriceRon = args.minPriceRon;
    const maxPriceRon = args.maxPriceRon;

    if (search && search.length > 0) {
      let chain = ctx.db.query("products").withSearchIndex("by_search_blob", (q) => {
        let inner = q.search("searchBlob", search);
        if (currencyUpper) inner = inner.eq("currency", currencyUpper);
        return inner;
      });
      if (minPriceRon !== undefined) {
        chain = chain.filter((f) => f.gte(f.field("priceRon"), minPriceRon));
      }
      if (maxPriceRon !== undefined) {
        chain = chain.filter((f) => f.lte(f.field("priceRon"), maxPriceRon));
      }
      return chain.paginate(args.paginationOpts);
    }

    const sortKey = args.sortKey ?? "name";
    const indexName =
      sortKey === "price"
        ? "by_price"
        : sortKey === "lastScrapedAt"
          ? "by_lastScrapedAt"
          : "by_name";
    const direction = args.sortDirection === "desc" ? "desc" : "asc";

    let chain = ctx.db.query("products").withIndex(indexName).order(direction);
    if (currencyUpper) {
      chain = chain.filter((f) => f.eq(f.field("currency"), currencyUpper));
    }
    if (minPriceRon !== undefined) {
      chain = chain.filter((f) => f.gte(f.field("priceRon"), minPriceRon));
    }
    if (maxPriceRon !== undefined) {
      chain = chain.filter((f) => f.lte(f.field("priceRon"), maxPriceRon));
    }
    return chain.paginate(args.paginationOpts);
  },
});

/**
 * Total number of products that match the given filters.
 *
 * Used by the UI to render "Showing X–Y of Z" and to compute the total page
 * count. Implemented as a separate query (rather than baked into {@link list})
 * so the pagination layer can keep using cursors without needing to scan
 * everything on each page request.
 */
export const count = query({
  args: FILTER_ARGS,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const search = args.search?.trim().toLowerCase();
    const currencyUpper = args.currency?.toUpperCase();
    const minPriceRon = args.minPriceRon;
    const maxPriceRon = args.maxPriceRon;

    let rows: Array<{ priceRon?: number; currency: string }>;
    if (search && search.length > 0) {
      rows = await ctx.db
        .query("products")
        .withSearchIndex("by_search_blob", (q) => {
          let inner = q.search("searchBlob", search);
          if (currencyUpper) inner = inner.eq("currency", currencyUpper);
          return inner;
        })
        .collect();
    } else {
      rows = await ctx.db.query("products").collect();
      if (currencyUpper) {
        rows = rows.filter((r) => r.currency.toUpperCase() === currencyUpper);
      }
    }

    if (minPriceRon !== undefined) {
      rows = rows.filter((r) => r.priceRon !== undefined && r.priceRon >= minPriceRon);
    }
    if (maxPriceRon !== undefined) {
      rows = rows.filter((r) => r.priceRon !== undefined && r.priceRon <= maxPriceRon);
    }
    return rows.length;
  },
});

/**
 * Returns the set of distinct currencies currently in the catalog. Used by
 * the UI to populate the currency-filter dropdown without hard-coding it.
 */
export const currencies = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const rows = await ctx.db.query("products").collect();
    const set = new Set<string>();
    for (const r of rows) set.add(r.currency.toUpperCase());
    return Array.from(set).sort();
  },
});

/**
 * Update an existing product. Used by the inline edit dialog.
 *
 * The unique-by-name invariant is preserved: if the new name collides with a
 * different row we throw rather than silently merging.
 */
export const update = mutation({
  args: {
    id: v.id("products"),
    name: v.string(),
    price: v.number(),
    currency: v.string(),
    description: v.string(),
    imageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Product not found");

    if (existing.name !== args.name) {
      const clash = await ctx.db
        .query("products")
        .withIndex("by_name", (q) => q.eq("name", args.name))
        .unique();
      if (clash && clash._id !== args.id) {
        throw new Error(`A product named "${args.name}" already exists.`);
      }
    }

    await ctx.db.patch(args.id, {
      name: args.name,
      price: args.price,
      currency: args.currency,
      description: args.description,
      imageUrl: args.imageUrl,
      searchBlob: buildSearchBlob(args.name, args.description),
    });
  },
});

/**
 * Delete a single product by id.
 *
 * No cascade is needed — `invoiceItems` and `exchangeRates` are independent.
 */
export const remove = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    await ctx.db.delete(args.id);
  },
});

/**
 * Internal upsert used by the scrape action. Not exposed to the client.
 *
 * For each incoming product:
 *   1. Look up an existing row by `name` (the unique key from the brief).
 *   2. If found, patch its mutable fields and refresh `lastScrapedAt`.
 *   3. If not, insert a new row.
 *
 * Returns the count of inserted vs. updated rows so the audit log can capture
 * change pressure across runs.
 */
export const upsertMany = internalMutation({
  args: {
    products: v.array(
      v.object({
        name: v.string(),
        price: v.number(),
        currency: v.string(),
        description: v.string(),
        imageUrl: v.string(),
        productUrl: v.optional(v.string()),
      }),
    ),
    scrapedAt: v.number(),
    usdToRon: v.optional(v.number()),
    eurToRon: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;
    for (const p of args.products) {
      const rate =
        p.currency.toUpperCase() === "USD"
          ? args.usdToRon
          : p.currency.toUpperCase() === "EUR"
            ? args.eurToRon
            : p.currency.toUpperCase() === "RON"
              ? 1
              : undefined;
      const priceRon = rate ? Number((p.price * rate).toFixed(2)) : undefined;

      const existing = await ctx.db
        .query("products")
        .withIndex("by_name", (q) => q.eq("name", p.name))
        .unique();
      const searchBlob = buildSearchBlob(p.name, p.description);
      if (existing) {
        await ctx.db.patch(existing._id, {
          price: p.price,
          currency: p.currency,
          description: p.description,
          imageUrl: p.imageUrl,
          productUrl: p.productUrl,
          priceRon,
          priceRonRate: rate,
          lastScrapedAt: args.scrapedAt,
          searchBlob,
        });
        updated += 1;
      } else {
        await ctx.db.insert("products", {
          name: p.name,
          price: p.price,
          currency: p.currency,
          description: p.description,
          imageUrl: p.imageUrl,
          productUrl: p.productUrl,
          priceRon,
          priceRonRate: rate,
          lastScrapedAt: args.scrapedAt,
          searchBlob,
        });
        inserted += 1;
      }
    }
    return { inserted, updated };
  },
});

/** Internal helper used by the scrape action to find the last FX snapshots. */
export const latestFxRates = internalQuery({
  args: {},
  handler: async (ctx) => {
    const findRate = async (currency: string) => {
      const row = await ctx.db
        .query("exchangeRates")
        .withIndex("by_currency_publishedOn", (q) => q.eq("currency", currency))
        .order("desc")
        .first();
      return row?.rate;
    };
    return {
      usd: await findRate("USD"),
      eur: await findRate("EUR"),
    };
  },
});
