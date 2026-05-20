import { httpRouter } from "convex/server";
import { auth } from "./auth";

/**
 * HTTP router for the Convex deployment.
 *
 * `auth.addHttpRoutes` registers the OAuth-style endpoints `@convex-dev/auth`
 * needs (sign-in, sign-out, refresh). Add custom HTTP actions below if the
 * React app ever needs to bypass the JS client (e.g. for non-browser uploads).
 */
const http = httpRouter();

auth.addHttpRoutes(http);

export default http;
