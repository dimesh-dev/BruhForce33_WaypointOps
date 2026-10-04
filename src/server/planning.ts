import type pg from "pg";
import { one, query, tx, type Db, pool } from "./db.ts";
import { dayLabel, nextOperatingDate } from "./clock.ts";
import { emit } from "./events.ts";
import {
  solve,
  validate,
  toHHMM,
  type Deferral,
  type OutletRef,
  type PlanResult,
  type PlanningContext,
  type PlanningOrder,
  type TripInput,
  type VehicleRef,
  type DistrictRef,
} from "../lib/planning/engine.ts";

export class PlanError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// ----------------------------------------------------------------- loading

export async function loadContext(
  runDate: string,
  db: Db = pool(),
): Promise<PlanningContext> {
  // Sequential on purpose: `db` may be a single transaction client.
  const outlets = await query<OutletRef>("SELECT * FROM outlets", [], db);
  const districts = await query<DistrictRef>(
    "SELECT * FROM district_travel",
    [],
    db,
  );
  const allowance = await query<{
    brand: string;
    dock_type: string;
    service_allowance_min: number;
  }>("SELECT * FROM service_allowance", [], db);
  const vehicles = await query<VehicleRef & { status: string; used_l: number }>(
    `WITH wk AS (SELECT iso_year, iso_week FROM calendar WHERE date = $1)
       SELECT v.*, v.status = 'available' AS available,
         COALESCE((SELECT SUM(f.litres) FROM fuel_ledger f, wk
                    WHERE f.vehicle_id = v.vehicle_id AND f.iso_year = wk.iso_year AND f.iso_week = wk.iso_week
                      AND f.run_date <> $1), 0)
         + COALESCE((SELECT SUM(t.fuel_l) FROM trips t JOIN plans p ON p.id = t.plan_id
                      JOIN calendar c ON c.date = p.run_date, wk
                     WHERE t.vehicle_id = v.vehicle_id AND p.status = 'published' AND p.run_date <> $1
                       AND c.iso_year = wk.iso_year AND c.iso_week = wk.iso_week), 0) AS used_l
       FROM vehicles v ORDER BY v.vehicle_id`,
    [runDate],
    db,
  );
  return {
    outlets: new Map(outlets.map((o) => [o.outlet_id, o])),
    districts: new Map(districts.map((d) => [d.district, d])),
    allowance: new Map(
      allowance.map((a) => [
        `${a.brand}:${a.dock_type}`,
        a.service_allowance_min,
      ]),
    ),
    vehicles: vehicles.map((v) => ({
      ...v,
      fuel_remaining_l: Math.max(0, v.weekly_fuel_quota_l - v.used_l),
    })),
  };
}

/** Orders competing for a run: queued for it, plus any the current published plan pushed out of it. */
export async function loadPlanningOrders(
  runDate: string,
  db: Db = pool(),
): Promise<PlanningOrder[]> {
  return query<PlanningOrder>(
    `SELECT o.order_id, o.outlet_id, o.brand, o.district, o.depot, o.temp_requirement, o.units,
            o.weight_kg, o.volume_m3,
            o.deferred_count - CASE WHEN o.run_date <> $1 THEN 1 ELSE 0 END AS deferred_count,
            GREATEST(0, $1::date - o.requested_date) AS days_waiting
       FROM orders o
      WHERE (o.run_date = $1 AND o.status IN ('confirmed','planned','deferred'))
         OR o.order_id IN (SELECT d.order_id FROM deferrals d JOIN plans p ON p.id = d.plan_id
                            WHERE p.run_date = $1 AND p.status = 'published' AND d.from_date = $1)
      ORDER BY o.order_id`,
    [runDate],
    db,
  );
}

// ----------------------------------------------------------------- writing

