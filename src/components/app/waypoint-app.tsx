"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Box,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Navigation,
  Package,
  Route,
  Store,
  Truck,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api, useApi } from "@/lib/client/api";
import { colomboTime, longDate, relative } from "@/lib/client/format";
import type { AppEvent, Me, User } from "@/lib/client/types";
import { ToastProvider } from "@/lib/client/ui";
import {
  DispatcherWorkspace,
  DISPATCH_PAGES,
  type DispatchPage,
} from "./dispatcher";
import { LoaderView } from "./loader";
import { DriverView } from "./driver";
import { StoreView } from "./store";
import { ServiceWorker } from "./service-worker";

const ROLE_LABEL = {
  dispatcher: "Dispatcher",
  loader: "Loader",
  driver: "Driver",
  store_manager: "Store manager",
} as const;
const ROLE_PAGE: Record<
  Exclude<User["role"], "dispatcher">,
  [string, LucideIcon]
> = {
  loader: ["Loading dock", Box],
  driver: ["On the road", Navigation],
  store_manager: ["Store portal", Store],
};
const NAV_ICON: Record<DispatchPage, LucideIcon> = {
  Overview: LayoutDashboard,
  "Dispatch planner": Route,
  Orders: Package,
  "Fleet & drivers": Truck,
  Outlets: Store,
  Capacity: BarChart3,
  Issues: AlertTriangle,
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

export function WaypointApp({ user }: { user: User }) {
  const [page, setPage] = useState<DispatchPage>("Overview");
  const [sidebar, setSidebar] = useState(false);
  const [inbox, setInbox] = useState(false);
  const [seen, setSeen] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const me = useApi<Me>("/api/me", 30000);
  const events = useApi<{ events: AppEvent[] }>("/api/events", 10000);

  useEffect(() => {
    const fromHash = decodeURIComponent(
      window.location.hash.slice(1),
    ) as DispatchPage;
    if (DISPATCH_PAGES.includes(fromHash)) setPage(fromHash);
    try {
      setSeen(Number(localStorage.getItem(`waypoint-seen-${user.id}`) ?? 0));
      setCollapsed(localStorage.getItem("waypoint-sidebar-collapsed") === "1");
    } catch {}
  }, [user.id]);

  const go = (p: DispatchPage) => {
    setPage(p);
    setSidebar(false);
    window.history.replaceState(null, "", `#${encodeURIComponent(p)}`);
    window.scrollTo({ top: 0 });
  };
  const list = events.data?.events ?? [];
  const unread = list.filter((e) => e.id > seen).length;
  const openInbox = () => {
    setInbox(!inbox);
    const top = list[0]?.id ?? 0;
    setSeen(top);
    try {
      localStorage.setItem(`waypoint-seen-${user.id}`, String(top));
    } catch {}
  };
  const signOut = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    // Shared dock tablets: do not leave the last user's data in the offline cache.
    navigator.serviceWorker?.controller?.postMessage("clear");
    window.location.href = "/login";
  };
  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("waypoint-sidebar-collapsed", next ? "1" : "0");
    } catch {}
  };
  const clock = me.data?.clock;
  const runDate = me.data?.run_date;
  const heading = user.role === "dispatcher" ? page : ROLE_PAGE[user.role][0];

  return (
    <ToastProvider>
      <ServiceWorker />
      <div
        className={`app-shell min-h-screen antialiased ${collapsed ? "sidebar-collapsed" : ""}`}
      >
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        {sidebar && (
          <div className="sidebar-scrim" onClick={() => setSidebar(false)} />
        )}
        <aside
          className={`sidebar ${sidebar ? "open" : ""}`}
          aria-label="Workspace navigation"
        >
          <a className="wordmark" href="/" aria-label="Waypoint home">
            <span className="brand-symbol">
              w<span>·</span>
            </span>
            waypoint<span className="wordmark-dot">®</span>
          </a>
          <button
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight size={15} />
            ) : (
              <ChevronLeft size={15} />
            )}
          </button>
          <div className="workspace">
            <span className="workspace-icon">
              <Box size={19} />
            </span>
            <div>
              Waypoint Group
              <small>
                {user.depot ??
                  (user.outlet_id
                    ? `Outlet ${user.outlet_id}`
                    : "Distribution workspace")}
              </small>
            </div>
          </div>
          <div className="nav-label">
            {user.role === "dispatcher" ? "WORKSPACE" : "YOUR WORK"}
          </div>
          <nav>
            {user.role === "dispatcher" ? (
              DISPATCH_PAGES.map((p) => {
                const Icon = NAV_ICON[p];
                return (
                  <button
                    key={p}
                    className={`nav-item ${page === p ? "active" : ""}`}
                    onClick={() => go(p)}
                    aria-current={page === p ? "page" : undefined}
                    title={collapsed ? p : undefined}
                  >
                    <Icon size={18} />
                    <span>{p}</span>
                  </button>
                );
              })
            ) : (
              <button className="nav-item active" aria-current="page">
                {(() => {
                  const Icon = ROLE_PAGE[user.role][1];
                  return <Icon size={18} />;
                })()}
                <span>{ROLE_PAGE[user.role][0]}</span>
              </button>
            )}
          </nav>
          <div className="sidebar-bottom">
            <div className="network-card">
              <Image
                width={1536}
                height={1024}
                sizes="240px"
                src="/images/island-network.png"
                alt=""
                className="sidebar-sketch"
              />
              <span className="network-card-head">
                <span className="status-light" /> One network. In sync.
              </span>
              <span className="network-card-label">Current run</span>
              <b className="network-card-date">
                {runDate ? longDate(runDate) : "Loading…"}
              </b>
              {clock && (
                <span className="network-card-clock">
                  {clock.simulated ? "Scenario clock" : "Colombo time"}{" "}
                  <b>{colomboTime(clock.now)}</b>
                </span>
              )}
            </div>
            <div className="profile" aria-label="Signed-in user">
              <span className="avatar">{initials(user.display_name)}</span>
              <span>
                {user.display_name}
                <small>
                  {ROLE_LABEL[user.role]}
                  {user.vehicle_id ? ` · ${user.vehicle_id}` : ""}
                </small>
              </span>
              <button
                className="sign-out"
                onClick={signOut}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="mobile-menu icon-btn"
                aria-label="Open menu"
                onClick={() => setSidebar(true)}
              >
                <Menu size={20} />
              </button>
              <span>Workspace</span>
              <ChevronRight size={13} />
              <strong>{heading}</strong>
            </div>
            <div className="topbar-actions">
              {clock?.simulated && (
                <span
                  className="demo-label"
                  title="The walkthrough runs on a scenario clock anchored when the data was seeded."
                >
                  SCENARIO · {colomboTime(clock.now)}
                </span>
              )}
              <span className="role-switch" aria-label="Signed-in role">
                <span className="status-light" />
                {ROLE_LABEL[user.role]}
              </span>
              <div className="notification-wrap">
                <button
                  className="icon-btn"
                  aria-label={`Notifications${unread ? `, ${unread} new` : ""}`}
                  onClick={openInbox}
                >
                  <Bell size={18} />
                </button>
                {unread > 0 && <span className="notification-dot" />}
                {inbox && (
                  <>
                    <div
                      className="popover-scrim"
                      onClick={() => setInbox(false)}
                    />
                    <div
                      className="notification-panel"
                      role="dialog"
                      aria-label="Activity inbox"
                    >
                      <h3>
                        Activity inbox <span>{list.length}</span>
                        <button
                          className="icon-btn"
                          aria-label="Close inbox"
                          onClick={() => setInbox(false)}
                        >
                          <X size={15} />
                        </button>
                      </h3>
                      {list.length === 0 && (
                        <p className="muted">
                          Nothing yet. Updates from other roles appear here.
                        </p>
                      )}
                      {list.map((e) => (
                        <div
                          className={`notification-item sev-${e.severity}`}
                          key={e.id}
                        >
                          <span className="event-icon">
                            <Bell size={14} />
                          </span>
                          <div>
                            <b>{e.title}</b>
                            <p>{e.detail}</p>
                            <small>{relative(e.created_at)}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <span className="avatar small">
                {initials(user.display_name)}
              </span>
            </div>
          </header>
          <main id="main-content">
            {!me.data ? (
              <div className="loading-state">Loading your workspace…</div>
            ) : user.role === "dispatcher" ? (
              <DispatcherWorkspace
                page={page}
                go={go}
                me={me.data}
                onChange={events.reload}
              />
            ) : user.role === "loader" ? (
              <LoaderView me={me.data} />
            ) : user.role === "driver" ? (
              <DriverView me={me.data} />
            ) : (
              <StoreView me={me.data} />
            )}
            <footer className="page-footer">
              <span>
                <span className="footer-symbol">w.</span> Thoughtfully
                connected.
              </span>
              <span>
                Tech-Triathlon 2026 Hackathon build <i /> All times Asia/Colombo
              </span>
              <span />
            </footer>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
