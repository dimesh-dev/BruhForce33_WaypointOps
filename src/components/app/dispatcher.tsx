"use client";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Package,
  RotateCcw,
  Snowflake,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { api, ApiError, useApi } from "@/lib/client/api";
import {
  colomboTime,
  hhmm,
  longDate,
  pct,
  TRIP_STATUS,
} from "@/lib/client/format";
import type { Board, Me } from "@/lib/client/types";
import { Badge, Dialog, Empty, useToast } from "@/lib/client/ui";
import { Planner } from "./planner";
import { OrdersPage, FleetPage, OutletsPage } from "./dispatch-tables";
import { CapacityPage } from "./capacity";
import { IssuesPage } from "./issues";

export const DISPATCH_PAGES = [
  "Overview",
  "Dispatch planner",
  "Orders",
  "Fleet & drivers",
  "Outlets",
  "Capacity",
  "Issues",
] as const;
export type DispatchPage = (typeof DISPATCH_PAGES)[number];

const SUBTITLE: Record<DispatchPage, string> = {
  Overview: "A clear view of every delivery. A better start to the day.",
  "Dispatch planner":
    "Turn competing priorities into a plan everyone can follow.",
  Orders: "Every order, from the first request to the final receipt.",
  "Fleet & drivers": "The right vehicle. The right load. Ready for the road.",
  Outlets: "One connected network, with every local detail in view.",
  Capacity: "Make room for what’s coming next.",
  Issues:
    "Problems reported from the dock, the road and the store, in one place.",
};

export interface DispatchProps {
  board: Board;
  me: Me;
  reload: () => Promise<void>;
  go: (p: DispatchPage) => void;
}

export function DispatcherWorkspace({
  page,
  go,
  me,
  onChange,
}: {
  page: DispatchPage;
  go: (p: DispatchPage) => void;
  me: Me;
  onChange: () => void;
}) {
  const [date, setDate] = useState(me.run_date);
  const { data, error, reload } = useApi<Board>(
    `/api/dispatch?date=${date}`,
    15000,
  );
  const [resetOpen, setResetOpen] = useState(false);
  const refresh = async () => {
    await reload();
    onChange();
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="tiny-line" /> RUN · {longDate(date).toUpperCase()}
          </div>
          <h1>
            {page === "Overview"
              ? `Good ${me.clock.local_minutes < 720 ? "morning" : "afternoon"}, ${me.user.display_name.split(" ")[0]}`
              : page}
          </h1>
          <p>{SUBTITLE[page]}</p>
        </div>
        <div className="heading-actions">
          <label className="date-btn btn secondary">
            <CalendarDays size={15} />
            <span className="sr-only">Run date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label="Run date"
            />
          </label>
          <button
            className="btn secondary"
            onClick={() => setResetOpen(true)}
            title="Restore the seeded walkthrough day"
          >
            <RotateCcw size={15} /> Reset demo
          </button>
          <button
            className="btn primary"
            onClick={() => go("Dispatch planner")}
          >
            Plan this run <ArrowRight size={16} />
          </button>
        </div>
      </div>
      {error && !data && (
        <div className="inline-callout warning">{error.message}</div>
      )}
      {!data ? (
        <div className="loading-state">Loading the run…</div>
      ) : page === "Overview" ? (
        <Overview board={data} me={me} reload={refresh} go={go} />
      ) : page === "Dispatch planner" ? (
        <Planner board={data} me={me} reload={refresh} go={go} />
      ) : page === "Orders" ? (
        <OrdersPage board={data} me={me} reload={refresh} go={go} />
      ) : page === "Fleet & drivers" ? (
        <FleetPage board={data} me={me} reload={refresh} go={go} />
      ) : page === "Outlets" ? (
        <OutletsPage board={data} me={me} reload={refresh} go={go} />
      ) : page === "Capacity" ? (
        <CapacityPage runDate={date} />
      ) : (
        <IssuesPage board={data} me={me} reload={refresh} go={go} />
      )}
      {resetOpen && <ResetDialog onClose={() => setResetOpen(false)} />}
    </>
  );
}

function ResetDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog title="Restore the walkthrough day?" onClose={onClose}>
      <p className="modal-intro">
        This replaces every order, plan, delivery record and issue with the
        seeded scenario and restarts the scenario clock. Accounts keep their
        passwords. Use it to repeat the judge walkthrough.
      </p>
      <button
        className="btn primary full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api("/api/admin/reset", { method: "POST" });
            window.location.reload();
          } catch (e) {
            toast(e instanceof ApiError ? e.message : "Reset failed", "error");
            setBusy(false);
          }
        }}
      >
        <RotateCcw size={16} /> {busy ? "Restoring…" : "Reset to seeded day"}
      </button>
    </Dialog>
  );
}

function Overview({ board, go }: DispatchProps) {
  const liveTrips =
    board.active_plan?.status === "published" ? board.trips : [];
  const stops = liveTrips.flatMap((t) => t.stops);
  const delivered = stops.filter((s) => s.status === "delivered").length;
  const openIssues = board.issues.filter((i) => i.status === "open");
  const onRoad = liveTrips.filter((t) => t.status === "in_transit").length;
  const queue = board.orders.filter((o) => o.run_date === board.run.run_date);
  const chilled = queue.filter((o) => o.temp_requirement === "chilled");
  const reefers = board.vehicles.filter((v) => v.temp === "reefer");
  const step = !board.run.closed_at
    ? 0
    : !board.active_plan
      ? 1
      : board.active_plan.status === "draft"
        ? 2
        : stops.length && delivered === stops.length
          ? 4
          : 3;

  return (
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
            <span className="status-light" />{" "}
            {board.run.dow_name?.toUpperCase()} RUN
            {board.run.festival ? ` · ${board.run.festival.toUpperCase()}` : ""}
            {board.run.is_payday ? " · PAYDAY" : ""}
            {Number(board.run.festival_ramp) > 0 && !board.run.festival
              ? " · FESTIVAL BUILD-UP"
              : ""}
          </span>
          <h2>
            Big picture.
            <br />
            <em>Every little delivery.</em>
          </h2>
          <p>
            {queue.length} orders from{" "}
            {new Set(queue.map((o) => o.outlet_id)).size} outlets.{" "}
            {board.run.closed_at
              ? `Queue closed ${colomboTime(board.run.closed_at)}.`
              : board.run.cutoff_at
                ? `Orders close ${colomboTime(board.run.cutoff_at)} the day before.`
                : ""}
          </p>
          <button onClick={() => go("Dispatch planner")}>
            {
              [
                "Close the order queue",
                "Generate the plan",
                "Review & publish the plan",
                "Follow the run",
                "Run complete",
              ][step]
            }{" "}
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="hero-stats">
          <span>
            <b>{queue.length}</b>orders queued
          </span>
          <i />
          <span>
            <b>{chilled.length}</b>chilled orders
          </span>
          <i />
          <span>
            <b>
              {reefers.filter((v) => v.status === "available").length}/
              {reefers.length}
            </b>
            reefers available
          </span>
        </div>
      </section>

      <ol className="run-steps" aria-label="Run progress">
        {[
          "Orders closed",
          "Plan generated",
          "Plan published",
          "Loading & delivery",
          "Receipts",
        ].map((s, i) => (
          <li
            key={s}
            className={i < step ? "done" : i === step ? "current" : ""}
          >
            <span>{i < step ? <CheckCircle2 size={14} /> : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      <div className="metric-grid">
        <Metric
          title="Orders this run"
          value={String(board.active_plan?.summary.orders ?? queue.length)}
          suffix=""
          icon={Package}
          note={
            board.active_plan
              ? `${board.active_plan.summary.served} served · ${board.active_plan.summary.deferred} deferred`
              : "Not planned yet"
          }
          color="orange"
        />
        <Metric
          title="Delivered"
          value={String(delivered)}
          suffix={`/ ${stops.length || "—"}`}
          icon={CheckCircle2}
          note={
            stops.length
              ? `${pct(delivered, stops.length)}% of planned stops`
              : "Publish a plan to start"
          }
          color="green"
        />
        <Metric
          title="Vehicles on the road"
          value={String(onRoad)}
          suffix={`/ ${new Set(liveTrips.map((t) => t.vehicle_id)).size || "—"}`}
          icon={Truck}
          note={`${liveTrips.filter((t) => t.status === "ready").length} ready at the dock`}
          color="purple"
        />
        <Metric
          title="Needs your attention"
          value={String(openIssues.length).padStart(2, "0")}
          icon={AlertTriangle}
          note="Open issues"
          color="amber"
          onClick={() => go("Issues")}
        />
      </div>

      <div className="operations-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>
                Network in motion{" "}
                <span className="live-pill">
                  <i />
                  LIVE
                </span>
              </h2>
              <p>Every published trip, as the dock and drivers report it.</p>
            </div>
          </div>
          {liveTrips.length === 0 ? (
            <Empty icon={<Truck size={28} />} title="No published plan yet">
              Trips appear here once you publish the plan.
            </Empty>
          ) : (
            <div className="table-scroll">
              <table className="dense">
                <thead>
                  <tr>
                    <th>VEHICLE / TRIP</th>
                    <th>ROUTE</th>
                    <th>DEPART</th>
                    <th>PROGRESS</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {liveTrips.map((t) => {
                    const done = t.stops.filter(
                      (s) => s.status === "delivered" || s.status === "failed",
                    ).length;
                    const failed = t.stops.filter(
                      (s) => s.status === "failed",
                    ).length;
                    return (
                      <tr key={t.id}>
                        <td>
                          <b>{t.vehicle_id}</b> · T{t.trip_no}
                          <small className="block muted">{t.driver_name}</small>
                        </td>
                        <td>
                          <span
                            className={`brand-text ${t.brand.toLowerCase()}`}
                          >
                            {t.brand}
                          </span>{" "}
                          · {t.district}
                          {t.vehicle_temp === "reefer" && (
                            <Snowflake
                              size={11}
                              className="inline-icon"
                              aria-label="refrigerated"
                            />
                          )}
                        </td>
                        <td>{hhmm(t.depart_min)}</td>
                        <td>
                          <div
                            className="mini-progress"
                            aria-label={`${done} of ${t.stops.length} stops done`}
                          >
                            {t.stops.map((s) => (
                              <i key={s.id} className={s.status} />
                            ))}
                          </div>
                          <small className="muted">
                            {done}/{t.stops.length}
                            {failed ? ` · ${failed} failed` : ""}
                          </small>
                        </td>
                        <td>
                          <Badge
                            kind={TRIP_STATUS[t.status]?.kind ?? "scheduled"}
                          >
                            {TRIP_STATUS[t.status]?.label ?? t.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="panel route-panel">
          <div className="panel-header">
            <h2>
              Needs attention{" "}
              <span className="subtle-count">{openIssues.length}</span>
            </h2>
            <button className="text-btn" onClick={() => go("Issues")}>
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div className="attention-list">
            {openIssues.slice(0, 5).map((i) => (
              <button key={i.id} onClick={() => go("Issues")}>
                <AlertTriangle size={16} />
                <span>
                  <b>{i.category}</b>
                  <small>
                    {i.order_id ?? ""} {i.vehicle_id ? `· ${i.vehicle_id}` : ""}{" "}
                    {i.outlet_name ? `· ${i.outlet_name}` : ""}
                  </small>
                </span>
              </button>
            ))}
            {openIssues.length === 0 && (
              <p className="muted">
                No open issues from the dock, the road or stores.
              </p>
            )}
          </div>
          <h3 className="sub-heading">
            <Clock3 size={15} /> Outlets skipped on earlier runs
          </h3>
          <div className="attention-list">
            {board.skipped.slice(0, 6).map((s) => (
              <div key={s.outlet_id} className="skipped-row">
                <b>{s.outlet_name}</b>
                <small>
                  Skipped {s.times}× · last {longDate(s.last_skipped)}
                </small>
              </div>
            ))}
            {board.skipped.length === 0 && (
              <p className="muted">No outlet has been skipped recently.</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function Metric({
  title,
  value,
  suffix,
  icon: Icon,
  note,
  color,
  onClick,
}: {
  title: string;
  value: string;
  suffix?: string;
  icon: typeof Package;
  note: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <section className={`metric ${color}`}>
      <div className="metric-top">
        <span>{title}</span>
        <Icon size={17} />
      </div>
      <div className="metric-middle">
        <span className="metric-value">
          {value}
          <small>{suffix}</small>
        </span>
      </div>
      {onClick ? (
        <button className="metric-note text-btn" onClick={onClick}>
          {note} <ArrowRight size={13} />
        </button>
      ) : (
        <span className="metric-note">{note}</span>
      )}
    </section>
  );
}
