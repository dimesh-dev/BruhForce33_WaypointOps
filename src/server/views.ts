import { one, query } from "./db.ts";
import { colombo, cutoffFor, now, orderingRunDate } from "./clock.ts";
import { HttpError } from "./http-error.ts";
import type { SessionUser } from "./users.ts";

/* Read models: one query bundle per screen, already scoped to the viewer. */

export async function currentRunDate(): Promise<string> {
  const meta = await one<{ value: string }>(
    "SELECT value FROM app_meta WHERE key = 'run_date'",
  );
  if (meta) return meta.value;
  const next = await one<{ date: string }>(
    "SELECT MIN(run_date)::text AS date FROM orders WHERE status = 'confirmed'",
  );
  return next?.date ?? colombo(new Date()).date;
}

export async function clockInfo() {
  const at = await now();
  const local = colombo(at);
  const orderingFor = await orderingRunDate(at);
  return {
    now: at.toISOString(),
    local_date: local.date,
    local_minutes: local.minutes,
    ordering_run_date: orderingFor ?? null,
    ordering_cutoff: orderingFor ? cutoffFor(orderingFor).toISOString() : null,
    simulated: !!(await one(
      "SELECT 1 FROM app_meta WHERE key = 'clock_anchor_sim'",
    )),
  };
}

const TRIP_SELECT = `
  SELECT t.*, v.type AS vehicle_type, v.temp AS vehicle_temp, v.weight_cap_kg, v.volume_cap_m3, v.driver_name,
         p.version, p.status AS plan_status, p.run_date,
         COALESCE(json_agg(json_build_object(
           'id', s.id, 'seq', s.seq, 'order_id', s.order_id, 'status', s.status, 'loaded', s.loaded,
           'arrival_min', s.arrival_min, 'service_start_min', s.service_start_min, 'depart_min', s.depart_min,
           'window_open_min', s.window_open_min, 'window_close_min', s.window_close_min, 'service_min', s.service_min,
           'completed_at', s.completed_at, 'outlet_id', o.outlet_id, 'outlet_name', ou.name, 'dock_type', ou.dock_type,
           'parking_constraint', ou.parking_constraint, 'temp_requirement', o.temp_requirement, 'units', o.units,
           'weight_kg', o.weight_kg, 'volume_m3', o.volume_m3, 'order_status', o.status
         ) ORDER BY s.seq) FILTER (WHERE s.id IS NOT NULL), '[]') AS stops
    FROM trips t
    JOIN plans p ON p.id = t.plan_id
    JOIN vehicles v ON v.vehicle_id = t.vehicle_id
    LEFT JOIN stops s ON s.trip_id = t.id
    LEFT JOIN orders o ON o.order_id = s.order_id
    LEFT JOIN outlets ou ON ou.outlet_id = o.outlet_id`;

