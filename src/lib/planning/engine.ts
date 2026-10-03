/**
 * Waypoint planning and allocation engine.
 *
 * Pure functions: no database or framework imports, so the API, the seed script
 * and the unit tests all run exactly the same rules.
 *
 * Hard constraints (Challenge Booklet pp. 5, 20-21):
 *   R1 one brand and one district per trip
 *   R2 chilled orders only on reefer vehicles
 *   R3 van_only outlets only on vans
 *   R4 vehicles serve only their home depot's outlets
 *   R5 whole orders, each on exactly one vehicle and trip
 *   R6 trip weight and volume within the vehicle's limits
 *   R7 at most two trips per vehicle; Fresh trips within 270 min (03:30-08:00),
 *      Style and Tech trips within 480 min (departing from 05:00 at the earliest)
 *   W  every stop arrives before its delivery window closes (mall windows
 *      intersect the outlet window); early arrivals wait for the window to open
 *   F  route distance fits the vehicle's remaining weekly fuel quota
 *   A  only vehicles marked available (not in_workshop) are used
 */

export type Brand = "Fresh" | "Style" | "Tech";
export type DockType = "rear_dock" | "street" | "mall_bay";
export type Parking = "normal" | "van_only" | "mall_dock";
export type Temp = "chilled" | "ambient";

export interface OutletRef {
  outlet_id: string;
  name: string;
  brand: Brand;
  district: string;
  depot: string;
  dock_type: DockType;
  parking_constraint: Parking;
  mall_window: string | null;
  window_open_time: string;
  window_close_time: string;
}

export interface VehicleRef {
  vehicle_id: string;
  type: "truck" | "van";
  temp: "reefer" | "ambient";
  weight_cap_kg: number;
  volume_cap_m3: number;
  km_per_l: number;
  weekly_fuel_quota_l: number;
  depot: string;
  available: boolean;
  /** Weekly quota minus fuel already committed this ISO week by other days. */
  fuel_remaining_l: number;
}

export interface DistrictRef {
  district: string;
  depot: string;
  depot_to_district_km: number;
  depot_to_district_freeflow_min: number;
  inter_stop_km: number;
  inter_stop_freeflow_min: number;
}

export interface PlanningOrder {
  order_id: string;
  outlet_id: string;
  brand: Brand;
  district: string;
  depot: string;
  temp_requirement: Temp;
  units: number;
  weight_kg: number;
  volume_m3: number;
  /** Consecutive runs this outlet has already been skipped. */
  deferred_count: number;
  /** Days the order has been waiting past its requested date. */
  days_waiting: number;
}

export interface PlanningContext {
  outlets: Map<string, OutletRef>;
  vehicles: VehicleRef[];
  districts: Map<string, DistrictRef>;
  allowance: Map<string, number>; // `${brand}:${dock_type}` -> minutes
}

export const FRESH_START_MIN = 3 * 60 + 30;
export const FRESH_BUDGET_MIN = 270;
/** Earliest departure for Style and Tech trips; their 480-minute budget covers the trading day. */
export const DAY_START_MIN = 5 * 60;
export const DAY_BUDGET_MIN = 480;
export const MAX_TRIPS = 2;

export type RuleCode =
  "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "W" | "F" | "A" | "X";

export interface Violation {
  rule: RuleCode;
  message: string;
  vehicle_id?: string;
  trip_no?: number;
  order_id?: string;
}

export interface TripInput {
  vehicle_id: string;
  order_ids: string[];
}

export interface ScheduledStop {
  order_id: string;
  outlet_id: string;
  seq: number;
  arrival_min: number;
  service_start_min: number;
  depart_min: number;
  window_open_min: number;
  window_close_min: number;
  service_min: number;
  wait_min: number;
  late: boolean;
}

export interface ScheduledTrip {
  vehicle_id: string;
  trip_no: 1 | 2;
  brand: Brand;
  district: string;
  depot: string;
  order_ids: string[];
  stops: ScheduledStop[];
  weight_kg: number;
  volume_m3: number;
  /** Booklet trip time: outbound + inter-stop + handling (no waiting, no return). */
  trip_minutes: number;
  outbound_min: number;
  inter_stop_min: number;
  handling_min: number;
  depart_min: number;
  return_min: number;
  distance_km: number;
  fuel_l: number;
}

