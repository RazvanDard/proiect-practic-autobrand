import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

/**
 * Convex Auth configuration.
 *
 * Uses the built-in `Password` provider — username/password stored in the
 * `users` and `authAccounts` tables (bcrypt-hashed). No email verification is
 * configured to keep the demo flow short; flipping that on later is a one-line
 * change.
 *
 * The `signIn`, `signOut`, `store`, and `isAuthenticated` exports are consumed
 * by both the server (`auth.getUserId`) and the React client
 * (`useAuthActions`).
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});