export async function dispatcherBoard(runDate: string) {
  const [run, plans, orders, issues, vehicles] = await Promise.all([
    one(
      `SELECT c.date AS run_date, c.dow_name, c.is_payday, c.festival, c.festival_ramp, c.monsoon,
              r.cutoff_at, r.closed_at
         FROM calendar c LEFT JOIN run_days r ON r.run_date = c.date WHERE c.date = $1`,
      [runDate],
    ),
    query(
      "SELECT id, version, status, summary, created_at, published_at FROM plans WHERE run_date = $1 ORDER BY version DESC",
      [runDate],
    ),
    query(
      `SELECT o.order_id, o.outlet_id, ou.name AS outlet_name, o.brand, o.district, o.depot, o.temp_requirement, o.units,
              o.weight_kg, o.volume_m3, o.status, o.requested_date, o.run_date, o.deferred_count, o.placed_at,
              ou.parking_constraint, ou.dock_type, ou.window_open_time, ou.window_close_time, ou.mall_window
         FROM orders o JOIN outlets ou ON ou.outlet_id = o.outlet_id
        WHERE o.run_date = $1
           OR o.order_id IN (SELECT order_id FROM deferrals d JOIN plans p ON p.id = d.plan_id WHERE p.run_date = $1)
        ORDER BY o.order_id`,
      [runDate],
    ),
    query(
      `SELECT i.*, u.display_name AS reported_by_name, ou.name AS outlet_name, t.vehicle_id, t.trip_no
         FROM issues i LEFT JOIN users u ON u.id = i.reported_by LEFT JOIN outlets ou ON ou.outlet_id = i.outlet_id
         LEFT JOIN trips t ON t.id = i.trip_id
        ORDER BY (i.status = 'open') DESC, i.created_at DESC LIMIT 60`,
    ),
    query(
      "SELECT vehicle_id, type, temp, depot, status, volume_cap_m3, weight_cap_kg, driver_name FROM vehicles ORDER BY vehicle_id",
    ),
  ]);
  const active =
    plans.find((p) => p.status === "draft") ??
    plans.find((p) => p.status === "published");
  const published = plans.find((p) => p.status === "published");
  const trips = active
    ? await query(
        `${TRIP_SELECT} WHERE t.plan_id = $1 GROUP BY t.id, v.vehicle_id, p.id ORDER BY t.vehicle_id, t.trip_no`,
        [active.id],
      )
    : [];
  const deferrals = active
    ? await query(
        `SELECT d.*, o.outlet_id, ou.name AS outlet_name, o.brand, o.district, o.temp_requirement, o.volume_m3,
                o.deferred_count, ou.parking_constraint
           FROM deferrals d JOIN orders o ON o.order_id = d.order_id JOIN outlets ou ON ou.outlet_id = o.outlet_id
          WHERE d.plan_id = $1 ORDER BY d.unavoidable, d.order_id`,
        [active.id],
      )
    : [];
  // Outlets skipped on earlier runs and still waiting.
  const skipped = await query(
    `SELECT o.outlet_id, ou.name AS outlet_name, MAX(d.from_date) AS last_skipped, COUNT(*)::int AS times
       FROM deferrals d JOIN orders o ON o.order_id = d.order_id JOIN outlets ou ON ou.outlet_id = o.outlet_id
       LEFT JOIN plans p ON p.id = d.plan_id
      WHERE d.from_date < $1 AND (p.id IS NULL OR p.status = 'published')
      GROUP BY o.outlet_id, ou.name ORDER BY last_skipped DESC LIMIT 20`,
    [runDate],
  );
  return {
    run,
    plans,
    active_plan: active ?? null,
    published_plan: published ?? null,
    trips,
    deferrals,
    orders,
    issues,
    vehicles,
    skipped,
  };
}

export async function fleetView(runDate: string) {
  return query(
    `WITH wk AS (SELECT iso_year, iso_week FROM calendar WHERE date = $1)
     SELECT v.*,
       COALESCE((SELECT SUM(f.litres) FROM fuel_ledger f, wk WHERE f.vehicle_id = v.vehicle_id
                  AND f.iso_year = wk.iso_year AND f.iso_week = wk.iso_week AND f.run_date <> $1), 0) AS fuel_used_l,
       COALESCE((SELECT SUM(t.fuel_l) FROM trips t JOIN plans p ON p.id = t.plan_id JOIN calendar c ON c.date = p.run_date, wk
                  WHERE t.vehicle_id = v.vehicle_id AND p.status = 'published'
                    AND c.iso_year = wk.iso_year AND c.iso_week = wk.iso_week), 0) AS fuel_planned_l
       FROM vehicles v ORDER BY v.vehicle_id`,
    [runDate],
  );
}

export async function outletsView() {
  return query(
    `SELECT ou.*, (SELECT COUNT(*)::int FROM deferrals d JOIN orders o ON o.order_id = d.order_id WHERE o.outlet_id = ou.outlet_id) AS deferrals,
            (SELECT username FROM users u WHERE u.outlet_id = ou.outlet_id ORDER BY featured DESC LIMIT 1) AS manager_login
       FROM outlets ou ORDER BY ou.outlet_id`,
  );
}

/** Published trips loading at the loader's depot for the active run. */
export async function loaderView(user: SessionUser, runDate: string) {
  const plan = await one<{ id: number; version: number; published_at: string }>(
    "SELECT id, version, published_at FROM plans WHERE run_date = $1 AND status = 'published'",
    [runDate],
  );
  if (!plan) return { run_date: runDate, plan: null, trips: [], issues: [] };
  const trips = await query(
    `${TRIP_SELECT} WHERE t.plan_id = $1 AND t.depot = $2 GROUP BY t.id, v.vehicle_id, p.id
      ORDER BY (t.status IN ('in_transit','completed')), t.depart_min, t.vehicle_id, t.trip_no`,
    [plan.id, user.depot],
  );
  const issues = await query(
    `SELECT i.* FROM issues i JOIN trips t ON t.id = i.trip_id WHERE t.plan_id = $1 AND t.depot = $2 AND i.kind = 'loading_shortfall'
      ORDER BY i.created_at DESC`,
    [plan.id, user.depot],
  );
  return { run_date: runDate, plan, trips, issues };
}

