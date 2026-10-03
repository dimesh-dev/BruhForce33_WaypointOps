import { one, tx } from "./db.ts";
import { cutoffFor, now, orderingRunDate } from "./clock.ts";
import { emit } from "./events.ts";
import { HttpError } from "./http-error.ts";
import type { SessionUser } from "./users.ts";

export interface NewOrder {
  temp_requirement: "chilled" | "ambient";
  units: number;
  weight_kg: number;
  volume_m3: number;
  notes?: string;
  client_ref?: string;
}

/**
 * A store places an order. It joins the next run whose 16:00 cutoff has not
 * passed and whose queue is still open, and the store gets that decision back
 * immediately as its confirmation.
 */
export async function placeOrder(user: SessionUser, input: NewOrder) {
  if (!user.outlet_id)
    throw new HttpError(403, "No outlet is assigned to this account.");
  const outlet = await one<{
    outlet_id: string;
    brand: string;
    district: string;
    depot: string;
    name: string;
  }>(
    "SELECT outlet_id, brand, district, depot, name FROM outlets WHERE outlet_id = $1",
    [user.outlet_id],
  );
  if (!outlet) throw new HttpError(404, "Outlet not found.");
  if (input.temp_requirement === "chilled" && outlet.brand !== "Fresh")
    throw new HttpError(
      422,
      "Only Waypoint Fresh outlets order chilled goods.",
    );
  if (input.client_ref) {
    const existing = await one<{ order_id: string; run_date: string }>(
      "SELECT order_id, run_date FROM orders WHERE client_ref = $1",
      [input.client_ref],
    );
    if (existing) return { ...existing, duplicate: true };
  }
  const at = await now();
  const runDate = await orderingRunDate(at);
  if (!runDate)
    throw new HttpError(409, "No upcoming operating day is open for orders.");
  const orderId = await tx(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [runDate]);
    const { rows } = await c.query<{ n: number }>(
      "SELECT COUNT(*)::int + 1 AS n FROM orders WHERE order_id LIKE $1",
      [`ORD${runDate.replaceAll("-", "").slice(2)}-%`],
    );
    const id = `ORD${runDate.replaceAll("-", "").slice(2)}-${String(rows[0].n).padStart(4, "0")}`;
    await c.query(
      `INSERT INTO orders(order_id, outlet_id, brand, district, depot, requested_date, run_date, temp_requirement, units,
         weight_kg, volume_m3, notes, placed_by, placed_at, client_ref)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        id,
        outlet.outlet_id,
        outlet.brand,
        outlet.district,
        outlet.depot,
        runDate,
        input.temp_requirement,
        input.units,
        input.weight_kg,
        input.volume_m3,
        input.notes?.trim() || null,
        user.id,
        at,
        input.client_ref ?? null,
      ],
    );
    return id;
  });
  await emit({
    type: "order.placed",
    title: `${outlet.name} ordered for ${runDate}`,
    detail: `${orderId}: ${input.units} units ${input.temp_requirement}, ${input.volume_m3} m³, ${input.weight_kg} kg.`,
    actor_id: user.id,
    order_id: orderId,
    outlet_id: outlet.outlet_id,
    audience: ["dispatcher", "store_manager"],
  });
  return {
    order_id: orderId,
    run_date: runDate,
    cutoff_at: cutoffFor(runDate).toISOString(),
    duplicate: false,
  };
}