async function writePlan(
  c: pg.PoolClient,
  planId: number,
  runDate: string,
  result: PlanResult,
) {
  await c.query("DELETE FROM trips WHERE plan_id = $1", [planId]);
  await c.query("DELETE FROM deferrals WHERE plan_id = $1", [planId]);
  for (const t of result.trips) {
    const { rows } = await c.query<{ id: number }>(
      `INSERT INTO trips(plan_id, vehicle_id, trip_no, brand, district, depot, depart_min, return_min, trip_minutes,
         weight_kg, volume_m3, distance_km, fuel_l)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [
        planId,
        t.vehicle_id,
        t.trip_no,
        t.brand,
        t.district,
        t.depot,
        t.depart_min,
        t.return_min,
        t.trip_minutes,
        t.weight_kg,
        t.volume_m3,
        t.distance_km,
        t.fuel_l,
      ],
    );
    for (const s of t.stops)
      await c.query(
        `INSERT INTO stops(trip_id, order_id, seq, arrival_min, service_start_min, depart_min, window_open_min,
           window_close_min, service_min) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          rows[0].id,
          s.order_id,
          s.seq,
          s.arrival_min,
          s.service_start_min,
          s.depart_min,
          s.window_open_min,
          s.window_close_min,
          s.service_min,
        ],
      );
  }
  const next = (await nextOperatingDate(runDate, c)) ?? runDate;
  for (const d of result.deferrals)
    await c.query(
      `INSERT INTO deferrals(order_id, plan_id, from_date, to_date, code, reason, unavoidable)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [d.order_id, planId, runDate, next, d.code, d.reason, d.unavoidable],
    );
  await c.query("UPDATE plans SET summary = $2 WHERE id = $1", [
    planId,
    JSON.stringify(result.summary),
  ]);
}

async function assertPlannable(runDate: string, db: Db) {
  const running = await one<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM trips t JOIN plans p ON p.id = t.plan_id
      WHERE p.run_date = $1 AND p.status = 'published' AND t.status IN ('in_transit','completed')`,
    [runDate],
    db,
  );
  if (running && running.n > 0)
    throw new PlanError(
      "Vehicles for this run are already on the road; the plan can no longer be replaced.",
      409,
    );
}

/** Runs the allocation engine and stores the result as the run's draft plan. */
export async function generatePlan(runDate: string, userId: number) {
  await assertPlannable(runDate, pool());
  const [ctx, orders] = await Promise.all([
    loadContext(runDate),
    loadPlanningOrders(runDate),
  ]);
  if (orders.length === 0)
    throw new PlanError("There are no confirmed orders for this run.", 422);
  const result = solve(orders, ctx);
  if (result.violations.length)
    throw new PlanError(
      "Engine produced an infeasible plan.",
      500,
      result.violations,
    );
  const planId = await tx(async (c) => {
    await c.query(
      "DELETE FROM plans WHERE run_date = $1 AND status = 'draft'",
      [runDate],
    );
    const v = await c.query<{ v: number }>(
      "SELECT COALESCE(MAX(version),0)+1 AS v FROM plans WHERE run_date = $1",
      [runDate],
    );
    const { rows } = await c.query<{ id: number }>(
      "INSERT INTO plans(run_date, version, status, summary, created_by) VALUES ($1,$2,'draft',$3,$4) RETURNING id",
      [runDate, v.rows[0].v, JSON.stringify(result.summary), userId],
    );
    await writePlan(c, rows[0].id, runDate, result);
    return rows[0].id;
  });
  return { planId, summary: result.summary };
}

/** Current trips and deferrals of a plan, in engine input form. */
async function currentAllocation(planId: number, db: Db) {
  const trips = await query<{
    vehicle_id: string;
    trip_no: number;
    order_ids: string[];
  }>(
    `SELECT t.vehicle_id, t.trip_no, array_agg(s.order_id ORDER BY s.seq) AS order_ids
       FROM trips t JOIN stops s ON s.trip_id = t.id WHERE t.plan_id = $1
      GROUP BY t.vehicle_id, t.trip_no ORDER BY t.vehicle_id, t.trip_no`,
    [planId],
    db,
  );
  const deferrals = await query<Deferral>(
    "SELECT order_id, code, reason, unavoidable FROM deferrals WHERE plan_id = $1",
    [planId],
    db,
  );
  return {
    trips: trips.map((t) => ({
      vehicle_id: t.vehicle_id,
      order_ids: t.order_ids,
    })),
    deferrals,
  };
}