/** The driver's trips in the most recent published plan that includes their vehicle. */
export async function driverView(user: SessionUser) {
  if (!user.vehicle_id)
    throw new HttpError(403, "No vehicle is assigned to this account.");
  const plan = await one<{ id: number; run_date: string; version: number }>(
    `SELECT p.id, p.run_date, p.version FROM plans p JOIN trips t ON t.plan_id = p.id
      WHERE p.status = 'published' AND t.vehicle_id = $1 ORDER BY p.run_date DESC LIMIT 1`,
    [user.vehicle_id],
  );
  const vehicle = await one("SELECT * FROM vehicles WHERE vehicle_id = $1", [
    user.vehicle_id,
  ]);
  if (!plan) return { plan: null, vehicle, trips: [] };
  const trips = await query(
    `${TRIP_SELECT} WHERE t.plan_id = $1 AND t.vehicle_id = $2 GROUP BY t.id, v.vehicle_id, p.id ORDER BY t.trip_no`,
    [plan.id, user.vehicle_id],
  );
  const extra = await query<{
    outlet_id: string;
    window_open_time: string;
    window_close_time: string;
    mall_window: string | null;
    district: string;
  }>(
    `SELECT DISTINCT ou.outlet_id, ou.window_open_time, ou.window_close_time, ou.mall_window, ou.district
       FROM outlets ou JOIN orders o ON o.outlet_id = ou.outlet_id JOIN stops s ON s.order_id = o.order_id
       JOIN trips t ON t.id = s.trip_id WHERE t.plan_id = $1 AND t.vehicle_id = $2`,
    [plan.id, user.vehicle_id],
  );
  return { plan, vehicle, trips, outlets: extra };
}

export async function storeView(user: SessionUser) {
  if (!user.outlet_id)
    throw new HttpError(403, "No outlet is assigned to this account.");
  const outlet = await one("SELECT * FROM outlets WHERE outlet_id = $1", [
    user.outlet_id,
  ]);
  const orders = await query(
    `SELECT o.*,
       (SELECT row_to_json(x) FROM (
          SELECT s.id AS stop_id, s.seq, s.status AS stop_status, s.arrival_min, s.service_start_min, s.window_close_min,
                 t.vehicle_id, t.trip_no, t.status AS trip_status, v.driver_name, p.version, p.run_date,
                 (SELECT COUNT(*)::int FROM stops s2 WHERE s2.trip_id = t.id AND s2.seq < s.seq AND s2.status IN ('pending','arrived')) AS stops_before
            FROM stops s JOIN trips t ON t.id = s.trip_id JOIN plans p ON p.id = t.plan_id JOIN vehicles v ON v.vehicle_id = t.vehicle_id
           WHERE s.order_id = o.order_id AND p.status = 'published' ORDER BY p.run_date DESC LIMIT 1) x) AS stop,
       (SELECT row_to_json(d) FROM (
          SELECT d.from_date, d.to_date, d.code, d.reason, d.unavoidable, d.created_at FROM deferrals d
            LEFT JOIN plans p ON p.id = d.plan_id
           WHERE d.order_id = o.order_id AND (p.id IS NULL OR p.status = 'published') ORDER BY d.created_at DESC LIMIT 1) d) AS deferral,
       (SELECT row_to_json(pr) FROM (
          SELECT outcome, receiver_name, units_delivered, note, failure_reason, recorded_at, photo IS NOT NULL AS has_photo,
                 signature IS NOT NULL AS has_signature
            FROM proofs WHERE order_id = o.order_id AND NOT superseded ORDER BY recorded_at DESC LIMIT 1) pr) AS proof,
       (SELECT row_to_json(r) FROM (SELECT units_received, condition, note, confirmed_at FROM receipts WHERE order_id = o.order_id) r) AS receipt
       FROM orders o WHERE o.outlet_id = $1 ORDER BY o.placed_at DESC LIMIT 20`,
    [user.outlet_id],
  );
  return { outlet, orders, clock: await clockInfo() };
}
