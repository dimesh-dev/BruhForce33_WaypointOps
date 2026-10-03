import { query } from "./db.ts";
import { festivalName } from "../lib/festivals.ts";

/**
 * Capacity outlook for future weeks.
 *
 * A transparent baseline, not a trained model (the Datathon models are judged
 * separately): demand history is deflated by the calendar effects the brief
 * names (paydays, festival build-up, Saturdays), averaged per weekday over the
 * last eight weeks, then re-inflated with the calendar of each future day. The
 * result is translated into vehicle trips and refrigerated trips so the
 * dispatcher can see when the fleet will run short.
 */

export function demandFactor(day: {
  dow: number;
  is_payday: number;
  festival_ramp: number;
}): number {
  return (
    1 +
    0.45 * Number(day.festival_ramp) +
    (day.is_payday ? 0.15 : 0) +
    (day.dow === 5 ? 0.1 : 0)
  );
}

interface Day {
  date: string;
  dow: number;
  iso_year: number;
  iso_week: number;
  is_payday: number;
  festival: string | null;
  festival_ramp: number;
  is_operating: number;
}

const FILL = 0.8;

export async function capacityForecast(fromDate: string, weeks = 8) {
  const history = await query<{
    date: string;
    depot: string;
    brand: string;
    total_volume_m3: number;
    chilled_volume_m3: number;
  }>(
    "SELECT * FROM demand_history WHERE date < $1 AND date >= $1::date - 56 ORDER BY date",
    [fromDate],
  );
  const calendar = await query<Day>(
    "SELECT date, dow, iso_year, iso_week, is_payday, festival, festival_ramp, is_operating FROM calendar WHERE date >= $1::date - 56 AND date < $1::date + $2::int * 7 + 7 ORDER BY date",
    [fromDate, weeks],
  );
  const vehicles = await query<{
    depot: string;
    temp: string;
    type: string;
    status: string;
    volume_cap_m3: number;
  }>("SELECT depot, temp, type, status, volume_cap_m3 FROM vehicles");
  const day = new Map(calendar.map((d) => [d.date, d]));

  // Per depot/brand/weekday: mean deflated volume and chilled share.
  const base = new Map<string, { total: number; chilled: number; n: number }>();
  for (const h of history) {
    const d = day.get(h.date);
    if (!d) continue;
    const f = demandFactor(d);
    const key = `${h.depot}|${h.brand}|${d.dow}`;
    const b = base.get(key) ?? { total: 0, chilled: 0, n: 0 };
    b.total += h.total_volume_m3 / f;
    b.chilled += h.chilled_volume_m3 / f;
    b.n++;
    base.set(key, b);
  }
  // Weeks with no history on a weekday count as zero demand for that weekday.
  const weeksObserved = 8;

  const segments = [
    ...new Set(history.map((h) => `${h.depot}|${h.brand}`)),
  ].sort();
  const future = calendar.filter(
    (d) => d.date >= fromDate && d.is_operating === 1,
  );
  const weekKeys = [
    ...new Set(
      future.map(
        (d) => `${d.iso_year}-W${String(d.iso_week).padStart(2, "0")}`,
      ),
    ),
  ].slice(0, weeks);

  const fleet = (depot: string) => {
    const available = vehicles.filter(
      (v) => v.depot === depot && v.status === "available",
    );
    const reefers = available.filter((v) => v.temp === "reefer");
    const avg = (list: typeof available) =>
      list.length
        ? list.reduce((s, v) => s + v.volume_cap_m3, 0) / list.length
        : 1;
    return {
      vehicles: available.length,
      reefers: reefers.length,
      avgVolume: avg(available),
      avgReefer: avg(reefers),
    };
  };

  const rows = weekKeys.flatMap((wk) => {
    const days = future.filter(
      (d) => `${d.iso_year}-W${String(d.iso_week).padStart(2, "0")}` === wk,
    );
    // Festivals fall on non-operating holidays, so read notes from every day of the week.
    const calendarWeek = calendar.filter(
      (d) =>
        d.date >= fromDate &&
        `${d.iso_year}-W${String(d.iso_week).padStart(2, "0")}` === wk,
    );
    const notes = [
      ...new Set(
        calendarWeek.flatMap((d) => [
          ...(d.festival ? [festivalName(d.festival)] : []),
          ...(Number(d.festival_ramp) > 0 && !d.festival
            ? ["Festival build-up"]
            : []),
          ...(d.is_payday ? ["Payday"] : []),
        ]),
      ),
    ];
    return segments.map((seg) => {
      const [depot, brand] = seg.split("|");
      let total = 0;
      let chilled = 0;
      let peak = 0;
      let peakDate = days[0]?.date;
      for (const d of days) {
        const b = base.get(`${seg}|${d.dow}`);
        if (!b) continue;
        const f = demandFactor(d);
        const t = (b.total / weeksObserved) * f;
        total += t;
        chilled += (b.chilled / weeksObserved) * f;
        if (t > peak) {
          peak = t;
          peakDate = d.date;
        }
      }
      const cap = fleet(depot);
      const trips = total / (cap.avgVolume * FILL);
      const reeferTrips = chilled / (cap.avgReefer * FILL);
      const peakReeferTrips =
        brand === "Fresh" && total > 0
          ? (peak * (chilled / total)) / (cap.avgReefer * FILL)
          : 0;
      return {
        week: wk,
        week_start: days[0]?.date,
        operating_days: days.length,
        depot,
        brand,
        total_volume_m3: Number(total.toFixed(1)),
        chilled_volume_m3: Number(chilled.toFixed(1)),
        peak_date: peakDate,
        peak_day_m3: Number(peak.toFixed(1)),
        trips_needed: Math.ceil(trips),
        reefer_trips_needed: Math.ceil(reeferTrips),
        peak_reefer_trips: Math.ceil(peakReeferTrips),
        reefer_trip_capacity_per_day: cap.reefers * 2,
        notes,
      };
    });
  });

  return {
    method:
      "Weekday baseline over the last 8 weeks, deflated and re-inflated for paydays, festival build-up and Saturdays. Trips assume 80% volume fill.",
    fleet: ["Peliyagoda", "Kandy"].map((d) => ({ depot: d, ...fleet(d) })),
    rows,
  };
}
