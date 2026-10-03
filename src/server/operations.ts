import type pg from "pg";
import { one, query, tx } from "./db.ts";
import { emit } from "./events.ts";
import { HttpError } from "./http-error.ts";
import { nextOperatingDate } from "./clock.ts";
import type { SessionUser } from "./users.ts";

/*
 * Field operations after a plan is published: loading, departure, delivery,
 * receipt and issue resolution. Every state change is scoped to the acting
 * user's depot, vehicle or outlet and emits an event for the other roles.
 */

interface TripRow {
  id: number;
  plan_id: number;
  vehicle_id: string;
  trip_no: number;
  depot: string;
  status: string;
  plan_status: string;
  run_date: string;
  version: number;
}

async function tripFor(
  tripId: number,
  db: pg.PoolClient | undefined = undefined,
) {
  const row = await one<TripRow>(
    `SELECT t.id, t.plan_id, t.vehicle_id, t.trip_no, t.depot, t.status, p.status AS plan_status, p.run_date, p.version
       FROM trips t JOIN plans p ON p.id = t.plan_id WHERE t.id = $1`,
    [tripId],
    db,
  );
  if (!row) throw new HttpError(404, "Trip not found.");
  return row;
}

function assertLoaderTrip(user: SessionUser, trip: TripRow) {
  if (trip.plan_status !== "published")
    throw new HttpError(
      409,
      "This trip belongs to a replaced plan version. Reload the dock list.",
    );
  if (user.role === "loader" && user.depot !== trip.depot)
    throw new HttpError(403, "This trip loads at another depot.");
}

// ------------------------------------------------------------------ loading

export async function setLoaded(
  user: SessionUser,
  stopId: number,
  loaded: boolean,
) {
  const stop = await one<{ trip_id: number; order_id: string }>(
    "SELECT trip_id, order_id FROM stops WHERE id = $1",
    [stopId],
  );
  if (!stop) throw new HttpError(404, "Stop not found.");
  const trip = await tripFor(stop.trip_id);
  assertLoaderTrip(user, trip);
  if (!["planned", "loading", "blocked"].includes(trip.status))
    throw new HttpError(
      409,
      "This vehicle is already marked ready or has left.",
    );
  await query(
    "UPDATE stops SET loaded = $2, loaded_at = CASE WHEN $2 THEN now() END, loaded_by = CASE WHEN $2 THEN $3::int END WHERE id = $1",
    [stopId, loaded, user.id],
  );
  if (trip.status === "planned")
    await query("UPDATE trips SET status = 'loading' WHERE id = $1", [trip.id]);
}

export async function reportShortfall(
  user: SessionUser,
  tripId: number,
  input: {
    order_id: string;
    category: string;
    units_affected: number;
    description: string;
  },
) {
  const trip = await tripFor(tripId);
  assertLoaderTrip(user, trip);
  if (!["planned", "loading", "blocked"].includes(trip.status))
    throw new HttpError(409, "Report shortfalls before the vehicle is ready.");
  const onTrip = await one(
    "SELECT 1 FROM stops WHERE trip_id = $1 AND order_id = $2",
    [tripId, input.order_id],
  );
  if (!onTrip) throw new HttpError(422, "That order is not on this trip.");
  const outlet = await one<{ outlet_id: string }>(
    "SELECT outlet_id FROM orders WHERE order_id = $1",
    [input.order_id],
  );
  const issue = await tx(async (c) => {
    const { rows } = await c.query<{ id: number }>(
      `INSERT INTO issues(kind, category, order_id, trip_id, outlet_id, units_affected, description, blocks_departure, reported_by)
       VALUES ('loading_shortfall',$1,$2,$3,$4,$5,$6,true,$7) RETURNING id`,
      [
        input.category,
        input.order_id,
        tripId,
        outlet?.outlet_id,
        input.units_affected,
        input.description,
        user.id,
      ],
    );
    await c.query("UPDATE trips SET status = 'blocked' WHERE id = $1", [
      tripId,
    ]);
    return rows[0].id;
  });
  await emit({
    type: "issue.shortfall",
    title: `Loading shortfall on ${trip.vehicle_id} trip ${trip.trip_no}`,
    detail: `${input.category}: ${input.units_affected} units of ${input.order_id}. ${input.description}`,
    severity: "critical",
    actor_id: user.id,
    order_id: input.order_id,
    trip_id: tripId,
    vehicle_id: trip.vehicle_id,
    audience: ["dispatcher"],
  });
  return { issue_id: issue };
}

