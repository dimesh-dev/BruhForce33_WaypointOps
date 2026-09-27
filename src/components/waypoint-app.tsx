"use client";
import Image from "next/image";
import React from "react";
import { useState, useEffect } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Bell,
  Box,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Leaf,
  MapPin,
  Menu,
  Navigation,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Store,
  Truck,
  Users,
  X,
  AlertTriangle,
  CheckCircle2,
  ShoppingBag,
  Monitor,
  Play,
  Maximize2,
} from "lucide-react";
import type {
  Role,
  Order,
  Activity,
  PendingProof,
  ModalState,
} from "@/lib/types";
import { initialOrders, routes, nav, roleInfo } from "@/lib/demo-data";
import { IllustratedBanner, JourneyCards } from "./illustrated-banner";
import { RoleExperience } from "./role-experience";
import { OrderTable } from "./order-table";
import { Modal } from "./workspace-modal";
import { NetworkMap } from "./network-map";
import { Insights } from "./insights";
import { IconButton, Badge, Metric, Capacity } from "./ui-primitives";
import { useSaved } from "@/lib/use-persisted-state";

export default function WaypointApp() {
  const [role, setRole] = useSaved<Role>("waypoint-role-v1", "Dispatcher"),
    [page, setPage] = useState("Overview"),
    [roleOpen, setRoleOpen] = useState(false),
    [sidebar, setSidebar] = useState(false);
  const [orders, setOrders] = useSaved("waypoint-orders-v1", initialOrders),
    [events, setEvents] = useSaved<Activity[]>("waypoint-events-v1", []),
    [loaded, setLoaded] = useSaved<string[]>("waypoint-loaded-v1", []),
    [published, setPublished] = useSaved("waypoint-plan-v1", false),
    [queued, setQueued] = useSaved<PendingProof[]>("waypoint-queue-v1", []);
  const [offline, setOffline] = useSaved("waypoint-offline-v1", false),
    [routeIndex, setRouteIndex] = useState(0),
    [modal, setModal] = useState<ModalState | null>(null),
    [toast, setToast] = useState(""),
    [search, setSearch] = useState(""),
    [brand, setBrand] = useState("All brands"),
    [status, setStatus] = useState("All statuses"),
    [depot, setDepot] = useState("All depots"),
    [tab, setTab] = useState("All deliveries"),
    [notifications, setNotifications] = useState(false),
    [tour, setTour] = useState(false),
    [tourStep, setTourStep] = useState(0);
  const activeRoute = routes[routeIndex],
    user = roleInfo[role];
  const notify = (message: string) => setToast(message);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const addEvent = (title: string, detail: string) =>
    setEvents((e) => [{ title, detail, time: "Just now" }, ...e].slice(0, 12));
  const updateOrder = (id: string, values: Partial<Order>) =>
    setOrders((o) => o.map((x) => (x.id === id ? { ...x, ...values } : x)));
  const switchRole = (r: Role) => {
    setRole(r);
    setPage("Overview");
    setRoleOpen(false);
    setSidebar(false);
  };
  const sync = () => {
    queued.forEach((q) =>
      updateOrder(q.id, { status: "Delivered", eta: "06:42", proof: q.proof }),
    );
    addEvent(
      "Offline records synchronized",
      `${queued.length} delivery record(s) now visible to the store.`,
    );
    setQueued([]);
    setOffline(false);
    notify("All records synchronized. Store manager notified.");
  };
  const filtered = orders.filter(
    (o) =>
      (brand === "All brands" || o.brand === brand) &&
      (status === "All statuses" || o.status === status) &&
      (depot === "All depots" ||
        (depot === "Kandy"
          ? o.district === "Kandy"
          : o.district !== "Kandy")) &&
      `${o.name} ${o.id} ${o.vehicle}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (tab !== "Needs attention" || ["At risk", "Deferred"].includes(o.status)),
  );
  const download = () => {
    const content = [
      "Order,Outlet,Brand,Status,ETA,Vehicle",
      ...filtered.map((o) =>
        [o.id, o.name, o.brand, o.status, o.eta, o.vehicle].join(","),
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
    a.download = "waypoint-demo-deliveries.csv";
    a.click();
    URL.revokeObjectURL(a.href);
    notify("Delivery report downloaded");
  };
  const tourSteps: [string, string, Role][] = [
    [
      "Your network, at a glance",
      "Explore the map and select a route. Every operational detail is one click away.",
      "Dispatcher",
    ],
    [
      "Make an explainable decision",
      "Open “Review exceptions” to record a deferral reason and protect an outlet already skipped.",
      "Dispatcher",
    ],
    [
      "A plan that reaches the dock",
      "Switch to Loader. Inspect the reverse stop sequence, check cargo, or flag a shortfall.",
      "Loader",
    ],
    [
      "Stay useful without signal",
      "Switch to Driver, enable offline mode, and capture proof of delivery. Reconnect to synchronize.",
      "Driver",
    ],
    [
      "Close the loop",
      "Switch to Store manager to see the delivery record, confirm receipt, or place an order.",
      "Store manager",
    ],
  ];
  return (
    <div className="app-shell min-h-screen antialiased">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      {sidebar && (
        <div className="sidebar-scrim" onClick={() => setSidebar(false)} />
      )}
      <aside className={`sidebar ${sidebar ? "open" : ""}`}>
        <a
          className="wordmark"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Overview");
          }}
        >
          <span className="brand-symbol">
            w<span>·</span>
          </span>
          waypoint<span className="wordmark-dot">®</span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">
            <Box size={19} />
          </span>
          <div>
            Waypoint Group<small>Distribution workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${page === label ? "active" : ""}`}
              onClick={() => {
                setPage(label);
                setSidebar(false);
                if (role !== "Dispatcher") setRole("Dispatcher");
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "Orders" && (
                <span className="nav-count">{orders.length}</span>
              )}
              {label === "Overview" && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="nav-divider" />
        <div className="nav-label">CONNECTED OPERATIONS</div>
        {(["Loader", "Driver", "Store manager"] as Role[]).map((r, i) => (
          <button
            key={r}
            className={`nav-item role-nav ${role === r ? "selected" : ""}`}
            onClick={() => switchRole(r)}
          >
            {React.createElement([Box, Navigation, Store][i], { size: 18 })}
            <span>
              {r === "Loader"
                ? "Loading dock"
                : r === "Driver"
                  ? "On the road"
                  : "Store portal"}
            </span>
            <ArrowUpRight size={14} />
          </button>
        ))}
        <div className="sidebar-bottom">
          <div className="network-card">
            <Image
              width={1536}
              height={1024}
              sizes="(max-width: 700px) 100vw, 800px"
              src="/images/island-network.png"
              alt=""
              className="sidebar-sketch"
            />
            <span className="status-light" /> One network. In sync.
            <p>
              120 outlets. 3 brands.
              <br />A better way forward.
            </p>
            <div className="brand-stack">
              <span>Fresh</span>
              <span>Style</span>
              <span>Tech</span>
            </div>
          </div>
          <button
            className="help-link"
            onClick={() => setModal({ type: "guide" })}
          >
            <CircleHelp size={17} /> Prototype guide <ArrowUpRight size={14} />
          </button>
          <button className="profile" onClick={() => setRoleOpen(!roleOpen)}>
            <span className="avatar">{user.initials}</span>
            <span>
              {user.full}
              <small>{user.title}</small>
            </span>
            <ChevronDown size={15} />
          </button>
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
            <strong>
              {role === "Dispatcher"
                ? page
                : role === "Loader"
                  ? "Loading dock"
                  : role === "Driver"
                    ? "On the road"
                    : "Store portal"}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="demo-label">DESIGN PROTOTYPE</span>
            <button
              className="role-switch"
              onClick={() => setRoleOpen(!roleOpen)}
            >
              <span className="status-light" />
              {role}
              <ChevronDown size={13} />
            </button>
            <div className="notification-wrap">
              <IconButton
                icon={Bell}
                label="Notifications"
                onClick={() => setNotifications(!notifications)}
              />
              <span className="notification-dot" />
              {notifications && (
                <div className="notification-panel">
                  <h3>
                    Activity inbox <span>{events.length + 2}</span>
                  </h3>
                  {[
                    ...events,
                    {
                      title: "Mall window at risk",
                      detail: "City retail loop is running 12 minutes late.",
                      time: "4 min ago",
                    },
                    {
                      title: "Morning plan ready",
                      detail: "Peliyagoda loading teams are ready.",
                      time: "12 min ago",
                    },
                  ].map((e, i) => (
                    <div className="notification-item" key={i}>
                      <span className="event-icon">
                        <Bell size={14} />
                      </span>
                      <div>
                        <b>{e.title}</b>
                        <p>{e.detail}</p>
                        <small>{e.time}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span className="avatar small">{user.initials}</span>
          </div>
        </header>
        {roleOpen && (
          <>
            <div className="popover-scrim" onClick={() => setRoleOpen(false)} />
            <div className="role-menu">
              <span className="eyebrow">EXPERIENCE THE WORKFLOW</span>
              {(Object.keys(roleInfo) as Role[]).map((r, i) => (
                <button key={r} onClick={() => switchRole(r)}>
                  <span className="role-number">0{i + 1}</span>
                  <span>
                    <b>{r}</b>
                    <small>
                      {
                        [
                          "Plan & oversee the network",
                          "Prepare the next departure",
                          "Deliver & capture proof",
                          "Order & confirm receipt",
                        ][i]
                      }
                    </small>
                  </span>
                  {role === r && <Check size={17} />}
                </button>
              ))}
            </div>
          </>
        )}
        <main id="main-content">
          {role === "Dispatcher" ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span className="tiny-line" /> MONDAY, 28 SEPTEMBER 2026
                  </div>
                  <h1>
                    {page === "Overview" ? (
                      <>
                        Good morning, Amaya<span className="sun-icon">☀</span>
                      </>
                    ) : (
                      page
                    )}
                  </h1>
                  <p>
                    {page === "Overview"
                      ? "A clear view of every delivery. A better start to the day."
                      : (
                          {
                            "Dispatch planner":
                              "Turn competing priorities into a plan everyone can follow.",
                            Orders:
                              "Every order, from the first request to the final receipt.",
                            "Fleet & drivers":
                              "The right vehicle. The right load. Ready for the road.",
                            Outlets:
                              "One connected network, with every local detail in view.",
                            Insights: "Make room for what’s coming next.",
                          } as Record<string, string>
                        )[page]}
                  </p>
                </div>
                <div className="heading-actions flex items-center gap-2">
                  <button
                    className="btn secondary date-btn"
                    onClick={() => setModal({ type: "date" })}
                  >
                    <CalendarDays size={15} />
                    28 Sep, 2026
                    <ChevronDown size={14} />
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => setModal({ type: "plan" })}
                  >
                    <Plus size={17} /> Build dispatch plan
                  </button>
                </div>
              </div>
              {page === "Orders" && (
                <IllustratedBanner
                  image="dispatch-studio"
                  eyebrow="THE DETAILS, THOUGHTFULLY CONNECTED"
                  title="Every request."
                  accent="A promise to keep."
                  description="From a store’s first request to the final crate at the door."
                />
              )}
              {page === "Fleet & drivers" && (
                <IllustratedBanner
                  image="fleet-yard"
                  eyebrow="THE PEOPLE & THE WHEELS"
                  title="Ready for the road."
                  accent="Made for the journey."
                  description="The right vehicle, a familiar face, and a little room for what’s next."
                />
              )}
              {page === "Outlets" && (
                <IllustratedBanner
                  image="neighborhood-store"
                  eyebrow="ONE ISLAND. A HUNDRED LITTLE CONNECTIONS."
                  title="Every doorstep"
                  accent="has a story."
                  description="Know the places and people that make this network feel local."
                />
              )}
              {page === "Insights" && (
                <IllustratedBanner
                  image="island-network"
                  eyebrow="A LITTLE FORESIGHT GOES A LONG WAY"
                  title="See a little further."
                  accent="Plan a little better."
                  description="Make space for tomorrow, with a clearer picture of what’s ahead."
                />
              )}
              {page === "Overview" && (
                <>
                  <section className="hero">
                    <Image
                      src="/images/waypoint-team-sketch.png"
                      width={2172}
                      height={724}
                      sizes="(max-width: 700px) 100vw, 1200px"
                      alt=""
                      className="hero-art"
                      priority
                    />
                    <div className="hero-copy">
                      <span className="hero-eyebrow">
                        <span className="status-light" /> YOUR MORNING, IN
                        MOTION
                      </span>
                      <h2>
                        Big picture.
                        <br />
                        <em>Every little delivery.</em>
                      </h2>
                      <p>
                        From the coast to the hill country, keep your network
                        moving.
                      </p>
                      <button
                        onClick={() => {
                          setPage("Dispatch planner");
                        }}
                      >
                        Explore today’s plan <ArrowUpRight size={17} />
                      </button>
                    </div>
                    <div className="hero-location">
                      <MapPin size={13} /> One island. Connected.
                      <span>SRI LANKA · 06:30 AM</span>
                    </div>
                    <div className="hero-stats">
                      <span>
                        <b>120</b>outlets connected
                      </span>
                      <i />
                      <span>
                        <b>02</b>distribution hubs
                      </span>
                      <i />
                      <span>
                        <b>03</b>brands, one network
                      </span>
                    </div>
                  </section>
                  <div className="metric-grid">
                    <Metric
                      title="Today's deliveries"
                      value="108"
                      suffix="/ 120"
                      icon={Package}
                      trend="12 awaiting allocation"
                      color="orange"
                      bars={[30, 45, 35, 65, 52, 76, 67, 89, 80, 100]}
                    />
                    <Metric
                      title="On-time performance"
                      value="94.2"
                      suffix="%"
                      icon={Clock3}
                      trend="↑ 2.4% vs. last operating day"
                      color="green"
                      bars={[30, 48, 38, 51, 47, 67, 60, 77, 72, 92]}
                    />
                    <Metric
                      title="Fleet on the move"
                      value="42"
                      suffix="/ 60"
                      icon={Truck}
                      trend="16 refrigerated vehicles in fleet"
                      color="purple"
                      bars={[50, 35, 60, 44, 68, 52, 80, 66, 86, 75]}
                    />
                    <Metric
                      title="Needs your attention"
                      value={String(
                        orders.filter((o) =>
                          ["At risk", "Deferred"].includes(o.status),
                        ).length,
                      ).padStart(2, "0")}
                      icon={AlertTriangle}
                      trend="Review exceptions"
                      color="amber"
                      onClick={() => setModal({ type: "exceptions" })}
                    />
                  </div>
                  <div className="operations-grid">
                    <section className="panel map-panel">
                      <div className="panel-header">
                        <div>
                          <h2>
                            Network in motion{" "}
                            <span className="live-pill">
                              <i />
                              LIVE DEMO
                            </span>
                          </h2>
                          <p>Your routes. One shared view.</p>
                        </div>
                        <select
                          aria-label="Filter map by depot"
                          value={depot}
                          onChange={(e) => setDepot(e.target.value)}
                        >
                          <option>All depots</option>
                          <option>Peliyagoda</option>
                          <option>Kandy</option>
                        </select>
                      </div>
                      <NetworkMap
                        selected={routeIndex}
                        onSelect={setRouteIndex}
                        depot={depot}
                      />
                      <div className="map-footer">
                        <span>
                          <i className="legend-dot orange" />
                          Fresh
                        </span>
                        <span>
                          <i className="legend-dot green" />
                          Style
                        </span>
                        <span>
                          <i className="legend-dot purple" />
                          Tech
                        </span>
                        <span className="map-note">
                          Illustrative route positions
                        </span>
                        <button onClick={() => setModal({ type: "map" })}>
                          <Maximize2 size={14} /> Expand
                        </button>
                      </div>
                    </section>
                    <section className="panel route-panel">
                      <div className="panel-header">
                        <h2>
                          On the road <span className="subtle-count">03</span>
                        </h2>
                        <button
                          className="text-btn"
                          onClick={() => setPage("Fleet & drivers")}
                        >
                          View all <ArrowUpRight size={14} />
                        </button>
                      </div>
                      <div className="route-tabs">
                        {routes.map((r, i) => (
                          <button
                            className={routeIndex === i ? "active" : ""}
                            key={r.id}
                            onClick={() => setRouteIndex(i)}
                          >
                            {r.id}
                          </button>
                        ))}
                      </div>
                      <div className="route-detail">
                        <div className="route-title">
                          <span
                            className="truck-tile"
                            style={{
                              background: activeRoute.color + "18",
                              color: activeRoute.color,
                            }}
                          >
                            <Truck size={24} />
                          </span>
                          <div>
                            <h3>{activeRoute.name}</h3>
                            <p>
                              {activeRoute.vehicle} <span>·</span>{" "}
                              {activeRoute.type}
                            </p>
                          </div>
                        </div>
                        <div className="driver-row">
                          <span className="avatar driver">
                            {activeRoute.initials}
                          </span>
                          <div>
                            <b>{activeRoute.driver}</b>
                            <small>On route since 05:30 AM</small>
                          </div>
                          <Badge>In transit</Badge>
                        </div>
                        <div className="route-progress-label">
                          <span>Delivery progress</span>
                          <b>
                            {activeRoute.done}{" "}
                            <span>/ {activeRoute.stops} stops</span>
                          </b>
                        </div>
                        <div className="stop-progress">
                          {Array.from({ length: activeRoute.stops }, (_, i) => (
                            <span
                              className={i < activeRoute.done ? "done" : ""}
                              key={i}
                            >
                              {i < activeRoute.done ? <Check size={10} /> : ""}
                            </span>
                          ))}
                        </div>
                        <div className="route-facts">
                          <div>
                            <span>Next arrival</span>
                            <b>
                              {activeRoute.eta} <small>AM</small>
                            </b>
                          </div>
                          <div>
                            <span>Load utilization</span>
                            <b>
                              {activeRoute.volume}
                              <small>% volume</small>
                            </b>
                          </div>
                        </div>
                        <div className="route-note">
                          <ShieldCheck size={15} />
                          {routeIndex === 1
                            ? "Mall arrival needs review"
                            : "Temperature & capacity checks passed"}
                        </div>
                        <button
                          className="btn secondary full"
                          onClick={() =>
                            setModal({ type: "route", route: activeRoute })
                          }
                        >
                          View route details <ArrowRight size={15} />
                        </button>
                      </div>
                    </section>
                  </div>
                  <section className="attention-strip">
                    <span className="attention-icon">
                      <Sparkles size={21} />
                    </span>
                    <div>
                      <b>A little foresight goes a long way.</b>
                      <p>
                        {orders.some((o) => o.status === "At risk")
                          ? "One mall delivery may miss its access window. Review it before the driver arrives."
                          : "You’ve reviewed the mall exception. Keep an eye on the remaining route updates."}
                      </p>
                    </div>
                    <button onClick={() => setModal({ type: "exceptions" })}>
                      Review exceptions <ArrowRight size={16} />
                    </button>
                  </section>
                  <JourneyCards onSelect={switchRole} />
                  <OrderTable
                    orders={filtered}
                    search={search}
                    setSearch={setSearch}
                    brand={brand}
                    setBrand={setBrand}
                    tab={tab}
                    setTab={setTab}
                    setModal={setModal}
                    download={download}
                  />
                </>
              )}
              {page === "Orders" && (
                <>
                  <div className="page-stat-strip">
                    <span>
                      <Package size={20} />
                      <b>{orders.length}</b> demonstration orders
                    </span>
                    <span>
                      <CheckCircle2 size={20} />
                      <b>
                        {
                          orders.filter(
                            (o) =>
                              o.status === "Delivered" ||
                              o.status === "Received",
                          ).length
                        }
                      </b>{" "}
                      delivered
                    </span>
                    <select
                      aria-label="Filter order status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      {[
                        "All statuses",
                        "Scheduled",
                        "In transit",
                        "At risk",
                        "Deferred",
                        "Delivered",
                        "Received",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      className="btn primary"
                      onClick={() => setModal({ type: "neworder" })}
                    >
                      <Plus size={16} />
                      New order
                    </button>
                  </div>
                  <OrderTable
                    orders={filtered}
                    {...{
                      search,
                      setSearch,
                      brand,
                      setBrand,
                      tab,
                      setTab,
                      setModal,
                      download,
                    }}
                  />
                </>
              )}
              {page === "Dispatch planner" && (
                <>
                  <div className="planning-banner">
                    <div>
                      <span className="eyebrow">
                        NEXT RUN · MONDAY 28 SEPTEMBER
                      </span>
                      <h2>
                        A considered plan.
                        <br />A confident departure.
                      </h2>
                      <p>
                        Orders closed Sunday at 4 PM. Respect every window,
                        <br />
                        protect the cold chain, and make every deferral
                        explainable.
                      </p>
                      <button
                        className="btn primary"
                        onClick={() => setModal({ type: "plan" })}
                      >
                        {published
                          ? "Review published plan"
                          : "Review & publish plan"}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                    <Image
                      width={1536}
                      height={1024}
                      sizes="(max-width: 700px) 100vw, 800px"
                      className="planner-art"
                      src="/images/dispatch-studio.png"
                      alt=""
                    />
                  </div>
                  <div className="three-grid grid gap-5">
                    {routes.map((r, i) => (
                      <section className="panel fleet-card" key={r.id}>
                        <Badge kind={r.brand.toLowerCase()}>{r.brand}</Badge>
                        <h2>{r.name}</h2>
                        <p>{r.depot} · Trip 1 of 2 maximum</p>
                        <Capacity label="Weight" value={r.weight} />
                        <Capacity label="Volume" value={r.volume} />
                        <Capacity
                          label="Weekly fuel remaining"
                          value={r.fuel}
                        />
                        <button
                          className="btn secondary full"
                          onClick={() => {
                            setRouteIndex(i);
                            setModal({ type: "route", route: r });
                          }}
                        >
                          Inspect route
                          <ArrowRight size={15} />
                        </button>
                      </section>
                    ))}
                  </div>
                  <OrderTable
                    orders={filtered}
                    {...{
                      search,
                      setSearch,
                      brand,
                      setBrand,
                      tab,
                      setTab,
                      setModal,
                      download,
                    }}
                  />
                </>
              )}
              {page === "Fleet & drivers" && (
                <>
                  <div className="page-stat-strip">
                    <span>
                      <Truck size={21} />
                      <b>60</b> vehicles
                    </span>
                    <span>
                      <Snowflake size={21} />
                      <b>16</b> refrigerated
                    </span>
                    <span>
                      <Users size={21} />
                      <b>60</b> assigned drivers
                    </span>
                    <span>
                      <Navigation size={21} />
                      <b>8</b> small vans
                    </span>
                  </div>
                  <div className="three-grid grid gap-5">
                    {routes.map((r) => (
                      <section className="panel fleet-card" key={r.id}>
                        <div className="fleet-illustration">
                          <Truck size={78} strokeWidth={1} />
                          <Badge>In transit</Badge>
                        </div>
                        <h2>{r.vehicle}</h2>
                        <p>
                          {r.type} · {r.depot}
                        </p>
                        <div className="driver-row">
                          <span className="avatar">{r.initials}</span>
                          <b>{r.driver}</b>
                        </div>
                        <Capacity
                          label="Weight capacity used"
                          value={r.weight}
                        />
                        <Capacity
                          label="Volume capacity used"
                          value={r.volume}
                        />
                        <Capacity
                          label="Weekly fuel remaining"
                          value={r.fuel}
                        />
                        <button
                          className="btn secondary full"
                          onClick={() => setModal({ type: "route", route: r })}
                        >
                          Vehicle & route details
                          <ArrowRight size={16} />
                        </button>
                      </section>
                    ))}
                  </div>
                  <div className="info-note">
                    <ShieldCheck size={20} />
                    <p>
                      The network has 12 refrigerated trucks, 40 dry-box trucks,
                      and 8 vans, including 4 refrigerated vans. These three
                      vehicles illustrate the fleet experience; vehicle IDs and
                      capacities await the shared dataset.
                    </p>
                  </div>
                </>
              )}
              {page === "Outlets" && (
                <>
                  <div className="outlet-heading">
                    <label className="search-input">
                      <Search size={17} />
                      <input
                        placeholder="Find an outlet…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <span>
                      Showing {filtered.length} illustrative outlets of the
                      120-outlet network
                    </span>
                  </div>
                  <div className="three-grid grid gap-5">
                    {filtered.map((o) => (
                      <section className="panel outlet-card" key={o.id}>
                        <div className={`outlet-art ${o.brand.toLowerCase()}`}>
                          {React.createElement(
                            o.brand === "Fresh"
                              ? Leaf
                              : o.brand === "Style"
                                ? ShoppingBag
                                : Monitor,
                            { size: 45, strokeWidth: 1.2 },
                          )}
                          <span>waypoint {o.brand.toLowerCase()}</span>
                        </div>
                        <div className="outlet-body">
                          <h3>{o.name}</h3>
                          <p>
                            <MapPin size={14} />
                            {o.district} ·{" "}
                            {o.district === "Kandy"
                              ? "Kandy hub"
                              : "Peliyagoda DC"}
                          </p>
                          <div className="outlet-info">
                            <span>
                              Delivery window<b>{o.window}</b>
                            </span>
                            <span>
                              Access<b>{o.access}</b>
                            </span>
                          </div>
                          <button
                            className="text-btn"
                            onClick={() =>
                              setModal({ type: "order", order: o })
                            }
                          >
                            View delivery
                            <ArrowUpRight size={15} />
                          </button>
                        </div>
                      </section>
                    ))}
                  </div>
                </>
              )}
              {page === "Insights" && <Insights onExport={download} />}
            </>
          ) : (
            <RoleExperience
              {...{
                role,
                user,
                orders,
                loaded,
                setLoaded,
                published,
                offline,
                setOffline,
                queued,
                sync,
                notify,
                setModal,
              }}
            />
          )}
          <footer className="page-footer">
            <span>
              <span className="footer-symbol">w.</span> Thoughtfully connected.
            </span>
            <span>
              Designathon 2026 <i /> Illustrative data · Asia/Colombo
            </span>
            <button
              onClick={() => {
                setTour(true);
                setTourStep(0);
                switchRole("Dispatcher");
              }}
            >
              <Play size={12} /> Take a guided tour
            </button>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {tour && (
        <div className="tour-card">
          <button
            className="tour-close icon-btn"
            aria-label="Close guided tour"
            onClick={() => setTour(false)}
          >
            <X size={17} />
          </button>
          <span className="eyebrow">
            A CONNECTED JOURNEY · {tourStep + 1} / 5
          </span>
          <h3>{tourSteps[tourStep][0]}</h3>
          <p>{tourSteps[tourStep][1]}</p>
          <div className="tour-footer">
            <div className="tour-dots">
              {tourSteps.map((_, i) => (
                <i className={i === tourStep ? "active" : ""} key={i} />
              ))}
            </div>
            <button
              className="btn primary"
              onClick={() => {
                if (tourStep === 4) setTour(false);
                else {
                  setTourStep(tourStep + 1);
                  switchRole(tourSteps[tourStep + 1][2]);
                }
              }}
            >
              {tourStep === 4 ? "Finish tour" : "Next step"}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
      {modal && (
        <Modal
          {...{
            modal,
            setModal,
            orders,
            updateOrder,
            setOrders,
            notify,
            addEvent,
            loaded,
            setLoaded,
            published,
            setPublished,
            offline,
            setQueued,
            queued,
            sync,
          }}
        />
      )}
    </div>
  );
}
