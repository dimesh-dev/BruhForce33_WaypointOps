import { test, expect } from "@playwright/test";
import {
  scheduleVehicle,
  solve,
  validate,
  type OutletRef,
  type PlanningContext,
  type PlanningOrder,
  type VehicleRef,
} from "../src/lib/planning/engine.ts";

/* Pure engine tests: no database or browser needed. */

const outlet = (id: string, over: Partial<OutletRef> = {}): OutletRef => ({
  outlet_id: id,
  name: id,
  brand: "Fresh",
  district: "Gampaha",
  depot: "Peliyagoda",
  dock_type: "rear_dock",
  parking_constraint: "normal",
  mall_window: null,
  window_open_time: "04:00",
  window_close_time: "08:00",
  ...over,
});

const vehicle = (id: string, over: Partial<VehicleRef> = {}): VehicleRef => ({
  vehicle_id: id,
  type: "truck",
  temp: "reefer",
  weight_cap_kg: 5000,
  volume_cap_m3: 30,
  km_per_l: 5,
  weekly_fuel_quota_l: 300,
  depot: "Peliyagoda",
  available: true,
  fuel_remaining_l: 300,
  ...over,
});

let n = 0;
const order = (
  outletId: string,
  over: Partial<PlanningOrder> = {},
): PlanningOrder => ({
  order_id: `O${++n}`,
  outlet_id: outletId,
  brand: "Fresh",
  district: "Gampaha",
  depot: "Peliyagoda",
  temp_requirement: "ambient",
  units: 10,
  weight_kg: 500,
  volume_m3: 3,
  deferred_count: 0,
  days_waiting: 0,
  ...over,
});

function context(
  outlets: OutletRef[],
  vehicles: VehicleRef[],
): PlanningContext {
  return {
    outlets: new Map(outlets.map((o) => [o.outlet_id, o])),
    vehicles,
    districts: new Map([
      [
        "Gampaha",
        {
          district: "Gampaha",
          depot: "Peliyagoda",
          depot_to_district_km: 25,
          depot_to_district_freeflow_min: 37,
          inter_stop_km: 6,
          inter_stop_freeflow_min: 9,
        },
      ],
      [
        "Colombo",
        {
          district: "Colombo",
          depot: "Peliyagoda",
          depot_to_district_km: 12,
          depot_to_district_freeflow_min: 24,
          inter_stop_km: 4,
          inter_stop_freeflow_min: 8,
        },
      ],
      [
        "Galle",
        {
          district: "Galle",
          depot: "Peliyagoda",
          depot_to_district_km: 115,
          depot_to_district_freeflow_min: 110,
          inter_stop_km: 10,
          inter_stop_freeflow_min: 15,
        },
      ],
      [
        "Kandy",
        {
          district: "Kandy",
          depot: "Kandy",
          depot_to_district_km: 8,
          depot_to_district_freeflow_min: 15,
          inter_stop_km: 4,
          inter_stop_freeflow_min: 10,
        },
      ],
    ]),
    allowance: new Map([
      ["Fresh:rear_dock", 15],
      ["Fresh:street", 16],
      ["Fresh:mall_bay", 20],
      ["Style:mall_bay", 30],
      ["Style:rear_dock", 20],
      ["Tech:rear_dock", 25],
    ]),
  };
}

const rules = (r: { violations: { rule: string }[] }) =>
  r.violations.map((v) => v.rule);

test.describe("trip time (booklet p.21)", () => {
  test("Fresh Gampaha trip with two rear docks and one street stop is 101 minutes", () => {
    const outlets = [
      outlet("A"),
      outlet("B"),
      outlet("C", { dock_type: "street" }),
    ];
    const ctx = context(outlets, [vehicle("V1")]);
    const day = scheduleVehicle(
      ctx.vehicles[0],
      [{ orders: outlets.map((o) => order(o.outlet_id)) }],
      ctx,
    );
    expect(day.trips[0].trip_minutes).toBe(101);
    expect(day.trips[0].outbound_min).toBe(37);
    expect(day.trips[0].inter_stop_min).toBe(18);
    expect(day.violations).toEqual([]);
  });
  test("second Colombo trip with four street stops is 112 minutes; 213 of 270 used", () => {
    const g = [outlet("A"), outlet("B"), outlet("C", { dock_type: "street" })];
    const c = ["D", "E", "F", "G"].map((id) =>
      outlet(id, { district: "Colombo", dock_type: "street" }),
    );
    const ctx = context([...g, ...c], [vehicle("V1")]);
    const day = scheduleVehicle(
      ctx.vehicles[0],
      [
        { orders: g.map((o) => order(o.outlet_id)) },
        { orders: c.map((o) => order(o.outlet_id, { district: "Colombo" })) },
      ],
      ctx,
    );
    expect(day.trips[1].trip_minutes).toBe(112);
    expect(day.fresh_minutes).toBe(213);
    expect(day.violations).toEqual([]);
  });
});