export async function markReady(user: SessionUser, tripId: number) {
  const trip = await tripFor(tripId);
  assertLoaderTrip(user, trip);
  const pending = await one<{ unloaded: number; blocking: number }>(
    `SELECT (SELECT COUNT(*)::int FROM stops WHERE trip_id = $1 AND NOT loaded) AS unloaded,
            (SELECT COUNT(*)::int FROM issues WHERE trip_id = $1 AND blocks_departure AND status = 'open') AS blocking`,
    [tripId],
  );
  if (pending!.blocking > 0)
    throw new HttpError(
      409,
      "A shortfall on this trip is waiting for the dispatcher's decision.",
    );
  if (pending!.unloaded > 0)
    throw new HttpError(
      409,
      `${pending!.unloaded} order(s) are not checked onto the vehicle yet.`,
    );
  await tx(async (c) => {
    await c.query(
      "UPDATE trips SET status = 'ready', ready_at = now() WHERE id = $1",
      [tripId],
    );
    await c.query(
      "UPDATE orders SET status = 'loaded' WHERE order_id IN (SELECT order_id FROM stops WHERE trip_id = $1)",
      [tripId],
    );
  });
  await emit({
    type: "trip.ready",
    title: `${trip.vehicle_id} trip ${trip.trip_no} loaded and ready`,
    detail: `Loaded against plan v${trip.version} in reverse stop order.`,
    severity: "success",
    actor_id: user.id,
    trip_id: tripId,
    vehicle_id: trip.vehicle_id,
    audience: ["dispatcher", "driver"],
  });
}

// ----------------------------------------------------------- issue handling

export async function resolveIssue(
  user: SessionUser,
  issueId: number,
  input: { action: "proceed" | "remove_order"; note: string },
) {
  const issue = await one<{
    id: number;
    kind: string;
    status: string;
    trip_id: number | null;
    order_id: string | null;
    outlet_id: string | null;
  }>(
    "SELECT id, kind, status, trip_id, order_id, outlet_id FROM issues WHERE id = $1",
    [issueId],
  );
  if (!issue) throw new HttpError(404, "Issue not found.");
  if (issue.status === "resolved")
    throw new HttpError(409, "This issue is already resolved.");
  let detail = input.note;
  await tx(async (c) => {
    if (input.action === "remove_order") {
      if (
        issue.kind !== "loading_shortfall" ||
        !issue.trip_id ||
        !issue.order_id
      )
        throw new HttpError(
          422,
          "Only a loading shortfall can remove an order from its trip.",
        );
      const trip = await tripFor(issue.trip_id, c);
      if (!["planned", "loading", "blocked"].includes(trip.status))
        throw new HttpError(409, "The vehicle has already been released.");
      const next = (await nextOperatingDate(trip.run_date, c)) ?? trip.run_date;
      await c.query("DELETE FROM stops WHERE trip_id = $1 AND order_id = $2", [
        trip.id,
        issue.order_id,
      ]);
      // Resequence the remaining stops.
      await c.query(
        `UPDATE stops s SET seq = r.rn FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY seq) AS rn FROM stops WHERE trip_id = $1) r
          WHERE s.id = r.id AND s.seq <> r.rn`,
        [trip.id],
      );
      await c.query(
        `INSERT INTO deferrals(order_id, plan_id, from_date, to_date, code, reason, unavoidable, decided_by)
         VALUES ($1,$2,$3,$4,'MANUAL',$5,false,$6)`,
        [
          issue.order_id,
          trip.plan_id,
          trip.run_date,
          next,
          `Removed at loading: ${input.note}`,
          user.id,
        ],
      );
      await c.query(
        "UPDATE orders SET status = 'deferred', run_date = $2, deferred_count = deferred_count + 1 WHERE order_id = $1",
        [issue.order_id, next],
      );
      detail = `Order ${issue.order_id} moved to ${next}. ${input.note}`;
    }
    await c.query(
      "UPDATE issues SET status = 'resolved', resolution = $2, resolved_by = $3, resolved_at = now() WHERE id = $1",
      [
        issueId,
        `${input.action === "proceed" ? "Proceed" : "Removed from trip"}: ${input.note}`,
        user.id,
      ],
    );
    if (issue.trip_id) {
      const open = await c.query(
        "SELECT 1 FROM issues WHERE trip_id = $1 AND blocks_departure AND status = 'open'",
        [issue.trip_id],
      );
      if (open.rowCount === 0)
        await c.query(
          "UPDATE trips SET status = 'loading' WHERE id = $1 AND status = 'blocked'",
          [issue.trip_id],
        );
    }
  });
  await emit({
    type: "issue.resolved",
    title: `Issue #${issueId} resolved`,
    detail,
    severity: "success",
    actor_id: user.id,
    order_id: issue.order_id,
    trip_id: issue.trip_id,
    audience: ["dispatcher", "loader"],
  });
  if (input.action === "remove_order" && issue.order_id)
    await emit({
      type: "order.deferred",
      title: `Order ${issue.order_id} moved to the next run`,
      detail: `It could not be loaded complete: ${input.note}`,
      severity: "warning",
      order_id: issue.order_id,
      outlet_id: issue.outlet_id,
      audience: ["store_manager"],
    });
}

