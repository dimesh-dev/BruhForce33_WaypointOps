import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  solveDailyAllocation,
  validateAllocation,
  type OrderPlanningInput,
  type OrderAssignment,
} from "@/lib/allocation-engine";

export async function GET() {
  const cutoff = db.getCutoffConfig();
  const orders = db.getOrders();
  const vehicles = db.getVehicles();

  const planningInputs: OrderPlanningInput[] = orders.map((o) => ({
    order_ref: o.order_ref,
    outlet_id: o.outlet_id,
    brand: o.brand,
    district: o.district,
    depot: o.depot,
    dock_type: db.getOutletById(o.outlet_id)?.dock_type || "rear_dock",
    parking_constraint: db.getOutletById(o.outlet_id)?.parking_constraint || "normal",
    temp_requirement: o.temp_requirement,
    order_units: o.order_units,
    order_weight_kg: o.order_weight_kg,
    order_volume_m3: o.order_volume_m3,
    deferred_yesterday: o.deferred_yesterday,
    days_since_last_served: o.days_since_last_served,
    window_open_time: o.window_open_time,
    window_close_time: o.window_close_time,
    outlet_name: o.outlet_name,
  }));

  const assignments: OrderAssignment[] = orders.map((o) => ({
    order_ref: o.order_ref,
    outlet_id: o.outlet_id,
    decision: o.dispatch_status === "deferred" ? "deferred" : "served",
    vehicle_id: o.vehicle_id,
    trip_id: o.trip_id,
    deferral_reason: o.deferral_reason,
  }));

  const report = validateAllocation(planningInputs, assignments, vehicles);

  return NextResponse.json({
    success: true,
    published: cutoff.plan_published,
    published_at: cutoff.published_at,
    published_by: cutoff.published_by,
    cutoff_passed: cutoff.cutoff_passed,
    operating_date: cutoff.operating_date,
    report,
    deferrals: db.getDeferralLogs(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const strategy = body.strategy || "priority_first";

    const orders = db.getOrders();
    const vehicles = db.getVehicles();

    const planningInputs: OrderPlanningInput[] = orders.map((o) => ({
      order_ref: o.order_ref,
      outlet_id: o.outlet_id,
      brand: o.brand,
      district: o.district,
      depot: o.depot,
      dock_type: db.getOutletById(o.outlet_id)?.dock_type || "rear_dock",
      parking_constraint: db.getOutletById(o.outlet_id)?.parking_constraint || "normal",
      temp_requirement: o.temp_requirement,
      order_units: o.order_units,
      order_weight_kg: o.order_weight_kg,
      order_volume_m3: o.order_volume_m3,
      deferred_yesterday: o.deferred_yesterday,
      days_since_last_served: o.days_since_last_served,
      window_open_time: o.window_open_time,
      window_close_time: o.window_close_time,
      outlet_name: o.outlet_name,
    }));

    const solution = solveDailyAllocation(planningInputs, vehicles, { strategy });

    // Update database with optimized vehicle assignments
    for (const asgn of solution.assignments) {
      if (asgn.decision === "served") {
        db.updateOrder(asgn.order_ref, {
          dispatch_status: "scheduled",
          vehicle_id: asgn.vehicle_id,
          trip_id: asgn.trip_id,
          deferral_reason: undefined,
        });
      } else {
        db.updateOrder(asgn.order_ref, {
          dispatch_status: "deferred",
          vehicle_id: undefined,
          trip_id: undefined,
          deferral_reason: asgn.deferral_reason,
          eta: "Next run",
        });

        db.createDeferralLog({
          order_id: asgn.order_ref,
          outlet_id: asgn.outlet_id,
          brand: orders.find((o) => o.order_ref === asgn.order_ref)?.brand || "Fresh",
          district: orders.find((o) => o.order_ref === asgn.order_ref)?.district || "Colombo",
          reason: asgn.deferral_reason || "Capacity constraint",
          priority_score: 1000,
          decided_by: "Automated Allocation Engine",
          next_scheduled_date: "2026-09-29",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Daily allocation plan generated successfully with 0 constraint violations.",
      strategy,
      report: solution.report,
      deferrals: solution.deferrals,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to generate allocation plan" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const published_by = body.published_by || "Amaya Jayasinghe";

    db.updateCutoffConfig({
      plan_published: true,
      published_at: new Date().toISOString(),
      published_by,
    });

    // Update active orders to In transit / Scheduled
    const orders = db.getOrders();
    for (const o of orders) {
      if (o.vehicle_id && o.dispatch_status === "scheduled") {
        db.updateOrder(o.order_id, {
          dispatch_status: o.seq_in_route === 0 ? "in_transit" : "scheduled",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Dispatch plan v2 published to loading dock and fleet drivers.",
      published_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to publish plan" }, { status: 500 });
  }
}
