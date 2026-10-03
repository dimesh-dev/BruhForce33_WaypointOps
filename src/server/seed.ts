import { join } from "node:path";
import type pg from "pg";
import { pool, query, tx } from "./db.ts";
import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema.ts";
import { readCsv, readCsvIfExists } from "./csv.ts";
import { hashPassword } from "./passwords.ts";
import { addDays, cutoffFor } from "./clock.ts";
import { loadContext, loadPlanningOrders } from "./planning.ts";
import { solve } from "../lib/planning/engine.ts";
import { demandFactor } from "./forecast.ts";

/**
 * Bootstrap: migrate, then load reference data and the walkthrough scenario.
 *
 * Reference data comes from DATA_DIR (default ./data), using the shared
 * dataset filenames and columns: outlets.csv, vehicles.csv, calendar.csv,
 * district_travel.csv, service_allowance.csv. If deliveries_train.csv is also
 * present it seeds demand history for the capacity forecast.
 *
 * The scenario: dispatch day DEMO_RUN_DATE (default Tue 6 Oct 2026) at
 * Peliyagoda and Kandy, with orders from every outlet scheduled to receive one,
 * three orders carried over from Monday's run, Monday's fuel already drawn,
 * and four Peliyagoda vehicles in the workshop. Demand exceeds refrigerated
 * capacity, so the plan must defer.
 */

// Read at runtime (the Docker image copies data/ next to the server); not bundled or traced.
const DATA_DIR =
  process.env.DATA_DIR ??
  join(/* turbopackIgnore: true */ process.cwd(), "data");
const RUN_DATE = process.env.DEMO_RUN_DATE ?? "2026-10-06";
const DEMO_START = process.env.DEMO_START ?? "2026-10-05T14:30:00+05:30";
const PASSWORD = process.env.DEMO_PASSWORD ?? "waypoint2026";

export async function migrate(db: pg.Pool | pg.PoolClient = pool()) {
  await db.query(SCHEMA_SQL);
  await db.query(
    "INSERT INTO app_meta(key, value) VALUES ('schema_version', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    [String(SCHEMA_VERSION)],
  );
}

export async function isSeeded(): Promise<boolean> {
  const rows = await query("SELECT 1 FROM app_meta WHERE key = 'seeded_at'");
  return rows.length > 0;
}

export async function bootstrap({ force = false } = {}) {
  await migrate();
  if (!force && (await isSeeded())) return { seeded: false };
  await tx(async (c) => {
    await c.query(`TRUNCATE sync_events, events, demand_history, fuel_ledger, receipts, issues, deferrals,
      proofs, stops, trips, plans, orders, run_days, users, calendar, vehicles, outlets, service_allowance,
      district_travel RESTART IDENTITY CASCADE`);
    await c.query("DELETE FROM app_meta WHERE key <> 'schema_version'");
    await loadReference(c);
    await seedScenario(c);
  });
  return { seeded: true };
}

// --------------------------------------------------------------- reference

const num = (v: string | undefined, fallback = 0) =>
  v === undefined || v === "" ? fallback : Number(v);

const DRIVER_NAMES = [
  "Kasun Perera",
  "Nimal Silva",
  "Dilan Fernando",
  "Sunil Bandara",
  "Chaminda Senanayake",
  "Thilina Jayawardena",
  "Mahesh Wickramasinghe",
  "Pradeep Kumara",
  "Nuwan Alwis",
  "Suresh Mendis",
  "Priyantha Jayasinghe",
  "Janaka Ratnayake",
  "Ruwan Dissanayake",
  "Asanka Herath",
  "Lahiru Gunasekara",
  "Sampath Rajapaksa",
  "Isuru Wijesinghe",
  "Kamal Peiris",
  "Roshan Abeysekera",
  "Dinesh Karunaratne",
  "Hasitha Samarasinghe",
  "Gayan Liyanage",
  "Chathura Weerasinghe",
  "Sanjeewa Ekanayake",
  "Tharindu Amarasinghe",
  "Upul Wanigasekara",
  "Buddhika Gamage",
  "Ajith Ranasinghe",
  "Mohamed Rizwan",
  "Faizal Hameed",
  "Selvaraj Kumar",
  "Rajeev Nadarajah",
  "Prasanna Kumarasinghe",
  "Kelum Pathirana",
  "Viraj Jayasuriya",
  "Ranjith Hettiarachchi",
  "Saman Kodituwakku",
  "Dhammika Rathnayake",
  "Malith Siriwardena",
  "Pathum Nissanka",
  "Anura Wimalasena",
  "Lalith Gunawardena",
  "Shehan Fonseka",
  "Yohan de Silva",
  "Nalaka Edirisinghe",
  "Charith Medis",
  "Eranga Kulatunga",
  "Amila Premaratne",
  "Damith Senaratne",
  "Chamara Withana",
  "Harsha Dias",
  "Rangana Hewage",
  "Sudath Munasinghe",
  "Kavinda Lokuge",
  "Niroshan Tennakoon",
  "Indika Wickremaratne",
  "Jagath Mendis",
  "Ishara Madushanka",
  "Samantha Perera",
  "Wasantha Kumara",
];