// ------------------------------------------------------------------ receipt

export async function confirmReceipt(
  user: SessionUser,
  orderId: string,
  input: {
    units_received: number;
    condition: "complete" | "short" | "damaged";
    note: string;
  },
) {
  const order = await one<{ outlet_id: string; status: string; units: number }>(
    "SELECT outlet_id, status, units FROM orders WHERE order_id = $1",
    [orderId],
  );
  if (!order || order.outlet_id !== user.outlet_id)
    throw new HttpError(404, "Order not found for your store.");
  if (
    !["delivered", "failed"].includes(order.status) &&
    order.status !== "disputed"
  )
    throw new HttpError(
      409,
      "You can confirm receipt once the driver's delivery record arrives.",
    );
  const disputed = input.condition !== "complete";
  await tx(async (c) => {
    await c.query(
      `INSERT INTO receipts(order_id, units_received, condition, note, confirmed_by) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (order_id) DO UPDATE SET units_received = EXCLUDED.units_received, condition = EXCLUDED.condition,
         note = EXCLUDED.note, confirmed_by = EXCLUDED.confirmed_by, confirmed_at = now()`,
      [
        orderId,
        input.units_received,
        input.condition,
        input.note || null,
        user.id,
      ],
    );
    await c.query("UPDATE orders SET status = $2 WHERE order_id = $1", [
      orderId,
      disputed ? "disputed" : "received",
    ]);
    if (disputed)
      await c.query(
        `INSERT INTO issues(kind, category, order_id, outlet_id, units_affected, description, reported_by)
         VALUES ('receipt_issue',$1,$2,$3,$4,$5,$6)`,
        [
          input.condition === "short" ? "Short delivery" : "Damaged goods",
          orderId,
          order.outlet_id,
          Math.max(0, order.units - input.units_received),
          input.note || "Reported at receipt.",
          user.id,
        ],
      );
  });
  await emit({
    type: disputed ? "receipt.disputed" : "receipt.confirmed",
    title: disputed
      ? `Store reported a problem with ${orderId}`
      : `${orderId} received by the store`,
    detail:
      `${input.units_received} of ${order.units} units, ${input.condition}. ${input.note}`.trim(),
    severity: disputed ? "warning" : "success",
    actor_id: user.id,
    order_id: orderId,
    outlet_id: order.outlet_id,
    audience: ["dispatcher"],
  });
}

export async function reportStoreIssue(
  user: SessionUser,
  orderId: string,
  category: string,
  description: string,
) {
  const order = await one<{ outlet_id: string }>(
    "SELECT outlet_id FROM orders WHERE order_id = $1",
    [orderId],
  );
  if (!order || order.outlet_id !== user.outlet_id)
    throw new HttpError(404, "Order not found for your store.");
  await query(
    `INSERT INTO issues(kind, category, order_id, outlet_id, description, reported_by) VALUES ('receipt_issue',$1,$2,$3,$4,$5)`,
    [category, orderId, order.outlet_id, description, user.id],
  );
  await emit({
    type: "issue.store",
    title: `${category} reported for ${orderId}`,
    detail: description,
    severity: "warning",
    actor_id: user.id,
    order_id: orderId,
    outlet_id: order.outlet_id,
    audience: ["dispatcher"],
  });
}
