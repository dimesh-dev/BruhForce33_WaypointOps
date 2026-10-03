/**
 * Waypoint Degradation & Failure Scenario Engine
 * Handles Mall Window Timeouts, Loading Shortfalls, and Fleet Breakdown Re-Allocation
 */

import {
  type VehicleRecord,
  type OutletRecord,
  FLEET_VEHICLES,
  OUTLETS_MAP,
} from "./dataset-reference";
import {
  type OrderPlanningInput,
  type OrderAssignment,
  validateAllocation,
  calculateTripDuration,
} from "./allocation-engine";

export interface DegradationScenario {
  id: "mall_timeout" | "loading_shortfall" | "vehicle_breakdown";
  title: string;
  severity: "critical" | "warning" | "info";
  description: string;
  impacted_entities: string[];
  remediation_options: {
    key: string;
    label: string;
    description: string;
    action: string;
  }[];
}

export interface ReallocationPlan {
  original_vehicle_id: string;
  replacement_vehicle_id: string;
  transferred_orders_count: number;
  transferred_weight_kg: number;
  transferred_volume_m3: number;
  is_valid: boolean;
  violations: string[];
}

/**
 * 1. Mall Window Timeout Analyzer
 */
export function analyzeMallWindowDegradation(
  order: {
    order_ref: string;
    outlet_id: string;
    eta?: string;
    window_close_time?: string;
    window_open_time?: string;
  }
): {
  is_at_risk: boolean;
  minutes_delayed: number;
  reason: string;
  recommended_action: "defer" | "request_window_review" | "proceed";
} {
  const etaMinutes = parseTimeToMinutes(order.eta || "10:42");
  const closeMinutes = parseTimeToMinutes(order.window_close_time || "10:30");

  const is_at_risk = etaMinutes > closeMinutes;
  const minutes_delayed = Math.max(0, etaMinutes - closeMinutes);

  return {
    is_at_risk,
    minutes_delayed,
    reason: is_at_risk
      ? `Mall delivery window closes at ${order.window_close_time || "10:30"}; projected arrival is ${order.eta || "10:42"} (+${minutes_delayed} min late).`
      : "Within scheduled access window.",
    recommended_action: is_at_risk ? "defer" : "proceed",
  };
}

/**
 * 2. Loading Shortfall Re-Routing Engine
 */
export function resolveLoadingShortfall(
  order: {
    order_ref: string;
    expected_units: number;
    available_units: number;
    shortfall_type: "missing" | "damaged" | "temperature_fault";
  }
): {
  decision: "dispatch_partial" | "defer_order" | "substitute_from_buffer";
  audit_note: string;
  dispatched_units: number;
} {
  const missing = order.expected_units - order.available_units;

  if (order.shortfall_type === "temperature_fault") {
    return {
      decision: "defer_order",
      audit_note: `Cold-chain integrity compromised on dock. Total ${order.expected_units} crates quarantined; order deferred to next run.`,
      dispatched_units: 0,
    };
  }

  if (missing > 0 && order.available_units > 0) {
    return {
      decision: "dispatch_partial",
      audit_note: `Loading shortfall recorded: Dispatched ${order.available_units}/${order.expected_units} units (${missing} ${order.shortfall_type}). Dispatcher notified.`,
      dispatched_units: order.available_units,
    };
  }

  return {
    decision: "substitute_from_buffer",
    audit_note: `Shortfall of ${missing} units resolved using Peliyagoda reserve buffer stock before departure.`,
    dispatched_units: order.expected_units,
  };
}

/**
 * 3. Vehicle Breakdown Dynamic Re-Allocation Engine
 * Transfers active orders from a broken vehicle to compatible spare vehicles
 */
export function reallocateBrokenVehicleOrders(
  brokenVehicleId: string,
  ordersToReallocate: OrderPlanningInput[],
  fleet: VehicleRecord[] = FLEET_VEHICLES
): {
  success: boolean;
  assigned_vehicle_id?: string;
  assigned_trip_id?: 1 | 2;
  message: string;
  assignments: OrderAssignment[];
} {
  const brokenVehicle = fleet.find((v) => v.vehicle_id === brokenVehicleId);
  const depot = brokenVehicle ? brokenVehicle.depot : "Peliyagoda";

  // Filter for available spare vehicles in same depot that are NOT the broken vehicle
  const candidateVehicles = fleet.filter(
    (v) => v.status === "available" && v.depot === depot && v.vehicle_id !== brokenVehicleId
  );

  const needsReefer = ordersToReallocate.some((o) => o.temp_requirement === "chilled");
  const needsVan = ordersToReallocate.some((o) => o.parking_constraint === "van_only");
  const totalWeight = ordersToReallocate.reduce((sum, o) => sum + o.order_weight_kg, 0);
  const totalVolume = ordersToReallocate.reduce((sum, o) => sum + o.order_volume_m3, 0);

  // Find compatible spare vehicle
  const compatibleVehicle = candidateVehicles.find((v) => {
    if (needsReefer && v.temp !== "reefer") return false;
    if (needsVan && v.type !== "van") return false;
    if (v.weight_cap_kg < totalWeight) return false;
    if (v.volume_cap_m3 < totalVolume) return false;
    return true;
  });

  if (!compatibleVehicle) {
    // If no single vehicle has capacity, defer with clear breakdown reason
    return {
      success: false,
      message: `No single spare vehicle at ${depot} depot has compatible capacity (${totalWeight}kg, ${totalVolume}m³). Orders deferred to recovery run.`,
      assignments: ordersToReallocate.map((o) => ({
        order_ref: o.order_ref,
        outlet_id: o.outlet_id,
        decision: "deferred",
        deferral_reason: `Vehicle ${brokenVehicleId} workshop outage; emergency fleet reallocation capacity exhausted.`,
      })),
    };
  }

  const assignments: OrderAssignment[] = ordersToReallocate.map((o) => ({
    order_ref: o.order_ref,
    outlet_id: o.outlet_id,
    decision: "served",
    vehicle_id: compatibleVehicle.vehicle_id,
    trip_id: 2, // Re-assigned as emergency Trip 2
  }));

  return {
    success: true,
    assigned_vehicle_id: compatibleVehicle.vehicle_id,
    assigned_trip_id: 2,
    message: `Successfully reallocated ${ordersToReallocate.length} orders from broken vehicle ${brokenVehicleId} to spare vehicle ${compatibleVehicle.vehicle_id} (Trip 2).`,
    assignments,
  };
}

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}
