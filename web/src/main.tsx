import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";

import App from "./App";
import "./index.css";

/**
 * React entry point.
 *
 * The single Convex client is hoisted to module scope so HMR doesn't
 * re-create it on every reload (which would invalidate every active
 * subscription).
 */
const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    "VITE_CONVEX_URL is not set — copy .env.example to .env and run `npx convex dev` first.",
  );
}
const convex = new ConvexReactClient(convexUrl);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexAuthProvider client={convex}>
      <App />
    </ConvexAuthProvider>
  </React.StrictMode>,
);
