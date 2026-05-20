import { FormEvent, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

import { humanizeError } from "../lib/errors";

/**
 * Email + password sign-in / sign-up form, backed by Convex Auth's `Password`
 * provider. A single component handles both flows via the `mode` toggle.
 */
export function LoginForm() {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn("password", { email, password, flow: mode });
    } catch (err) {
      const fallback = mode === "signIn"
        ? "We couldn't sign you in. Check your email and password."
        : "We couldn't create your account.";
      setError(humanizeError(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card padded login-card">
      <div className="brand" style={{ marginBottom: 18 }}>
        <div className="brand-mark">Autobrand</div>
        <div className="brand-sub">Proba practică</div>
      </div>
      <h1 style={{ marginBottom: 4 }}>
        {mode === "signIn" ? "Sign in" : "Create account"}
      </h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        {mode === "signIn"
          ? "Sign in to manage products and parse invoices."
          : "Set up a new account to access the app."}
      </p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            autoComplete={mode === "signIn" ? "current-password" : "new-password"}
            placeholder="At least 8 characters"
          />
        </div>
        {error && <div className="error">{error}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "…" : mode === "signIn" ? "Sign in" : "Create account"}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => setMode((m) => (m === "signIn" ? "signUp" : "signIn"))}
          >
            {mode === "signIn" ? "Create account" : "I have an account"}
          </button>
        </div>
      </form>
    </div>
  );
}
