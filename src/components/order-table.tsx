"use client";
import React from "react";
import {
  ArrowUpRight,
  Clock3,
  Download,
  Leaf,
  Search,
  Snowflake,
  X,
  ShoppingBag,
  Monitor,
} from "lucide-react";
import type { TableProps } from "@/lib/types";
import { Badge } from "./ui-primitives";

export function OrderTable({
  orders,
  search,
  setSearch,
  brand,
  setBrand,
  tab,
  setTab,
  setModal,
  download,
}: TableProps) {
  return (
    <section className="panel orders-panel">
      <div className="panel-header">
        <div>
          <h2>
            Today’s deliveries{" "}
            <span className="subtle-count">
              {orders.length.toString().padStart(2, "0")}
            </span>
          </h2>
          <p>The details that keep your day on track.</p>
        </div>
        <button className="btn secondary small-btn" onClick={download}>
          <Download size={14} />
          Export
        </button>
      </div>
      <div className="table-toolbar">
        <div className="table-tabs">
          {["All deliveries", "Needs attention"].map((t) => (
            <button
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
              key={t}
            >
              {t}
              {t === "Needs attention" && <span>!</span>}
            </button>
          ))}
        </div>
        <div className="table-filters">
          <label className="search-input">
            <Search size={15} />
            <input
              aria-label="Search orders"
              placeholder="Search orders…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button aria-label="Clear search" onClick={() => setSearch("")}>
                <X size={13} />
              </button>
            )}
          </label>
          <select
            aria-label="Filter by brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          >
            {["All brands", "Fresh", "Style", "Tech"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>ORDER / OUTLET</th>
              <th>BRAND</th>
              <th>DELIVERY WINDOW</th>
              <th>VEHICLE</th>
              <th>STATUS</th>
              <th>ETA</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                onClick={() => setModal({ type: "order", order: o })}
              >
                <td>
                  <div className="order-name">
                    <span className={`brand-icon ${o.brand.toLowerCase()}`}>
                      {React.createElement(
                        o.brand === "Fresh"
                          ? Leaf
                          : o.brand === "Style"
                            ? ShoppingBag
                            : Monitor,
                        { size: 16 },
                      )}
                    </span>
                    <span>
                      <b>{o.name}</b>
                      <small>
                        {o.id}{" "}
                        {o.temp === "Chilled" && (
                          <>
                            · <Snowflake size={10} /> Chilled
                          </>
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
                <td>{o.window}</td>
                <td className="vehicle-cell">{o.vehicle}</td>
                <td>
                  <Badge>{o.status}</Badge>
                </td>
                <td className={o.status === "At risk" ? "late-text" : ""}>
                  {o.eta}
                </td>
                <td>
                  <button
                    className="icon-btn"
                    aria-label={`View order ${o.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setModal({ type: "order", order: o });
                    }}
                  >
                    <ArrowUpRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <div className="empty-state">
            <Search size={28} />
            <h3>No deliveries found</h3>
            <p>Try another search or brand filter.</p>
          </div>
        )}
      </div>
      <div className="table-bottom">
        <span>{orders.length} illustrative orders · Monday’s delivery run</span>
        <span>
          All times in Sri Lanka <Clock3 size={12} />
        </span>
      </div>
    </section>
  );
}
