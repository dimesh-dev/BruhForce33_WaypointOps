"use client";
import Image from "next/image";
import { useState } from "react";
import {
  ArrowRight,
  Box,
  Eye,
  EyeOff,
  Lock,
  Navigation,
  Route,
  Store,
  User,
  WifiOff,
} from "lucide-react";
import { api, ApiError } from "@/lib/client/api";

const ROLE = {
  dispatcher: {
    label: "Dispatcher",
    icon: Route,
    note: "Plan, allocate and oversee",
  },
  loader: { label: "Loader", icon: Box, note: "Load and release vehicles" },
  driver: {
    label: "Driver",
    icon: Navigation,
    note: "Deliver and record proof",
  },
  store_manager: {
    label: "Store manager",
    icon: Store,
    note: "Order and confirm receipt",
  },
} as const;

export function LoginForm({
  accounts,
  demoPassword,
}: {
  accounts: {
    username: string;
    display_name: string;
    role: string;
    vehicle_id: string | null;
    outlet_id: string | null;
    depot: string | null;
  }[];
  demoPassword: string;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signIn = async (u: string, p: string) => {
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { json: { username: u, password: p } });
      window.location.href = "/";
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Could not reach Waypoint. Check your connection.",
      );
      setBusy(false);
    }
  };
  return (
    <main className="login-page">
      <section className="login-hero">
        {/* Shown at its native panoramic ratio and served near full resolution so the pencil work stays crisp. */}
        <Image
          src="/images/waypoint-team-sketch.png"
          alt=""
          fill
          priority
          quality={90}
          sizes="(max-width: 760px) 200vw, min(100vw, 1280px)"
          className="login-hero-art"
        />
        <div className="login-panel">
          <span className="wordmark login-wordmark">
            <span className="brand-symbol">
              w<span>·</span>
            </span>
            waypoint<span className="wordmark-dot">®</span>
          </span>
          <span className="eyebrow">
            <span className="status-light" /> DELIVERY OPERATIONS · SRI LANKA
          </span>
          <h1>
            One delivery record.
            <br />
            <em>Every role in the loop.</em>
          </h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              signIn(username, password);
            }}
          >
            <label className="field login-field">
              Username
              <span className="input-icon">
                <User size={16} aria-hidden="true" />
                <input
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </span>
            </label>
            {/* div + htmlFor keeps the reveal button out of the input's accessible name */}
            <div className="field login-field">
              <label htmlFor="login-password">Password</label>
              <span className="input-icon">
                <Lock size={16} aria-hidden="true" />
                <input
                  id="login-password"
                  type={reveal ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="reveal"
                  aria-label={reveal ? "Hide password" : "Show password"}
                  onClick={() => setReveal(!reveal)}
                >
                  {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn primary full login-submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"} <ArrowRight size={16} />
            </button>
          </form>
          <p className="login-note">
            <WifiOff size={14} aria-hidden="true" /> Drivers and loaders keep
            working offline; records sync when signal returns.
          </p>
        </div>
      </section>

      <ul className="login-roles" aria-label="Who uses Waypoint">
        {Object.values(ROLE).map((r) => (
          <li key={r.label}>
            <r.icon size={18} aria-hidden="true" />
            <span>
              <b>{r.label}</b>
              <small>{r.note}</small>
            </span>
          </li>
        ))}
      </ul>

      {accounts.length > 0 && (
        <section className="demo-accounts">
          <span className="eyebrow">
            LOCAL DEMO ACCOUNTS · PASSWORD {demoPassword}
          </span>
          {accounts.map((a) => {
            const r = ROLE[a.role as keyof typeof ROLE];
            return (
              <button
                key={a.username}
                type="button"
                disabled={busy}
                onClick={() => signIn(a.username, demoPassword)}
              >
                <r.icon size={18} />
                <span>
                  <b>
                    {r.label} · {a.display_name}
                  </b>
                  <small>
                    {a.username} · {a.vehicle_id ?? a.outlet_id ?? a.depot}
                  </small>
                </span>
                <ArrowRight size={15} />
              </button>
            );
          })}
        </section>
      )}
      <footer className="login-footer">
        <span className="footer-symbol">w.</span> Thoughtfully connected ·
        Tech-Triathlon 2026
      </footer>
    </main>
  );
}
