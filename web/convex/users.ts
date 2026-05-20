import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Returns the currently signed-in user's profile (or `null`).
 *
 * Used by the React shell to flip between the login form and the main app.
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return { _id: user._id, email: user.email ?? null, name: user.name ?? null };
  },
});
