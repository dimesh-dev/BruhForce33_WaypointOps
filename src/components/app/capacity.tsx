"use client";
import { useMemo, useState } from "react";
import { BarChart3, Snowflake } from "lucide-react";
import { useApi } from "@/lib/client/api";
import { shortDate } from "@/lib/client/format";
import { Empty } from "@/lib/client/ui";

interface Row {
  week: string;
  week_start: string;
  operating_days: number;
  depot: string;
  brand: "Fresh" | "Style" | "Tech";
  total_volume_m3: number;
  chilled_volume_m3: number;
  peak_date: string;
  peak_day_m3: number;
  trips_needed: number;
  reefer_trips_needed: number;
  peak_reefer_trips: number;
  reefer_trip_capacity_per_day: number;
  notes: string[];
}
interface Forecast {
  method: string;
  fleet: {
    depot: string;
    vehicles: number;
    reefers: number;
    avgVolume: number;
    avgReefer: number;
  }[];
  rows: Row[];
}

export function CapacityPage({ runDate }: { runDate: string }) {
  const { data, loading } = useApi<Forecast>(
    `/api/forecast?from=${runDate}&weeks=8`,
  );
  const [depot, setDepot] = useState("Peliyagoda");
  const weeks = useMemo(() => {
    const rows = (data?.rows ?? []).filter((r) => r.depot === depot);
    const map = new Map<string, Row[]>();
    rows.forEach((r) => map.set(r.week, [...(map.get(r.week) ?? []), r]));
    return [...map.entries()];
  }, [data, depot]);
  const fleet = data?.fleet.find((f) => f.depot === depot);
  const max = Math.max(
    1,
    ...weeks.map(([, rs]) => rs.reduce((s, r) => s + r.total_volume_m3, 0)),
  );
  return (
    <>
      <div className="page-stat-strip">
        <span>
          <BarChart3 size={21} /> Weekly demand outlook, {depot}
        </span>
        <span>
          <Snowflake size={21} />
          <b>{fleet?.reefers ?? "—"}</b> reefers available ·{" "}
          {fleet?.vehicles ?? "—"} vehicles
        </span>
        <select
          aria-label="Depot"
          value={depot}
          onChange={(e) => setDepot(e.target.value)}
        >
          <option>Peliyagoda</option>
          <option>Kandy</option>
        </select>
      </div>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Vehicles, drivers and refrigerated capacity ahead</h2>
            <p>{data?.method}</p>
          </div>
        </div>
        {loading ? (
          <p className="muted">Building the outlook…</p>
        ) : weeks.length === 0 ? (
          <Empty icon={<BarChart3 size={28} />} title="No demand history yet" />
        ) : (
          <div className="table-scroll">
            <table className="dense forecast-table">
              <thead>
                <tr>
                  <th>WEEK</th>
                  <th>DEMAND (m³)</th>
                  <th>FRESH · CHILLED</th>
                  <th>STYLE</th>
                  <th>TECH</th>
                  <th>VEHICLE TRIPS</th>
                  <th>PEAK-DAY REEFER TRIPS</th>
                  <th>CALENDAR</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map(([wk, rs]) => {
                  const get = (b: string) => rs.find((r) => r.brand === b);
                  const total = rs.reduce((s, r) => s + r.total_volume_m3, 0);
                  const trips = rs.reduce((s, r) => s + r.trips_needed, 0);
                  const fresh = get("Fresh");
                  const shortReefer =
                    fresh &&
                    fresh.peak_reefer_trips >
                      fresh.reefer_trip_capacity_per_day;
                  return (
                    <tr key={wk} className={shortReefer ? "row-warning" : ""}>
                      <td>
                        <b>{wk}</b>
                        <small className="block muted">
                          from {shortDate(rs[0].week_start)} ·{" "}
                          {rs[0].operating_days} days
                        </small>
                      </td>
                      <td>
                        <div className="bar-cell" aria-hidden="true">
                          <i style={{ width: `${(total / max) * 100}%` }} />
                        </div>
                        {total.toFixed(0)}
                      </td>
                      <td>
                        {fresh?.total_volume_m3.toFixed(0) ?? 0} ·{" "}
                        <Snowflake size={11} />{" "}
                        {fresh?.chilled_volume_m3.toFixed(0) ?? 0}
                      </td>
                      <td>{get("Style")?.total_volume_m3.toFixed(0) ?? 0}</td>
                      <td>{get("Tech")?.total_volume_m3.toFixed(0) ?? 0}</td>
                      <td>
                        {trips}{" "}
                        <small className="muted">
                          ≈{" "}
                          {Math.ceil(trips / Math.max(1, rs[0].operating_days))}
                          /day
                        </small>
                      </td>
                      <td>
                        {fresh ? (
                          <>
                            <b className={shortReefer ? "late-text" : ""}>
                              {fresh.peak_reefer_trips}
                            </b>{" "}
                            / {fresh.reefer_trip_capacity_per_day}
                            {shortReefer && (
                              <small className="block late-text">
                                Short of reefer capacity on{" "}
                                {shortDate(fresh.peak_date)}
                              </small>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{rs[0].notes.join(", ") || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="info-note">
        <BarChart3 size={20} />
        <p>
          Reefer trip capacity counts each available refrigerated vehicle for
          two trips a day. Weeks highlighted need more refrigerated trips on
          their peak day than the fleet can run: bring workshop vehicles back,
          hire cold-chain capacity or agree earlier ordering with stores.
        </p>
      </div>
    </>
  );
}