export type PlanEdit =
  | { type: "assign"; order_id: string; vehicle_id: string }
  | { type: "defer"; order_id: string; reason: string };

/**
 * Manual decision with validation: move an order onto a vehicle (joining its
 * trip for the same brand and district, or opening one) or defer it with a
 * reason. The edited plan is re-validated against every rule; any violation
 * rejects the edit and is returned to the dispatcher.
 */
export async function editPlan(planId: number, edit: PlanEdit, userId: number) {
  const plan = await one<{ run_date: string; status: string }>(
    "SELECT run_date, status FROM plans WHERE id = $1",
    [planId],
  );
  if (!plan) throw new PlanError("Plan not found.", 404);
  if (plan.status !== "draft")
    throw new PlanError(
      "Only a draft plan can be edited. Generate a new draft first.",
      409,
    );
  const [ctx, orders, current] = await Promise.all([
    loadContext(plan.run_date),
    loadPlanningOrders(plan.run_date),
    currentAllocation(planId, pool()),
  ]);
  const order = orders.find((o) => o.order_id === edit.order_id);
  if (!order)
    throw new PlanError(`Order ${edit.order_id} is not part of this run.`, 404);

  let trips: TripInput[] = current.trips.map((t) => ({
    ...t,
    order_ids: t.order_ids.filter((id) => id !== edit.order_id),
  }));
  trips = trips.filter((t) => t.order_ids.length);
  const deferrals = current.deferrals.filter(
    (d) => d.order_id !== edit.order_id,
  );

  if (edit.type === "defer") {
    if (!edit.reason?.trim())
      throw new PlanError("A deferral needs a reason the store will see.", 422);
    deferrals.push({
      order_id: edit.order_id,
      code: "MANUAL",
      reason: edit.reason.trim(),
      unavoidable: false,
    });
  } else {
    const target = trips.find((t) => {
      if (t.vehicle_id !== edit.vehicle_id) return false;
      const head = orders.find((o) => o.order_id === t.order_ids[0]);
      return head?.brand === order.brand && head?.district === order.district;
    });
    if (target) target.order_ids.push(edit.order_id);
    else
      trips.push({ vehicle_id: edit.vehicle_id, order_ids: [edit.order_id] });
  }

  const result = validate(orders, trips, deferrals, ctx);
  if (result.violations.length)
    throw new PlanError(
      "That change breaks an operating constraint.",
      422,
      result.violations,
    );
  await tx(async (c) => writePlan(c, planId, plan.run_date, result));
  await emit({
    type: "plan.edited",
    title:
      edit.type === "defer"
        ? `Deferred ${edit.order_id}`
        : `Moved ${edit.order_id} to ${edit.vehicle_id}`,
    detail:
      edit.type === "defer"
        ? edit.reason
        : "Manual allocation passed every constraint check.",
    actor_id: userId,
    order_id: edit.order_id,
    audience: ["dispatcher"],
  });
  return { summary: result.summary };
}

/**
 * Publishes a draft. Replaces any earlier published version (only while no
 * vehicle has left), moves deferred orders to the next operating run and
 * notifies loaders, drivers and stores.
 */
