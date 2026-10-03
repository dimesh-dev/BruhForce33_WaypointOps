/** Prints what the engine would do for the seeded run without saving anything. */
import { loadContext, loadPlanningOrders } from "../src/server/planning.ts";
import { solve, toHHMM } from "../src/lib/planning/engine.ts";
import { one, pool } from "../src/server/db.ts";

const runDate =
  process.argv[2] ??
  (await one<{ value: string }>(
    "SELECT value FROM app_meta WHERE key='run_date'",
  ))!.value;
const [ctx, orders] = await Promise.all([
  loadContext(runDate),
  loadPlanningOrders(runDate),
]);
const result = solve(orders, ctx);
console.log(JSON.stringify(result.summary, null, 2));
console.log("violations", result.violations.length);
const codes = new Map<string, number>();
result.deferrals.forEach((d) =>
  codes.set(d.code, (codes.get(d.code) ?? 0) + 1),
);
console.log("deferrals by code", Object.fromEntries(codes));
for (const t of result.trips.filter((t) => ["VEH001"].includes(t.vehicle_id)))
  console.log(
    t.vehicle_id,
    t.trip_no,
    t.brand,
    t.district,
    t.order_ids.join(" "),
    toHHMM(t.depart_min),
    t.trip_minutes,
    t.stops.map((s) => `${s.outlet_id}@${toHHMM(s.arrival_min)}`).join(" "),
  );
await pool().end();
