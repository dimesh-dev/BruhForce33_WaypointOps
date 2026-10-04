"use client";
import Image from "next/image";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCheck,
  Clock3,
  Leaf,
  Monitor,
  Package,
  Plus,
  ShoppingBag,
  Snowflake,
  Truck,
} from "lucide-react";
import { api, ApiError, useApi } from "@/lib/client/api";
import {
  ACCESS,
  colomboTime,
  DOCK,
  hhmm,
  longDate,
  ORDER_STATUS,
  shortDate,
} from "@/lib/client/format";
import type { Clock, Me } from "@/lib/client/types";
import { NumberField, Select } from "@/lib/client/controls";
import { Badge, Dialog, Empty, useToast } from "@/lib/client/ui";

interface StoreOrder {
  order_id: string;
  brand: "Fresh" | "Style" | "Tech";
  temp_requirement: "chilled" | "ambient";
  units: number;
  weight_kg: number;
  volume_m3: number;
  status: string;
  requested_date: string;
  run_date: string;
  placed_at: string;
  deferred_count: number;
  stop: {
    stop_id: number;
    seq: number;
    stop_status: string;
    arrival_min: number;
    service_start_min: number;
    window_close_min: number;
    vehicle_id: string;
    trip_no: number;
    trip_status: string;
    driver_name: string;
    run_date: string;
    stops_before: number;
  } | null;
  deferral: {
    from_date: string;
    to_date: string;
    code: string;
    reason: string;
    unavoidable: boolean;
  } | null;
  proof: {
    outcome: string;
    receiver_name: string | null;
    units_delivered: number;
    note: string | null;
    failure_reason: string | null;
    recorded_at: string;
    has_photo: boolean;
    has_signature: boolean;
  } | null;
  receipt: {
    units_received: number;
    condition: string;
    note: string | null;
    confirmed_at: string;
  } | null;
}

interface StoreData {
  outlet: {
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
  };
  orders: StoreOrder[];
  clock: Clock;
}

const STAGES = [
  "Confirmed",
  "Scheduled",
  "On the road",
  "Delivered",
  "Received",
];
const stageOf = (o: StoreOrder) =>
  ({
    confirmed: 0,
    deferred: 0,
    planned: 1,
    loaded: 1,
    in_transit: 2,
    delivered: 3,
    failed: 3,
    received: 4,
    disputed: 4,
  })[o.status] ?? 0;
const BrandIcon = ({ brand }: { brand: string }) =>
  brand === "Fresh" ? (
    <Leaf size={23} />
  ) : brand === "Style" ? (
    <ShoppingBag size={23} />
  ) : (
    <Monitor size={23} />
  );

