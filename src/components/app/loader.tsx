"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  Layers,
  Snowflake,
  Truck,
} from "lucide-react";
import { api, ApiError, useApi } from "@/lib/client/api";
import {
  colomboTime,
  DOCK,
  hhmm,
  longDate,
  TRIP_STATUS,
} from "@/lib/client/format";
import type { Issue, Me, Trip } from "@/lib/client/types";
import { NumberField, Select } from "@/lib/client/controls";
import { Badge, Dialog, Empty, useToast } from "@/lib/client/ui";

interface LoaderData {
  run_date: string;
  plan: { id: number; version: number; published_at: string } | null;
  trips: Trip[];
  issues: Issue[];
}

export function LoaderView({ me }: { me: Me }) {
  const { data, reload, error } = useApi<LoaderData>("/api/loader", 10000);
  const [tripId, setTripId] = useState<number | null>(null);
  const version = useRef<number | null>(null);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    if (!data?.plan) return;
    if (version.current !== null && version.current !== data.plan.version)
      setChanged(true);
    version.current = data.plan.version;
  }, [data?.plan]);
  const trip = data?.trips.find((t) => t.id === tripId) ?? null;

  return (
    <div className="role-experience">
      <div className="page-heading role-illustrated-heading">
        <Image
          width={1536}
          height={1024}
          sizes="(max-width: 700px) 100vw, 800px"
          className="role-heading-art"
          src="/images/loading-dock.png"
          alt=""
        />
        <div>
          <div className="eyebrow">
            {me.user.depot?.toUpperCase()} DOCK ·{" "}
            {data ? longDate(data.run_date).toUpperCase() : ""}
          </div>
          <h1>A good journey starts here.</h1>
          <p>The right goods, in the right order, before the wheels turn.</p>
        </div>
        {data?.plan && (
          <Badge kind="delivered">Plan v{data.plan.version}</Badge>
        )}
      </div>
      {error && !data && (
        <div className="inline-callout warning">{error.message}</div>
      )}
      {changed && (
        <div className="inline-callout warning" role="alert">
          <AlertTriangle size={20} />
          <div>
            <b>The dispatcher published a new plan version.</b>
            <p>
              Check marks belong to the version they were made on. Re-check any
              vehicle that changed.
            </p>
          </div>
          <button
            className="btn secondary small-btn"
            onClick={() => setChanged(false)}
          >
            Got it
          </button>
        </div>
      )}
      {!data ? (
        <div className="loading-state">Loading the dock list…</div>
      ) : !data.plan ? (
        <section className="panel">
          <Empty icon={<Truck size={28} />} title="No published plan yet">
            The loading list appears as soon as the dispatcher publishes the
            plan for {longDate(data.run_date)}.
          </Empty>
        </section>
      ) : trip ? (
        <TripLoading
          trip={trip}
          issues={data.issues.filter((i) => i.trip_id === trip.id)}
          back={() => setTripId(null)}
          reload={reload}
        />
      ) : (
        <section className="panel task-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">
                DEPARTURES · PUBLISHED {colomboTime(data.plan.published_at)}
              </span>
              <h2>{data.trips.length} trips to load</h2>
            </div>
          </div>
          <div className="trip-pick-list">
            {data.trips.map((t) => {
              const loaded = t.stops.filter((s) => s.loaded).length;
              return (
                <button
                  key={t.id}
                  className="trip-pick"
                  onClick={() => setTripId(t.id)}
                >
                  <span className="truck-tile">
                    {t.vehicle_temp === "reefer" ? (
                      <Snowflake size={20} />
                    ) : (
                      <Truck size={20} />
                    )}
                  </span>
                  <span>
                    <b>
                      {t.vehicle_id} · trip {t.trip_no}
                    </b>
                    <small>
                      Departs {hhmm(t.depart_min)} · {t.brand} {t.district} ·{" "}
                      {t.stops.length} stops · {loaded}/{t.stops.length} loaded
                    </small>
                  </span>
                  <Badge kind={TRIP_STATUS[t.status]?.kind ?? "scheduled"}>
                    {TRIP_STATUS[t.status]?.label ?? t.status}
                  </Badge>
                  <ArrowRight size={16} />
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function TripLoading({
  trip,
  issues,
  back,
  reload,
}: {
  trip: Trip;
  issues: Issue[];
  back: () => void;
  reload: () => Promise<void>;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<number | "ready" | null>(null);
  const [shortfall, setShortfall] = useState(false);
  const editable = ["planned", "loading", "blocked"].includes(trip.status);
  const loadOrder = [...trip.stops].sort((a, b) => b.seq - a.seq);
  const loaded = trip.stops.filter((s) => s.loaded).length;
  const openShortfalls = issues.filter((i) => i.status === "open");

  const toggle = async (stopId: number, value: boolean) => {
    setBusy(stopId);
    try {
      await api(`/api/loader/stops/${stopId}`, { json: { loaded: value } });
      await reload();
    } catch (e) {
      toast(
        e instanceof ApiError
          ? e.message
          : "Could not save. Check the dock connection.",
        "error",
      );
    } finally {
      setBusy(null);
    }
  };
  const ready = async () => {
    setBusy("ready");
    try {
      await api(`/api/loader/trips/${trip.id}/ready`, { method: "POST" });
      toast(
        `${trip.vehicle_id} released. The driver and dispatcher can see it.`,
      );
      await reload();
    } catch (e) {
      toast(
        e instanceof ApiError ? e.message : "Could not mark ready",
        "error",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="role-columns">
      <section className="panel task-panel">
        <button className="text-btn back-link" onClick={back}>
          <ArrowLeft size={14} /> All departures
        </button>
        <div className="panel-header">
          <div>
            <span className="eyebrow">
              DEPARTS {hhmm(trip.depart_min)} · PLAN V{trip.version}
            </span>
            <h2>
              {trip.brand} · {trip.district}
            </h2>
          </div>
          <Badge kind={TRIP_STATUS[trip.status]?.kind ?? "scheduled"}>
            {TRIP_STATUS[trip.status]?.label}
          </Badge>
        </div>
        <div className="load-summary">
          <span>
            {trip.vehicle_id}{" "}
            <b>
              {trip.vehicle_temp === "reefer" ? "Refrigerated" : "Dry"}{" "}
              {trip.vehicle_type}
            </b>
          </span>
          <span>
            Driver <b>{trip.driver_name}</b>
          </span>
          <span>
            Load{" "}
            <b>
              {trip.volume_m3}/{trip.volume_cap_m3} m³ · {trip.weight_kg}/
              {trip.weight_cap_kg} kg
            </b>
          </span>
        </div>
        <div className="inline-callout">
          <Layers size={20} />
          <div>
            <b>Last stop in. First stop out.</b>
            <p>
              Load from the top of this list so the first delivery stays at the
              doors.
            </p>
          </div>
        </div>
        {openShortfalls.map((i) => (
          <div className="inline-callout warning" key={i.id} role="alert">
            <AlertTriangle size={20} />
            <div>
              <b>Shortfall reported · {i.order_id} · waiting for dispatcher</b>
              <p>
                {i.category}: {i.units_affected} units. {i.description}
              </p>
            </div>
          </div>
        ))}
        <div className="loading-items">
          {loadOrder.map((s, i) => (
            <button
              key={s.id}
              className={`loading-item ${s.loaded ? "checked" : ""}`}
              disabled={!editable || busy !== null}
              onClick={() => toggle(s.id, !s.loaded)}
              aria-pressed={s.loaded}
            >
              <span className="check-box">
                {s.loaded && <Check size={16} />}
              </span>
              <div>
                <small>
                  STOP {String(s.seq).padStart(2, "0")}
                  {i === 0
                    ? " · LOAD FIRST"
                    : i === loadOrder.length - 1
                      ? " · LOAD LAST"
                      : ""}
                </small>
                <h3>{s.outlet_name}</h3>
                <p>
                  {s.temp_requirement === "chilled" ? (
                    <Snowflake size={14} />
                  ) : (
                    <Box size={14} />
                  )}
                  {s.units} units · {s.volume_m3} m³ · {s.order_id} ·{" "}
                  {DOCK[s.dock_type]}
                </p>
              </div>
              <span className="check-label">
                {s.loaded ? "Loaded" : "Check load"}
              </span>
            </button>
          ))}
        </div>
        {editable && (
          <div className="task-actions">
            <button
              className="btn secondary"
              onClick={() => setShortfall(true)}
            >
              <AlertTriangle size={17} /> Report a shortfall
            </button>
            <button
              className="btn primary"
              disabled={
                loaded < trip.stops.length ||
                openShortfalls.length > 0 ||
                busy !== null
              }
              onClick={ready}
            >
              Mark ready to depart <ArrowRight size={16} />
            </button>
          </div>
        )}
      </section>
      <aside className="panel context-panel">
        <span className="eyebrow">BEFORE YOU CLOSE THE DOORS</span>
        <h2>Every detail matters.</h2>
        <div className="checklist">
          <p>
            <Snowflake />
            {trip.stops.some((s) => s.temp_requirement === "chilled")
              ? "Cold chain required"
              : "Ambient load"}
            <span>
              {trip.vehicle_temp === "reefer"
                ? "Refrigerated vehicle"
                : "Dry vehicle"}
            </span>
          </p>
          <p>
            <Box />
            Both capacity limits checked
            <span>
              {Math.round((trip.weight_kg / trip.weight_cap_kg) * 100)}% weight
              · {Math.round((trip.volume_m3 / trip.volume_cap_m3) * 100)}%
              volume
            </span>
          </p>
        </div>
        <div
          className="progress-ring"
          style={
            {
              "--progress": `${(loaded / Math.max(1, trip.stops.length)) * 100}%`,
            } as React.CSSProperties
          }
        >
          <div>
            <b>
              {loaded}/{trip.stops.length}
            </b>
            <span>loads checked</span>
          </div>
        </div>
        <p className="muted centered">
          A shortfall holds this vehicle until the dispatcher decides. The
          driver cannot depart before release.
        </p>
      </aside>
      {shortfall && (
        <ShortfallDialog
          trip={trip}
          onClose={() => setShortfall(false)}
          onDone={async () => {
            setShortfall(false);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function ShortfallDialog({
  trip,
  onClose,
  onDone,
}: {
  trip: Trip;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [orderId, setOrderId] = useState(trip.stops[0]?.order_id ?? "");
  const [category, setCategory] = useState("Missing items");
  const [units, setUnits] = useState(1);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog title="Catch it before departure." onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(`/api/loader/trips/${trip.id}/shortfall`, {
              json: {
                order_id: orderId,
                category,
                units_affected: units,
                description,
              },
            });
            toast(
              "Shortfall sent. The vehicle is held until the dispatcher decides.",
            );
            await onDone();
          } catch (err) {
            toast(
              err instanceof ApiError ? err.message : "Could not send",
              "error",
            );
            setBusy(false);
          }
        }}
      >
        <Select
          label="Affected order"
          value={orderId}
          onChange={setOrderId}
          options={trip.stops.map((s) => ({
            value: s.order_id,
            label: `Stop ${s.seq} · ${s.outlet_name}`,
            hint: `${s.order_id} · ${s.units} units · ${s.temp_requirement}`,
          }))}
        />
        <Select
          label="Problem"
          value={category}
          onChange={setCategory}
          options={[
            "Missing items",
            "Damaged goods",
            "Temperature concern",
            "Does not fit vehicle",
          ]}
        />
        <NumberField
          label="Units affected"
          value={units}
          onChange={setUnits}
          min={1}
          max={5000}
          required
        />
        <label className="field">
          What happened?
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="e.g. 6 dairy crates not in the chiller pick."
          />
        </label>
        <button className="btn primary full" disabled={busy}>
          <AlertTriangle size={16} /> Send to dispatcher & hold vehicle
        </button>
      </form>
    </Dialog>
  );
}
