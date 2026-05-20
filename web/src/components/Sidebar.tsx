import type { ReactNode } from "react";

/**
 * View identifier used by {@link Sidebar} and the {@link App} router.
 *
 * Add a value here and a matching entry in `NAV` to introduce another tab.
 */
export type AppView = "products" | "invoice";

interface NavEntry {
  key: AppView;
  label: string;
  hint: string;
  icon: ReactNode;
}

/** Static nav definitions — keep order stable to avoid layout shift. */
const NAV: NavEntry[] = [
  {
    key: "products",
    label: "Products",
    hint: "Scraped catalog",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h18M3 12h18M3 17h12" />
      </svg>
    ),
  },
  {
    key: "invoice",
    label: "Invoice extractor",
    hint: "Parse PDF → CSV",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 14h6M9 17h4" />
      </svg>
    ),
  },
];

export interface SidebarProps {
  active: AppView;
  onChange: (view: AppView) => void;
}

/**
 * Vertical side navigation. Stateless — parent owns the active view.
 */
export function Sidebar({ active, onChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">Autobrand</div>
        <div className="brand-sub">Proba practică</div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map((entry) => (
          <button
            key={entry.key}
            className={`nav-item${active === entry.key ? " active" : ""}`}
            onClick={() => onChange(entry.key)}
            type="button"
          >
            <span className="nav-icon" aria-hidden>
              {entry.icon}
            </span>
            <span className="nav-text">
              <span className="nav-label">{entry.label}</span>
              <span className="nav-hint">{entry.hint}</span>
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