export function StoreView({ me }: { me: Me }) {
  const { data, reload } = useApi<StoreData>("/api/store", 15000);
  const [ordering, setOrdering] = useState(false);
  const [receipt, setReceipt] = useState<StoreOrder | null>(null);
  const [issue, setIssue] = useState<StoreOrder | null>(null);
  const [placed, setPlaced] = useState<{
    order_id: string;
    run_date: string;
    cutoff_at: string;
  } | null>(null);
  if (!data) return <div className="loading-state">Loading your store…</div>;
  const { outlet, orders, clock } = data;
  const active = orders.filter((o) => !["received"].includes(o.status));
  const history = orders.filter((o) => o.status === "received");

  return (
    <div className="role-experience">
      <div className="page-heading role-illustrated-heading">
        <Image
          width={1536}
          height={1024}
          sizes="(max-width: 700px) 100vw, 800px"
          className="role-heading-art"
          src="/images/neighborhood-store.png"
          alt=""
        />
        <div>
          <div className="eyebrow">
            {outlet.name.toUpperCase()} · {outlet.outlet_id}
          </div>
          <h1>Your store. In the loop.</h1>
          <p>
            Know what’s arriving, make room for it, and keep your shelves ready.
          </p>
        </div>
        <Badge kind={outlet.brand.toLowerCase()}>{outlet.brand}</Badge>
      </div>
      <div className="role-columns">
        <section className="panel task-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">YOUR DELIVERIES</span>
              <h2>
                {active.length
                  ? `${active.length} order${active.length === 1 ? "" : "s"} in progress`
                  : "Nothing in progress"}
              </h2>
            </div>
            <span className={`brand-icon ${outlet.brand.toLowerCase()}`}>
              <BrandIcon brand={outlet.brand} />
            </span>
          </div>
          {placed && (
            <div className="inline-callout" role="status">
              <CheckCheck size={20} />
              <div>
                <b>
                  Order {placed.order_id} received for{" "}
                  {longDate(placed.run_date)}
                </b>
                <p>
                  It is in the dispatcher’s queue. You’ll see the vehicle and
                  arrival time here once the plan is published.
                </p>
              </div>
            </div>
          )}
          {active.length === 0 && (
            <Empty icon={<Package size={28} />} title="No open orders" />
          )}
          <div className="store-orders">
            {active.map((o) => (
              <article className="store-delivery store-order" key={o.order_id}>
                <div className="store-order-head">
                  <Badge kind={ORDER_STATUS[o.status]?.kind ?? "scheduled"}>
                    {ORDER_STATUS[o.status]?.label ?? o.status}
                  </Badge>
                  <small>
                    {o.order_id} ·{" "}
                    {o.temp_requirement === "chilled" ? "Chilled" : "Ambient"} ·{" "}
                    {o.units} units · {o.volume_m3} m³
                  </small>
                </div>
                <div className="arrival-time">
                  {o.status === "deferred"
                    ? shortDate(o.run_date)
                    : o.stop
                      ? hhmm(o.stop.arrival_min)
                      : shortDate(o.run_date)}
                  <span>
                    <small>
                      {o.status === "deferred"
                        ? "Moved to this run"
                        : o.proof
                          ? `Recorded ${colomboTime(o.proof.recorded_at)}`
                          : o.stop
                            ? `Expected ${shortDate(o.stop.run_date)}`
                            : "Requested run · awaiting plan"}
                    </small>
                  </span>
                </div>
                <div className="delivery-timeline" aria-label="Order progress">
                  {STAGES.map((s, i) => (
                    <div className={i <= stageOf(o) ? "done" : ""} key={s}>
                      <span>
                        <Check size={13} />
                      </span>
                      <small>{s}</small>
                    </div>
                  ))}
                </div>
                {o.deferral && o.status === "deferred" ? (
                  <div className="inline-callout warning">
                    <Clock3 size={20} />
                    <div>
                      <b>
                        Moved from {shortDate(o.deferral.from_date)} to{" "}
                        {longDate(o.deferral.to_date)}
                      </b>
                      <p>
                        {o.deferral.reason} Your order keeps priority on the
                        next run so it is not skipped again.
                      </p>
                    </div>
                  </div>
                ) : o.proof ? (
                  <div
                    className={`inline-callout ${o.proof.outcome !== "delivered" ? "warning" : ""}`}
                  >
                    <CheckCheck size={20} />
                    <div>
                      <b>
                        {o.proof.outcome === "failed"
                          ? `Not delivered: ${o.proof.failure_reason}`
                          : `${o.proof.units_delivered} of ${o.units} units delivered${o.proof.outcome === "partial" ? " (partial)" : ""}`}
                      </b>
                      <p>
                        {o.proof.receiver_name
                          ? `Received by ${o.proof.receiver_name}. `
                          : ""}
                        {o.proof.note ?? ""}{" "}
                        {o.proof.has_photo ? "Photo on record." : ""}{" "}
                        {o.proof.has_signature ? "Signed." : ""}
                      </p>
                    </div>
                  </div>
                ) : o.stop ? (
                  <div className="inline-callout">
                    <Truck size={20} />
                    <div>
                      <b>
                        {o.stop.trip_status === "in_transit"
                          ? o.stop.stops_before
                            ? `On the road · ${o.stop.stops_before} stop${o.stop.stops_before === 1 ? "" : "s"} before yours`
                            : "On the road · you are the next stop"
                          : `Scheduled on ${o.stop.vehicle_id} · stop ${o.stop.seq}`}
                      </b>
                      <p>
                        Driver {o.stop.driver_name}. Have your receiving team
                        ready from {hhmm(o.stop.arrival_min)}; your window
                        closes {hhmm(o.stop.window_close_min)}.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="inline-callout">
                    <Clock3 size={20} />
                    <div>
                      <b>In the queue for {longDate(o.run_date)}</b>
                      <p>
                        The dispatcher assigns a vehicle after orders close.
                        Placed {colomboTime(o.placed_at)}.
                      </p>
                    </div>
                  </div>
                )}
                {["delivered", "failed", "disputed"].includes(o.status) && (
                  <button
                    className="btn primary full"
                    onClick={() => setReceipt(o)}
                  >
                    <CheckCheck size={17} />{" "}
                    {o.status === "disputed"
                      ? "Update receipt"
                      : "Confirm what arrived"}
                  </button>
                )}
                <button
                  className="btn secondary full"
                  onClick={() => setIssue(o)}
                >
                  Report an issue <ArrowRight size={15} />
                </button>
              </article>
            ))}
          </div>
          {history.length > 0 && (
            <details className="history">
              <summary>Received orders ({history.length})</summary>
              {history.map((o) => (
                <p key={o.order_id}>
                  {o.order_id} · {o.receipt?.units_received}/{o.units} units ·
                  confirmed{" "}
                  {o.receipt ? colomboTime(o.receipt.confirmed_at) : ""}
                </p>
              ))}
            </details>
          )}
        </section>
        <aside className="panel context-panel">
          <span className="eyebrow">
            {outlet.brand.toUpperCase()} · ORDERING
          </span>
          <h2>
            What’s next
            <br />
            for your store?
          </h2>
          <div className="order-cutoff">
            <Clock3 size={25} />
            <span>
              {clock.ordering_run_date ? (
                <>
                  Next order goes on the {shortDate(clock.ordering_run_date)}{" "}
                  run
                  <b>
                    {clock.ordering_cutoff
                      ? colomboTime(clock.ordering_cutoff)
                      : "16:00"}
                  </b>
                  <small>
                    Order cutoff
                    {clock.ordering_cutoff
                      ? ` · ${shortDate(clock.ordering_cutoff.slice(0, 10))}`
                      : ""}{" "}
                    · now {colomboTime(clock.now)}
                  </small>
                </>
              ) : (
                <>
                  No run open<b>—</b>
                </>
              )}
            </span>
          </div>
          <p className="muted">
            Receiving window{" "}
            {outlet.mall_window
              ? `${outlet.mall_window} (mall)`
              : `${outlet.window_open_time}–${outlet.window_close_time}`}{" "}
            · {DOCK[outlet.dock_type]} · {ACCESS[outlet.parking_constraint]}.
            {outlet.brand === "Fresh"
              ? " Place chilled and dry goods as separate orders."
              : ""}
          </p>
          <button
            className="btn primary full"
            onClick={() => setOrdering(true)}
            disabled={!clock.ordering_run_date}
          >
            <Plus size={16} /> Place a new order
          </button>
        </aside>
      </div>
      {ordering && (
        <OrderDialog
          brand={outlet.brand}
          runDate={clock.ordering_run_date}
          onClose={() => setOrdering(false)}
          onDone={async (r) => {
            setOrdering(false);
            setPlaced(r);
            await reload();
          }}
        />
      )}
      {receipt && (
        <ReceiptDialog
          order={receipt}
          onClose={() => setReceipt(null)}
          onDone={async () => {
            setReceipt(null);
            await reload();
          }}
        />
      )}
      {issue && (
        <StoreIssueDialog
          order={issue}
          onClose={() => setIssue(null)}
          onDone={async () => {
            setIssue(null);
            await reload();
          }}
        />
      )}
      <span className="sr-only">{me.user.display_name}</span>
    </div>
  );
}

