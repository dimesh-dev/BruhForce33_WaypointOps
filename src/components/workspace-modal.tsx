"use client";
import React from "react";
import { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  Clock3,
  Radio,
  ShieldCheck,
  Store,
  Truck,
  Users,
  WifiOff,
  X,
  Route,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Camera,
  Send,
} from "lucide-react";
import type { Order, ModalProps } from "@/lib/types";
import { initialOrders, routes } from "@/lib/demo-data";
import { NetworkMap } from "./network-map";
import { IconButton, Badge, Capacity } from "./ui-primitives";

export function Modal({
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
}: ModalProps) {
  const ref = useRef<HTMLElement>(null);
  const [issueType, setIssueType] = useState(
    modal.type === "shortfall" ? "Missing items" : "Quantity discrepancy",
  );
  const [reason, setReason] = useState("Delivery window cannot be met"),
    [note, setNote] = useState(""),
    [choice, setChoice] = useState("defer"),
    [checks, setChecks] = useState(false),
    [count, setCount] = useState<number | string>(24),
    [temp, setTemp] = useState("Chilled"),
    [receiver, setReceiver] = useState(""),
    [late, setLate] = useState(false),
    [selected, setSelected] = useState("WP-2043"),
    [resolved, setResolved] = useState(false),
    [mapRoute, setMapRoute] = useState(0);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const box = ref.current;
    box?.querySelector<HTMLElement>("button,input,select,textarea")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
      if (e.key === "Tab") {
        const focus = [
          ...(box?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input,select,textarea,[tabindex="0"]',
          ) ?? []),
        ];
        const first = focus[0],
          last = focus.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  const close = () => setModal(null);
  const finish = (msg: string) => {
    notify(msg);
    close();
  };
  const modalRoute = modal.route ?? routes[0];
  const modalOrder = modal.order ?? orders[0];
  const titles: Record<string, string | undefined> = {
    exceptions: "A decision worth explaining.",
    plan: "A plan everyone can follow.",
    route: modal.route?.name,
    order: modal.order?.name,
    pod: "Delivery, with a clear record.",
    shortfall: "Catch it before departure.",
    ready: "Ready for the road.",
    neworder: "Let’s stock tomorrow.",
    receipt: "Close the loop.",
    driverissue: "Keep your team in the loop.",
    storeissue: "Tell us what needs attention.",
    guide: "A better way forward.",
    date: "Your operating day.",
    map: "Your network, in focus.",
  };
  const exception = orders.find((o) => o.id === selected) ?? initialOrders[2];
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`modal ${modal.type === "map" ? "wide" : ""}`}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">
              WAYPOINT ·{" "}
              {modal.type === "exceptions"
                ? "EXCEPTION WORKSPACE"
                : "CONNECTED OPERATIONS"}
            </span>
            <h2 id="modal-title">{titles[modal.type]}</h2>
          </div>
          <IconButton icon={X} label="Close dialog" onClick={close} />
        </div>
        <div className="modal-content">
          {modal.type === "exceptions" && (
            <>
              {resolved ? (
                <div className="success-state">
                  <CheckCircle2 size={46} />
                  <h3>Decision recorded. Everyone informed.</h3>
                  <p>
                    The order now has a reason and next-run notice. The store
                    view and dispatcher queue reflect the same decision.
                  </p>
                  <button className="btn primary" onClick={close}>
                    Back to overview
                  </button>
                </div>
              ) : (
                <>
                  <div className="inline-callout warning">
                    <AlertTriangle size={23} />
                    <div>
                      <b>Scenario: a mall window is closing.</b>
                      <p>
                        The driver’s 10:42 arrival falls 12 minutes outside the
                        mall’s 10:30 access window. Avoid an unsuccessful trip
                        and make the tradeoff visible.
                      </p>
                    </div>
                  </div>
                  <label className="field">
                    Order to review
                    <select
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      {orders
                        .filter(
                          (o) =>
                            ["At risk", "Deferred"].includes(o.status) ||
                            o.id === selected,
                        )
                        .map((o) => (
                          <option value={o.id} key={o.id}>
                            {o.id} · {o.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="exception-order">
                    <Badge>{exception.status}</Badge>
                    <h3>{exception.name}</h3>
                    <p>
                      {exception.amount} · {exception.volume} ·{" "}
                      {exception.access}
                    </p>
                    <div className="outlet-info">
                      <span>
                        Receiving window<b>{exception.window}</b>
                      </span>
                      <span>
                        Planned arrival
                        <b className="late-text">{exception.eta}</b>
                      </span>
                    </div>
                  </div>
                  <div className="decision-options flex gap-3">
                    <button
                      className={choice === "defer" ? "selected" : ""}
                      onClick={() => setChoice("defer")}
                    >
                      <Clock3 size={18} />
                      <b>Defer with a reason</b>
                      <small>Notify store. Preserve decision history.</small>
                    </button>
                    <button
                      className={choice === "review" ? "selected" : ""}
                      onClick={() => setChoice("review")}
                    >
                      <Users size={18} />
                      <b>Request window review</b>
                      <small>Keep at risk until store confirms access.</small>
                    </button>
                  </div>
                  <label className="field">
                    Decision reason
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    >
                      <option>Delivery window cannot be met</option>
                      <option>No compatible refrigerated van</option>
                      <option>Vehicle capacity exhausted</option>
                      <option>Weekly fuel allowance insufficient</option>
                      <option>Loading shortfall requires replanning</option>
                    </select>
                  </label>
                  <label className="field">
                    Context for the store
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Explain what changes and what happens next…"
                    />
                  </label>
                  <div className="fairness-note">
                    <ShieldCheck size={18} />
                    <p>
                      <b>Protect outlets already skipped.</b> Kadawatha was
                      deferred on the previous run. Keep it visible for priority
                      review; a deferral never silently disappears.
                    </p>
                  </div>
                  <button
                    className="btn primary full"
                    onClick={() => {
                      updateOrder(selected, {
                        status: choice === "defer" ? "Deferred" : "At risk",
                        reason: reason + (note ? `. ${note}` : ""),
                        eta: choice === "defer" ? "Next run" : exception.eta,
                      });
                      addEvent(
                        choice === "defer"
                          ? "Deferral recorded"
                          : "Access review requested",
                        `${exception.name}: ${reason}`,
                      );
                      setResolved(true);
                    }}
                  >
                    <Check size={16} />
                    {choice === "defer"
                      ? "Record decision & notify store"
                      : "Request access-window review"}
                  </button>
                </>
              )}
            </>
          )}
          {modal.type === "plan" && (
            <>
              <p className="modal-intro">
                Review the representative Monday plan before sharing it with
                loading teams. These are designed validation states, not an
                allocation engine.
              </p>
              <div className="plan-summary">
                <span>
                  <b>03</b>example routes
                </span>
                <span>
                  <b>02</b>depots
                </span>
                <span>
                  <b>{orders.filter((o) => o.status === "Deferred").length}</b>
                  deferrals recorded
                </span>
              </div>
              <div className="validation-list">
                {[
                  [
                    "Both capacity limits",
                    "Weight and volume stay within each vehicle’s limits.",
                  ],
                  [
                    "Temperature compatibility",
                    "Chilled cargo uses refrigerated vehicles only.",
                  ],
                  [
                    "Outlet access & delivery windows",
                    "Van-only access and fixed mall windows stay visible.",
                  ],
                  [
                    "Home depot",
                    "Routes begin at each vehicle’s assigned depot.",
                  ],
                  [
                    "Trip limit & fuel allowance",
                    "Maximum two daily trips; weekly fuel balance checked.",
                  ],
                  [
                    "Deferral fairness",
                    "Previous skips and decision reasons are kept in view.",
                  ],
                ].map(([title, desc]) => (
                  <div key={title}>
                    <ShieldCheck size={20} />
                    <span>
                      <b>{title}</b>
                      <small>{desc}</small>
                    </span>
                  </div>
                ))}
              </div>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={checks}
                  onChange={(e) => setChecks(e.target.checked)}
                />
                <span>
                  I reviewed the sample constraints and outstanding exceptions.
                </span>
              </label>
              <button
                className="btn primary full"
                disabled={!checks}
                onClick={() => {
                  setPublished(true);
                  addEvent(
                    "Dispatch plan v2 published",
                    "Loader now sees the updated plan and reverse stop sequence.",
                  );
                  finish("Plan v2 published to the loading dock.");
                }}
              >
                <Send size={17} />
                {published
                  ? "Publish updated plan"
                  : "Publish plan to loading teams"}
              </button>
            </>
          )}
          {modal.type === "route" && (
            <>
              <div className="route-modal-top">
                <span className="truck-tile">
                  <Truck size={27} />
                </span>
                <div>
                  <h3>
                    {modalRoute.vehicle} · {modalRoute.type}
                  </h3>
                  <p>
                    {modalRoute.driver} · {modalRoute.depot} · Trip 1 / 2
                  </p>
                </div>
                <Badge>In transit</Badge>
              </div>
              <Capacity label="Weight used" value={modalRoute.weight} />
              <Capacity label="Volume used" value={modalRoute.volume} />
              <Capacity label="Weekly fuel remaining" value={modalRoute.fuel} />
              <div className="inline-callout">
                <ShieldCheck size={21} />
                <div>
                  <b>
                    {modalRoute.brand === "Style"
                      ? "Access window requires review"
                      : "Vehicle compatibility reviewed"}
                  </b>
                  <p>
                    {modalRoute.brand === "Fresh"
                      ? "Refrigerated truck for chilled cargo. Truck-accessible stops. Fresh arrivals planned before 8 AM."
                      : modalRoute.brand === "Style"
                        ? "Garments are volume-limited. City Centre’s fixed mall window closes at 10:30."
                        : "Heavy and fragile goods. Weight capacity and safe unloading access take priority."}
                  </p>
                </div>
              </div>
              <div className="outlet-info">
                <span>
                  Completed
                  <b>
                    {modalRoute.done} / {modalRoute.stops} stops
                  </b>
                </span>
                <span>
                  Next arrival<b>{modalRoute.eta} AM</b>
                </span>
              </div>
              <button
                className="btn secondary full"
                onClick={() => {
                  notify(
                    "Route selected. Full stop navigation is represented in the Driver experience.",
                  );
                  close();
                }}
              >
                Done
                <Check size={15} />
              </button>
            </>
          )}
          {modal.type === "order" && (
            <>
              <div className="order-modal-top">
                <Badge>{modalOrder.status}</Badge>
                <span>{modalOrder.id}</span>
              </div>
              <div className="detail-grid grid grid-cols-2 gap-6">
                {[
                  ["Brand", modalOrder.brand],
                  ["District", modalOrder.district],
                  ["Weight", modalOrder.amount],
                  ["Volume", modalOrder.volume],
                  ["Temperature", modalOrder.temp],
                  ["Access", modalOrder.access],
                  ["Delivery window", modalOrder.window],
                  ["Vehicle", modalOrder.vehicle],
                ].map(([k, v]) => (
                  <div key={k}>
                    <small>{k}</small>
                    <b>{v}</b>
                  </div>
                ))}
              </div>
              {modalOrder.reason && (
                <div className="inline-callout warning">
                  <Clock3 size={19} />
                  <div>
                    <b>Recorded decision</b>
                    <p>{modalOrder.reason}</p>
                  </div>
                </div>
              )}
              <div className="inline-callout">
                <Radio size={19} />
                <div>
                  <b>One shared order record</b>
                  <p>
                    Planning, loading, delivery and store receipt stay
                    connected. This record uses illustrative values.
                  </p>
                </div>
              </div>
              <button className="btn primary full" onClick={close}>
                Got it
                <Check size={16} />
              </button>
            </>
          )}
          {modal.type === "pod" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const proof = `Received by ${receiver}. ${count} of 24 crates. ${note}`;
                if (offline) {
                  setQueued((q) => [...q, { id: modalOrder.id, proof }]);
                  finish(
                    "Proof saved on this device. Ready to sync when connected.",
                  );
                } else {
                  updateOrder(modalOrder.id, { status: "Delivered", proof });
                  addEvent(
                    "Delivery completed",
                    "Colombo 03 can now confirm receipt.",
                  );
                  finish(
                    "Delivery recorded. The store can now confirm receipt.",
                  );
                }
              }}
            >
              <div className={`inline-callout ${offline ? "warning" : ""}`}>
                {offline ? <WifiOff size={22} /> : <ShieldCheck size={22} />}
                <div>
                  <b>
                    {offline ? "Offline capture is ready" : "Proof of delivery"}
                  </b>
                  <p>
                    {offline
                      ? "This record will survive a refresh on this device. Reconnect from the driver screen to synchronize."
                      : "Confirm the quantity and receiving contact while safely stopped."}
                  </p>
                </div>
              </div>
              <label className="field">
                Receiving contact
                <input
                  required
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  placeholder="e.g. Anjali Fernando"
                />
              </label>
              <label className="field">
                Crates delivered (24 expected)
                <input
                  required
                  type="number"
                  min="0"
                  max="24"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </label>
              <label className="field">
                Proof note / discrepancy
                <textarea
                  required
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Condition, receiving location, and any shortage…"
                />
              </label>
              <p className="muted small-copy">
                <Camera size={14} /> This design prototype uses a text proof
                note. Photo and signature capture are documented for the later
                build.
              </p>
              <button className="btn primary full" type="submit">
                {offline ? <WifiOff size={16} /> : <CheckCheck size={16} />}{" "}
                {offline ? "Save proof offline" : "Complete delivery"}
              </button>
            </form>
          )}
          {["shortfall", "driverissue", "storeissue"].includes(modal.type) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addEvent(
                  modal.type === "shortfall"
                    ? "Loading shortfall reported"
                    : modal.type === "driverissue"
                      ? "Driver issue reported"
                      : "Store issue reported",
                  `${issueType}: ${note}`,
                );
                finish("Issue recorded in the dispatcher’s activity inbox.");
              }}
            >
              <p className="modal-intro">
                Give the dispatcher enough context to act. The current delivery
                record is preserved until a new decision is made.
              </p>
              <label className="field">
                Issue type
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                >
                  {(modal.type === "shortfall"
                    ? ["Missing items", "Damaged goods", "Temperature concern"]
                    : [
                        "Quantity discrepancy",
                        "Damaged goods",
                        "Outlet inaccessible",
                        "Delivery delay",
                      ]
                  ).map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                What happened?
                <textarea
                  required
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Include the order, affected quantity, and what needs attention."
                />
              </label>
              <button className="btn primary full" type="submit">
                <Send size={16} />
                Send issue to dispatcher
              </button>
            </form>
          )}
          {modal.type === "ready" && (
            <div className="success-state">
              <CheckCircle2 size={45} />
              <h3>All three loads checked.</h3>
              <p>
                Confirm that the vehicle is ready. Your dispatcher will see the
                departure readiness update.
              </p>
              <button
                className="btn primary"
                onClick={() => {
                  addEvent(
                    "WP-012 ready to depart",
                    "Three example loads checked at Peliyagoda dock 03.",
                  );
                  finish("Vehicle marked ready. Dispatcher informed.");
                }}
              >
                Confirm vehicle readiness
                <Check size={16} />
              </button>
            </div>
          )}
          {modal.type === "neworder" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const id = "WP-" + (2100 + orders.length);
                setOrders((o) => [
                  ...o,
                  {
                    id,
                    name: "Fresh · Colombo 03",
                    brand: "Fresh",
                    district: "Colombo",
                    amount: `${Number(count) * 20} kg`,
                    volume: `${(Number(count) * 0.15).toFixed(1)} m³`,
                    window: "06:00 - 07:30",
                    temp,
                    status: "Scheduled",
                    eta: late ? "Wed 30 Sep" : "Tue 29 Sep",
                    vehicle: "Unassigned",
                    access: "Rear dock",
                  },
                ]);
                addEvent(
                  "Store order confirmed",
                  `${id}: ${count} ${temp.toLowerCase()} crates for ${late ? "Wednesday" : "Tuesday"}.`,
                );
                finish(
                  `Order ${id} confirmed for ${late ? "Wednesday 30 Sep" : "Tuesday 29 Sep"}.`,
                );
              }}
            >
              <p className="modal-intro">
                Fresh · Colombo 03. Place chilled and ambient goods in separate
                orders so the right vehicle can be assigned.
              </p>
              <label className="field">
                Goods type
                <select value={temp} onChange={(e) => setTemp(e.target.value)}>
                  <option>Chilled</option>
                  <option>Ambient</option>
                </select>
              </label>
              <label className="field">
                Number of crates
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={late}
                  onChange={(e) => setLate(e.target.checked)}
                />
                Demonstrate an order placed after 4 PM
              </label>
              <div className={`inline-callout ${late ? "warning" : ""}`}>
                <Clock3 size={20} />
                <div>
                  <b>
                    {late
                      ? "Cutoff passed · Wednesday 30 Sep"
                      : "Before cutoff · Tuesday 29 Sep"}
                  </b>
                  <p>
                    {late
                      ? "The Tuesday queue is closed. This order moves to the next operating run."
                      : "Your order will enter the next-day planning queue. Vehicle assignment follows planning."}
                  </p>
                </div>
              </div>
              <button className="btn primary full" type="submit">
                Confirm order
                <ArrowRight size={16} />
              </button>
            </form>
          )}
          {modal.type === "receipt" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateOrder(modalOrder.id, {
                  status: "Received",
                  receiptNote: note,
                });
                addEvent(
                  "Store receipt confirmed",
                  "Anjali confirmed the Colombo 03 delivery.",
                );
                finish("Receipt confirmed. The delivery loop is complete.");
              }}
            >
              <div className="inline-callout">
                <CheckCheck size={22} />
                <div>
                  <b>Driver proof available</b>
                  <p>
                    {modalOrder.proof ||
                      "24 chilled crates delivered to the receiving counter."}
                  </p>
                </div>
              </div>
              <label className="checkbox-field">
                <input required type="checkbox" />I checked the delivery against
                the order.
              </label>
              <label className="field">
                Receiving note (optional)
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add receiving details…"
                />
              </label>
              <button className="btn primary full" type="submit">
                Confirm receipt
                <Check size={16} />
              </button>
            </form>
          )}
          {modal.type === "guide" && (
            <>
              <p className="modal-intro">
                An interactive Designathon prototype for Waypoint’s delivery
                network. Explore four connected roles with the role switcher in
                the top bar.
              </p>
              <div className="validation-list">
                {[
                  [
                    "01 · Dispatcher",
                    "Inspect routes, review exceptions, and publish the example plan.",
                  ],
                  [
                    "02 · Loader",
                    "Check reverse loading order and report a shortfall.",
                  ],
                  [
                    "03 · Driver",
                    "Simulate a lost connection, record delivery proof, and reconnect.",
                  ],
                  [
                    "04 · Store manager",
                    "Confirm receipt and place a next-day order.",
                  ],
                ].map(([a, b]) => (
                  <div key={a}>
                    <ArrowRight size={18} />
                    <span>
                      <b>{a}</b>
                      <small>{b}</small>
                    </span>
                  </div>
                ))}
              </div>
              <a
                className="btn secondary full"
                href="/design-book.html"
                target="_blank"
                rel="noreferrer"
              >
                Open the Designathon design book <ArrowRight size={16} />
              </a>
              <p className="small-copy muted">
                All operations are local demonstration interactions. Six initial
                orders and three routes are illustrative, not imported
                competition records. Network totals match the booklet. Map
                geometry is schematic. Use the Design Book in docs for personas,
                rationale, assumptions and disclosure.
              </p>
              <button
                className="btn secondary full"
                onClick={() => {
                  [
                    "waypoint-orders-v1",
                    "waypoint-events-v1",
                    "waypoint-loaded-v1",
                    "waypoint-plan-v1",
                    "waypoint-queue-v1",
                    "waypoint-role-v1",
                    "waypoint-offline-v1",
                  ].forEach((k) => localStorage.removeItem(k));
                  location.reload();
                }}
              >
                <RotateCcw size={16} />
                Reset prototype demonstration
              </button>
            </>
          )}
          {modal.type === "date" && (
            <>
              <p className="modal-intro">
                This prototype follows the Monday 28 September run. Waypoint
                operates Monday through Saturday; Sunday is reserved for
                planning the next operating day.
              </p>
              <div className="calendar-demo">
                {[
                  "M",
                  "T",
                  "W",
                  "T",
                  "F",
                  "S",
                  "S",
                  "21",
                  "22",
                  "23",
                  "24",
                  "25",
                  "26",
                  "27",
                  "28",
                  "29",
                  "30",
                  "1",
                  "2",
                  "3",
                  "4",
                ].map((d, i) => (
                  <span
                    className={
                      i === 14
                        ? "selected"
                        : i < 7
                          ? "day-label"
                          : i % 7 === 6
                            ? "closed"
                            : ""
                    }
                    key={i}
                  >
                    {d}
                  </span>
                ))}
              </div>
              <div className="inline-callout">
                <CalendarDays size={20} />
                <div>
                  <b>Monday, 28 September 2026</b>
                  <p>
                    06:30 AM · Asia/Colombo. Fixed scenario time keeps role
                    handoffs consistent for the demo.
                  </p>
                </div>
              </div>
              <button className="btn primary full" onClick={close}>
                Continue with Monday’s run
                <ArrowRight size={16} />
              </button>
            </>
          )}
          {modal.type === "map" && (
            <>
              <NetworkMap selected={mapRoute} onSelect={setMapRoute} large />
              <div className="map-expanded-detail">
                <h3>{routes[mapRoute].name}</h3>
                <p>
                  {routes[mapRoute].driver} · {routes[mapRoute].done}/
                  {routes[mapRoute].stops} stops · next arrival{" "}
                  {routes[mapRoute].eta}
                </p>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
