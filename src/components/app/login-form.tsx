"use client";
import Image from "next/image";
import { useState } from "react";
import { ArrowRight, Box, Navigation, Route, Store } from "lucide-react";
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
      <section className="login-card">
        <div className="login-art">
          <Image
            src="/images/waypoint-team-sketch.png"
            alt=""
            width={2172}
            height={724}
            priority
            sizes="(max-width: 700px) 100vw, 560px"
          />
        </div>
        <div className="login-body">
          <span className="wordmark login-wordmark">
            <span className="brand-symbol">
              w<span>·</span>
            </span>
            waypoint<span className="wordmark-dot">®</span>
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
            <label className="field">
              Username
              <input
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
            <label className="field">
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn primary full" disabled={busy}>
              Sign in <ArrowRight size={16} />
            </button>
          </form>
          {accounts.length > 0 && (
            <div className="demo-accounts">
              <span className="eyebrow">
                WALKTHROUGH ACCOUNTS · PASSWORD {demoPassword}
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
                        {a.username} · {a.vehicle_id ?? a.outlet_id ?? a.depot}{" "}
                        · {r.note}
                      </small>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                );
              })}
              <p className="muted small-copy">
                Every vehicle has a driver login (e.g. veh014) and every outlet
                a manager login (e.g. out012), all with the same password.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
