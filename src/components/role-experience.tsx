"use client";
import Image from "next/image";
import React from "react";
import { useState } from "react";
import {
  ArrowRight,
  Box,
  Check,
  CheckCheck,
  Clock3,
  Leaf,
  ShoppingBag,
  Monitor,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  Snowflake,
  Store,
  Truck,
  Wifi,
  WifiOff,
  Layers,
  AlertTriangle,
} from "lucide-react";
import type { Order, RoleProps } from "@/lib/types";
import { initialOrders } from "@/lib/demo-data";
import { Badge } from "./ui-primitives";

export function RoleExperience({
  role,
  user,
  orders,
  loaded,
  setLoaded,
  published,
  offline,
  setOffline,
  queued,
  sync,
  notify,
  setModal,
}: RoleProps) {
  const [storeOrderId, setStoreOrderId] = useState("WP-2041");
  const order =
    orders.find(
      (o) => o.id === (role === "Store manager" ? storeOrderId : "WP-2041"),
    ) ?? initialOrders[0];
  return (
    <div className="role-experience">
      <div className="page-heading role-illustrated-heading">
        <Image
          width={1536}
          height={1024}
          sizes="(max-width: 700px) 100vw, 800px"
          className="role-heading-art"
          src={`/images/${role === "Loader" ? "loading-dock" : role === "Driver" ? "on-the-road" : "neighborhood-store"}.png`}
          alt=""
        />
        <div>
          <div className="eyebrow">
            {role === "Loader"
              ? "PELIYAGODA · DOCK 03"
              : role === "Driver"
                ? "ROUTE R-012 · COLOMBO"
                : order.name.toUpperCase()}
          </div>
          <h1>
            {role === "Loader"
              ? "A good journey starts here."
              : role === "Driver"
                ? `Let’s get there, ${user.name}.`
                : "Your store. In the loop."}
          </h1>
          <p>
            {role === "Loader"
              ? "The right goods, in the right order, before the wheels turn."
              : role === "Driver"
                ? "Everything you need for the next stop. Use when safely parked."
                : "Know what’s arriving, make room for it, and keep your shelves ready."}
          </p>
        </div>
        {role === "Store manager" ? (
          <select
            aria-label="Switch example store"
            value={storeOrderId}
            onChange={(e) => setStoreOrderId(e.target.value)}
          >
            {orders.slice(0, 6).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        ) : (
          <Badge kind={offline ? "deferred" : "delivered"}>
            {offline ? "Offline · saved on device" : "Connected"}
          </Badge>
        )}
      </div>
      {role === "Loader" ? (
        <div className="role-columns">
          <section className="panel task-panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">NEXT DEPARTURE · 05:30 AM</span>
                <h2>Colombo morning run</h2>
              </div>
              <span className="truck-tile">
                <Truck size={24} />
              </span>
            </div>
            <div className="load-summary">
              <span>
                WP-012 <b>Refrigerated truck</b>
              </span>
              <span>
                Driver <b>Kasun Perera</b>
              </span>
              <span>
                Plan status{" "}
                <b>{published ? "Published · v2" : "Demo baseline · v1"}</b>
              </span>
            </div>
            <div className="inline-callout">
              <Layers size={20} />
              <div>
                <b>Last stop in. First stop out.</b>
                <p>
                  Load in reverse delivery order so the first stop stays
                  accessible.
                </p>
              </div>
            </div>
            <div className="loading-items">
              {[
                {
                  id: "cargo3",
                  name: "Fresh · Dehiwala",
                  stop: "STOP 03 · LOAD FIRST",
                  units: "18 ambient cartons",
                  icon: Box,
                },
                {
                  id: "cargo2",
                  name: "Fresh · Wellawatte",
                  stop: "STOP 02",
                  units: "12 chilled crates",
                  icon: Snowflake,
                },
                {
                  id: "cargo1",
                  name: "Fresh · Colombo 03",
                  stop: "STOP 01 · LOAD LAST",
                  units: "24 chilled crates",
                  icon: Snowflake,
                },
              ].map((c) => (
                <button
                  key={c.id}
                  className={`loading-item ${loaded.includes(c.id) ? "checked" : ""}`}
                  onClick={() =>
                    setLoaded((l) =>
                      l.includes(c.id)
                        ? l.filter((x) => x !== c.id)
                        : [...l, c.id],
                    )
                  }
                >
                  <span className="check-box">
                    {loaded.includes(c.id) && <Check size={16} />}
                  </span>
                  <div>
                    <small>{c.stop}</small>
                    <h3>{c.name}</h3>
                    <p>
                      <c.icon size={14} />
                      {c.units}
                    </p>
                  </div>
                  <span className="check-label">
                    {loaded.includes(c.id) ? "Checked" : "Check load"}
                  </span>
                </button>
              ))}
            </div>
            <div className="task-actions">
              <button
                className="btn secondary"
                onClick={() => setModal({ type: "shortfall" })}
              >
                <AlertTriangle size={17} />
                Report a shortfall
              </button>
              <button
                className="btn primary"
                disabled={loaded.length < 3}
                onClick={() => setModal({ type: "ready" })}
              >
                Mark ready to depart
                <ArrowRight size={16} />
              </button>
            </div>
          </section>
          <aside className="panel context-panel">
            <span className="eyebrow">BEFORE YOU CLOSE THE DOORS</span>
            <h2>Every detail matters.</h2>
            <div className="checklist">
              <p>
                <Snowflake />
                Cold chain confirmed<span>Refrigerated vehicle</span>
              </p>
              <p>
                <Package />
                Both capacity limits checked<span>68% weight · 74% volume</span>
              </p>
              <p>
                <MapPin />
                Stop sequence confirmed
                <span>3 example stops · reverse load order</span>
              </p>
            </div>
            <div
              className="progress-ring"
              style={
                {
                  "--progress": `${(loaded.length / 3) * 100}%`,
                } as React.CSSProperties
              }
            >
              <div>
                <b>{loaded.length}/3</b>
                <span>loads checked</span>
              </div>
            </div>
            <p className="muted centered">
              Flag missing or damaged items before departure. Your dispatcher
              sees the report.
            </p>
          </aside>
        </div>
      ) : role === "Driver" ? (
        <div className="role-columns driver-columns">
          <section className="panel task-panel">
            <div className={`connectivity-banner ${offline ? "offline" : ""}`}>
              <span>
                {offline ? <WifiOff size={18} /> : <Wifi size={18} />}
                <b>
                  {offline
                    ? "You’re offline. Keep going."
                    : "Your route is up to date."}
                </b>
              </span>
              <button
                onClick={() => {
                  if (offline) sync();
                  else setOffline(true);
                }}
              >
                {offline ? "Reconnect & sync" : "Simulate offline"}
              </button>
            </div>
            {offline && (
              <div className="offline-explanation">
                <p>
                  Delivery records stay on this device until you reconnect.
                  Photos and signatures are represented by a proof note in this
                  prototype.
                </p>
                <b>
                  {queued.length} record{queued.length !== 1 ? "s" : ""} waiting
                  to sync
                </b>
              </div>
            )}
            <div className="driver-stop">
              <span className="eyebrow">NEXT STOP · 04 OF 06</span>
              <h2>Fresh · Colombo 03</h2>
              <p>
                <MapPin size={16} />
                Galle Road, Colombo 03
              </p>
              <div className="arrival-time">
                06:42{" "}
                <span>
                  AM<small>Expected arrival</small>
                </span>
                <Badge kind="delivered">On time</Badge>
              </div>
              <div className="stop-details">
                <span>
                  <Clock3 size={18} />
                  <small>Receiving window</small>
                  <b>06:00 - 07:30</b>
                </span>
                <span>
                  <Snowflake size={18} />
                  <small>Your delivery</small>
                  <b>24 chilled crates</b>
                </span>
                <span>
                  <Truck size={18} />
                  <small>Unloading access</small>
                  <b>Rear loading dock</b>
                </span>
              </div>
              <div className="inline-callout">
                <Store size={20} />
                <div>
                  <b>Receiving note</b>
                  <p>
                    Use the rear entrance. Ask for Anjali at the receiving
                    counter.
                  </p>
                </div>
              </div>
              <button
                className="btn primary full large-btn"
                disabled={
                  queued.some((q) => q.id === order.id) ||
                  ["Delivered", "Received"].includes(order.status)
                }
                onClick={() => setModal({ type: "pod", order })}
              >
                <CheckCheck size={18} />
                {queued.some((q) => q.id === order.id)
                  ? "Proof saved · awaiting sync"
                  : ["Delivered", "Received"].includes(order.status)
                    ? "Delivery recorded"
                    : "Record delivery & proof"}
              </button>
              <button
                className="btn secondary full"
                onClick={() => setModal({ type: "driverissue" })}
              >
                <AlertTriangle size={16} />
                Report a delivery issue
              </button>
            </div>
          </section>
          <aside className="panel context-panel">
            <span className="eyebrow">TODAY’S JOURNEY</span>
            <h2>One stop at a time.</h2>
            <div className="journey">
              {[
                "Depart Peliyagoda",
                "Fresh · Wattala",
                "Fresh · Kotahena",
                "Fresh · Colombo 03",
                "Fresh · Wellawatte",
                "Fresh · Dehiwala",
              ].map((s, i) => (
                <div
                  className={i < 3 ? "complete" : i === 3 ? "current" : ""}
                  key={s}
                >
                  <span>{i < 3 ? <Check size={14} /> : i}</span>
                  <div>
                    <b>{s}</b>
                    <small>
                      {
                        [
                          "05:30 · Departed",
                          "05:54 · Delivered",
                          "06:18 · Delivered",
                          queued.length
                            ? "Proof saved offline"
                            : "06:42 · Next stop",
                          "07:02 · Planned",
                          "07:25 · Planned",
                        ][i]
                      }
                    </small>
                  </div>
                </div>
              ))}
            </div>
            <div className="safe-note">
              <ShieldCheck size={20} />
              <span>
                Your safety comes first.
                <br />
                Use this screen while parked.
              </span>
            </div>
          </aside>
        </div>
      ) : (
        <div className="role-columns">
          <section className="panel task-panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">MONDAY’S DELIVERY</span>
                <h2>
                  {order.status === "Deferred"
                    ? "A change to your delivery."
                    : `Your ${order.brand.toLowerCase()} delivery, in view.`}
                </h2>
              </div>
              <span className={`brand-icon ${order.brand.toLowerCase()}`}>
                {order.brand === "Fresh" ? (
                  <Leaf size={23} />
                ) : order.brand === "Style" ? (
                  <ShoppingBag size={23} />
                ) : (
                  <Monitor size={23} />
                )}
              </span>
            </div>
            <div className="store-delivery">
              <Badge>{order.status}</Badge>
              <div className="arrival-time">
                {order.status === "Deferred" ? "Next run" : order.eta}
                <span>
                  {order.status === "Deferred" ? "" : "AM"}
                  <small>
                    {["Delivered", "Received"].includes(order.status)
                      ? "Delivery recorded"
                      : "Expected arrival"}
                  </small>
                </span>
              </div>
              <p>
                Order {order.id} · {order.temp} · {order.amount}
              </p>
              <div className="delivery-timeline">
                {["Confirmed", "Scheduled", "On the road", "Delivered"].map(
                  (s, i) => (
                    <div
                      className={
                        i <=
                        (order.status === "Deferred"
                          ? 0
                          : order.status === "Scheduled"
                            ? 1
                            : ["Delivered", "Received"].includes(order.status)
                              ? 3
                              : 2)
                          ? "done"
                          : ""
                      }
                      key={s}
                    >
                      <span>
                        <Check size={13} />
                      </span>
                      <small>{s}</small>
                    </div>
                  ),
                )}
              </div>
              {order.status === "Deferred" ? (
                <div className="inline-callout warning">
                  <Clock3 size={20} />
                  <div>
                    <b>Next eligible run · Tuesday 29 Sep</b>
                    <p>
                      {order.reason ||
                        "No compatible refrigerated van is available for this run."}{" "}
                      Your order stays in the queue for priority review.
                    </p>
                  </div>
                </div>
              ) : ["Delivered", "Received"].includes(order.status) ? (
                <div className="inline-callout">
                  <CheckCheck size={20} />
                  <div>
                    <b>Delivery proof received</b>
                    <p>
                      {order.proof ||
                        "Recorded by Kasun Perera at the rear loading dock."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="inline-callout">
                  <Truck size={20} />
                  <div>
                    <b>
                      {order.status === "Scheduled"
                        ? "Your delivery is scheduled."
                        : order.status === "At risk"
                          ? "Your arrival window needs review."
                          : "Your driver is on the way."}
                    </b>
                    <p>
                      Plan your receiving team around the arrival time. We’ll
                      show changes here.
                    </p>
                  </div>
                </div>
              )}
              <button
                className="btn primary full"
                disabled={
                  !["Delivered", "Received"].includes(order.status) ||
                  order.status === "Received"
                }
                onClick={() => setModal({ type: "receipt", order })}
              >
                <CheckCheck size={17} />
                {order.status === "Received"
                  ? "Receipt confirmed"
                  : "Confirm receipt"}
              </button>
              <button
                className="btn secondary full"
                onClick={() => setModal({ type: "storeissue" })}
              >
                Report an issue
                <ArrowRight size={15} />
              </button>
            </div>
          </section>
          <aside className="panel context-panel">
            <span className="eyebrow">FRESH · COLOMBO 03 ORDERING DEMO</span>
            <h2>
              What’s next
              <br />
              for your store?
            </h2>
            <div className="order-cutoff">
              <Clock3 size={25} />
              <span>
                Next-day orders close at<b>4:00 PM</b>
                <small>Asia/Colombo · Monday</small>
              </span>
            </div>
            <p className="muted">
              Place separate orders for chilled and ambient goods. Orders after
              cutoff move to the following operating run.
            </p>
            <button
              className="btn primary full"
              onClick={() => setModal({ type: "neworder" })}
            >
              <Plus size={16} />
              Place a new order
            </button>
            {orders
              .filter((o) => o.status === "Deferred" && o.id === storeOrderId)
              .map((o) => (
                <div className="deferred-notice" key={o.id}>
                  <Badge>Deferred</Badge>
                  <h4>{o.name}</h4>
                  <p>
                    {o.reason || "No refrigerated van available for this run."}
                  </p>
                  <small>Next eligible run · Tuesday 29 Sep</small>
                </div>
              ))}
          </aside>
        </div>
      )}
    </div>
  );
}