export interface VehicleDay {
  vehicle_id: string;
  trips: ScheduledTrip[];
  fresh_minutes: number;
  day_minutes: number;
  fuel_l: number;
  violations: Violation[];
}

export type DeferralCode =
  | "NO_COMPATIBLE_VEHICLE"
  | "WINDOW_UNREACHABLE"
  | "FUEL_QUOTA"
  | "REEFER_CAPACITY"
  | "VAN_CAPACITY"
  | "TIME_BUDGET"
  | "FLEET_CAPACITY"
  | "MANUAL";

export interface Deferral {
  order_id: string;
  code: DeferralCode;
  reason: string;
  /** True when no feasible placement existed; false when the dispatcher chose it. */
  unavoidable: boolean;
}

export interface PlanResult {
  trips: ScheduledTrip[];
  deferrals: Deferral[];
  vehicles: VehicleDay[];
  violations: Violation[];
  summary: PlanSummary;
}

export interface PlanSummary {
  orders: number;
  served: number;
  deferred: number;
  service_rate_pct: number;
  trips: number;
  vehicles_used: number;
  reefer_trips: number;
  total_volume_m3: number;
  total_fuel_l: number;
  by_brand: Record<Brand, { orders: number; served: number }>;
  binding: string[];
}

// ------------------------------------------------------------------ helpers