test.describe("validation rejects every broken rule", () => {
  const outlets = [
    outlet("F1"),
    outlet("F2", { district: "Colombo" }),
    outlet("S1", { brand: "Style" }),
    outlet("VAN", { parking_constraint: "van_only" }),
    outlet("K1", { district: "Kandy", depot: "Kandy" }),
    outlet("EARLY", {
      district: "Galle",
      window_open_time: "04:00",
      window_close_time: "05:00",
    }),
  ];
  const run = (
    orders: PlanningOrder[],
    vehicles: VehicleRef[],
    trips: { vehicle_id: string; order_ids: string[] }[],
  ) => validate(orders, trips, [], context(outlets, vehicles));

  test("R1 mixed brand or district", () => {
    const a = order("F1");
    const b = order("S1", { brand: "Style" });
    const c = order("F2", { district: "Colombo" });
    expect(
      rules(
        run(
          [a, b],
          [vehicle("V1")],
          [{ vehicle_id: "V1", order_ids: [a.order_id, b.order_id] }],
        ),
      ),
    ).toContain("R1");
    expect(
      rules(
        run(
          [a, c],
          [vehicle("V1")],
          [{ vehicle_id: "V1", order_ids: [a.order_id, c.order_id] }],
        ),
      ),
    ).toContain("R1");
  });
  test("R2 chilled on an ambient vehicle", () => {
    const a = order("F1", { temp_requirement: "chilled" });
    expect(
      rules(
        run(
          [a],
          [vehicle("V1", { temp: "ambient" })],
          [{ vehicle_id: "V1", order_ids: [a.order_id] }],
        ),
      ),
    ).toContain("R2");
  });
  test("R3 van-only outlet on a truck", () => {
    const a = order("VAN");
    expect(
      rules(
        run(
          [a],
          [vehicle("V1")],
          [{ vehicle_id: "V1", order_ids: [a.order_id] }],
        ),
      ),
    ).toContain("R3");
  });
  test("R4 vehicle from another depot", () => {
    const a = order("K1", { district: "Kandy", depot: "Kandy" });
    expect(
      rules(
        run(
          [a],
          [vehicle("V1")],
          [{ vehicle_id: "V1", order_ids: [a.order_id] }],
        ),
      ),
    ).toContain("R4");
  });
  test("R5 order missing or split", () => {
    const a = order("F1");
    expect(rules(run([a], [vehicle("V1")], []))).toContain("R5");
    expect(
      rules(
        run(
          [a],
          [vehicle("V1"), vehicle("V2")],
          [
            { vehicle_id: "V1", order_ids: [a.order_id] },
            { vehicle_id: "V2", order_ids: [a.order_id] },
          ],
        ),
      ),
    ).toContain("R5");
  });
  test("R6 weight and volume both enforced", () => {
    const heavy = order("F1", { weight_kg: 5200, volume_m3: 2 });
    const bulky = order("F1", { weight_kg: 100, volume_m3: 31 });
    expect(
      rules(
        run(
          [heavy],
          [vehicle("V1")],
          [{ vehicle_id: "V1", order_ids: [heavy.order_id] }],
        ),
      ),
    ).toContain("R6");
    expect(
      rules(
        run(
          [bulky],
          [vehicle("V1")],
          [{ vehicle_id: "V1", order_ids: [bulky.order_id] }],
        ),
      ),
    ).toContain("R6");
  });
  test("R7 three trips, or Fresh over 270 minutes", () => {
    const os = ["F1", "F2", "S1"].map((id) =>
      order(
        id,
        id === "F2"
          ? { district: "Colombo" }
          : id === "S1"
            ? { brand: "Style" }
            : {},
      ),
    );
    const r = run(
      os,
      [vehicle("V1")],
      os.map((o) => ({ vehicle_id: "V1", order_ids: [o.order_id] })),
    );
    expect(rules(r)).toContain("R7");
    const many = Array.from({ length: 14 }, () => order("F1"));
    expect(
      rules(
        run(
          many,
          [vehicle("V1", { volume_cap_m3: 100, weight_cap_kg: 20000 })],
          [{ vehicle_id: "V1", order_ids: many.map((o) => o.order_id) }],
        ),
      ),
    ).toContain("R7");
  });
  test("W window closes before arrival", () => {
    const a = order("EARLY", { district: "Galle" });
    expect(
      rules(
        run(
          [a],
          [vehicle("V1")],
          [{ vehicle_id: "V1", order_ids: [a.order_id] }],
        ),
      ),
    ).toContain("W");
  });
  test("F weekly fuel quota", () => {
    const a = order("EARLY", { district: "Galle" });
    expect(
      rules(
        run(
          [a],
          [vehicle("V1", { fuel_remaining_l: 10 })],
          [{ vehicle_id: "V1", order_ids: [a.order_id] }],
        ),
      ),
    ).toContain("F");
  });
  test("A workshop vehicle", () => {
    const a = order("F1");
    expect(
      rules(
        run(
          [a],
          [vehicle("V1", { available: false })],
          [{ vehicle_id: "V1", order_ids: [a.order_id] }],
        ),
      ),
    ).toContain("A");
  });
});

