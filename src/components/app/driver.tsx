"use client";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCheck,
  Clock3,
  CloudOff,
  MapPin,
  PenLine,
  RefreshCw,
  ShieldCheck,
  Snowflake,
  Store,
  Truck,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { api, ApiError } from "@/lib/client/api";
import {
  ACCESS,
  colomboTime,
  DOCK,
  hhmm,
  longDate,
  TRIP_STATUS,
} from "@/lib/client/format";
import {
  enqueue,
  loadSnapshot,
  pending,
  remove,
  saveSnapshot,
  update,
  type OutboxEvent,
  type OutboxKind,
} from "@/lib/client/outbox";
import type { Me, Stop, Trip } from "@/lib/client/types";
import { Badge, Dialog, Empty, useToast } from "@/lib/client/ui";

interface DriverData {
  plan: { id: number; run_date: string; version: number } | null;
  vehicle: {
    vehicle_id: string;
    type: string;
    temp: string;
    driver_name: string;
  } | null;
  trips: Trip[];
  outlets?: {
    outlet_id: string;
    window_open_time: string;
    window_close_time: string;
    mall_window: string | null;
    district: string;
  }[];
}

interface SyncLog {
  at: string;
  applied: number;
  conflicts: string[];
  rejected: string[];
}

const FORCED_KEY = "waypoint-forced-offline";

