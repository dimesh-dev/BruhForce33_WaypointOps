import type pg from "pg";
import { tx } from "./db.ts";
import { emit, type EventInput } from "./events.ts";
import type { SessionUser } from "./users.ts";

/**
 * Driver field events. The driver app records every action into a local
 * outbox first and sends batches here, online or after a coverage gap.
 *
 * Reconciliation rules:
 *  - client_event_id makes each event idempotent: a replay returns the stored result.
 *    Rejected events are not stored, so the device can retry them later.
 *  - Events apply in the order they were recorded on the device.
 *  - A completed stop is never overwritten. A second, different outcome is kept
 *    as an additional proof and raised to the dispatcher as a sync conflict.
 *  - Events for a replaced plan version are kept and raised for review.
 */

export type FieldEventKind =
  "trip.depart" | "stop.arrive" | "stop.deliver" | "stop.fail" | "issue.report";

export interface FieldEvent {
  client_event_id: string;
  kind: FieldEventKind;
  recorded_at: string;
  device_id?: string;
  payload: Record<string, unknown>;
}

export type SyncStatus = "applied" | "duplicate" | "conflict" | "rejected";

export interface SyncResult {
  client_event_id: string;
  status: SyncStatus;
  message: string;
}

interface StopContext {
  stop_id: number;
  stop_status: string;
  order_id: string;
  outlet_id: string;
  outlet_name: string;
  units: number;
  trip_id: number;
  trip_status: string;
  vehicle_id: string;
  plan_status: string;
  remaining: number;
}

const text = (v: unknown, max = 1000) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

async function stopContext(
  c: pg.PoolClient,
  stopId: number,
): Promise<StopContext | undefined> {
  const { rows } = await c.query<StopContext>(
    `SELECT s.id AS stop_id, s.status AS stop_status, s.order_id, o.outlet_id, ou.name AS outlet_name, o.units,
            t.id AS trip_id, t.status AS trip_status, t.vehicle_id, p.status AS plan_status,
            (SELECT COUNT(*)::int FROM stops x WHERE x.trip_id = t.id AND x.status IN ('pending','arrived') AND x.id <> s.id) AS remaining
       FROM stops s JOIN trips t ON t.id = s.trip_id JOIN plans p ON p.id = t.plan_id
       JOIN orders o ON o.order_id = s.order_id JOIN outlets ou ON ou.outlet_id = o.outlet_id
      WHERE s.id = $1 FOR UPDATE OF s`,
    [stopId],
  );
  return rows[0];
}

