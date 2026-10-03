#!/usr/bin/env node
/**
 * Writes schema-compatible stand-in copies of the shared Tech-Triathlon reference
 * files (outlets, vehicles, calendar, district_travel, service_allowance) into
 * data/. Column names and value vocabularies follow the Challenge Booklet data
 * reference (pages 28-30). Totals match the brief: 120 outlets (80 Fresh, 25
 * Style, 15 Tech), 60 vehicles (12 reefer trucks, 40 dry-box trucks, 8 vans of
 * which 4 are refrigerated), two depots.
 *
 * The official CSVs replace these files one-for-one: drop them into data/ and
 * reset the database. Nothing here is real data.
 *
 * Usage: node scripts/generate-sample-data.mjs [outDir]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2] ?? "data";
mkdirSync(outDir, { recursive: true });

let seed = 20261006;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (list) => list[Math.floor(rand() * list.length)];
const pad = (n, w = 3) => String(n).padStart(w, "0");
const csv = (rows) => {
  const header = Object.keys(rows[0]);
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return (
    [
      header.join(","),
      ...rows.map((r) => header.map((h) => esc(r[h])).join(",")),
    ].join("\n") + "\n"
  );
};
const write = (name, rows) => {
  writeFileSync(join(outDir, name), csv(rows));
  console.log(`wrote ${join(outDir, name)} (${rows.length} rows)`);
};

// ---------------------------------------------------------------- districts
const districts = [
  ["Colombo", "Peliyagoda", "urban", 30, 12, 24, 4, 8],
  ["Gampaha", "Peliyagoda", "suburban", 40, 25, 37, 6, 9],
  ["Kalutara", "Peliyagoda", "highway", 45, 45, 60, 8, 12],
  ["Galle", "Peliyagoda", "highway", 60, 115, 110, 10, 15],
  ["Matara", "Peliyagoda", "highway", 65, 155, 135, 10, 15],
  ["Kurunegala", "Peliyagoda", "highway", 50, 80, 90, 8, 12],
  ["Puttalam", "Peliyagoda", "highway", 55, 125, 130, 12, 16],
  ["Ratnapura", "Peliyagoda", "hill", 40, 78, 88, 7, 13],
  ["Kandy", "Kandy", "hill", 30, 8, 15, 4, 10],
  ["Matale", "Kandy", "hill", 35, 26, 38, 6, 12],
  ["Nuwara Eliya", "Kandy", "hill", 30, 72, 85, 8, 18],
  ["Kegalle", "Kandy", "hill", 40, 38, 48, 7, 12],
];
write(
  "district_travel.csv",
  districts.map(([district, depot, road_class, kmh, km, min, ikm, imin]) => ({
    district,
    depot,
    road_class,
    free_flow_kmh: kmh,
    depot_to_district_km: km,
    depot_to_district_freeflow_min: min,
    inter_stop_km: ikm,
    inter_stop_freeflow_min: imin,
  })),
);
const depotOf = Object.fromEntries(districts.map((d) => [d[0], d[1]]));

// ---------------------------------------------------------- service allowance
const allowance = {
  Fresh: { rear_dock: 15, street: 16, mall_bay: 20 },
  Style: { rear_dock: 20, street: 25, mall_bay: 30 },
  Tech: { rear_dock: 25, street: 30, mall_bay: 35 },
};
write(
  "service_allowance.csv",
  Object.entries(allowance).flatMap(([brand, docks]) =>
    Object.entries(docks).map(([dock_type, min]) => ({
      brand,
      dock_type,
      service_allowance_min: min,
    })),
  ),
);

// ------------------------------------------------------------------ outlets
const spread = {
  Fresh: {
    Colombo: 18,
    Gampaha: 14,
    Kalutara: 8,
    Galle: 6,
    Matara: 4,
    Kurunegala: 6,
    Puttalam: 3,
    Ratnapura: 4,
    Kandy: 8,
    Matale: 3,
    "Nuwara Eliya": 3,
    Kegalle: 3,
  },
  Style: {
    Colombo: 8,
    Gampaha: 4,
    Kalutara: 2,
    Galle: 2,
    Kurunegala: 2,
    Matara: 1,
    Kandy: 4,
    "Nuwara Eliya": 1,
    Kegalle: 1,
  },
  Tech: {
    Colombo: 5,
    Gampaha: 3,
    Kalutara: 1,
    Galle: 1,
    Kurunegala: 1,
    Ratnapura: 1,
    Kandy: 3,
  },
};
const mallWindows = [
  "07:00-09:30",
  "08:00-10:00",
  "08:30-10:30",
  "09:00-11:00",
];
const outlets = [];
let n = 1;
for (const brand of ["Fresh", "Style", "Tech"]) {
  for (const [district, count] of Object.entries(spread[brand])) {
    for (let i = 0; i < count; i++) {
      const r = rand();
      let dock_type,
        parking_constraint,
        mall_window = "",
        open,
        close;
      if (brand === "Fresh") {
        const mall = r < 0.08;
        const vanOnly =
          !mall &&
          (district === "Colombo" ||
          district === "Kandy" ||
          district === "Nuwara Eliya"
            ? r < 0.3
            : r < 0.14);
        dock_type = mall
          ? "mall_bay"
          : vanOnly || r < 0.45
            ? "street"
            : "rear_dock";
        parking_constraint = mall
          ? "mall_dock"
          : vanOnly
            ? "van_only"
            : "normal";
        if (mall) mall_window = "05:00-07:30";
        open = pick(["04:30", "05:00", "05:00", "05:30"]);
        close = mall
          ? "07:30"
          : pick(["07:00", "07:30", "07:45", "08:00", "08:00"]);
        if (mall) open = "05:00";
      } else {
        const mall = brand === "Style" ? i % 2 === 0 : r < 0.3;
        dock_type = mall ? "mall_bay" : r < 0.6 ? "rear_dock" : "street";
        parking_constraint = mall
          ? "mall_dock"
          : r > 0.9
            ? "van_only"
            : "normal";
        if (mall) {
          mall_window = pick(mallWindows);
          [open, close] = mall_window.split("-");
        } else {
          open = brand === "Tech" ? "10:00" : "09:00";
          close = brand === "Tech" ? "17:00" : "16:00";
        }
      }
      outlets.push({
        outlet_id: `OUT${pad(n++)}`,
        brand,
        district,
        depot: depotOf[district],
        dock_type,
        parking_constraint,
        mall_window,
        window_open_time: open,
        window_close_time: close,
      });
    }
  }
}
write("outlets.csv", outlets);

// ----------------------------------------------------------------- vehicles
const vehicles = [];
const addVehicles = (count, kandyCount, spec) => {
  for (let i = 0; i < count; i++) {
    const id = vehicles.length + 1;
    vehicles.push({
      vehicle_id: `VEH${pad(id)}`,
      type: spec.type,
      temp: spec.temp,
      weight_cap_kg:
        typeof spec.weight === "function" ? spec.weight(i) : spec.weight,
      volume_cap_m3:
        typeof spec.volume === "function" ? spec.volume(i) : spec.volume,
      fuel_type: "diesel",
      km_per_l: spec.kmpl,
      weekly_fuel_quota_l: spec.quota,
      depot: i >= count - kandyCount ? "Kandy" : "Peliyagoda",
    });
  }
};
addVehicles(12, 3, {
  type: "truck",
  temp: "reefer",
  weight: 6000,
  volume: 28,
  kmpl: 4.8,
  quota: 300,
});
addVehicles(40, 9, {
  type: "truck",
  temp: "ambient",
  weight: (i) => (i % 2 === 0 ? 5000 : 7000),
  volume: (i) => (i % 2 === 0 ? 32 : 40),
  kmpl: 5.5,
  quota: 260,
});
addVehicles(4, 1, {
  type: "van",
  temp: "reefer",
  weight: 1000,
  volume: 7,
  kmpl: 9.5,
  quota: 140,
});
addVehicles(4, 1, {
  type: "van",
  temp: "ambient",
  weight: 1200,
  volume: 9,
  kmpl: 10.5,
  quota: 140,
});
write("vehicles.csv", vehicles);

// ----------------------------------------------------------------- calendar
const festivals = {
  "2025-10-20": "Deepavali",
  "2025-12-25": "Christmas",
  "2026-01-14": "Thai Pongal",
  "2026-04-13": "Sinhala and Tamil New Year Eve",
  "2026-04-14": "Sinhala and Tamil New Year",
  "2026-05-01": "Vesak",
  "2026-06-29": "Poson",
  "2026-11-08": "Deepavali",
  "2026-12-25": "Christmas",
};
const holidays = new Set(["2026-02-04", "2026-05-01", "2026-10-25"]);
const isoWeek = (d) => {
  const t = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return [t.getUTCFullYear(), Math.ceil(((t - yearStart) / 86400000 + 1) / 7)];
};
const names = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const festivalDates = Object.keys(festivals).map(
  (d) => new Date(d + "T00:00:00Z"),
);
const calendar = [];
for (
  let d = new Date("2025-06-01T00:00:00Z");
  d <= new Date("2026-12-31T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1)
) {
  const date = d.toISOString().slice(0, 10);
  const dow = (d.getUTCDay() + 6) % 7;
  const [iso_year, iso_week] = isoWeek(d);
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const is_payday =
    d.getUTCDate() === 25 || (d.getUTCDate() === lastDay && lastDay < 25)
      ? 1
      : 0;
  const ahead = festivalDates
    .map((f) => Math.round((f - d) / 86400000))
    .filter((x) => x >= 0 && x <= 9);
  const festival_ramp = ahead.length
    ? Number((1 - Math.min(...ahead) / 10).toFixed(2))
    : 0;
  const month = d.getUTCMonth() + 1;
  const monsoon = [5, 6, 7, 8, 9, 10, 11].includes(month) ? 1 : 0;
  const is_holiday = festivals[date] || holidays.has(date) ? 1 : 0;
  calendar.push({
    date,
    dow,
    dow_name: names[dow],
    is_weekend: dow >= 5 ? 1 : 0,
    iso_year,
    iso_week,
    is_payday,
    festival: festivals[date] ?? "",
    festival_ramp,
    is_holiday,
    monsoon,
    is_operating: dow <= 5 && !is_holiday ? 1 : 0,
  });
}
write("calendar.csv", calendar);