export const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const toHHMM = (min: number): string => {
  const m = Math.round(min);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Delivery window an outlet can actually receive in; mall bays intersect the mall window. */
export function effectiveWindow(o: OutletRef): [number, number] {
  let open = toMin(o.window_open_time);
  let close = toMin(o.window_close_time);
  if (o.mall_window && o.mall_window.includes("-")) {
    const [mo, mc] = o.mall_window.split("-").map((s) => toMin(s.trim()));
    open = Math.max(open, mo);
    close = Math.min(close, mc);
  }
  return [open, close];
}

const round = (n: number, d = 2) => Number(n.toFixed(d));

function compatible(
  v: VehicleRef,
  o: PlanningOrder,
  outlet: OutletRef | undefined,
): boolean {
  if (v.depot !== o.depot) return false;
  if (o.temp_requirement === "chilled" && v.temp !== "reefer") return false;
  if (outlet?.parking_constraint === "van_only" && v.type !== "van")
    return false;
  return true;
}

// --------------------------------------------------------------- scheduling

interface TripDraft {
  orders: PlanningOrder[];
}

/**
 * Schedules a vehicle's whole day. Fresh trips run first from 03:30; Style and
 * Tech trips start at 08:00 at the earliest (or when the vehicle returns) and
 * leave late enough to reach the first window as it opens.
 */
export function scheduleVehicle(
  vehicle: VehicleRef,
  drafts: TripDraft[],
  ctx: PlanningContext,
): VehicleDay {
  const violations: Violation[] = [];
  const nonEmpty = drafts.filter((d) => d.orders.length > 0);
  const ordered = [...nonEmpty].sort(
    (a, b) =>
      Number(b.orders[0].brand === "Fresh") -
      Number(a.orders[0].brand === "Fresh"),
  );
  if (!vehicle.available)
    violations.push({
      rule: "A",
      vehicle_id: vehicle.vehicle_id,
      message: `${vehicle.vehicle_id} is in the workshop and cannot be allocated.`,
    });
  if (ordered.length > MAX_TRIPS)
    violations.push({
      rule: "R7",
      vehicle_id: vehicle.vehicle_id,
      message: `${vehicle.vehicle_id} has ${ordered.length} trips; a vehicle may run at most ${MAX_TRIPS}.`,
    });

  const trips: ScheduledTrip[] = [];
  let clock = FRESH_START_MIN;
  ordered.forEach((draft, index) => {
    const tripNo = (index + 1) as 1 | 2;
    const first = draft.orders[0];
    const brands = new Set(draft.orders.map((o) => o.brand));
    const districts = new Set(draft.orders.map((o) => o.district));
    if (brands.size > 1 || districts.size > 1)
      violations.push({
        rule: "R1",
        vehicle_id: vehicle.vehicle_id,
        trip_no: tripNo,
        message: `Trip ${tripNo} mixes ${[...brands].join("/")} orders across ${[...districts].join("/")}; a trip serves one brand and one district.`,
      });
    const district = ctx.districts.get(first.district);
    if (!district) {
      violations.push({
        rule: "X",
        vehicle_id: vehicle.vehicle_id,
        trip_no: tripNo,
        message: `No travel record for district ${first.district}.`,
      });
      return;
    }
    let weight = 0;
    let volume = 0;
    for (const o of draft.orders) {
      const outlet = ctx.outlets.get(o.outlet_id);
      weight += o.weight_kg;
      volume += o.volume_m3;
      if (o.depot !== vehicle.depot)
        violations.push({
          rule: "R4",
          vehicle_id: vehicle.vehicle_id,
          trip_no: tripNo,
          order_id: o.order_id,
          message: `${o.order_id} belongs to ${o.depot}; ${vehicle.vehicle_id} is based at ${vehicle.depot}.`,
        });
      if (o.temp_requirement === "chilled" && vehicle.temp !== "reefer")
        violations.push({
          rule: "R2",
          vehicle_id: vehicle.vehicle_id,
          trip_no: tripNo,
          order_id: o.order_id,
          message: `${o.order_id} is chilled; ${vehicle.vehicle_id} is not refrigerated.`,
        });
      if (outlet?.parking_constraint === "van_only" && vehicle.type !== "van")
        violations.push({
          rule: "R3",
          vehicle_id: vehicle.vehicle_id,
          trip_no: tripNo,
          order_id: o.order_id,
          message: `${outlet.outlet_id} is van-only; ${vehicle.vehicle_id} is a truck.`,
        });
    }
    if (weight > vehicle.weight_cap_kg + 1e-6)
      violations.push({
        rule: "R6",
        vehicle_id: vehicle.vehicle_id,
        trip_no: tripNo,
        message: `Trip ${tripNo} weighs ${round(weight, 0)} kg; limit ${vehicle.weight_cap_kg} kg.`,
      });
    if (volume > vehicle.volume_cap_m3 + 1e-6)
      violations.push({
        rule: "R6",
        vehicle_id: vehicle.vehicle_id,
        trip_no: tripNo,
        message: `Trip ${tripNo} fills ${round(volume, 1)} m³; limit ${vehicle.volume_cap_m3} m³.`,
      });

    // Stop sequence: tightest closing window first.
    const seq = draft.orders
      .map((o) => {
        const outlet = ctx.outlets.get(o.outlet_id)!;
        const [open, close] = effectiveWindow(outlet);
        return { o, outlet, open, close };
      })
      .sort(
        (a, b) =>
          a.close - b.close ||
          a.open - b.open ||
          a.o.order_id.localeCompare(b.o.order_id),
      );

    const outbound = district.depot_to_district_freeflow_min;
    const isFresh = first.brand === "Fresh";
    // Leave late enough to reach the first window as it opens instead of idling at the outlet.
    const earliest = isFresh ? FRESH_START_MIN : DAY_START_MIN;
    const depart = Math.max(clock, earliest, (seq[0]?.open ?? 0) - outbound);
    let t = depart + outbound;
    let handling = 0;
    const stops: ScheduledStop[] = seq.map((s, i) => {
      if (i > 0) t += district.inter_stop_freeflow_min;
      const arrival = t;
      const service =
        ctx.allowance.get(`${first.brand}:${s.outlet.dock_type}`) ?? 20;
      handling += service;
      const start = Math.max(arrival, s.open);
      const late = arrival > s.close;
      if (late)
        violations.push({
          rule: "W",
          vehicle_id: vehicle.vehicle_id,
          trip_no: tripNo,
          order_id: s.o.order_id,
          message: `${s.o.order_id} would arrive ${toHHMM(arrival)}, after ${s.outlet.outlet_id}'s window closes at ${toHHMM(s.close)}.`,
        });
      t = start + service;
      return {
        order_id: s.o.order_id,
        outlet_id: s.outlet.outlet_id,
        seq: i + 1,
        arrival_min: arrival,
        service_start_min: start,
        depart_min: t,
        window_open_min: s.open,
        window_close_min: s.close,
        service_min: service,
        wait_min: start - arrival,
        late,
      };
    });
    const interStop =
      district.inter_stop_freeflow_min * Math.max(0, seq.length - 1);
    const distance =
      2 * district.depot_to_district_km +
      district.inter_stop_km * Math.max(0, seq.length - 1);
    const returnAt = t + outbound;
    clock = returnAt;
    trips.push({
      vehicle_id: vehicle.vehicle_id,
      trip_no: tripNo,
      brand: first.brand,
      district: first.district,
      depot: vehicle.depot,
      order_ids: seq.map((s) => s.o.order_id),
      stops,
      weight_kg: round(weight, 1),
      volume_m3: round(volume, 2),
      trip_minutes: outbound + interStop + handling,
      outbound_min: outbound,
      inter_stop_min: interStop,
      handling_min: handling,
      depart_min: depart,
      return_min: returnAt,
      distance_km: round(distance, 1),
      fuel_l: round(distance / vehicle.km_per_l, 2),
    });
  });

  const fresh = trips
    .filter((t) => t.brand === "Fresh")
    .reduce((s, t) => s + t.trip_minutes, 0);
  const day = trips
    .filter((t) => t.brand !== "Fresh")
    .reduce((s, t) => s + t.trip_minutes, 0);
  const fuel = trips.reduce((s, t) => s + t.fuel_l, 0);
  if (fresh > FRESH_BUDGET_MIN)
    violations.push({
      rule: "R7",
      vehicle_id: vehicle.vehicle_id,
      message: `${vehicle.vehicle_id} Fresh trips take ${fresh} min; budget ${FRESH_BUDGET_MIN} min (03:30-08:00).`,
    });
  if (day > DAY_BUDGET_MIN)
    violations.push({
      rule: "R7",
      vehicle_id: vehicle.vehicle_id,
      message: `${vehicle.vehicle_id} Style/Tech trips take ${day} min; budget ${DAY_BUDGET_MIN} min.`,
    });
  if (fuel > vehicle.fuel_remaining_l + 1e-6)
    violations.push({
      rule: "F",
      vehicle_id: vehicle.vehicle_id,
      message: `${vehicle.vehicle_id} needs ${round(fuel, 1)} L; ${round(vehicle.fuel_remaining_l, 1)} L of its weekly quota remains.`,
    });
  return {
    vehicle_id: vehicle.vehicle_id,
    trips,
    fresh_minutes: fresh,
    day_minutes: day,
    fuel_l: round(fuel, 2),
    violations,
  };
}

// ---------------------------------------------------------------- priority

/**
 * Allocation priority. Higher is served first.
 *  1. Outlets already skipped on earlier runs (fairness: never skip twice if avoidable).
 *  2. Fresh chilled, then Fresh ambient: perishable, must reach shelves before 8 AM.
 *  3. Tech (high-value, as-needed orders), then Style (weekly; volume-heavy).
 *  4. Days waiting, tighter windows, then larger orders (first-fit-decreasing packing).
 */
export function priorityScore(o: PlanningOrder, outlet?: OutletRef): number {
  const brand =
    o.brand === "Fresh"
      ? o.temp_requirement === "chilled"
        ? 400
        : 300
      : o.brand === "Tech"
        ? 200
        : 150;
  const window = outlet ? (24 * 60 - effectiveWindow(outlet)[1]) / 100 : 0;
  return (
    o.deferred_count * 1000 +
    o.days_waiting * 100 +
    brand +
    window +
    Math.min(o.volume_m3, 50) / 100
  );
}

// ------------------------------------------------------------------ solver

interface Bin {
  vehicle: VehicleRef;
  drafts: TripDraft[];
}

function tryPlace(
  bin: Bin,
  ctx: PlanningContext,
  mutate: (d: TripDraft[]) => TripDraft[],
): VehicleDay | null {
  const day = scheduleVehicle(bin.vehicle, mutate(bin.drafts), ctx);
  return day.violations.length === 0 ? day : null;
}

const cloneDrafts = (d: TripDraft[]) =>
  d.map((x) => ({ orders: [...x.orders] }));

function diagnose(
  o: PlanningOrder,
  bins: Bin[],
  ctx: PlanningContext,
): Deferral {
  const outlet = ctx.outlets.get(o.outlet_id);
  const label = `${o.brand} ${o.temp_requirement}`;
  const candidates = bins.filter((b) => compatible(b.vehicle, o, outlet));
  if (candidates.length === 0) {
    const need =
      outlet?.parking_constraint === "van_only"
        ? o.temp_requirement === "chilled"
          ? "refrigerated van"
          : "van"
        : o.temp_requirement === "chilled"
          ? "refrigerated vehicle"
          : "vehicle";
    return {
      order_id: o.order_id,
      code: "NO_COMPATIBLE_VEHICLE",
      reason: `No available ${need} at ${o.depot} for this run.`,
      unavoidable: true,
    };
  }
  // Would the order fit an otherwise empty compatible vehicle?
  const fresh = { ...candidates[0].vehicle, fuel_remaining_l: Infinity };
  const solo = scheduleVehicle(fresh, [{ orders: [o] }], ctx);
  const window = solo.violations.find((v) => v.rule === "W");
  if (window)
    return {
      order_id: o.order_id,
      code: "WINDOW_UNREACHABLE",
      reason: `Even a direct trip cannot reach the outlet before its window closes (${window.message}).`,
      unavoidable: true,
    };
  const capacity = solo.violations.find((v) => v.rule === "R6");
  if (capacity)
    return {
      order_id: o.order_id,
      code: "FLEET_CAPACITY",
      reason: `Order is larger than any compatible vehicle: ${capacity.message}`,
      unavoidable: true,
    };
  const fuelOk = candidates.some((b) =>
    scheduleVehicle(b.vehicle, [{ orders: [o] }], ctx).violations.every(
      (v) => v.rule !== "F",
    ),
  );
  if (!fuelOk)
    return {
      order_id: o.order_id,
      code: "FUEL_QUOTA",
      reason: `Every compatible vehicle at ${o.depot} has too little weekly fuel quota left for this ${o.district} trip.`,
      unavoidable: true,
    };
  if (outlet?.parking_constraint === "van_only")
    return {
      order_id: o.order_id,
      code: "VAN_CAPACITY",
      reason: `Van-only outlet: all ${o.depot} vans are full or out of time for this run.`,
      unavoidable: true,
    };
  if (o.temp_requirement === "chilled")
    return {
      order_id: o.order_id,
      code: "REEFER_CAPACITY",
      reason: `Refrigerated capacity at ${o.depot} is fully committed to higher-priority ${label} orders for the 03:30-08:00 window.`,
      unavoidable: true,
    };
  if (o.brand === "Fresh")
    return {
      order_id: o.order_id,
      code: "TIME_BUDGET",
      reason: `No vehicle has enough of its 270-minute Fresh window left for a ${o.district} stop.`,
      unavoidable: true,
    };
  return {
    order_id: o.order_id,
    code: "FLEET_CAPACITY",
    reason: `Fleet capacity at ${o.depot} is committed to higher-priority orders for this trading day.`,
    unavoidable: true,
  };
}

/**
 * Greedy allocation with best-fit insertion.
 *
 * Orders are visited by priority. Each order goes to the existing same-brand,
 * same-district trip that stays feasible with the least spare volume; otherwise
 * it opens a trip on the least-specialised compatible vehicle (ambient trucks
 * before vans before reefers) so scarce reefers and vans stay free for orders
 * that need them. Every placement is checked by scheduleVehicle, so the result
 * satisfies every hard constraint by construction; anything left over is
 * deferred with a diagnosed reason.
 */
export function solve(
  orders: PlanningOrder[],
  ctx: PlanningContext,
  locked: Deferral[] = [],
): PlanResult {
  const lockedIds = new Set(locked.map((d) => d.order_id));
  const bins: Bin[] = ctx.vehicles
    .filter((v) => v.available)
    .sort((a, b) => a.vehicle_id.localeCompare(b.vehicle_id))
    .map((vehicle) => ({ vehicle, drafts: [] }));
  const queue = orders
    .filter((o) => !lockedIds.has(o.order_id))
    .map((o) => ({
      o,
      outlet: ctx.outlets.get(o.outlet_id),
      score: priorityScore(o, ctx.outlets.get(o.outlet_id)),
    }))
    .sort(
      (a, b) => b.score - a.score || a.o.order_id.localeCompare(b.o.order_id),
    );

  const deferrals: Deferral[] = [...locked];
  const specialisation = (
    v: VehicleRef,
    o: PlanningOrder,
    outlet?: OutletRef,
  ) =>
    (v.temp === "reefer" && o.temp_requirement !== "chilled" ? 20 : 0) +
    (v.type === "van" && outlet?.parking_constraint !== "van_only" ? 10 : 0);

  for (const { o, outlet } of queue) {
    let best: { bin: Bin; drafts: TripDraft[]; cost: number } | null = null;
    for (const bin of bins) {
      if (!compatible(bin.vehicle, o, outlet)) continue;
      const spec = specialisation(bin.vehicle, o, outlet);
      // Join an existing trip of the same brand and district.
      bin.drafts.forEach((draft, i) => {
        const head = draft.orders[0];
        if (head.brand !== o.brand || head.district !== o.district) return;
        const next = cloneDrafts(bin.drafts);
        next[i].orders.push(o);
        if (!tryPlace(bin, ctx, () => next)) return;
        const used = next[i].orders.reduce((s, x) => s + x.volume_m3, 0);
        const cost =
          spec + (bin.vehicle.volume_cap_m3 - used) / bin.vehicle.volume_cap_m3;
        if (!best || cost < best.cost) best = { bin, drafts: next, cost };
      });
      // Open a new trip.
      if (bin.drafts.length < MAX_TRIPS) {
        const next = [...cloneDrafts(bin.drafts), { orders: [o] }];
        if (tryPlace(bin, ctx, () => next)) {
          const cost = 5 + spec + bin.drafts.length * 0.5;
          if (!best || cost < best.cost) best = { bin, drafts: next, cost };
        }
      }
    }
    if (best) {
      const chosen = best as { bin: Bin; drafts: TripDraft[] };
      chosen.bin.drafts = chosen.drafts;
    } else deferrals.push(diagnose(o, bins, ctx));
  }

  return assemble(orders, bins, deferrals, ctx);
}

function assemble(
  orders: PlanningOrder[],
  bins: Bin[],
  deferrals: Deferral[],
  ctx: PlanningContext,
): PlanResult {
  const vehicles = bins
    .filter((b) => b.drafts.length)
    .map((b) => scheduleVehicle(b.vehicle, b.drafts, ctx));
  const trips = vehicles.flatMap((v) => v.trips);
  const violations = vehicles.flatMap((v) => v.violations);
  return {
    trips,
    deferrals,
    vehicles,
    violations,
    summary: summarise(orders, trips, deferrals, ctx),
  };
}

function summarise(
  orders: PlanningOrder[],
  trips: ScheduledTrip[],
  deferrals: Deferral[],
  ctx: PlanningContext,
): PlanSummary {
  const served = new Set(trips.flatMap((t) => t.order_ids));
  const vehicleMap = new Map(ctx.vehicles.map((v) => [v.vehicle_id, v]));
  const by_brand = {
    Fresh: { orders: 0, served: 0 },
    Style: { orders: 0, served: 0 },
    Tech: { orders: 0, served: 0 },
  };
  for (const o of orders) {
    by_brand[o.brand].orders++;
    if (served.has(o.order_id)) by_brand[o.brand].served++;
  }
  const counts = new Map<DeferralCode, number>();
  deferrals.forEach((d) => counts.set(d.code, (counts.get(d.code) ?? 0) + 1));
  const labels: Record<DeferralCode, string> = {
    REEFER_CAPACITY: "refrigerated capacity",
    VAN_CAPACITY: "van access capacity",
    TIME_BUDGET: "Fresh 03:30-08:00 time budget",
    FUEL_QUOTA: "weekly fuel quota",
    WINDOW_UNREACHABLE: "unreachable delivery windows",
    NO_COMPATIBLE_VEHICLE: "no compatible vehicle available",
    FLEET_CAPACITY: "general fleet capacity",
    MANUAL: "dispatcher decisions",
  };
  const binding = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, n]) => `${labels[code]} (${n} order${n === 1 ? "" : "s"})`);
  return {
    orders: orders.length,
    served: served.size,
    deferred: orders.length - served.size,
    service_rate_pct: orders.length
      ? round((served.size / orders.length) * 100, 1)
      : 100,
    trips: trips.length,
    vehicles_used: new Set(trips.map((t) => t.vehicle_id)).size,
    reefer_trips: trips.filter(
      (t) => vehicleMap.get(t.vehicle_id)?.temp === "reefer",
    ).length,
    total_volume_m3: round(
      trips.reduce((s, t) => s + t.volume_m3, 0),
      1,
    ),
    total_fuel_l: round(
      trips.reduce((s, t) => s + t.fuel_l, 0),
      1,
    ),
    by_brand,
    binding,
  };
}