async function apply(
  c: pg.PoolClient,
  user: SessionUser,
  e: FieldEvent,
  notices: EventInput[],
): Promise<SyncResult> {
  const result = (status: SyncStatus, message: string): SyncResult => ({
    client_event_id: e.client_event_id,
    status,
    message,
  });
  const recordedAt = new Date(e.recorded_at);
  if (Number.isNaN(recordedAt.getTime()))
    return result("rejected", "Event has no valid recording time.");
  const p = e.payload ?? {};

  if (e.kind === "trip.depart") {
    const { rows } = await c.query<{
      status: string;
      vehicle_id: string;
      plan_status: string;
      trip_no: number;
    }>(
      "SELECT t.status, t.vehicle_id, t.trip_no, p.status AS plan_status FROM trips t JOIN plans p ON p.id = t.plan_id WHERE t.id = $1 FOR UPDATE OF t",
      [Number(p.trip_id)],
    );
    const trip = rows[0];
    if (!trip || trip.vehicle_id !== user.vehicle_id)
      return result("rejected", "That trip is not assigned to your vehicle.");
    if (trip.plan_status !== "published")
      return result(
        "rejected",
        "The plan changed; this trip was replaced. Refresh your route.",
      );
    if (trip.status === "in_transit" || trip.status === "completed")
      return result("duplicate", "Departure already recorded.");
    if (trip.status !== "ready")
      return result(
        "rejected",
        "The loader has not released this vehicle yet.",
      );
    await c.query(
      "UPDATE trips SET status = 'in_transit', departed_at = $2 WHERE id = $1",
      [Number(p.trip_id), recordedAt],
    );
    await c.query(
      "UPDATE orders SET status = 'in_transit' WHERE order_id IN (SELECT order_id FROM stops WHERE trip_id = $1) AND status = 'loaded'",
      [Number(p.trip_id)],
    );
    notices.push({
      type: "trip.departed",
      title: `${trip.vehicle_id} trip ${trip.trip_no} departed`,
      detail: "Stores on this trip can now see it on the road.",
      trip_id: Number(p.trip_id),
      vehicle_id: trip.vehicle_id,
      audience: ["dispatcher"],
    });
    return result("applied", "Departure recorded.");
  }

  if (e.kind === "issue.report") {
    const category = text(p.category, 80) || "Delivery issue";
    const description = text(p.description) || category;
    const stop = p.stop_id
      ? await stopContext(c, Number(p.stop_id))
      : undefined;
    if (stop && stop.vehicle_id !== user.vehicle_id)
      return result("rejected", "That stop is not on your vehicle.");
    await c.query(
      `INSERT INTO issues(kind, category, order_id, trip_id, outlet_id, description, reported_by, created_at, client_event_id)
       VALUES ('delivery_issue',$1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        category,
        stop?.order_id ?? null,
        stop?.trip_id ?? (p.trip_id ? Number(p.trip_id) : null),
        stop?.outlet_id ?? null,
        description,
        user.id,
        recordedAt,
        e.client_event_id,
      ],
    );
    notices.push({
      type: "issue.driver",
      title: `${user.vehicle_id}: ${category}`,
      detail: description,
      severity: "warning",
      order_id: stop?.order_id,
      outlet_id: stop?.outlet_id,
      vehicle_id: user.vehicle_id,
      audience: stop ? ["dispatcher", "store_manager"] : ["dispatcher"],
    });
    return result("applied", "Issue sent to the dispatcher.");
  }

  const stop = await stopContext(c, Number(p.stop_id));
  if (!stop || stop.vehicle_id !== user.vehicle_id)
    return result("rejected", "That stop is not on your vehicle.");

  if (e.kind === "stop.arrive") {
    if (stop.stop_status !== "pending")
      return result("duplicate", "Arrival already recorded.");
    await c.query(
      "UPDATE stops SET status = 'arrived', arrived_at = $2 WHERE id = $1",
      [stop.stop_id, recordedAt],
    );
    return result("applied", "Arrival recorded.");
  }

  // Delivery outcome (delivered, partial or failed).
  const failed = e.kind === "stop.fail";
  const unitsDelivered = failed
    ? 0
    : Math.max(
        0,
        Math.min(
          stop.units * 2,
          Math.round(Number(p.units_delivered ?? stop.units)),
        ),
      );
  const outcome = failed
    ? "failed"
    : unitsDelivered < stop.units
      ? "partial"
      : "delivered";
  const proofValues = [
    stop.stop_id,
    stop.order_id,
    outcome,
    text(p.receiver_name, 120) || null,
    unitsDelivered,
    text(p.note) || null,
    failed ? text(p.reason, 200) || "Not delivered" : null,
    typeof p.photo === "string" && p.photo.startsWith("data:image/")
      ? p.photo.slice(0, 900_000)
      : null,
    typeof p.signature === "string" && p.signature.startsWith("data:image/")
      ? p.signature.slice(0, 300_000)
      : null,
    recordedAt,
    user.id,
    e.device_id ?? null,
    e.client_event_id,
  ];
  const insertProof = (superseded: boolean) =>
    c.query(
      `INSERT INTO proofs(stop_id, order_id, outcome, receiver_name, units_delivered, note, failure_reason, photo, signature,
         recorded_at, recorded_by, device_id, client_event_id, superseded)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [...proofValues, superseded],
    );

  if (stop.stop_status === "delivered" || stop.stop_status === "failed") {
    const prior = await c.query<{ outcome: string; units_delivered: number }>(
      "SELECT outcome, units_delivered FROM proofs WHERE stop_id = $1 AND NOT superseded ORDER BY recorded_at LIMIT 1",
      [stop.stop_id],
    );
    const same =
      prior.rows[0] &&
      prior.rows[0].outcome === outcome &&
      prior.rows[0].units_delivered === unitsDelivered;
    await insertProof(true);
    if (same)
      return result(
        "duplicate",
        "This delivery was already recorded with the same outcome.",
      );
    await c.query(
      `INSERT INTO issues(kind, category, order_id, trip_id, outlet_id, description, reported_by)
       VALUES ('sync_conflict','Conflicting delivery records',$1,$2,$3,$4,$5)`,
      [
        stop.order_id,
        stop.trip_id,
        stop.outlet_id,
        `A second record (${outcome}, ${unitsDelivered} units) arrived after ${stop.order_id} was already closed as ` +
          `${prior.rows[0]?.outcome ?? stop.stop_status}. Both proofs are kept for review.`,
        user.id,
      ],
    );
    notices.push({
      type: "sync.conflict",
      title: `Conflicting records for ${stop.order_id}`,
      detail: "Both proofs are kept. Review and confirm which is correct.",
      severity: "critical",
      order_id: stop.order_id,
      trip_id: stop.trip_id,
      audience: ["dispatcher"],
    });
    return result(
      "conflict",
      "This stop was already closed. Both records were kept for the dispatcher to review.",
    );
  }

  if (stop.plan_status !== "published") {
    await insertProof(false);
    await c.query(
      `INSERT INTO issues(kind, category, order_id, trip_id, outlet_id, description, reported_by)
       VALUES ('sync_conflict','Record for a replaced plan',$1,$2,$3,$4,$5)`,
      [
        stop.order_id,
        stop.trip_id,
        stop.outlet_id,
        `A ${outcome} record arrived for a trip from a replaced plan version.`,
        user.id,
      ],
    );
    return result(
      "conflict",
      "The plan changed while you were offline. Your record was kept for the dispatcher.",
    );
  }

  await insertProof(false);
  await c.query(
    "UPDATE stops SET status = $2, completed_at = $3, arrived_at = COALESCE(arrived_at, $3) WHERE id = $1",
    [stop.stop_id, failed ? "failed" : "delivered", recordedAt],
  );
  await c.query("UPDATE orders SET status = $2 WHERE order_id = $1", [
    stop.order_id,
    failed ? "failed" : "delivered",
  ]);
  // A delivery recorded offline implies the vehicle left, even if the departure event is missing.
  await c.query(
    "UPDATE trips SET status = CASE WHEN $2 = 0 THEN 'completed' ELSE 'in_transit' END, departed_at = COALESCE(departed_at, $3), completed_at = CASE WHEN $2 = 0 THEN $3 END WHERE id = $1",
    [stop.trip_id, stop.remaining, recordedAt],
  );
  notices.push({
    type: failed ? "stop.failed" : "stop.delivered",
    title: failed
      ? `${stop.outlet_name}: delivery not completed`
      : `${stop.outlet_name}: delivered`,
    detail: failed
      ? `${text(p.reason, 200) || "Not delivered"}. ${text(p.note)}`.trim()
      : `${unitsDelivered} of ${stop.units} units, received by ${text(p.receiver_name, 120) || "store staff"}.${outcome === "partial" ? " Partial delivery." : ""}`,
    severity: failed || outcome === "partial" ? "warning" : "success",
    order_id: stop.order_id,
    outlet_id: stop.outlet_id,
    trip_id: stop.trip_id,
    vehicle_id: stop.vehicle_id,
    audience: ["dispatcher", "store_manager"],
  });
  return result(
    "applied",
    failed ? "Failed delivery recorded." : "Delivery recorded.",
  );
}

export async function syncEvents(
  user: SessionUser,
  events: FieldEvent[],
): Promise<SyncResult[]> {
  const ordered = [...events].sort((a, b) =>
    a.recorded_at.localeCompare(b.recorded_at),
  );
  const results: SyncResult[] = [];
  const notices: EventInput[] = [];
  for (const e of ordered) {
    const r = await tx(async (c) => {
      const prior = await c.query<{ result: SyncResult }>(
        "SELECT result FROM sync_events WHERE client_event_id = $1",
        [e.client_event_id],
      );
      if (prior.rows[0])
        return {
          ...prior.rows[0].result,
          status: "duplicate" as const,
          message: "Already synchronised.",
        };
      const applied = await apply(c, user, e, notices);
      // Rejections are not final (e.g. the loader has not released the vehicle yet), so they can be retried.
      if (applied.status === "rejected") return applied;
      await c.query(
        "INSERT INTO sync_events(client_event_id, user_id, device_id, kind, result) VALUES ($1,$2,$3,$4,$5)",
        [
          e.client_event_id,
          user.id,
          e.device_id ?? null,
          e.kind,
          JSON.stringify(applied),
        ],
      );
      return applied;
    });
    results.push(r);
  }
  for (const n of notices) await emit({ ...n, actor_id: user.id });
  return results;
}