test.describe("solver", () => {
  test("over-capacity day: feasible plan, every order served or deferred with a reason", () => {
    const outlets = Array.from({ length: 30 }, (_, i) =>
      outlet(`C${i}`, { district: i % 2 ? "Colombo" : "Gampaha" }),
    );
    const orders = outlets.map((o) =>
      order(o.outlet_id, {
        district: o.district,
        temp_requirement: "chilled",
        volume_m3: 6,
        weight_kg: 900,
      }),
    );
    const ctx = context(outlets, [
      vehicle("R1"),
      vehicle("R2"),
      vehicle("D1", { temp: "ambient" }),
      vehicle("W1", { available: false }),
    ]);
    const result = solve(orders, ctx);
    expect(result.violations).toEqual([]);
    expect(result.summary.served + result.deferrals.length).toBe(orders.length);
    expect(result.deferrals.length).toBeGreaterThan(0);
    expect(
      result.deferrals.every(
        (d) => d.code === "REEFER_CAPACITY" && d.reason.length > 10,
      ),
    ).toBe(true);
    expect(
      result.trips.some((t) => t.vehicle_id === "W1" || t.vehicle_id === "D1"),
    ).toBe(false);
    expect(
      validate(
        orders,
        result.trips.map((t) => ({
          vehicle_id: t.vehicle_id,
          order_ids: t.order_ids,
        })),
        result.deferrals,
        ctx,
      ).violations,
    ).toEqual([]);
  });
  test("an outlet skipped on the last run is served first", () => {
    const outlets = [outlet("A"), outlet("B")];
    const fresh = order("A", { temp_requirement: "chilled", volume_m3: 20 });
    const skipped = order("B", {
      temp_requirement: "chilled",
      volume_m3: 20,
      deferred_count: 1,
    });
    const result = solve(
      [fresh, skipped],
      context(outlets, [vehicle("R1", { volume_cap_m3: 25 })]),
    );
    // Only one fits per trip and the second trip needs time; the skipped outlet must be in trip 1.
    expect(result.trips[0].order_ids).toContain(skipped.order_id);
  });
  test("ambient orders keep reefers free and van-only outlets get vans", () => {
    const outlets = [
      outlet("A"),
      outlet("V", { parking_constraint: "van_only" }),
    ];
    const a = order("A");
    const v = order("V");
    const result = solve(
      [a, v],
      context(outlets, [
        vehicle("R1"),
        vehicle("D1", { temp: "ambient" }),
        vehicle("VAN", {
          type: "van",
          temp: "ambient",
          volume_cap_m3: 9,
          weight_cap_kg: 1200,
        }),
      ]),
    );
    const on = (id: string) =>
      result.trips.find((t) => t.order_ids.includes(id))?.vehicle_id;
    expect(on(a.order_id)).toBe("D1");
    expect(on(v.order_id)).toBe("VAN");
  });
  test("unreachable window is deferred as unavoidable", () => {
    const outlets = [
      outlet("EARLY", { district: "Galle", window_close_time: "05:00" }),
    ];
    const result = solve(
      [order("EARLY", { district: "Galle" })],
      context(outlets, [vehicle("R1")]),
    );
    expect(result.deferrals[0].code).toBe("WINDOW_UNREACHABLE");
    expect(result.deferrals[0].unavoidable).toBe(true);
  });
});