// --------------------------------------------------------------- validation

/**
 * Validates an explicit allocation (for manual edits). Trips are keyed by
 * vehicle; trip numbers are assigned by scheduleVehicle (Fresh first).
 */
export function validate(
  orders: PlanningOrder[],
  trips: TripInput[],
  deferrals: Deferral[],
  ctx: PlanningContext,
): PlanResult {
  const orderMap = new Map(orders.map((o) => [o.order_id, o]));
  const vehicleMap = new Map(ctx.vehicles.map((v) => [v.vehicle_id, v]));
  const violations: Violation[] = [];
  const seen = new Map<string, number>();
  const byVehicle = new Map<string, TripDraft[]>();
  for (const trip of trips) {
    const vehicle = vehicleMap.get(trip.vehicle_id);
    if (!vehicle) {
      violations.push({
        rule: "X",
        vehicle_id: trip.vehicle_id,
        message: `Unknown vehicle ${trip.vehicle_id}.`,
      });
      continue;
    }
    const list: PlanningOrder[] = [];
    for (const id of trip.order_ids) {
      const o = orderMap.get(id);
      if (!o) {
        violations.push({
          rule: "X",
          order_id: id,
          message: `Unknown order ${id}.`,
        });
        continue;
      }
      seen.set(id, (seen.get(id) ?? 0) + 1);
      list.push(o);
    }
    if (!byVehicle.has(trip.vehicle_id)) byVehicle.set(trip.vehicle_id, []);
    byVehicle.get(trip.vehicle_id)!.push({ orders: list });
  }
  for (const d of deferrals)
    seen.set(d.order_id, (seen.get(d.order_id) ?? 0) + 1);
  for (const o of orders) {
    const n = seen.get(o.order_id) ?? 0;
    if (n === 0)
      violations.push({
        rule: "R5",
        order_id: o.order_id,
        message: `${o.order_id} is neither served nor deferred.`,
      });
    if (n > 1)
      violations.push({
        rule: "R5",
        order_id: o.order_id,
        message: `${o.order_id} appears ${n} times; orders cannot be split.`,
      });
  }
  const bins: Bin[] = [...byVehicle.entries()].map(([id, drafts]) => ({
    vehicle: vehicleMap.get(id)!,
    drafts,
  }));
  const result = assemble(orders, bins, deferrals, ctx);
  result.violations = [...violations, ...result.violations];
  return result;
}