export function DriverView({ me }: { me: Me }) {
  const toast = useToast();
  const [data, setData] = useState<DriverData | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [outbox, setOutbox] = useState<OutboxEvent[]>([]);
  // Read before the first network effect so a reload in offline mode never syncs by accident.
  // (This view only mounts client-side, after the session has loaded.)
  const [forced, setForced] = useState(() => {
    try {
      return localStorage.getItem(FORCED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [network, setNetwork] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [syncing, setSyncing] = useState(false);
  const [log, setLog] = useState<SyncLog | null>(null);
  const [tripNo, setTripNo] = useState<number | null>(null);
  const [dialog, setDialog] = useState<{
    type: "deliver" | "fail" | "issue";
    stop?: Stop;
  } | null>(null);
  const flushing = useRef(false);
  const online = network && !forced;

  const refreshOutbox = useCallback(async () => setOutbox(await pending()), []);

  const fetchSeq = useRef(0);
  const fetchRoute = useCallback(async () => {
    const seq = ++fetchSeq.current;
    try {
      const next = await api<DriverData>("/api/driver");
      // A slower, older request must not overwrite state fetched after a sync.
      if (seq !== fetchSeq.current) return;
      setData(next);
      setSavedAt(new Date().toISOString());
      await saveSnapshot(`driver-${me.user.id}`, next);
    } catch {
      /* offline: keep the device copy */
    }
  }, [me.user.id]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    const queue = await pending();
    if (!queue.length) return;
    flushing.current = true;
    setSyncing(true);
    try {
      const { results } = await api<{
        results: { client_event_id: string; status: string; message: string }[];
      }>("/api/sync", {
        json: {
          events: queue.map(
            ({ client_event_id, kind, recorded_at, device_id, payload }) => ({
              client_event_id,
              kind,
              recorded_at,
              device_id,
              payload,
            }),
          ),
        },
      });
      const done = results
        .filter((r) => r.status !== "rejected")
        .map((r) => r.client_event_id);
      await remove(done);
      for (const r of results.filter((x) => x.status === "rejected")) {
        const e = queue.find((q) => q.client_event_id === r.client_event_id);
        if (e)
          await update({
            ...e,
            attempts: e.attempts + 1,
            last_error: r.message,
          });
      }
      const summary: SyncLog = {
        at: new Date().toISOString(),
        applied: results.filter(
          (r) => r.status === "applied" || r.status === "duplicate",
        ).length,
        conflicts: results
          .filter((r) => r.status === "conflict")
          .map((r) => r.message),
        rejected: results
          .filter((r) => r.status === "rejected")
          .map((r) => r.message),
      };
      setLog(summary);
      if (summary.conflicts.length) toast(summary.conflicts[0], "error");
      else if (summary.rejected.length) toast(summary.rejected[0], "error");
      else
        toast(
          `${summary.applied} record${summary.applied === 1 ? "" : "s"} synchronised. The store can see them.`,
        );
      await fetchRoute();
    } catch (e) {
      if (e instanceof ApiError && e.status > 0 && e.status < 500)
        toast(e.message, "error");
      // Network failure: records stay on the device and retry automatically.
    } finally {
      flushing.current = false;
      setSyncing(false);
      await refreshOutbox();
    }
  }, [fetchRoute, refreshOutbox, toast]);

  useEffect(() => {
    (async () => {
      const snap = await loadSnapshot<DriverData>(`driver-${me.user.id}`).catch(
        () => undefined,
      );
      if (snap) {
        setData((d) => d ?? snap.value);
        setSavedAt((s) => s ?? snap.saved_at);
      }
      await refreshOutbox();
    })();
    const up = () => setNetwork(true);
    const down = () => setNetwork(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [me.user.id, refreshOutbox]);

  useEffect(() => {
    if (!online) return;
    fetchRoute().then(flush);
    const t = setInterval(() => {
      fetchRoute();
      flush();
    }, 15000);
    return () => clearInterval(t);
  }, [online, fetchRoute, flush]);

  const setOffline = (value: boolean) => {
    setForced(value);
    try {
      localStorage.setItem(FORCED_KEY, value ? "1" : "0");
    } catch {}
    if (!value) toast("Back online. Synchronising your records…");
  };

  const record = async (
    kind: OutboxKind,
    payload: Record<string, unknown>,
    message: string,
  ) => {
    await enqueue(kind, payload);
    await refreshOutbox();
    toast(
      online
        ? message
        : `${message} Saved on this phone; it will sync when you reconnect.`,
    );
    if (online) await flush();
  };

  // Server state with this device's unsynchronised records applied on top.
  const trips = useMemo(() => {
    if (!data) return [];
    return data.trips.map((t) => {
      const departed = outbox.some(
        (e) => e.kind === "trip.depart" && e.payload.trip_id === t.id,
      );
      return {
        ...t,
        status: departed && t.status === "ready" ? "in_transit" : t.status,
        stops: t.stops.map((s) => {
          const local = outbox
            .filter(
              (e) =>
                e.payload.stop_id === s.id &&
                (e.kind === "stop.deliver" || e.kind === "stop.fail"),
            )
            .at(-1);
          return local && s.status !== "delivered" && s.status !== "failed"
            ? {
                ...s,
                status:
                  local.kind === "stop.deliver"
                    ? ("delivered" as const)
                    : ("failed" as const),
                pendingSync: true,
              }
            : { ...s, pendingSync: false };
        }),
      };
    });
  }, [data, outbox]);

  const trip =
    trips.find((t) => t.trip_no === tripNo) ??
    trips.find(
      (t) =>
        t.status !== "completed" &&
        t.stops.some((s) => s.status === "pending" || s.status === "arrived"),
    ) ??
    trips[0];
  const next = trip?.stops.find(
    (s) => s.status === "pending" || s.status === "arrived",
  );
  const outletInfo = new Map(
    (data?.outlets ?? []).map((o) => [o.outlet_id, o]),
  );
  const rejected = outbox.filter((e) => e.last_error);

  return (
    <div className="role-experience">
      <div className="page-heading role-illustrated-heading">
        <Image
          width={1536}
          height={1024}
          sizes="(max-width: 700px) 100vw, 800px"
          className="role-heading-art"
          src="/images/on-the-road.png"
          alt=""
        />
        <div>
          <div className="eyebrow">
            {me.user.vehicle_id}{" "}
            {trip
              ? `· TRIP ${trip.trip_no} · ${trip.district.toUpperCase()}`
              : ""}
          </div>
          <h1>Let’s get there, {me.user.display_name.split(" ")[0]}.</h1>
          <p>Everything you need for the next stop. Use when safely parked.</p>
        </div>
        <Badge kind={online ? "delivered" : "deferred"}>
          {online ? "Connected" : "Offline · saved on device"}
        </Badge>
      </div>
      <div className="role-columns driver-columns">
        <section className="panel task-panel">
          <div className={`connectivity-banner ${online ? "" : "offline"}`}>
            <span>
              {online ? <Wifi size={18} /> : <WifiOff size={18} />}
              <b>
                {online
                  ? outbox.length
                    ? "Connected · sending records"
                    : "Your route is up to date."
                  : "You’re offline. Keep going."}
              </b>
            </span>
            {forced ? (
              <button onClick={() => setOffline(false)}>
                Reconnect & sync
              </button>
            ) : network ? (
              <button
                onClick={() => setOffline(true)}
                title="Simulates losing coverage on this device"
              >
                Work offline
              </button>
            ) : null}
          </div>
          {(!online || outbox.length > 0) && (
            <div className="offline-explanation">
              <p>
                {online
                  ? "Records waiting from the coverage gap are being sent now."
                  : !network
                    ? "No signal. Deliveries, photos and signatures are stored on this phone and sent automatically when coverage returns."
                    : "Offline mode is on (simulating a coverage gap). Records stay on this phone until you reconnect."}
              </p>
              <b>
                <CloudOff size={14} /> {outbox.length} record
                {outbox.length === 1 ? "" : "s"} waiting to sync
                {savedAt && ` · route saved ${colomboTime(savedAt)}`}
              </b>
              {online && outbox.length > 0 && (
                <button className="text-btn" onClick={flush} disabled={syncing}>
                  <RefreshCw size={13} /> {syncing ? "Syncing…" : "Sync now"}
                </button>
              )}
            </div>
          )}
          {rejected.length > 0 && (
            <div className="inline-callout warning" role="alert">
              <AlertTriangle size={20} />
              <div>
                <b>{rejected.length} record(s) need attention</b>
                <p>{rejected[0].last_error}</p>
                <button
                  className="text-btn"
                  onClick={async () => {
                    await remove(rejected.map((r) => r.client_event_id));
                    await refreshOutbox();
                  }}
                >
                  Discard these records
                </button>
              </div>
            </div>
          )}
          {log && log.conflicts.length > 0 && (
            <div className="inline-callout warning">
              <AlertTriangle size={20} />
              <div>
                <b>Sent for dispatcher review</b>
                <p>{log.conflicts[0]}</p>
              </div>
            </div>
          )}

          {!data ? (
            <div className="loading-state">
              {online
                ? "Loading your route…"
                : "No saved route on this phone yet. Connect once to download it."}
            </div>
          ) : !trip ? (
            <Empty
              icon={<Truck size={28} />}
              title="No published trips for your vehicle"
            >
              Your route appears here when the dispatcher publishes a plan that
              uses {me.user.vehicle_id}.
            </Empty>
          ) : (
            <>
              {trips.length > 1 && (
                <div className="segmented" role="tablist" aria-label="Trips">
                  {trips.map((t) => (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={t.id === trip.id}
                      className={t.id === trip.id ? "active" : ""}
                      onClick={() => setTripNo(t.trip_no)}
                    >
                      Trip {t.trip_no} · {t.district}
                    </button>
                  ))}
                </div>
              )}
              {["planned", "loading", "blocked"].includes(trip.status) ? (
                <div className="driver-stop">
                  <span className="eyebrow">
                    {longDate(trip.run_date).toUpperCase()} · DEPART{" "}
                    {hhmm(trip.depart_min)}
                  </span>
                  <h2>Waiting for the dock</h2>
                  <p>
                    <Clock3 size={16} />{" "}
                    {trip.status === "blocked"
                      ? "A loading shortfall is with the dispatcher."
                      : "The loader is preparing your vehicle."}
                  </p>
                  <Badge kind={TRIP_STATUS[trip.status].kind}>
                    {TRIP_STATUS[trip.status].label}
                  </Badge>
                </div>
              ) : trip.status === "ready" ? (
                <div className="driver-stop">
                  <span className="eyebrow">
                    LOADED AND RELEASED · PLAN V{trip.version}
                  </span>
                  <h2>
                    {trip.stops.length} stops in {trip.district}
                  </h2>
                  <p>
                    <Truck size={16} /> Planned departure{" "}
                    {hhmm(trip.depart_min)} from {trip.depot}
                  </p>
                  <button
                    className="btn primary full large-btn"
                    onClick={() =>
                      record(
                        "trip.depart",
                        { trip_id: trip.id },
                        "Departure recorded.",
                      )
                    }
                  >
                    <Truck size={18} /> Start trip
                  </button>
                </div>
              ) : next ? (
                <div className="driver-stop">
                  <span className="eyebrow">
                    NEXT STOP · {String(next.seq).padStart(2, "0")} OF{" "}
                    {String(trip.stops.length).padStart(2, "0")}
                  </span>
                  <h2>{next.outlet_name}</h2>
                  <p>
                    <MapPin size={16} />{" "}
                    {outletInfo.get(next.outlet_id)?.district ?? trip.district}{" "}
                    · {next.outlet_id}
                  </p>
                  <div className="arrival-time">
                    {hhmm(next.arrival_min)}
                    <span>
                      <small>Planned arrival</small>
                    </span>
                    <Badge
                      kind={
                        next.window_close_min - next.arrival_min < 15
                          ? "at-risk"
                          : "delivered"
                      }
                    >
                      {next.window_close_min - next.arrival_min < 15
                        ? "Tight window"
                        : "On plan"}
                    </Badge>
                  </div>
                  <div className="stop-details">
                    <span>
                      <Clock3 size={18} />
                      <small>Receiving window</small>
                      <b>
                        {hhmm(next.window_open_min)} –{" "}
                        {hhmm(next.window_close_min)}
                      </b>
                    </span>
                    <span>
                      {next.temp_requirement === "chilled" ? (
                        <Snowflake size={18} />
                      ) : (
                        <Store size={18} />
                      )}
                      <small>Your delivery</small>
                      <b>
                        {next.units} {next.temp_requirement} units
                      </b>
                    </span>
                    <span>
                      <Truck size={18} />
                      <small>Unloading access</small>
                      <b>
                        {DOCK[next.dock_type]} ·{" "}
                        {ACCESS[next.parking_constraint]}
                      </b>
                    </span>
                  </div>
                  <button
                    className="btn primary full large-btn"
                    onClick={() => setDialog({ type: "deliver", stop: next })}
                  >
                    <CheckCheck size={18} /> Record delivery & proof
                  </button>
                  <button
                    className="btn secondary full"
                    onClick={() => setDialog({ type: "fail", stop: next })}
                  >
                    <XCircle size={16} /> Could not deliver
                  </button>
                  <button
                    className="btn secondary full"
                    onClick={() => setDialog({ type: "issue", stop: next })}
                  >
                    <AlertTriangle size={16} /> Report a delivery issue
                  </button>
                </div>
              ) : (
                <div className="success-state">
                  <ShieldCheck size={45} />
                  <h3>Trip {trip.trip_no} complete.</h3>
                  <p>
                    {outbox.length
                      ? "Records will reach the stores once you are back in coverage."
                      : "Every stop is recorded and visible to the stores."}
                  </p>
                </div>
              )}
            </>
          )}
        </section>
        <aside className="panel context-panel">
          <span className="eyebrow">TODAY’S JOURNEY</span>
          <h2>One stop at a time.</h2>
          {trip && (
            <div className="journey">
              <div
                className={
                  trip.status === "in_transit" || trip.status === "completed"
                    ? "complete"
                    : "current"
                }
              >
                <span>
                  {trip.status === "in_transit" ||
                  trip.status === "completed" ? (
                    <Check size={14} />
                  ) : (
                    "•"
                  )}
                </span>
                <div>
                  <b>Depart {trip.depot}</b>
                  <small>{hhmm(trip.depart_min)} · planned</small>
                </div>
              </div>
              {trip.stops.map((s) => (
                <div
                  key={s.id}
                  className={
                    s.status === "delivered" || s.status === "failed"
                      ? "complete"
                      : s.id === next?.id
                        ? "current"
                        : ""
                  }
                >
                  <span>
                    {s.status === "delivered" ? (
                      <Check size={14} />
                    ) : s.status === "failed" ? (
                      <XCircle size={14} />
                    ) : (
                      s.seq
                    )}
                  </span>
                  <div>
                    <b>{s.outlet_name}</b>
                    <small>
                      {hhmm(s.arrival_min)} ·{" "}
                      {"pendingSync" in s && s.pendingSync
                        ? "Saved offline · awaiting sync"
                        : s.status === "delivered"
                          ? "Delivered"
                          : s.status === "failed"
                            ? "Not delivered"
                            : s.id === next?.id
                              ? "Next stop"
                              : "Planned"}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="safe-note">
            <ShieldCheck size={20} />
            <span>
              Your safety comes first.
              <br />
              Use this screen while parked.
            </span>
          </div>
        </aside>
      </div>
      {dialog?.type === "deliver" && dialog.stop && (
        <DeliveryDialog
          stop={dialog.stop}
          online={online}
          onClose={() => setDialog(null)}
          onSave={async (payload) => {
            setDialog(null);
            await record(
              "stop.deliver",
              { stop_id: dialog.stop!.id, ...payload },
              "Delivery recorded.",
            );
          }}
        />
      )}
      {dialog?.type === "fail" && dialog.stop && (
        <FailDialog
          stop={dialog.stop}
          onClose={() => setDialog(null)}
          onSave={async (payload) => {
            setDialog(null);
            await record(
              "stop.fail",
              { stop_id: dialog.stop!.id, ...payload },
              "Failed delivery recorded. Dispatcher and store notified.",
            );
          }}
        />
      )}
      {dialog?.type === "issue" && (
        <IssueDialog
          onClose={() => setDialog(null)}
          onSave={async (payload) => {
            setDialog(null);
            await record(
              "issue.report",
              { stop_id: dialog.stop?.id, trip_id: trip?.id, ...payload },
              "Issue sent to the dispatcher.",
            );
          }}
        />
      )}
    </div>
  );
}

/** Downscales a camera photo so it stays small enough to queue offline and sync over weak signal. */
async function compressPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new window.Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, 960 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function SignaturePad({
  onChange,
}: {
  onChange: (dataUrl: string | null) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [
      ((e.clientX - r.left) / r.width) * e.currentTarget.width,
      ((e.clientY - r.top) / r.height) * e.currentTarget.height,
    ];
  };
  return (
    <div className="signature">
      <canvas
        ref={ref}
        width={600}
        height={180}
        aria-label="Receiver signature"
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const ctx = e.currentTarget.getContext("2d")!;
          const [x, y] = point(e);
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.strokeStyle = "#29384a";
          ctx.beginPath();
          ctx.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext("2d")!;
          const [x, y] = point(e);
          ctx.lineTo(x, y);
          ctx.stroke();
          dirty.current = true;
        }}
        onPointerUp={(e) => {
          drawing.current = false;
          if (dirty.current) onChange(e.currentTarget.toDataURL("image/png"));
        }}
      />
      <button
        type="button"
        className="text-btn"
        onClick={() => {
          const c = ref.current!;
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          dirty.current = false;
          onChange(null);
        }}
      >
        Clear signature
      </button>
    </div>
  );
}

function DeliveryDialog({
  stop,
  online,
  onClose,
  onSave,
}: {
  stop: Stop;
  online: boolean;
  onClose: () => void;
  onSave: (p: Record<string, unknown>) => Promise<void>;
}) {
  const [receiver, setReceiver] = useState("");
  const [units, setUnits] = useState(stop.units);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  return (
    <Dialog title="Delivery, with a clear record." onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            receiver_name: receiver,
            units_delivered: units,
            note,
            photo,
            signature,
          });
        }}
      >
        <div className={`inline-callout ${online ? "" : "warning"}`}>
          {online ? <ShieldCheck size={22} /> : <WifiOff size={22} />}
          <div>
            <b>{online ? "Proof of delivery" : "Offline capture is ready"}</b>
            <p>
              {online
                ? "Confirm the quantity and receiving contact while safely stopped."
                : "This record stays on your phone, survives a refresh and syncs when you reconnect."}
            </p>
          </div>
        </div>
        <label className="field">
          Receiving contact
          <input
            required
            value={receiver}
            onChange={(e) => setReceiver(e.target.value)}
            placeholder="Name of the person receiving"
          />
        </label>
        <label className="field">
          Units handed over ({stop.units} ordered)
          <input
            required
            type="number"
            min={0}
            max={stop.units * 2}
            value={units}
            onChange={(e) => setUnits(Number(e.target.value))}
          />
        </label>
        {units < stop.units && (
          <p className="skip-flag">
            Recorded as a partial delivery of {stop.units - units} units short.
          </p>
        )}
        <label className="field">
          Condition / note
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Where it was left, condition, temperature…"
          />
        </label>
        <label className="field photo-field">
          <span>
            <Camera size={14} /> Photo of the delivered goods (optional)
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={async (e) =>
              e.target.files?.[0] &&
              setPhoto(await compressPhoto(e.target.files[0]))
            }
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo && (
            <img
              src={photo}
              alt="Delivery photo preview"
              className="proof-photo"
            />
          )}
        </label>
        <div className="field">
          <span>
            <PenLine size={14} /> Receiver signature (optional)
          </span>
          <SignaturePad onChange={setSignature} />
        </div>
        <button className="btn primary full" type="submit">
          {online ? <CheckCheck size={16} /> : <WifiOff size={16} />}{" "}
          {online ? "Complete delivery" : "Save proof on this phone"}
        </button>
      </form>
    </Dialog>
  );
}

function FailDialog({
  stop,
  onClose,
  onSave,
}: {
  stop: Stop;
  onClose: () => void;
  onSave: (p: Record<string, unknown>) => Promise<void>;
}) {
  const [reason, setReason] = useState("Outlet closed");
  const [note, setNote] = useState("");
  return (
    <Dialog
      title={`Could not deliver to ${stop.outlet_name}`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ reason, note });
        }}
      >
        <label className="field">
          Reason
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {[
              "Outlet closed",
              "Arrived after window closed",
              "Access blocked",
              "Refused by store",
              "Goods damaged in transit",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Details
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
            placeholder="What happened, and where the goods are now."
          />
        </label>
        <button className="btn primary full">
          Record and notify dispatcher
        </button>
      </form>
    </Dialog>
  );
}

function IssueDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (p: Record<string, unknown>) => Promise<void>;
}) {
  const [category, setCategory] = useState("Running late");
  const [description, setDescription] = useState("");
  return (
    <Dialog title="Keep your team in the loop." onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ category, description });
        }}
      >
        <label className="field">
          Issue type
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {[
              "Running late",
              "Road closed / flooding",
              "Vehicle problem",
              "Quantity discrepancy",
              "Temperature concern",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          What happened?
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <button className="btn primary full">Send to dispatcher</button>
      </form>
    </Dialog>
  );
}