function OrderDialog({
  brand,
  runDate,
  onClose,
  onDone,
}: {
  brand: "Fresh" | "Style" | "Tech";
  runDate: string | null;
  onClose: () => void;
  onDone: (r: {
    order_id: string;
    run_date: string;
    cutoff_at: string;
  }) => Promise<void>;
}) {
  const toast = useToast();
  const [temp, setTemp] = useState<"chilled" | "ambient">(
    brand === "Fresh" ? "chilled" : "ambient",
  );
  const [units, setUnits] = useState(brand === "Tech" ? 4 : 40);
  const [weight, setWeight] = useState(
    brand === "Tech" ? 300 : brand === "Style" ? 350 : 600,
  );
  const [volume, setVolume] = useState(
    brand === "Style" ? 10 : brand === "Tech" ? 2 : 2.5,
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [ref] = useState(() =>
    typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()),
  );
  return (
    <Dialog title="Let’s stock the next run." onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await api<{
              order_id: string;
              run_date: string;
              cutoff_at: string;
            }>("/api/orders", {
              json: {
                temp_requirement: temp,
                units,
                weight_kg: weight,
                volume_m3: volume,
                notes,
                client_ref: ref,
              },
            });
            toast(`Order ${r.order_id} confirmed for ${shortDate(r.run_date)}`);
            await onDone(r);
          } catch (err) {
            toast(
              err instanceof ApiError
                ? err.message
                : "Could not place the order",
              "error",
            );
            setBusy(false);
          }
        }}
      >
        <p className="modal-intro">
          This order joins the <b>{runDate ? longDate(runDate) : "next"}</b>{" "}
          run. You get an order number straight away; the vehicle and arrival
          time follow when the plan is published.
        </p>
        {brand === "Fresh" && (
          <div className="segmented" role="radiogroup" aria-label="Goods type">
            <button
              type="button"
              role="radio"
              aria-checked={temp === "chilled"}
              className={temp === "chilled" ? "active" : ""}
              onClick={() => setTemp("chilled")}
            >
              <Snowflake size={14} /> Chilled & frozen
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={temp === "ambient"}
              className={temp === "ambient" ? "active" : ""}
              onClick={() => setTemp("ambient")}
            >
              <Package size={14} /> Dry groceries
            </button>
          </div>
        )}
        <div className="field-row">
          <NumberField
            label={
              brand === "Tech"
                ? "Items"
                : brand === "Style"
                  ? "Cartons / rails"
                  : "Cases"
            }
            value={units}
            onChange={setUnits}
            min={1}
            max={5000}
            required
          />
          <NumberField
            label="Weight"
            suffix="kg"
            value={weight}
            onChange={setWeight}
            min={1}
            max={8000}
            step={50}
            required
          />
          <NumberField
            label="Volume"
            suffix="m³"
            value={volume}
            onChange={setVolume}
            min={0.1}
            max={45}
            step={0.5}
            decimals={1}
            required
          />
        </div>
        <label className="field">
          Note for the dispatcher (optional)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              brand === "Tech"
                ? "e.g. one 65-inch TV, handle upright"
                : "e.g. extra milk ahead of the festival"
            }
          />
        </label>
        <button className="btn primary full" disabled={busy}>
          <Plus size={16} /> {busy ? "Sending…" : "Place order"}
        </button>
      </form>
    </Dialog>
  );
}

