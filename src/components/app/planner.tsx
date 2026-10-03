"use client";
import { Select } from "@/lib/client/controls";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  PlayCircle,
  Send,
  ShieldCheck,
  Snowflake,
  Truck,
  Undo2,
} from "lucide-react";
import { api, ApiError } from "@/lib/client/api";
import {
  ACCESS,
  colomboTime,
  hhmm,
  longDate,
  shortDate,
} from "@/lib/client/format";
import type { Deferral, QueueOrder, Trip, Violation } from "@/lib/client/types";
import {
  Badge,
  Dialog,
  Empty,
  ErrorList,
  Meter,
  useToast,
} from "@/lib/client/ui";
import type { DispatchProps } from "./dispatcher";

const RULES = [
  ["R1", "One brand & district per trip"],
  ["R2", "Chilled only on reefers"],
  ["R3", "Van-only outlets on vans"],
  ["R4", "Home depot only"],
  ["R5", "Whole orders"],
  ["R6", "Weight & volume limits"],
  ["R7", "≤2 trips · 270 / 480 min budgets"],
  ["W", "Delivery & mall windows"],
  ["F", "Weekly fuel quota"],
  ["A", "Workshop vehicles excluded"],
];

export function Planner({ board, reload }: DispatchProps) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<QueueOrder | null>(null);
  const [failure, setFailure] = useState<{
    title: string;
    items: Violation[];
  } | null>(null);
  const [filter, setFilter] = useState("All");
  const plan = board.active_plan;
  const runDate = board.run.run_date;
  const isDraft = plan?.status === "draft";
  const locked =
    board.trips.some((t) => ["in_transit", "completed"].includes(t.status)) &&
    plan?.status === "published";

  const act = async (
    key: string,
    fn: () => Promise<unknown>,
    success: string,
  ) => {
    setBusy(key);
    setFailure(null);
    try {
      await fn();
      toast(success);
      await reload();
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, "Request failed");
      if (Array.isArray(err.details))
        setFailure({ title: err.message, items: err.details as Violation[] });
      else toast(err.message, "error");
    } finally {
      setBusy(null);
    }
  };

  const byVehicle = useMemo(() => {
    const map = new Map<string, Trip[]>();
    for (const t of board.trips)
      map.set(t.vehicle_id, [...(map.get(t.vehicle_id) ?? []), t]);
    return [...map.entries()];
  }, [board.trips]);
  const shown = byVehicle.filter(
    ([, trips]) =>
      filter === "All" ||
      trips.some((t) => t.brand === filter || t.depot === filter),
  );
  const orderById = new Map(board.orders.map((o) => [o.order_id, o]));

  return (
    <>
      <section className="planner-steps">
        <Step
          n={1}
          done={!!board.run.closed_at}
          title="Close the order queue"
          detail={
            board.run.closed_at
              ? `Closed ${colomboTime(board.run.closed_at)}. New orders join the next run.`
              : `Cutoff ${board.run.cutoff_at ? colomboTime(board.run.cutoff_at) : "16:00"} the day before. Close early to plan now.`
          }
        >
          {!board.run.closed_at && (
            <button
              className="btn secondary"
              disabled={!!busy}
              onClick={() =>
                act(
                  "close",
                  () =>
                    api("/api/dispatch/close", { json: { run_date: runDate } }),
                  "Order queue closed for this run",
                )
              }
            >
              <Lock size={15} /> Close queue
            </button>
          )}
        </Step>
        <Step
          n={2}
          done={!!plan}
          title="Generate the allocation"
          detail="The engine assigns orders to vehicles and trips under every operating constraint, then explains each deferral."
        >
          <button
            className="btn secondary"
            disabled={!!busy || locked}
            onClick={() =>
              act(
                "gen",
                () => api("/api/plans", { json: { run_date: runDate } }),
                "Draft plan generated",
              )
            }
          >
            <PlayCircle size={15} />{" "}
            {busy === "gen"
              ? "Allocating…"
              : plan
                ? "Regenerate draft"
                : "Generate plan"}
          </button>
        </Step>
        <Step
          n={3}
          done={plan?.status === "published"}
          title="Review & publish"
          detail={
            plan
              ? `Plan v${plan.version} · ${plan.status}${plan.published_at ? ` ${colomboTime(plan.published_at)}` : ""}`
              : "Publishing sends the plan to loaders, drivers and stores."
          }
        >
          {isDraft && (
            <button
              className="btn primary"
              disabled={!!busy}
              onClick={() =>
                act(
                  "pub",
                  () =>
                    api(`/api/plans/${plan!.id}/publish`, { method: "POST" }),
                  `Plan v${plan!.version} published to the dock, drivers and stores`,
                )
              }
            >
              <Send size={15} /> Publish v{plan!.version}
            </button>
          )}
        </Step>
      </section>

      {locked && (
        <div className="inline-callout">
          <Truck size={20} />
          <div>
            <b>Vehicles are on the road.</b>
            <p>
              The published plan is locked. Use Issues to handle shortfalls and
              failed deliveries.
            </p>
          </div>
        </div>
      )}
      {failure && <ErrorList title={failure.title} items={failure.items} />}

      <section className="panel rule-panel">
        <div className="panel-header">
          <div>
            <h2>
              <ShieldCheck size={17} /> Constraints checked on every plan and
              every manual change
            </h2>
            <p>A change that breaks any rule is rejected with the reason.</p>
          </div>
        </div>
        <div className="rule-grid">
          {RULES.map(([code, label]) => (
            <span key={code}>
              <code>{code}</code> {label}
            </span>
          ))}
        </div>
      </section>

      {!plan ? (
        <section className="panel">
          <Empty
            icon={<PlayCircle size={28} />}
            title="No plan for this run yet"
          >
            {board.orders.length} orders are waiting. Close the queue and
            generate a plan.
          </Empty>
        </section>
      ) : (
        <>
          <div className="metric-grid summary-grid">
            <SummaryTile
              label="Service rate"
              value={`${plan.summary.service_rate_pct}%`}
              note={`${plan.summary.served} served of ${plan.summary.orders}`}
            />
            <SummaryTile
              label="Deferred"
              value={String(plan.summary.deferred)}
              note={
                plan.summary.binding[0]
                  ? `Mostly ${plan.summary.binding[0]}`
                  : "Nothing deferred"
              }
            />
            <SummaryTile
              label="Trips"
              value={String(plan.summary.trips)}
              note={`${plan.summary.vehicles_used} vehicles · ${plan.summary.reefer_trips} reefer trips`}
            />
            <SummaryTile
              label="Fuel committed"
              value={`${plan.summary.total_fuel_l} L`}
              note={`${plan.summary.total_volume_m3} m³ moved`}
            />
          </div>
          {plan.summary.binding.length > 0 && (
            <div className="inline-callout warning">
              <Snowflake size={20} />
              <div>
                <b>What limited service on this run</b>
                <p>{plan.summary.binding.join(" · ")}</p>
              </div>
            </div>
          )}

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>
                  Deferred orders{" "}
                  <span className="subtle-count">{board.deferrals.length}</span>
                </h2>
                <p>
                  Each deferral moves to the next operating run with its reason;
                  the store sees the same reason.
                </p>
              </div>
            </div>
            {board.deferrals.length === 0 ? (
              <Empty
                icon={<CheckCircle2 size={28} />}
                title="Every order is served"
              />
            ) : (
              <div className="table-scroll">
                <table className="dense">
                  <thead>
                    <tr>
                      <th>ORDER / OUTLET</th>
                      <th>NEEDS</th>
                      <th>REASON</th>
                      <th>TYPE</th>
                      <th>NEXT RUN</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {board.deferrals.map((d: Deferral) => (
                      <tr key={d.id}>
                        <td>
                          <b>{d.outlet_name}</b>
                          <small className="block muted">
                            {d.order_id}
                            {d.deferred_count > 0 && (
                              <span className="skip-flag">
                                {" "}
                                · skipped {d.deferred_count}× already
                              </span>
                            )}
                          </small>
                        </td>
                        <td>
                          {d.temp_requirement === "chilled"
                            ? "Reefer"
                            : "Any temp"}{" "}
                          · {ACCESS[d.parking_constraint]} · {d.volume_m3} m³
                        </td>
                        <td className="reason-cell">{d.reason}</td>
                        <td>
                          <Badge kind={d.unavoidable ? "at-risk" : "scheduled"}>
                            {d.unavoidable
                              ? "Unavoidable"
                              : "Dispatcher choice"}
                          </Badge>
                        </td>
                        <td>{shortDate(d.to_date)}</td>
                        <td>
                          {isDraft && (
                            <button
                              className="btn secondary small-btn"
                              onClick={() =>
                                setEditing(orderById.get(d.order_id) ?? null)
                              }
                            >
                              Try to serve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>
                  Vehicles & trips{" "}
                  <span className="subtle-count">{byVehicle.length}</span>
                </h2>
                <p>
                  Stops are sequenced by closing window. Trip time uses the
                  booklet formula: outbound + inter-stop + handling.
                </p>
              </div>
              <Select
                compact
                ariaLabel="Filter trips"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "All", label: "All trips" },
                  { value: "Fresh", label: "Fresh" },
                  { value: "Style", label: "Style" },
                  { value: "Tech", label: "Tech" },
                  { value: "Peliyagoda", label: "Peliyagoda depot" },
                  { value: "Kandy", label: "Kandy depot" },
                ]}
              />
            </div>
            <div className="vehicle-grid">
              {shown.map(([vehicleId, trips]) => {
                const v = trips[0];
                const fresh = trips
                  .filter((t) => t.brand === "Fresh")
                  .reduce((s, t) => s + t.trip_minutes, 0);
                const day = trips
                  .filter((t) => t.brand !== "Fresh")
                  .reduce((s, t) => s + t.trip_minutes, 0);
                return (
                  <article className="vehicle-card" key={vehicleId}>
                    <header>
                      <span className="truck-tile">
                        <Truck size={20} />
                      </span>
                      <div>
                        <h3>
                          {vehicleId}{" "}
                          {v.vehicle_temp === "reefer" && (
                            <Snowflake size={13} aria-label="refrigerated" />
                          )}
                        </h3>
                        <small>
                          {v.vehicle_type} · {v.vehicle_temp} · {v.depot} ·{" "}
                          {v.driver_name}
                        </small>
                      </div>
                    </header>
                    {fresh > 0 && (
                      <Meter
                        label="Fresh budget (03:30–08:00)"
                        value={fresh}
                        max={270}
                        unit="min"
                      />
                    )}
                    {day > 0 && (
                      <Meter
                        label="Style/Tech budget"
                        value={day}
                        max={480}
                        unit="min"
                      />
                    )}
                    {trips.map((t) => (
                      <div className="trip-block" key={t.id}>
                        <div className="trip-head">
                          <b>
                            Trip {t.trip_no} ·{" "}
                            <span
                              className={`brand-text ${t.brand.toLowerCase()}`}
                            >
                              {t.brand}
                            </span>{" "}
                            · {t.district}
                          </b>
                          <small>
                            {hhmm(t.depart_min)}→{hhmm(t.return_min)} ·{" "}
                            {t.trip_minutes} min · {t.distance_km} km ·{" "}
                            {t.fuel_l} L
                          </small>
                        </div>
                        <Meter
                          label="Volume"
                          value={t.volume_m3}
                          max={t.volume_cap_m3}
                          unit="m³"
                        />
                        <Meter
                          label="Weight"
                          value={t.weight_kg}
                          max={t.weight_cap_kg}
                          unit="kg"
                        />
                        <details className="stop-details-toggle">
                          <summary>
                            {t.stops.length} stop
                            {t.stops.length === 1 ? "" : "s"} · first arrival{" "}
                            {hhmm(t.stops[0]?.arrival_min)}
                          </summary>
                          <ol className="stop-list">
                            {t.stops.map((s) => (
                              <li key={s.id}>
                                <span className="stop-seq">{s.seq}</span>
                                <span>
                                  <b>{s.outlet_name}</b>
                                  <small>
                                    {s.order_id} · {s.temp_requirement} · arrive{" "}
                                    {hhmm(s.arrival_min)} · window{" "}
                                    {hhmm(s.window_open_min)}–
                                    {hhmm(s.window_close_min)}
                                    {s.window_close_min - s.arrival_min <
                                      15 && (
                                      <span className="skip-flag">
                                        {" "}
                                        · tight
                                      </span>
                                    )}
                                  </small>
                                </span>
                                {isDraft && (
                                  <button
                                    className="text-btn"
                                    onClick={() =>
                                      setEditing(
                                        orderById.get(s.order_id) ?? null,
                                      )
                                    }
                                    aria-label={`Change ${s.order_id}`}
                                  >
                                    Change
                                  </button>
                                )}
                              </li>
                            ))}
                          </ol>
                        </details>
                      </div>
                    ))}
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
      {editing && plan && (
        <EditDialog
          order={editing}
          planId={plan.id}
          board={board}
          onClose={() => setEditing(null)}
          onDone={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}
    </>
  );
}

function Step({
  n,
  done,
  title,
  detail,
  children,
}: {
  n: number;
  done: boolean;
  title: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`planner-step ${done ? "done" : ""}`}>
      <span className="step-n">{done ? <CheckCircle2 size={18} /> : n}</span>
      <div>
        <b>{title}</b>
        <p>{detail}</p>
      </div>
      {children}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <section className="metric">
      <div className="metric-top">
        <span>{label}</span>
      </div>
      <div className="metric-middle">
        <span className="metric-value">{value}</span>
      </div>
      <span className="metric-note">{note}</span>
    </section>
  );
}

function EditDialog({
  order,
  planId,
  board,
  onClose,
  onDone,
}: {
  order: QueueOrder;
  planId: number;
  board: DispatchProps["board"];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<"assign" | "defer">("assign");
  const [vehicle, setVehicle] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [violations, setViolations] = useState<Violation[] | null>(null);
  const current = board.trips.find((t) =>
    t.stops.some((s) => s.order_id === order.order_id),
  );
  // Every depot vehicle is offered; the server is the judge. Likely mismatches are labelled and listed last.
  const mismatch = (v: (typeof board.vehicles)[number]) =>
    [
      order.temp_requirement === "chilled" &&
        v.temp !== "reefer" &&
        "not refrigerated",
      order.parking_constraint === "van_only" &&
        v.type !== "van" &&
        "not a van",
      v.status !== "available" && "in workshop",
    ].filter(Boolean) as string[];
  const candidates = board.vehicles
    .filter((v) => v.depot === order.depot)
    .sort(
      (a, b) =>
        mismatch(a).length - mismatch(b).length ||
        a.vehicle_id.localeCompare(b.vehicle_id),
    );
  const compatible = candidates.filter((v) => mismatch(v).length === 0).length;
  const submit = async () => {
    setBusy(true);
    setViolations(null);
    try {
      await api(`/api/plans/${planId}/edit`, {
        json:
          mode === "assign"
            ? { type: "assign", order_id: order.order_id, vehicle_id: vehicle }
            : { type: "defer", order_id: order.order_id, reason },
      });
      toast(
        mode === "assign"
          ? `${order.order_id} moved to ${vehicle}`
          : `${order.order_id} deferred with your reason`,
      );
      await onDone();
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details))
        setViolations(e.details as Violation[]);
      else toast(e instanceof Error ? e.message : "Change failed", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={`Change ${order.order_id}`}
      eyebrow="WAYPOINT · MANUAL DECISION"
      onClose={onClose}
    >
      <p className="modal-intro">
        <b>{order.outlet_name}</b> · {order.brand} {order.temp_requirement} ·{" "}
        {order.volume_m3} m³ · {order.weight_kg} kg ·{" "}
        {ACCESS[order.parking_constraint]} · window{" "}
        {order.mall_window ??
          `${order.window_open_time}–${order.window_close_time}`}
        <br />
        Currently{" "}
        {current
          ? `on ${current.vehicle_id} trip ${current.trip_no}`
          : "deferred"}
        .
        {order.deferred_count > 0 && (
          <span className="skip-flag">
            {" "}
            Skipped {order.deferred_count}× already.
          </span>
        )}
      </p>
      <div className="segmented" role="radiogroup" aria-label="Decision">
        <button
          role="radio"
          aria-checked={mode === "assign"}
          className={mode === "assign" ? "active" : ""}
          onClick={() => setMode("assign")}
        >
          <ArrowRight size={14} /> Assign to vehicle
        </button>
        <button
          role="radio"
          aria-checked={mode === "defer"}
          className={mode === "defer" ? "active" : ""}
          onClick={() => setMode("defer")}
        >
          <Undo2 size={14} /> Defer to next run
        </button>
      </div>
      {mode === "assign" ? (
        <Select
          label={`Vehicle (${compatible} compatible at ${order.depot}; others will be rejected)`}
          placeholder="Choose a vehicle…"
          value={vehicle}
          onChange={setVehicle}
          options={candidates.map((v) => {
            const trips = board.trips.filter(
              (t) => t.vehicle_id === v.vehicle_id,
            );
            const issues = mismatch(v);
            return {
              value: v.vehicle_id,
              label: `${v.vehicle_id} · ${v.type} · ${v.temp}`,
              hint: trips.length
                ? trips
                    .map(
                      (t) =>
                        `Trip ${t.trip_no}: ${t.brand} ${t.district}, ${Math.round((t.volume_m3 / t.volume_cap_m3) * 100)}% full`,
                    )
                    .join(" · ")
                : "Idle today",
              warning: issues.length ? issues.join(", ") : undefined,
            };
          })}
        />
      ) : (
        <label className="field">
          Reason the store will see
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Mall bay closes before the van can reach it; moved to tomorrow's first trip."
          />
        </label>
      )}
      {violations && (
        <ErrorList
          title="This change breaks an operating constraint"
          items={violations}
        />
      )}
      <button
        className="btn primary full"
        disabled={
          busy || (mode === "assign" ? !vehicle : reason.trim().length < 5)
        }
        onClick={submit}
      >
        {busy
          ? "Checking constraints…"
          : mode === "assign"
            ? "Validate & apply"
            : "Defer with reason"}
      </button>
      <p className="muted small-copy">
        Applies to the draft. Publish to send it to the dock. Run:{" "}
        {longDate(board.run.run_date)}.
      </p>
    </Dialog>
  );
}
