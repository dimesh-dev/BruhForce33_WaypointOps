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
  Navigation,
  Mail,
  Lock,
  UserCheck,
} from "lucide-react";
import type { Order, ModalProps } from "@/lib/types";
import { initialOrders, routes } from "@/lib/demo-data";
import { NetworkMap } from "./network-map";
import { IconButton, Badge, Capacity } from "./ui-primitives";
import {
  solveDailyAllocation,
  validateAllocation,
  calculateTripDuration,
  type FeasibilityReport,
  type OrderPlanningInput,
  type OrderAssignment,
} from "@/lib/allocation-engine";
import {
  FLEET_VEHICLES,
  OUTLETS,
  DISTRICT_TRAVEL,
  SERVICE_ALLOWANCES,
} from "@/lib/dataset-reference";

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
    [mapRoute, setMapRoute] = useState(0),
    [planTab, setPlanTab] = useState<"audit" | "trips" | "deferrals">("audit"),
    [solverStrategy, setSolverStrategy] = useState<"priority_first" | "max_utilization" | "balanced">("priority_first"),
    [solvedReport, setSolvedReport] = useState<FeasibilityReport | null>(null),
    [customEmail, setCustomEmail] = useState(""),
    [authError, setAuthError] = useState(""),
    [authLoading, setAuthLoading] = useState(false);
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
    auth: "Seeded Accounts & Role Authentication",
    login: "Seeded Accounts & Role Authentication",
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
          {modal.type === "plan" && (() => {
            const planningInputs: OrderPlanningInput[] = orders.map((o) => {
              const weightNum = parseFloat(o.amount) || 500;
              const volNum = parseFloat(o.volume) || 4.0;
              const isChilled = o.temp.toLowerCase().includes("chill");
              const isVanOnly = o.access.toLowerCase().includes("van");
              const isMall = o.access.toLowerCase().includes("mall");
              const dock_type = isMall ? "mall_bay" : o.access.toLowerCase().includes("street") ? "street" : "rear_dock";
              const depot = ["Kandy", "Matale", "Nuwara Eliya", "Kegalle"].includes(o.district) ? "Kandy" : "Peliyagoda";

              return {
                order_ref: o.id,
                outlet_id: o.id.replace("WP-", "OUT"),
                brand: (o.brand as any) || "Fresh",
                district: o.district || "Colombo",
                depot,
                dock_type,
                parking_constraint: isVanOnly ? "van_only" : isMall ? "mall_dock" : "normal",
                temp_requirement: isChilled ? "chilled" : "ambient",
                order_units: Math.round(weightNum / 15),
                order_weight_kg: weightNum,
                order_volume_m3: volNum,
                deferred_yesterday: o.id === "WP-2045" ? 1 : 0,
                days_since_last_served: o.id === "WP-2045" ? 2 : 1,
                outlet_name: o.name,
              };
            });

            const currentReport = solvedReport ?? solveDailyAllocation(planningInputs, FLEET_VEHICLES, { strategy: solverStrategy }).report;

            return (
              <>
                <p className="modal-intro">
                  Tech-Triathlon 2026 Feasibility Engine & Dispatch Planner. Solves multi-brand, multi-depot fleet allocation with strict adherence to all 7 operating constraints.
                </p>

                {/* Solver Control Bar */}
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3.5 mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-100">
                      Solver: {currentReport.is_valid ? "7/7 Constraints Satisfied" : `${currentReport.violations.length} Violations`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="text-xs py-1 px-2.5 rounded-lg border border-amber-300 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 font-medium"
                      value={solverStrategy}
                      onChange={(e) => {
                        const strat = e.target.value as any;
                        setSolverStrategy(strat);
                        const res = solveDailyAllocation(planningInputs, FLEET_VEHICLES, { strategy: strat });
                        setSolvedReport(res.report);
                        notify(`Solved with ${strat === "priority_first" ? "Fairness & Priority" : "Max Capacity"} strategy`);
                      }}
                    >
                      <option value="priority_first">Priority & Fairness First</option>
                      <option value="max_utilization">Max Capacity Utilization</option>
                      <option value="balanced">Balanced Efficiency</option>
                    </select>
                    <button
                      className="btn secondary text-xs py-1 px-3 bg-amber-600 text-white hover:bg-amber-700 border-none font-medium flex items-center gap-1.5"
                      onClick={() => {
                        const res = solveDailyAllocation(planningInputs, FLEET_VEHICLES, { strategy: solverStrategy });
                        setSolvedReport(res.report);
                        notify("Optimized allocation calculated successfully!");
                      }}
                    >
                      <RotateCcw size={13} /> Re-Solve Engine
                    </button>
                  </div>
                </div>

                {/* Plan Summary Stat Cards */}
                <div className="plan-summary grid grid-cols-4 gap-2 mb-4">
                  <div>
                    <b>{currentReport.summary.served_orders} / {currentReport.summary.total_orders}</b>
                    <small>Orders served ({currentReport.summary.service_rate_pct}%)</small>
                  </div>
                  <div>
                    <b>{currentReport.summary.total_trips}</b>
                    <small>Allocated trips</small>
                  </div>
                  <div>
                    <b>{currentReport.summary.vehicles_used}</b>
                    <small>Vehicles active</small>
                  </div>
                  <div>
                    <b>{currentReport.summary.deferred_orders}</b>
                    <small>Deferred with reasons</small>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-stone-200 dark:border-stone-800 mb-3 gap-2">
                  <button
                    className={`pb-2 px-3 text-xs font-semibold transition-colors border-b-2 ${
                      planTab === "audit"
                        ? "border-amber-600 text-amber-700 dark:text-amber-400 font-bold"
                        : "border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400"
                    }`}
                    onClick={() => setPlanTab("audit")}
                  >
                    Feasibility Audit (7 Rules)
                  </button>
                  <button
                    className={`pb-2 px-3 text-xs font-semibold transition-colors border-b-2 ${
                      planTab === "trips"
                        ? "border-amber-600 text-amber-700 dark:text-amber-400 font-bold"
                        : "border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400"
                    }`}
                    onClick={() => setPlanTab("trips")}
                  >
                    Vehicle Trips & Time ({currentReport.trips.length})
                  </button>
                  <button
                    className={`pb-2 px-3 text-xs font-semibold transition-colors border-b-2 ${
                      planTab === "deferrals"
                        ? "border-amber-600 text-amber-700 dark:text-amber-400 font-bold"
                        : "border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400"
                    }`}
                    onClick={() => setPlanTab("deferrals")}
                  >
                    Deferral Log ({currentReport.summary.deferred_orders})
                  </button>
                </div>

                {/* Tab 1: 7-Rule Feasibility Audit */}
                {planTab === "audit" && (
                  <div className="validation-list space-y-2 max-h-64 overflow-y-auto pr-1">
                    {[
                      [
                        "Rule 1: Brand & District Isolation",
                        "All orders sharing vehicle & trip must strictly belong to the same brand and district.",
                      ],
                      [
                        "Rule 2: Refrigeration Capability",
                        "Chilled orders strictly allocated to reefer vehicles (12 trucks + 4 vans in fleet).",
                      ],
                      [
                        "Rule 3: Vehicle Access Constraints",
                        "Outlets marked van_only strictly allocated to vans (no truck access).",
                      ],
                      [
                        "Rule 4: Home Depot Enforcement",
                        "Vehicles only serve outlets assigned to their home depot (Peliyagoda or Kandy).",
                      ],
                      [
                        "Rule 5: Whole Orders (No Splitting)",
                        "Each served order is assigned to exactly one vehicle and one trip.",
                      ],
                      [
                        "Rule 6: Capacity Limits (Weight & Volume)",
                        "Trip total weight <= weight_cap_kg and total volume <= volume_cap_m3.",
                      ],
                      [
                        "Rule 7: Trips & Time Budgets",
                        "Max 2 trips per vehicle. Fresh <= 270 min morning window; Style/Tech <= 480 min trading day.",
                      ],
                    ].map(([title, desc], idx) => {
                      const ruleNum = idx + 1;
                      const hasViolation = currentReport.violations.some((v) => v.rule_number === ruleNum);
                      return (
                        <div key={title} className="flex items-start gap-3 p-2 rounded-lg bg-stone-50 dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800">
                          {hasViolation ? (
                            <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <b className="text-xs text-stone-900 dark:text-stone-100 font-semibold">{title}</b>
                            <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-tight mt-0.5">{desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Tab 2: Vehicle Trips & Time */}
                {planTab === "trips" && (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {currentReport.trips.map((t, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-bold text-stone-900 dark:text-stone-100">
                            {t.vehicle_id} · Trip {t.trip_id} ({t.brand} · {t.district})
                          </span>
                          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                            {t.total_trip_min} min (Outbound: {t.outbound_travel_min}m, Stops: {t.inter_stop_travel_min}m, Handling: {t.handling_time_min}m)
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[11px] text-stone-600 dark:text-stone-400 mb-1.5">
                          <div>Stops: <b>{t.order_count}</b></div>
                          <div>Weight: <b>{t.total_weight_kg} kg ({t.weight_utilization_pct}%)</b></div>
                          <div>Volume: <b>{t.total_volume_m3} m³ ({t.volume_utilization_pct}%)</b></div>
                        </div>
                        <div className="flex gap-1.5">
                          <div className="h-1.5 flex-1 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-600 rounded-full" style={{ width: `${Math.min(100, t.weight_utilization_pct)}%` }} />
                          </div>
                          <div className="h-1.5 flex-1 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.min(100, t.volume_utilization_pct)}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab 3: Deferral Log */}
                {planTab === "deferrals" && (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {orders.filter((o) => o.status === "Deferred" || o.id === "WP-2045").map((o) => (
                      <div key={o.id} className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-amber-50/40 dark:bg-amber-950/20">
                        <div className="flex items-center justify-between text-xs font-bold mb-1">
                          <span>{o.id}: {o.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-semibold uppercase">Deferred</span>
                        </div>
                        <p className="text-[11px] text-stone-700 dark:text-stone-300">
                          <b>Reason:</b> {o.reason || "Refrigerated van capacity exhausted in Gampaha district for morning window."}
                        </p>
                        <small className="text-[10px] text-stone-500 block mt-1">
                          Protected Fairness Rule: Order marked for elevated priority on next dispatch run.
                        </small>
                      </div>
                    ))}
                  </div>
                )}

                <label className="checkbox-field mt-3">
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
                  className="btn primary full mt-2"
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
            );
          })()}
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
                  fetch("/api/driver", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      order_id: modalOrder.id,
                      driver_name: "Kasun Perera",
                      recipient_name: receiver,
                      items_received: Number(count),
                      proof_notes: note,
                    }),
                  }).catch(() => {});
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

                if (modal.type === "shortfall") {
                  fetch("/api/loading", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      order_id: modalOrder.id,
                      vehicle_id: "VEH001",
                      trip_id: 1,
                      shortfall_type: issueType === "Missing items" ? "missing" : "damaged",
                      shortfall_notes: note,
                    }),
                  }).catch(() => {});
                }

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
                const weight = Number(count) * 20;
                const volume = (Number(count) * 0.15).toFixed(1);

                setOrders((o) => [
                  ...o,
                  {
                    id,
                    name: "Fresh · Colombo 03",
                    brand: "Fresh",
                    district: "Colombo",
                    amount: `${weight} kg`,
                    volume: `${volume} m³`,
                    window: "06:00 - 07:30",
                    temp,
                    status: "Scheduled",
                    eta: late ? "Wed 30 Sep" : "Tue 29 Sep",
                    vehicle: "Unassigned",
                    access: "Rear dock",
                  },
                ]);

                fetch("/api/orders", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    order_ref: id,
                    outlet_id: "OUT001",
                    brand: "Fresh",
                    district: "Colombo",
                    depot: "Peliyagoda",
                    order_weight_kg: weight,
                    order_volume_m3: parseFloat(volume),
                    temp_requirement: temp.toLowerCase(),
                    force_after_cutoff: late,
                  }),
                }).catch(() => {});

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

                fetch("/api/orders", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    order_id: modalOrder.id,
                    dispatch_status: "received",
                    receipt_confirmed: true,
                    receipt_notes: note,
                  }),
                }).catch(() => {});

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
          {(modal.type === "auth" || modal.type === "login") && (
            <>
              <p className="modal-intro">
                Waypoint is equipped with four official role accounts. Click any account below to switch roles and authenticate via the backend API, or enter credentials manually.
              </p>

              <div style={{ display: "grid", gap: "10px", margin: "16px 0" }}>
                {[
                  {
                    role: "Dispatcher" as const,
                    email: "dispatcher@waypoint.lk",
                    alias: "amaya@waypoint.lk",
                    name: "Amaya Jayasinghe",
                    title: "Network Dispatcher & Planning Lead",
                    location: "Peliyagoda Central Planning Office",
                    icon: Route,
                  },
                  {
                    role: "Loader" as const,
                    email: "loader@waypoint.lk",
                    alias: "ruwan@waypoint.lk",
                    name: "Ruwan Kumara",
                    title: "Loading Dock Supervisor",
                    location: "Peliyagoda Loading Dock 03",
                    icon: Truck,
                  },
                  {
                    role: "Driver" as const,
                    email: "driver@waypoint.lk",
                    alias: "kasun@waypoint.lk",
                    name: "Kasun Perera",
                    title: "Senior Fleet Delivery Driver",
                    location: "Vehicle VEH001 · Route R-012 (Colombo)",
                    icon: Navigation,
                  },
                  {
                    role: "Store manager" as const,
                    email: "storemanager@waypoint.lk",
                    alias: "anjali@waypoint.lk",
                    name: "Anjali Fernando",
                    title: "Supermarket Store Manager",
                    location: "Waypoint Fresh · Colombo 03 (OUT001)",
                    icon: Store,
                  },
                ].map((acc) => (
                  <div
                    key={acc.email}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--line, #e7e9ee)",
                      background: "var(--paper, #fff)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          background: "var(--line, #eef2f6)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--accent-dark, #526b95)",
                        }}
                      >
                        <acc.icon size={18} />
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong>{acc.name}</strong>
                          <span
                            style={{
                              fontSize: "11px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "rgba(104, 127, 166, 0.15)",
                              color: "var(--accent-dark, #526b95)",
                              fontWeight: 600,
                            }}
                          >
                            {acc.role}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--muted, #7b8491)", fontFamily: "monospace" }}>
                          {acc.email} <span style={{ opacity: 0.65 }}>({acc.alias})</span>
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--muted, #7b8491)", marginTop: "2px" }}>
                          {acc.location}
                        </div>
                      </div>
                    </div>
                    <button
                      className="btn secondary"
                      style={{ fontSize: "12px", padding: "6px 12px" }}
                      onClick={async () => {
                        setAuthLoading(true);
                        try {
                          const res = await fetch("/api/auth", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email: acc.email, role: acc.role }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            localStorage.setItem("waypoint-role-v1", JSON.stringify(acc.role));
                            notify(`Authenticated as ${acc.name} (${acc.role})`);
                            location.reload();
                          } else {
                            setAuthError(data.error || "Authentication failed");
                          }
                        } catch {
                          localStorage.setItem("waypoint-role-v1", JSON.stringify(acc.role));
                          notify(`Switched to ${acc.role}`);
                          location.reload();
                        } finally {
                          setAuthLoading(false);
                        }
                      }}
                    >
                      <UserCheck size={14} /> Sign In
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid var(--line, #e7e9ee)", paddingTop: "14px", marginTop: "14px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                  Custom Email Authentication
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="email"
                    placeholder="e.g. dispatcher@waypoint.lk"
                    value={customEmail}
                    onChange={(e) => {
                      setCustomEmail(e.target.value);
                      setAuthError("");
                    }}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--line, #e7e9ee)",
                      fontSize: "13px",
                    }}
                  />
                  <button
                    className="btn primary"
                    disabled={!customEmail.trim() || authLoading}
                    onClick={async () => {
                      setAuthLoading(true);
                      setAuthError("");
                      try {
                        const res = await fetch("/api/auth", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email: customEmail.trim() }),
                        });
                        const data = await res.json();
                        if (data.success && data.user) {
                          localStorage.setItem("waypoint-role-v1", JSON.stringify(data.user.role));
                          notify(`Authenticated as ${data.user.name} (${data.user.role})`);
                          location.reload();
                        } else {
                          setAuthError(data.error || "Invalid credentials");
                        }
                      } catch {
                        setAuthError("Network error during authentication");
                      } finally {
                        setAuthLoading(false);
                      }
                    }}
                  >
                    {authLoading ? "Verifying..." : "Authenticate"}
                  </button>
                </div>
                {authError && (
                  <p style={{ color: "#e11d48", fontSize: "12px", marginTop: "6px" }}>
                    ⚠ {authError}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