function ReceiptDialog({
  order,
  onClose,
  onDone,
}: {
  order: StoreOrder;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [units, setUnits] = useState(
    order.proof?.units_delivered ?? order.units,
  );
  const [condition, setCondition] = useState<"complete" | "short" | "damaged">(
    units < order.units ? "short" : "complete",
  );
  const [note, setNote] = useState("");
  return (
    <Dialog title="Close the loop." onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api(`/api/store/orders/${order.order_id}/receipt`, {
              json: { units_received: units, condition, note },
            });
            toast(
              condition === "complete"
                ? "Receipt confirmed. Thank you."
                : "Receipt recorded and the problem sent to the dispatcher.",
            );
            await onDone();
          } catch (err) {
            toast(
              err instanceof ApiError ? err.message : "Could not confirm",
              "error",
            );
          }
        }}
      >
        <p className="modal-intro">
          The driver recorded {order.proof?.units_delivered ?? 0} of{" "}
          {order.units} units. Confirm what your team actually received.
        </p>
        <NumberField
          label="Units received"
          value={units}
          onChange={setUnits}
          min={0}
          max={order.units * 2}
        />
        <Select
          label="Condition"
          value={condition}
          onChange={setCondition}
          options={[
            { value: "complete", label: "Complete and in good condition" },
            {
              value: "short",
              label: "Short delivery",
              hint: "Opens an issue for the dispatcher",
            },
            {
              value: "damaged",
              label: "Damaged goods",
              hint: "Opens an issue for the dispatcher",
            },
          ]}
        />
        <label className="field">
          Note
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required={condition !== "complete"}
          />
        </label>
        <button className="btn primary full">
          <CheckCheck size={16} /> Confirm receipt
        </button>
      </form>
    </Dialog>
  );
}

function StoreIssueDialog({
  order,
  onClose,
  onDone,
}: {
  order: StoreOrder;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [category, setCategory] = useState("Delivery delay");
  const [description, setDescription] = useState("");
  return (
    <Dialog title="Tell us what needs attention." onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api(`/api/store/orders/${order.order_id}/issue`, {
              json: { category, description },
            });
            toast("Sent to the dispatcher's inbox.");
            await onDone();
          } catch (err) {
            toast(
              err instanceof ApiError ? err.message : "Could not send",
              "error",
            );
          }
        }}
      >
        <Select
          label="Issue type"
          value={category}
          onChange={setCategory}
          options={[
            "Delivery delay",
            "Quantity discrepancy",
            "Damaged goods",
            "Wrong items",
            "Receiving staff unavailable",
          ]}
        />
        <label className="field">
          What happened?
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <button className="btn primary full">Send to dispatcher</button>
      </form>
    </Dialog>
  );
}
