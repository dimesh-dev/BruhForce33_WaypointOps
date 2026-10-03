import { query, type Db, pool } from "./db.ts";
import type { SessionUser } from "./users.ts";

export type Audience = "dispatcher" | "loader" | "driver" | "store_manager";

export interface EventInput {
  type: string;
  title: string;
  detail: string;
  severity?: "info" | "success" | "warning" | "critical";
  actor_id?: number | null;
  order_id?: string | null;
  trip_id?: number | null;
  outlet_id?: string | null;
  vehicle_id?: string | null;
  depot?: string | null;
  audience: Audience[];
}

export async function emit(e: EventInput, db: Db = pool()) {
  await query(
    `INSERT INTO events(type, title, detail, severity, actor_id, order_id, trip_id, outlet_id, vehicle_id, depot, audience)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      e.type,
      e.title,
      e.detail,
      e.severity ?? "info",
      e.actor_id ?? null,
      e.order_id ?? null,
      e.trip_id ?? null,
      e.outlet_id ?? null,
      e.vehicle_id ?? null,
      e.depot ?? null,
      e.audience,
    ],
    db,
  );
}

/**
 * Events visible to a user: role-addressed, then narrowed so a store sees only
 * its outlet, a driver only their vehicle and a loader only their depot.
 */
export async function eventsFor(user: SessionUser, sinceId = 0, limit = 40) {
  return query(
    `SELECT id, type, title, detail, severity, order_id, trip_id, outlet_id, vehicle_id, created_at
       FROM events
      WHERE $1 = ANY(audience) AND id > $2
        AND ($1 <> 'store_manager' OR outlet_id IS NULL OR outlet_id = $3)
        AND ($1 <> 'driver' OR vehicle_id IS NULL OR vehicle_id = $4)
        AND ($1 <> 'loader' OR depot IS NULL OR depot = $5)
        AND NOT ($1 = 'store_manager' AND outlet_id IS NULL AND type NOT IN ('orders.closed'))
      ORDER BY id DESC LIMIT $6`,
    [user.role, sinceId, user.outlet_id, user.vehicle_id, user.depot, limit],
  );
}
