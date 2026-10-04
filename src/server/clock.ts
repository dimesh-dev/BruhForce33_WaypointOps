import { one, query, type Db, pool } from "./db.ts";

/**
 * Operating clock. Waypoint runs on Asia/Colombo time (UTC+05:30, no DST).
 *
 * For a reproducible judge walkthrough the seed anchors a scenario time
 * (DEMO_START, default Monday 5 Oct 2026 14:30) to the real moment the data was
 * seeded; the scenario clock then advances in real time. Set DEMO_START=off to
 * run on the real clock.
 */
export const COLOMBO_OFFSET_MIN = 330;
export const CUTOFF_MIN = 16 * 60;

export async function now(db: Db = pool()): Promise<Date> {
  const rows = await query<{ key: string; value: string }>(
    "SELECT key, value FROM app_meta WHERE key IN ('clock_anchor_real','clock_anchor_sim')",
    [],
    db,
  );
  const meta = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (!meta.clock_anchor_real || !meta.clock_anchor_sim) return new Date();
  const elapsed = Date.now() - new Date(meta.clock_anchor_real).getTime();
  return new Date(new Date(meta.clock_anchor_sim).getTime() + elapsed);
}

export function colombo(date: Date): { date: string; minutes: number } {
  const shifted = new Date(date.getTime() + COLOMBO_OFFSET_MIN * 60000);
  return {
    date: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** UTC instant for a Colombo wall-clock date and minute-of-day. */
export function colomboInstant(date: string, minutes: number): Date {
  return new Date(
    new Date(`${date}T00:00:00Z`).getTime() +
      (minutes - COLOMBO_OFFSET_MIN) * 60000,
  );
}

/** "Wed 8 Apr" for notification text. */
export function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Orders for a run close at 16:00 Colombo time on the previous calendar day. */
export function cutoffFor(runDate: string): Date {
  return colomboInstant(addDays(runDate, -1), CUTOFF_MIN);
}

export async function nextOperatingDate(
  after: string,
  db: Db = pool(),
): Promise<string | undefined> {
  const row = await one<{ date: string }>(
    "SELECT date FROM calendar WHERE date > $1 AND is_operating = 1 ORDER BY date LIMIT 1",
    [after],
    db,
  );
  return row?.date;
}

/**
 * The run a newly placed order joins: the first operating day whose cutoff has
 * not passed and whose queue the dispatcher has not closed.
 */
export async function orderingRunDate(
  at: Date,
  db: Db = pool(),
): Promise<string | undefined> {
  const rows = await query<{ date: string; closed_at: string | null }>(
    `SELECT c.date, r.closed_at FROM calendar c
       LEFT JOIN run_days r ON r.run_date = c.date
      WHERE c.date > $1 AND c.is_operating = 1
      ORDER BY c.date LIMIT 10`,
    [colombo(at).date],
    db,
  );
  return rows.find((r) => !r.closed_at && at < cutoffFor(r.date))?.date;
}