export async function publishPlan(planId: number, userId: number) {
  const plan = await one<{ run_date: string; status: string; version: number }>(
    "SELECT run_date, status, version FROM plans WHERE id = $1",
    [planId],
  );
  if (!plan) throw new PlanError("Plan not found.", 404);
  if (plan.status !== "draft")
    throw new PlanError("This plan is already published.", 409);
  await assertPlannable(plan.run_date, pool());
  const runDate = plan.run_date;

  const notices = await tx(async (c) => {
    // Undo the previous published version's deferrals so they are re-decided by this one.
    const prior = await c.query<{ id: number }>(
      "SELECT id FROM plans WHERE run_date = $1 AND status = 'published'",
      [runDate],
    );
    for (const p of prior.rows) {
      await c.query(
        `UPDATE orders o SET run_date = d.from_date, deferred_count = GREATEST(0, o.deferred_count - 1), status = 'confirmed'
           FROM deferrals d WHERE d.plan_id = $1 AND d.order_id = o.order_id`,
        [p.id],
      );
      await c.query("UPDATE plans SET status = 'superseded' WHERE id = $1", [
        p.id,
      ]);
    }
    await c.query(
      "UPDATE plans SET status = 'published', published_at = now() WHERE id = $1",
      [planId],
    );
    await c.query(
      `UPDATE orders SET status = 'planned', run_date = $2
        WHERE order_id IN (SELECT s.order_id FROM stops s JOIN trips t ON t.id = s.trip_id WHERE t.plan_id = $1)`,
      [planId, runDate],
    );
    await c.query(
      `UPDATE orders o SET status = 'deferred', run_date = d.to_date, deferred_count = o.deferred_count + 1
         FROM deferrals d WHERE d.plan_id = $1 AND d.order_id = o.order_id`,
      [planId],
    );
    await c.query(
      "INSERT INTO run_days(run_date, cutoff_at, closed_at, closed_by) VALUES ($1, now(), now(), $2) ON CONFLICT (run_date) DO UPDATE SET closed_at = COALESCE(run_days.closed_at, now()), closed_by = COALESCE(run_days.closed_by, $2)",
      [runDate, userId],
    );
    const served = await c.query<{
      order_id: string;
      outlet_id: string;
      vehicle_id: string;
      arrival_min: number;
      depot: string;
      trip_id: number;
    }>(
      `SELECT s.order_id, o.outlet_id, t.vehicle_id, s.arrival_min, t.depot, t.id AS trip_id
         FROM stops s JOIN trips t ON t.id = s.trip_id JOIN orders o ON o.order_id = s.order_id WHERE t.plan_id = $1`,
      [planId],
    );
    const deferred = await c.query<{
      order_id: string;
      outlet_id: string;
      reason: string;
      to_date: string;
    }>(
      `SELECT d.order_id, o.outlet_id, d.reason, d.to_date FROM deferrals d JOIN orders o ON o.order_id = d.order_id
        WHERE d.plan_id = $1`,
      [planId],
    );
    return { served: served.rows, deferred: deferred.rows };
  });

  const version = `v${plan.version}`;
  await emit({
    type: "plan.published",
    title: `Plan ${version} published for ${dayLabel(runDate)}`,
    detail: `${notices.served.length} orders scheduled, ${notices.deferred.length} deferred.`,
    severity: "success",
    actor_id: userId,
    audience: ["dispatcher", "loader", "driver"],
  });
  for (const s of notices.served)
    await emit({
      type: "order.scheduled",
      title: `Order ${s.order_id} scheduled`,
      detail: `Expected arrival ${toHHMM(s.arrival_min)} on ${dayLabel(runDate)} (vehicle ${s.vehicle_id}).`,
      order_id: s.order_id,
      outlet_id: s.outlet_id,
      vehicle_id: s.vehicle_id,
      trip_id: s.trip_id,
      audience: ["store_manager"],
    });
  for (const d of notices.deferred)
    await emit({
      type: "order.deferred",
      title: `Order ${d.order_id} moved to ${dayLabel(d.to_date)}`,
      detail: d.reason,
      severity: "warning",
      order_id: d.order_id,
      outlet_id: d.outlet_id,
      audience: ["store_manager", "dispatcher"],
    });
  return { runDate, version: plan.version };
}

export async function closeQueue(runDate: string, userId: number) {
  await query(
    `INSERT INTO run_days(run_date, cutoff_at, closed_at, closed_by) VALUES ($1, now(), now(), $2)
     ON CONFLICT (run_date) DO UPDATE SET closed_at = now(), closed_by = $2`,
    [runDate, userId],
  );
  await emit({
    type: "orders.closed",
    title: `Order queue closed for ${dayLabel(runDate)}`,
    detail: "New store orders now join the following operating run.",
    actor_id: userId,
    audience: ["dispatcher", "store_manager"],
  });
}
