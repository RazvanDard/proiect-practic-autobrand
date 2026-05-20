/**
 * Convex Auth runtime configuration.
 *
 * `CONVEX_SITE_URL` is populated automatically inside the Convex dashboard;
 * locally `npx convex dev` sets it from your deployment URL. We export the
 * provider list so JWT validation knows what issuer to trust.
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
