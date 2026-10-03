import { test, expect } from "@playwright/test";
import {
  analyzeMallWindowDegradation,
  resolveLoadingShortfall,
  reallocateBrokenVehicleOrders,
} from "../src/lib/degradation-scenarios";
import { FLEET_VEHICLES } from "../src/lib/dataset-reference";
import type { OrderPlanningInput } from "../src/lib/allocation-engine";

test.describe("Offline Operation & Degradation Recovery", () => {
  test("Mall Window Degradation: Detects access window violation and recommends deferral", () => {
    const atRiskOrder = {
      order_ref: "WP-2043",
      outlet_id: "OUT081",
      eta: "10:42",
      window_open_time: "09:00",
      window_close_time: "10:30",
    };

    const analysis = analyzeMallWindowDegradation(atRiskOrder);
    expect(analysis.is_at_risk).toBe(true);
    expect(analysis.minutes_delayed).toBe(12);
    expect(analysis.recommended_action).toBe("defer");
    expect(analysis.reason).toContain("Mall delivery window closes at 10:30");
  });

  test("Loading Shortfall Degradation: Logs partial dispatch with shortfall notes", () => {
    const shortfallOrder = {
      order_ref: "WP-2041",
      expected_units: 30,
      available_units: 24,
      shortfall_type: "damaged" as const,
    };

    const resolution = resolveLoadingShortfall(shortfallOrder);
    expect(resolution.decision).toBe("dispatch_partial");
    expect(resolution.dispatched_units).toBe(24);
    expect(resolution.audit_note).toContain("Dispatched 24/30 units (6 damaged)");
  });

  test("Loading Shortfall Degradation: Quarantines temperature-compromised cargo", () => {
    const tempFaultOrder = {
      order_ref: "WP-2041",
      expected_units: 24,
      available_units: 24,
      shortfall_type: "temperature_fault" as const,
    };

    const resolution = resolveLoadingShortfall(tempFaultOrder);
    expect(resolution.decision).toBe("defer_order");
    expect(resolution.dispatched_units).toBe(0);
    expect(resolution.audit_note).toContain("Cold-chain integrity compromised");
  });

  test("Vehicle Breakdown Degradation: Dynamically reallocates orders to compatible spare vehicle", () => {
    // Broken reefer truck with 2 chilled orders
    const orders: OrderPlanningInput[] = [
      {
        order_ref: "BD-001",
        outlet_id: "OUT001",
        brand: "Fresh",
        district: "Colombo",
        depot: "Peliyagoda",
        dock_type: "rear_dock",
        parking_constraint: "normal",
        temp_requirement: "chilled",
        order_units: 30,
        order_weight_kg: 600,
        order_volume_m3: 4.0,
      },
      {
        order_ref: "BD-002",
        outlet_id: "OUT002",
        brand: "Fresh",
        district: "Colombo",
        depot: "Peliyagoda",
        dock_type: "street",
        parking_constraint: "normal",
        temp_requirement: "chilled",
        order_units: 20,
        order_weight_kg: 400,
        order_volume_m3: 3.0,
      },
    ];

    const result = reallocateBrokenVehicleOrders("VEH001", orders, FLEET_VEHICLES);
    expect(result.success).toBe(true);
    expect(result.assigned_vehicle_id).toBeDefined();

    // Check that assigned vehicle is not the broken vehicle and is a reefer
    const assignedVehicle = FLEET_VEHICLES.find((v) => v.vehicle_id === result.assigned_vehicle_id);
    expect(assignedVehicle?.vehicle_id).not.toBe("VEH001");
    expect(assignedVehicle?.temp).toBe("reefer");
    expect(assignedVehicle?.depot).toBe("Peliyagoda");
  });

  test("Reconciliation Engine API: Processes offline batch queues and updates server state", async ({ request }) => {
    const syncRes = await request.post("/api/driver/sync", {
      data: {
        queue: [
          {
            order_id: "ORD0092301",
            driver_id: "USR-003",
            driver_name: "Kasun Perera",
            recipient_name: "Anjali Fernando",
            items_received: 42,
            proof_notes: "Reconciled proof from offline storage in Colombo 03.",
          },
        ],
      },
    });

    expect(syncRes.ok()).toBe(true);
    const syncData = await syncRes.json();
    expect(syncData.success).toBe(true);
    expect(syncData.synced_count).toBe(1);

    // Verify order is now marked as delivered on server
    const orderRes = await request.get("/api/orders/ORD0092301");
    expect(orderRes.ok()).toBe(true);
    const orderData = await orderRes.json();
    expect(orderData.order.dispatch_status).toBe("delivered");
    expect(orderData.order.receipt_confirmed).toBe(true);
  });
});