async function loadReference(c: pg.PoolClient) {
  const file = (name: string) =>
    readCsv(join(/* turbopackIgnore: true */ DATA_DIR, name));

  for (const r of file("district_travel.csv"))
    await c.query(
      `INSERT INTO district_travel VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        r.district,
        r.depot,
        r.road_class,
        num(r.free_flow_kmh),
        num(r.depot_to_district_km),
        num(r.depot_to_district_freeflow_min),
        num(r.inter_stop_km),
        num(r.inter_stop_freeflow_min),
      ],
    );

  for (const r of file("service_allowance.csv"))
    await c.query(`INSERT INTO service_allowance VALUES ($1,$2,$3)`, [
      r.brand,
      r.dock_type,
      num(r.service_allowance_min),
    ]);

  const counters = new Map<string, number>();
  for (const r of file("outlets.csv")) {
    const key = `${r.brand}:${r.district}`;
    counters.set(key, (counters.get(key) ?? 0) + 1);
    const label =
      r.name ||
      r.outlet_name ||
      `${r.brand} · ${r.district} ${String(counters.get(key)).padStart(2, "0")}`;
    await c.query(
      `INSERT INTO outlets VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        r.outlet_id,
        label,
        r.brand,
        r.district,
        r.depot,
        r.dock_type,
        r.parking_constraint,
        r.mall_window || null,
        r.window_open_time,
        r.window_close_time,
      ],
    );
  }

  let i = 0;
  for (const r of file("vehicles.csv"))
    await c.query(
      `INSERT INTO vehicles VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'available',$10)`,
      [
        r.vehicle_id,
        r.type,
        r.temp,
        num(r.weight_cap_kg),
        num(r.volume_cap_m3),
        r.fuel_type || "diesel",
        num(r.km_per_l, 5),
        num(r.weekly_fuel_quota_l, 250),
        r.depot,
        DRIVER_NAMES[i++ % DRIVER_NAMES.length],
      ],
    );

  const cal = file("calendar.csv");
  const values: unknown[] = [];
  const tuples: string[] = [];
  cal.forEach((r, k) => {
    const b = k * 12;
    tuples.push(
      `(${Array.from({ length: 12 }, (_, j) => `$${b + j + 1}`).join(",")})`,
    );
    values.push(
      r.date,
      num(r.dow),
      r.dow_name,
      num(r.is_weekend),
      num(r.iso_year),
      num(r.iso_week),
      num(r.is_payday),
      r.festival || null,
      num(r.festival_ramp),
      num(r.is_holiday),
      num(r.monsoon),
      num(r.is_operating),
    );
  });
  for (let k = 0; k < tuples.length; k += 400) {
    const slice = tuples.slice(k, k + 400);
    const offset = k * 12;
    await c.query(
      `INSERT INTO calendar VALUES ${slice.map((t) => t.replace(/\$(\d+)/g, (_, n) => `$${Number(n) - offset}`)).join(",")}`,
      values.slice(offset, offset + slice.length * 12),
    );
  }
}

// ---------------------------------------------------------------- scenario

