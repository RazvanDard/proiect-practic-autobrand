import { useState, type ReactNode } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

import { LoginForm } from "./components/LoginForm";
import { Sidebar, type AppView } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { InvoicePage } from "./pages/InvoicePage";
import { ProductsPage } from "./pages/ProductsPage";

/**
 * Page metadata keyed by {@link AppView}. Drives the {@link TopBar} content.
 */
const VIEWS: Record<AppView, { title: string; hint: string; render: () => ReactNode }> = {
  products: {
    title: "Products",
    hint: "Hourly scrape · web-scraping.dev/consumables",
    render: () => <ProductsPage />,
  },
  invoice: {
    title: "Invoice extractor",
    hint: "RO eFactura PDF · structured line items + CSV",
    render: () => <InvoicePage />,
  },
};

/**
 * Top-level shell.
 *
 * Convex Auth's render slots gate the entire app behind sign-in; the
 * sidebar-with-content layout only mounts once authenticated. View switching
 * is local state — no router needed for two tabs.
 */
export default function App() {
  const [view, setView] = useState<AppView>("products");

  return (
    <>
      <AuthLoading>
        <div className="login-shell">
          <div className="card padded login-card">
            <p className="muted">Loading…</p>
          </div>
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="login-shell">
          <LoginForm />
        </div>
      </Unauthenticated>
      <Authenticated>
        <div className="app-layout">
          <Sidebar active={view} onChange={setView} />
          <main className="app-main">
            <TopBar title={VIEWS[view].title} hint={VIEWS[view].hint} />
            <div className="app-content">{VIEWS[view].render()}</div>
          </main>
        </div>
      </Authenticated>
    </>
  );
}
