"use client";
import { useState } from "react";
import {
  Download,
  Leaf,
  Monitor,
  Search,
  ShoppingBag,
  Snowflake,
  Store,
  Truck,
  Wrench,
} from "lucide-react";
import { api, ApiError, useApi } from "@/lib/client/api";
import {
  ACCESS,
  colomboTime,
  DOCK,
  downloadCsv,
  hhmm,
  ORDER_STATUS,
  shortDate,
} from "@/lib/client/format";
import { Select } from "@/lib/client/controls";
import { Badge, Empty, Meter, useToast } from "@/lib/client/ui";
import type { DispatchProps } from "./dispatcher";

const BRAND_ICON = { Fresh: Leaf, Style: ShoppingBag, Tech: Monitor } as const;

export function OrdersPage({ board }: DispatchProps) {
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("All brands");
  const [status, setStatus] = useState("All statuses");
  const stopByOrder = new Map(
    board.trips.flatMap((t) =>
      t.stops.map((s) => [s.order_id, { trip: t, stop: s }] as const),
    ),
  );
  const deferred = new Map(board.deferrals.map((d) => [d.order_id, d]));
  const rows = board.orders.filter(
    (o) =>
      (brand === "All brands" || o.brand === brand) &&
      (status === "All statuses" || o.status === status) &&
      `${o.order_id} ${o.outlet_name} ${o.outlet_id} ${o.district}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const exportCsv = () =>
    downloadCsv(`waypoint-orders-${board.run.run_date}.csv`, [
      [
        "order_id",
        "outlet_id",
        "outlet",
        "brand",
        "district",
        "temp",
        "units",
        "weight_kg",
        "volume_m3",
        "status",
        "vehicle_id",
        "trip_id",
        "planned_arrival",
        "deferral_reason",
      ],
      ...rows.map((o) => {
        const s = stopByOrder.get(o.order_id);
        return [
          o.order_id,
          o.outlet_id,
          o.outlet_name,
          o.brand,
          o.district,
          o.temp_requirement,
          o.units,
          o.weight_kg,
          o.volume_m3,
          o.status,
          s?.trip.vehicle_id,
          s?.trip.trip_no,
          s ? hhmm(s.stop.arrival_min) : "",
          deferred.get(o.order_id)?.reason,
        ];
      }),
    ]);
  return (
    <section className="panel orders-panel">
      <div className="panel-header">
        <div>
          <h2>
            Orders for this run{" "}
            <span className="subtle-count">{rows.length}</span>
          </h2>
          <p>
            Store orders arrive here directly; nothing is re-keyed from phone
            calls.
          </p>
        </div>
        <button className="btn secondary small-btn" onClick={exportCsv}>
          <Download size={14} /> Export CSV
        </button>
      </div>
      <div className="table-toolbar">
        <div className="table-filters">
          <label className="search-input">
            <Search size={15} />
            <input
              aria-label="Search orders"
              placeholder="Search order, outlet, district…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <Select
            compact
            ariaLabel="Filter by brand"
            value={brand}
            onChange={setBrand}
            options={["All brands", "Fresh", "Style", "Tech"]}
          />
          <Select
            compact
            ariaLabel="Filter by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "All statuses", label: "All statuses" },
              ...Object.entries(ORDER_STATUS).map(([k, v]) => ({
                value: k,
                label: v.label,
              })),
            ]}
          />
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>ORDER / OUTLET</th>
              <th>BRAND</th>
              <th>SIZE</th>
              <th>WINDOW · ACCESS</th>
              <th>VEHICLE</th>
              <th>STATUS</th>
              <th>ETA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const s = stopByOrder.get(o.order_id);
              const Icon = BRAND_ICON[o.brand];
              const d = deferred.get(o.order_id);
              return (
                <tr key={o.order_id}>
                  <td>
                    <div className="order-name">
                      <span className={`brand-icon ${o.brand.toLowerCase()}`}>
                        <Icon size={16} />
                      </span>
                      <span>
                        <b>{o.outlet_name}</b>
                        <small>
                          {o.order_id}
                          {o.temp_requirement === "chilled" && (
                            <>
                              {" "}
                              · <Snowflake size={10} /> Chilled
                            </>
                          )}
                          {o.deferred_count > 0 && (
                            <span className="skip-flag">
                              {" "}
                              · skipped {o.deferred_count}×
                            </span>
                          )}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`brand-text ${o.brand.toLowerCase()}`}>
                      {o.brand}
                    </span>
                  </td>
                  <td>
                    {o.volume_m3} m³ · {o.weight_kg} kg
                  </td>
                  <td>
                    {o.mall_window ??
                      `${o.window_open_time}–${o.window_close_time}`}
                    <small className="block muted">
                      {ACCESS[o.parking_constraint]}
                    </small>
                  </td>
                  <td className="vehicle-cell">
                    {s ? `${s.trip.vehicle_id} · T${s.trip.trip_no}` : "—"}
                  </td>
                  <td>
                    <Badge kind={ORDER_STATUS[o.status]?.kind ?? "scheduled"}>
                      {ORDER_STATUS[o.status]?.label ?? o.status}
                    </Badge>
                    {d && (
                      <small className="block muted reason-cell">
                        {d.reason}
                      </small>
                    )}
                  </td>
                  <td>
                    {s
                      ? hhmm(s.stop.arrival_min)
                      : d
                        ? shortDate(d.to_date)
                        : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <Empty icon={<Search size={28} />} title="No orders match" />
        )}
      </div>
      <div className="table-bottom">
        <span>Run {shortDate(board.run.run_date)}</span>
        <span>All times in Sri Lanka</span>
      </div>
    </section>
  );
}

interface FleetRow {
  vehicle_id: string;
  type: string;
  temp: string;
  weight_cap_kg: number;
  volume_cap_m3: number;
  km_per_l: number;
  weekly_fuel_quota_l: number;
  depot: string;
  status: "available" | "in_workshop";
  driver_name: string;
  fuel_used_l: number;
  fuel_planned_l: number;
}

export function FleetPage({ board, reload }: DispatchProps) {
  const toast = useToast();
  const fleet = useApi<{ vehicles: FleetRow[] }>(
    `/api/fleet?date=${board.run.run_date}`,
  );
  const [depot, setDepot] = useState("All depots");
  const tripsBy = new Map<string, number>();
  board.trips.forEach((t) =>
    tripsBy.set(t.vehicle_id, (tripsBy.get(t.vehicle_id) ?? 0) + 1),
  );
  const toggle = async (v: FleetRow) => {
    try {
      await api(`/api/fleet/${v.vehicle_id}`, {
        method: "PATCH",
        json: {
          status: v.status === "available" ? "in_workshop" : "available",
        },
      });
      toast(
        `${v.vehicle_id} ${v.status === "available" ? "sent to the workshop" : "back in service"}. Regenerate the draft to apply.`,
      );
      await fleet.reload();
      await reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Update failed", "error");
    }
  };
  const list = (fleet.data?.vehicles ?? []).filter(
    (v) => depot === "All depots" || v.depot === depot,
  );
  const all = fleet.data?.vehicles ?? [];
  return (
    <>
      <div className="page-stat-strip">
        <span>
          <Truck size={21} />
          <b>{all.length}</b> vehicles
        </span>
        <span>
          <Snowflake size={21} />
          <b>{all.filter((v) => v.temp === "reefer").length}</b> refrigerated
        </span>
        <span>
          <Wrench size={21} />
          <b>{all.filter((v) => v.status === "in_workshop").length}</b> in
          workshop
        </span>
        <Select
          compact
          ariaLabel="Filter by depot"
          value={depot}
          onChange={setDepot}
          options={["All depots", "Peliyagoda", "Kandy"]}
        />
      </div>
      <section className="panel">
        <div className="table-scroll">
          <table className="dense">
            <thead>
              <tr>
                <th>VEHICLE · DRIVER</th>
                <th>TYPE</th>
                <th>CAPACITY</th>
                <th>WEEKLY FUEL</th>
                <th>TRIPS THIS RUN</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.vehicle_id}>
                  <td>
                    <b>{v.vehicle_id}</b>
                    <small className="block muted">
                      {v.driver_name} · login {v.vehicle_id.toLowerCase()}
                    </small>
                  </td>
                  <td>
                    {v.type} · {v.temp} · {v.depot}
                  </td>
                  <td>
                    {v.weight_cap_kg} kg · {v.volume_cap_m3} m³
                  </td>
                  <td className="meter-cell">
                    <Meter
                      label={`${v.km_per_l} km/L`}
                      value={v.fuel_used_l + v.fuel_planned_l}
                      max={v.weekly_fuel_quota_l}
                      unit="L"
                    />
                  </td>
                  <td>{tripsBy.get(v.vehicle_id) ?? 0}</td>
                  <td>
                    <button
                      className={`btn small-btn ${v.status === "available" ? "secondary" : "warning-btn"}`}
                      onClick={() => toggle(v)}
                      aria-label={`${v.vehicle_id} is ${v.status}; toggle`}
                    >
                      {v.status === "available" ? "Available" : "In workshop"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

interface OutletRow {
  outlet_id: string;
  name: string;
  brand: "Fresh" | "Style" | "Tech";
  district: string;
  depot: string;
  dock_type: string;
  parking_constraint: string;
  mall_window: string | null;
  window_open_time: string;
  window_close_time: string;
  deferrals: number;
  manager_login: string;
}

export function OutletsPage(_props: DispatchProps) {
  const outlets = useApi<{ outlets: OutletRow[] }>("/api/outlets");
  const [q, setQ] = useState("");
  const list = (outlets.data?.outlets ?? []).filter((o) =>
    `${o.outlet_id} ${o.name} ${o.district} ${o.brand}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>
            Outlets <span className="subtle-count">{list.length}</span>
          </h2>
          <p>Access rules and receiving windows the planner enforces.</p>
        </div>
        <label className="search-input">
          <Search size={15} />
          <input
            aria-label="Search outlets"
            placeholder="Find an outlet…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>
      <div className="table-scroll">
        <table className="dense">
          <thead>
            <tr>
              <th>OUTLET</th>
              <th>DISTRICT · DEPOT</th>
              <th>UNLOADING</th>
              <th>ACCESS</th>
              <th>WINDOW</th>
              <th>DEFERRALS</th>
            </tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.outlet_id}>
                <td>
                  <b>{o.name}</b>
                  <small className="block muted">
                    {o.outlet_id} · manager login {o.manager_login}
                  </small>
                </td>
                <td>
                  {o.district} · {o.depot}
                </td>
                <td>{DOCK[o.dock_type]}</td>
                <td>
                  {ACCESS[o.parking_constraint]}
                  {o.mall_window && (
                    <small className="block muted">Mall {o.mall_window}</small>
                  )}
                </td>
                <td>
                  {o.window_open_time}–{o.window_close_time}
                </td>
                <td>{o.deferrals || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {outlets.loading && <p className="muted">Loading outlets…</p>}
        {!outlets.loading && list.length === 0 && (
          <Empty icon={<Store size={28} />} title="No outlets match" />
        )}
      </div>
      <div className="table-bottom">
        <span>Updated {colomboTime(new Date().toISOString())}</span>
      </div>
    </section>
  );
}