let state = 4207;
const rand = () => {
  state = (state * 1103515245 + 12345) % 2147483648;
  return state / 2147483648;
};
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const hash = (s: string) =>
  [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

interface OutletRow {
  outlet_id: string;
  name: string;
  brand: "Fresh" | "Style" | "Tech";
  district: string;
  depot: string;
  parking_constraint: string;
}

interface CalendarRow {
  date: string;
  dow: number;
  iso_year: number;
  iso_week: number;
  is_payday: number;
  festival_ramp: number;
  is_operating: number;
  monsoon: number;
}

interface GeneratedOrder {
  outlet: OutletRow;
  temp: "chilled" | "ambient";
  units: number;
  weight: number;
  volume: number;
}

/** Orders an outlet places for a given day, following each brand's ordering pattern. */
function ordersFor(outlet: OutletRow, day: CalendarRow): GeneratedOrder[] {
  // Van-only outlets are small-format stores; their orders fit a van.
  const f =
    demandFactor(day) * (outlet.parking_constraint === "van_only" ? 0.6 : 1);
  const out: GeneratedOrder[] = [];
  const add = (
    temp: "chilled" | "ambient",
    volume: number,
    density: number,
    unitSize: number,
  ) => {
    const v = Number((volume * f).toFixed(2));
    out.push({
      outlet,
      temp,
      volume: v,
      weight: Math.round(v * density),
      units: Math.max(1, Math.round(v / unitSize)),
    });
  };
  if (outlet.brand === "Fresh") {
    // Dry groceries every trading day; chilled on several days a week.
    if (rand() < 0.97)
      add("ambient", between(2.2, 5.5), between(170, 230), 0.08);
    const chilledDays =
      hash(outlet.outlet_id) % 2 === 0 ? [0, 1, 3, 5] : [0, 2, 4, 5];
    if (chilledDays.includes(day.dow) || rand() < 0.2)
      add("chilled", between(1.6, 4.2), between(240, 320), 0.06);
  } else if (outlet.brand === "Style") {
    // Weekly scheduled delivery day; volume-heavy hanging garments and cartons.
    if (hash(outlet.outlet_id) % 6 === day.dow)
      add("ambient", between(9, 18), between(25, 45), 0.12);
  } else if (rand() < 0.4) {
    // Tech: as needed, heavy and fragile.
    add("ambient", between(1.5, 7), between(140, 260), 0.5);
  }
  return out;
}

async function seedScenario(c: pg.PoolClient) {
  const outlets = (
    await c.query<OutletRow>("SELECT * FROM outlets ORDER BY outlet_id")
  ).rows;
  const calendar = (
    await c.query<CalendarRow>("SELECT * FROM calendar ORDER BY date")
  ).rows;
  const day = calendar.find((d) => d.date === RUN_DATE);
  if (!day) throw new Error(`DEMO_RUN_DATE ${RUN_DATE} is not in calendar.csv`);
  const previous = [...calendar]
    .reverse()
    .find((d) => d.date < RUN_DATE && d.is_operating === 1)!;
  state = 4207;

  // Vehicles in the workshop for the scenario day: three Peliyagoda reefer trucks and one dry truck.
  const workshop = await c.query<{ vehicle_id: string }>(
    `(SELECT vehicle_id FROM vehicles WHERE depot='Peliyagoda' AND temp='reefer' AND type='truck' ORDER BY vehicle_id DESC LIMIT 3)
     UNION ALL
     (SELECT vehicle_id FROM vehicles WHERE depot='Peliyagoda' AND temp='ambient' AND type='truck' ORDER BY vehicle_id DESC LIMIT 1)`,
  );
  await c.query(
    "UPDATE vehicles SET status='in_workshop' WHERE vehicle_id = ANY($1)",
    [workshop.rows.map((r) => r.vehicle_id)],
  );

  // ------------------------------------------------------------------ orders
  await c.query("INSERT INTO run_days(run_date, cutoff_at) VALUES ($1,$2)", [
    RUN_DATE,
    cutoffFor(RUN_DATE),
  ]);
  let seq = 0;
  const id = () =>
    `ORD${RUN_DATE.replaceAll("-", "").slice(2)}-${String(++seq).padStart(4, "0")}`;
  const insertOrder = async (
    o: GeneratedOrder,
    requested: string,
    deferredCount: number,
    placedAt: Date,
  ) => {
    const orderId = id();
    await c.query(
      `INSERT INTO orders(order_id, outlet_id, brand, district, depot, requested_date, run_date, temp_requirement,
         units, weight_kg, volume_m3, status, placed_at, deferred_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'confirmed',$12,$13)`,
      [
        orderId,
        o.outlet.outlet_id,
        o.outlet.brand,
        o.outlet.district,
        o.outlet.depot,
        requested,
        RUN_DATE,
        o.temp,
        o.units,
        o.weight,
        o.volume,
        placedAt,
        deferredCount,
      ],
    );
    return orderId;
  };

  // Carry-over: three outlets whose Monday orders were deferred for lack of refrigerated capacity.
  const carried = outlets
    .filter(
      (o) =>
        o.brand === "Fresh" &&
        o.depot === "Peliyagoda" &&
        o.parking_constraint === "normal",
    )
    .filter((_, k) => k % 17 === 5)
    .slice(0, 3);
  for (const o of carried) {
    const orderId = await insertOrder(
      { outlet: o, temp: "chilled", volume: 2.8, weight: 780, units: 46 },
      previous.date,
      1,
      new Date(cutoffFor(previous.date).getTime() - 3 * 3600000),
    );
    await c.query(
      `INSERT INTO deferrals(order_id, from_date, to_date, code, reason, unavoidable, created_at)
       VALUES ($1,$2,$3,'REEFER_CAPACITY',$4,true,$5)`,
      [
        orderId,
        previous.date,
        RUN_DATE,
        "Refrigerated capacity at Peliyagoda was fully committed for the 03:30-08:00 window.",
        new Date(cutoffFor(previous.date).getTime() + 2 * 3600000),
      ],
    );
  }

  for (const o of outlets)
    for (const g of ordersFor(o, day))
      await insertOrder(
        g,
        RUN_DATE,
        0,
        new Date(cutoffFor(RUN_DATE).getTime() - between(1, 30) * 3600000),
      );

  // Monday's runs already drew fuel from this ISO week's quota; a few vehicles are nearly out.
  for (const v of (
    await c.query<{ vehicle_id: string; weekly_fuel_quota_l: number }>(
      "SELECT vehicle_id, weekly_fuel_quota_l FROM vehicles ORDER BY vehicle_id",
    )
  ).rows) {
    const share =
      v.vehicle_id.endsWith("7") || v.vehicle_id.endsWith("3")
        ? between(0.82, 0.92)
        : between(0.12, 0.3);
    await c.query(
      `INSERT INTO fuel_ledger(vehicle_id, run_date, iso_year, iso_week, litres, source) VALUES ($1,$2,$3,$4,$5,'Earlier runs this week')`,
      [
        v.vehicle_id,
        previous.date,
        day.iso_year,
        day.iso_week,
        Number((v.weekly_fuel_quota_l * share).toFixed(1)),
      ],
    );
  }

  // ---------------------------------------------------------------- accounts
  // The walkthrough driver is the first available Peliyagoda reefer truck; the
  // walkthrough store is an outlet the engine routes onto that vehicle, so a
  // judge can follow one order from planning to receipt with these accounts.
  const featuredVehicle = (
    await c.query<{ vehicle_id: string; driver_name: string }>(
      `SELECT vehicle_id, driver_name FROM vehicles
        WHERE depot='Peliyagoda' AND temp='reefer' AND type='truck' AND status='available' ORDER BY vehicle_id LIMIT 1`,
    )
  ).rows[0];
  const preview = solve(
    await loadPlanningOrders(RUN_DATE, c),
    await loadContext(RUN_DATE, c),
  );
  const firstTrip = preview.trips.find(
    (t) => t.vehicle_id === featuredVehicle.vehicle_id && t.trip_no === 1,
  );
  const carriedIds = new Set(carried.map((o) => o.outlet_id));
  const featuredOutletId =
    firstTrip?.stops
      .map((s) => s.outlet_id)
      .find((id) => !carriedIds.has(id)) ??
    outlets.find((o) => o.brand === "Fresh" && o.depot === "Peliyagoda")!
      .outlet_id;
  const hashed = hashPassword(PASSWORD);
  const users: [
    string,
    string,
    string,
    string | null,
    string | null,
    string | null,
    boolean,
  ][] = [
    [
      "dispatcher",
      "Amaya Jayasinghe",
      "dispatcher",
      "Peliyagoda",
      null,
      null,
      true,
    ],
    ["loader", "Ruwan Kumara", "loader", "Peliyagoda", null, null, true],
    [
      "driver",
      featuredVehicle.driver_name,
      "driver",
      "Peliyagoda",
      featuredVehicle.vehicle_id,
      null,
      true,
    ],
    [
      "store",
      "Anjali Fernando",
      "store_manager",
      null,
      null,
      featuredOutletId,
      true,
    ],
    ["loader.kandy", "Shanika Herath", "loader", "Kandy", null, null, false],
  ];
  const vehicles = (
    await c.query<{ vehicle_id: string; driver_name: string; depot: string }>(
      "SELECT vehicle_id, driver_name, depot FROM vehicles ORDER BY vehicle_id",
    )
  ).rows;
  for (const v of vehicles)
    if (v.vehicle_id !== featuredVehicle.vehicle_id)
      users.push([
        v.vehicle_id.toLowerCase(),
        v.driver_name,
        "driver",
        v.depot,
        v.vehicle_id,
        null,
        false,
      ]);
  for (const o of outlets)
    if (o.outlet_id !== featuredOutletId)
      users.push([
        o.outlet_id.toLowerCase(),
        `${o.name} manager`,
        "store_manager",
        null,
        null,
        o.outlet_id,
        false,
      ]);
  for (const u of users)
    await c.query(
      `INSERT INTO users(username, password_hash, display_name, role, depot, vehicle_id, outlet_id, featured)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [u[0], hashed, u[1], u[2], u[3], u[4], u[5], u[6]],
    );

  await seedDemandHistory(c, outlets, calendar);

  await c.query(
    `INSERT INTO events(type, title, detail, severity, audience, created_at) VALUES
      ('orders.queue', 'Orders arriving for ${RUN_DATE}', 'Store orders for the next run close at 16:00 the day before.', 'info', '{dispatcher}', $1),
      ('deferral.carried', '${carried.length} outlets skipped on the last run', 'Their orders carry priority into this run.', 'warning', '{dispatcher}', $1)`,
    [new Date(DEMO_START)],
  );

  const meta: [string, string][] = [
    ["seeded_at", new Date().toISOString()],
    ["run_date", RUN_DATE],
  ];
  if (DEMO_START !== "off")
    meta.push(
      ["clock_anchor_real", new Date().toISOString()],
      ["clock_anchor_sim", new Date(DEMO_START).toISOString()],
    );
  for (const [k, v] of meta)
    await c.query(
      "INSERT INTO app_meta(key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value",
      [k, v],
    );
}

async function seedDemandHistory(
  c: pg.PoolClient,
  outlets: OutletRow[],
  calendar: CalendarRow[],
) {
  const train = readCsvIfExists(
    join(/* turbopackIgnore: true */ DATA_DIR, "deliveries_train.csv"),
  );
  const totals = new Map<
    string,
    { orders: number; total: number; chilled: number }
  >();
  const bump = (
    date: string,
    depot: string,
    brand: string,
    volume: number,
    chilled: boolean,
  ) => {
    const key = `${date}|${depot}|${brand}`;
    const t = totals.get(key) ?? { orders: 0, total: 0, chilled: 0 };
    t.orders++;
    t.total += volume;
    if (chilled) t.chilled += volume;
    totals.set(key, t);
  };
  if (train) {
    for (const r of train)
      bump(
        r.order_date,
        r.depot,
        r.brand,
        num(r.order_volume_m3),
        r.temp_requirement === "chilled",
      );
  } else {
    // Synthetic history: 26 weeks of the same ordering pattern before the scenario.
    const start = addDays(RUN_DATE, -26 * 7);
    for (const d of calendar.filter(
      (x) => x.date >= start && x.date < RUN_DATE && x.is_operating === 1,
    ))
      for (const o of outlets)
        for (const g of ordersFor(o, d))
          bump(
            d.date,
            o.depot,
            o.brand,
            g.volume * between(0.9, 1.1),
            g.temp === "chilled",
          );
  }
  const entries = [...totals.entries()];
  for (let k = 0; k < entries.length; k += 500) {
    const slice = entries.slice(k, k + 500);
    const values: unknown[] = [];
    const tuples = slice.map(([key, t], j) => {
      const [date, depot, brand] = key.split("|");
      values.push(
        date,
        depot,
        brand,
        t.orders,
        Number(t.total.toFixed(2)),
        Number(t.chilled.toFixed(2)),
      );
      return `($${j * 6 + 1},$${j * 6 + 2},$${j * 6 + 3},$${j * 6 + 4},$${j * 6 + 5},$${j * 6 + 6})`;
    });
    await c.query(
      `INSERT INTO demand_history VALUES ${tuples.join(",")} ON CONFLICT DO NOTHING`,
      values,
    );
  }
}
