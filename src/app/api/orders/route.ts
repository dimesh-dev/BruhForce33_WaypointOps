import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const brand = searchParams.get("brand") || undefined;
  const status = searchParams.get("status") || undefined;
  const district = searchParams.get("district") || undefined;
  const depot = searchParams.get("depot") || undefined;
  const search = searchParams.get("search") || searchParams.get("q") || undefined;
  const outlet_id = searchParams.get("outlet_id") || undefined;
  const vehicle_id = searchParams.get("vehicle_id") || undefined;

  const orders = db.getOrders({
    brand,
    status,
    district,
    depot,
    search,
    outlet_id,
    vehicle_id,
  });

  return NextResponse.json({
    success: true,
    count: orders.length,
    orders,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cutoffConfig = db.getCutoffConfig();

    // Check 4 PM cutoff rule
    // If order submitted after 4 PM cutoff (or simulated cutoff), mark as after_cutoff
    const isPastCutoff = body.force_after_cutoff !== undefined
      ? body.force_after_cutoff
      : cutoffConfig.cutoff_passed;

    const outlet = db.getOutletById(body.outlet_id);
    const outlet_name = outlet ? outlet.name : body.outlet_name || "Waypoint Outlet";
    const district = outlet ? outlet.district : body.district || "Colombo";
    const depot = outlet ? outlet.depot : body.depot || "Peliyagoda";
    const window_open_time = outlet ? outlet.window_open_time : "06:00";
    const window_close_time = outlet ? outlet.window_close_time : "08:00";

    const weight = Number(body.order_weight_kg || body.amount?.replace(/[^0-9.]/g, "") || 400);
    const volume = Number(body.order_volume_m3 || body.volume?.replace(/[^0-9.]/g, "") || 3.0);
    const units = Number(body.order_units || Math.round(weight / 15));

    const newOrder = db.createOrder({
      order_ref: body.order_ref || `WP-${2040 + db.getOrders().length + 1}`,
      order_date: cutoffConfig.operating_date,
      dispatch_date: isPastCutoff ? undefined : cutoffConfig.operating_date,
      brand: body.brand || (outlet ? outlet.brand : "Fresh"),
      outlet_id: body.outlet_id || "OUT001",
      outlet_name,
      district,
      depot,
      temp_requirement: body.temp_requirement || (body.temp?.toLowerCase().includes("chill") ? "chilled" : "ambient"),
      order_units: units,
      order_weight_kg: weight,
      order_volume_m3: volume,
      cutoff_status: isPastCutoff ? "after_cutoff" : "on_time",
      dispatch_status: isPastCutoff ? "deferred" : "scheduled",
      vehicle_id: isPastCutoff ? undefined : body.vehicle_id,
      trip_id: isPastCutoff ? undefined : body.trip_id,
      seq_in_route: isPastCutoff ? undefined : body.seq_in_route,
      planned_departure_time: isPastCutoff ? undefined : "05:30",
      planned_arrival_time: isPastCutoff ? undefined : "06:30",
      window_open_time,
      window_close_time,
      eta: isPastCutoff ? "Following run (After 4 PM cutoff)" : body.eta || "06:45",
      deferred_yesterday: body.deferred_yesterday || 0,
      days_since_last_served: body.days_since_last_served || 1,
      deferral_reason: isPastCutoff
        ? "Received after 4:00 PM cutoff; queued for following operating run."
        : body.deferral_reason,
      receipt_confirmed: false,
    });

    return NextResponse.json({
      success: true,
      message: isPastCutoff
        ? "Order received after 4 PM cutoff and queued for following run."
        : "Order captured and confirmed for next dispatch run.",
      order: newOrder,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to create order" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { order_id, ...updates } = body;

    if (!order_id) {
      return NextResponse.json({ success: false, error: "Missing order_id" }, { status: 400 });
    }

    const updated = db.updateOrder(order_id, updates);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      order: updated,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to update order" }, { status: 500 });
  }
}
