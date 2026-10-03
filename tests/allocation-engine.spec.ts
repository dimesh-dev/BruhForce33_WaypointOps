import { test, expect } from "@playwright/test";
import {
  calculateTripDuration,
  validateAllocation,
  solveDailyAllocation,
  calculateOrderPriority,
  type OrderPlanningInput,
  type OrderAssignment,
} from "../src/lib/allocation-engine";
import {
  FLEET_VEHICLES,
  DISTRICT_TRAVEL,
  SERVICE_ALLOWANCES,
} from "../src/lib/dataset-reference";

test.describe("Planning & Allocation Engine Feasibility Constraints", () => {
  // Base test order
  const baseOrder: OrderPlanningInput = {
    order_ref: "ORD-001",
    outlet_id: "OUT001",
    brand: "Fresh",
    district: "Colombo",
    depot: "Peliyagoda",
    dock_type: "rear_dock",
    parking_constraint: "normal",
    temp_requirement: "chilled",
    order_units: 30,
    order_weight_kg: 500,
    order_volume_m3: 3.5,
  };

  test("Rule 1: Brand & District Homogeneity - rejects mixed brands or districts in one trip", () => {
    const orders: OrderPlanningInput[] = [
      { ...baseOrder, order_ref: "ORD-001", brand: "Fresh", district: "Colombo" },
      { ...baseOrder, order_ref: "ORD-002", brand: "Style", district: "Colombo" }, // Different brand
    ];

    const assignments: OrderAssignment[] = [
      { order_ref: "ORD-001", outlet_id: "OUT001", decision: "served", vehicle_id: "VEH001", trip_id: 1 },
      { order_ref: "ORD-002", outlet_id: "OUT001", decision: "served", vehicle_id: "VEH001", trip_id: 1 },
    ];

    const report = validateAllocation(orders, assignments);
    expect(report.is_valid).toBe(false);
    expect(report.violations.some((v) => v.rule_number === 1 && v.rule_name === "Brand and district")).toBe(true);
  });

  test("Rule 1: Brand & District Homogeneity - rejects mixed districts in one trip", () => {
    const orders: OrderPlanningInput[] = [
      { ...baseOrder, order_ref: "ORD-001", brand: "Fresh", district: "Colombo" },
      { ...baseOrder, order_ref: "ORD-002", brand: "Fresh", district: "Gampaha" }, // Different district
    ];

    const assignments: OrderAssignment[] = [
      { order_ref: "ORD-001", outlet_id: "OUT001", decision: "served", vehicle_id: "VEH001", trip_id: 1 },
      { order_ref: "ORD-002", outlet_id: "OUT001", decision: "served", vehicle_id: "VEH001", trip_id: 1 },
    ];

    const report = validateAllocation(orders, assignments);
    expect(report.is_valid).toBe(false);
    expect(report.violations.some((v) => v.rule_number === 1)).toBe(true);
  });

  test("Rule 2: Refrigeration - chilled orders require reefer vehicles", () => {
    // VEH013 is an ambient dry-box truck
    const chilledOrder: OrderPlanningInput = {
      ...baseOrder,
      order_ref: "ORD-CHILLED",
      temp_requirement: "chilled",
    };

    const invalidAssignment: OrderAssignment[] = [
      { order_ref: "ORD-CHILLED", outlet_id: "OUT001", decision: "served", vehicle_id: "VEH013", trip_id: 1 },
    ];

    const reportInvalid = validateAllocation([chilledOrder], invalidAssignment);
    expect(reportInvalid.is_valid).toBe(false);
    expect(reportInvalid.violations.some((v) => v.rule_number === 2 && v.rule_name === "Refrigeration")).toBe(true);

    // VEH001 is a refrigerated truck
    const validAssignment: OrderAssignment[] = [
      { order_ref: "ORD-CHILLED", outlet_id: "OUT001", decision: "served", vehicle_id: "VEH001", trip_id: 1 },
    ];

    const reportValid = validateAllocation([chilledOrder], validAssignment);
    expect(reportValid.is_valid).toBe(true);
  });

  test("Rule 3: Vehicle Access - van_only outlets require type = van", () => {
    // VEH001 is a truck, VEH053 is a reefer van
    const vanOnlyOrder: OrderPlanningInput = {
      ...baseOrder,
      order_ref: "ORD-VAN-ONLY",
      parking_constraint: "van_only",
      temp_requirement: "chilled",
    };

    const invalidAssignment: OrderAssignment[] = [
      { order_ref: "ORD-VAN-ONLY", outlet_id: "OUT001", decision: "served", vehicle_id: "VEH001", trip_id: 1 },
    ];

    const reportInvalid = validateAllocation([vanOnlyOrder], invalidAssignment);
    expect(reportInvalid.is_valid).toBe(false);
    expect(reportInvalid.violations.some((v) => v.rule_number === 3 && v.rule_name === "Vehicle access")).toBe(true);

    const validAssignment: OrderAssignment[] = [
      { order_ref: "ORD-VAN-ONLY", outlet_id: "OUT001", decision: "served", vehicle_id: "VEH053", trip_id: 1 },
    ];

    const reportValid = validateAllocation([vanOnlyOrder], validAssignment);
    expect(reportValid.is_valid).toBe(true);
  });

  test("Rule 4: Home Depot - vehicles may only serve outlets in their assigned home depot", () => {
    // VEH001 is Peliyagoda depot, VEH011 is Kandy depot
    const kandyOrder: OrderPlanningInput = {
      ...baseOrder,
      order_ref: "ORD-KANDY",
      depot: "Kandy",
      district: "Kandy",
    };

    const invalidAssignment: OrderAssignment[] = [
      { order_ref: "ORD-KANDY", outlet_id: "OUT001", decision: "served", vehicle_id: "VEH001", trip_id: 1 },
    ];

    const reportInvalid = validateAllocation([kandyOrder], invalidAssignment);
    expect(reportInvalid.is_valid).toBe(false);
    expect(reportInvalid.violations.some((v) => v.rule_number === 4 && v.rule_name === "Home depot")).toBe(true);

    const validAssignment: OrderAssignment[] = [
      { order_ref: "ORD-KANDY", outlet_id: "OUT001", decision: "served", vehicle_id: "VEH011", trip_id: 1 },
    ];

    const reportValid = validateAllocation([kandyOrder], validAssignment);
    expect(reportValid.is_valid).toBe(true);
  });

  test("Rule 5: Whole Orders - orders cannot be split across multiple trips or vehicles", () => {
    const order: OrderPlanningInput = { ...baseOrder, order_ref: "ORD-SPLIT" };

    const splitAssignment: OrderAssignment[] = [
      { order_ref: "ORD-SPLIT", outlet_id: "OUT001", decision: "served", vehicle_id: "VEH001", trip_id: 1 },
      { order_ref: "ORD-SPLIT", outlet_id: "OUT001", decision: "served", vehicle_id: "VEH002", trip_id: 1 },
    ];

    const report = validateAllocation([order], splitAssignment);
    expect(report.is_valid).toBe(false);
    expect(report.violations.some((v) => v.rule_number === 5 && v.rule_name === "Whole orders")).toBe(true);
  });

  test("Rule 6: Capacity Limits - trip weight and volume must not exceed vehicle caps", () => {
    // VEH053 has weight_cap_kg: 1500, volume_cap_m3: 10
    const overweightOrder: OrderPlanningInput = {
      ...baseOrder,
      order_ref: "ORD-HEAVY",
      order_weight_kg: 2000, // Exceeds 1500 kg
      order_volume_m3: 4.0,
    };

    const reportOverweight = validateAllocation(
      [overweightOrder],
      [{ order_ref: "ORD-HEAVY", outlet_id: "OUT001", decision: "served", vehicle_id: "VEH053", trip_id: 1 }]
    );
    expect(reportOverweight.is_valid).toBe(false);
    expect(reportOverweight.violations.some((v) => v.rule_number === 6 && v.rule_name === "Capacity")).toBe(true);

    const overvolumeOrder: OrderPlanningInput = {
      ...baseOrder,
      order_ref: "ORD-BULKY",
      order_weight_kg: 500,
      order_volume_m3: 14.0, // Exceeds 10 m³
    };

    const reportOvervolume = validateAllocation(
      [overvolumeOrder],
      [{ order_ref: "ORD-BULKY", outlet_id: "OUT001", decision: "served", vehicle_id: "VEH053", trip_id: 1 }]
    );
    expect(reportOvervolume.is_valid).toBe(false);
    expect(reportOvervolume.violations.some((v) => v.rule_number === 6)).toBe(true);
  });

  test("Rule 7: Trips and Time Budgets - calculation and strict limits (270 min Fresh / 480 min Style)", () => {
    // Verify trip duration formula: outbound + inter_stop*(n-1) + sum(handling)
    // Gampaha: outbound = 37 min, inter_stop = 9 min. Fresh rear_dock = 15, street = 16.
    // 3 stops (2 rear_dock + 1 street): 37 + (9 * 2) + 15 + 15 + 16 = 101 minutes (Matches booklet page 21 example!)
    const calculated = calculateTripDuration("Peliyagoda", "Gampaha", "Fresh", [
      { dock_type: "rear_dock" },
      { dock_type: "rear_dock" },
      { dock_type: "street" },
    ]);

    expect(calculated.outbound_travel_min).toBe(37);
    expect(calculated.inter_stop_travel_min).toBe(18);
    expect(calculated.handling_time_min).toBe(46);
    expect(calculated.total_trip_min).toBe(101);

    // Test max 2 trips per vehicle rule
    const orders: OrderPlanningInput[] = [
      { ...baseOrder, order_ref: "ORD-T1", brand: "Fresh", district: "Colombo" },
      { ...baseOrder, order_ref: "ORD-T2", brand: "Fresh", district: "Colombo" },
      { ...baseOrder, order_ref: "ORD-T3", brand: "Fresh", district: "Colombo" },
    ];

    const threeTripsAssignment: OrderAssignment[] = [
      { order_ref: "ORD-T1", outlet_id: "OUT001", decision: "served", vehicle_id: "VEH001", trip_id: 1 },
      { order_ref: "ORD-T2", outlet_id: "OUT001", decision: "served", vehicle_id: "VEH001", trip_id: 2 },
      { order_ref: "ORD-T3", outlet_id: "OUT001", decision: "served", vehicle_id: "VEH001", trip_id: 3 as any }, // 3rd trip invalid
    ];

    const report = validateAllocation(orders, threeTripsAssignment);
    expect(report.is_valid).toBe(false);
    expect(report.violations.some((v) => v.rule_number === 7 && v.rule_name === "Trips and time")).toBe(true);
  });

  test("Vehicle Workshop Availability - rejects in_workshop vehicles", () => {
    // VEH005 has status = in_workshop
    const assignment: OrderAssignment[] = [
      { order_ref: "ORD-001", outlet_id: "OUT001", decision: "served", vehicle_id: "VEH005", trip_id: 1 },
    ];

    const report = validateAllocation([baseOrder], assignment);
    expect(report.is_valid).toBe(false);
    expect(report.violations.some((v) => v.rule_name === "Vehicle availability")).toBe(true);
  });

  test("Automated Solver: Generates 100% Feasible Solution with Zero Violations", () => {
    // Create a realistic sample of orders across brands and districts
    const scenarioOrders: OrderPlanningInput[] = [
      // Colombo Fresh Chilled & Ambient
      {
        order_ref: "S1-001",
        outlet_id: "OUT001",
        brand: "Fresh",
        district: "Colombo",
        depot: "Peliyagoda",
        dock_type: "rear_dock",
        parking_constraint: "normal",
        temp_requirement: "chilled",
        order_units: 45,
        order_weight_kg: 850,
        order_volume_m3: 4.8,
        deferred_yesterday: 1, // Must be prioritized!
        days_since_last_served: 2,
      },
      {
        order_ref: "S1-002",
        outlet_id: "OUT002",
        brand: "Fresh",
        district: "Colombo",
        depot: "Peliyagoda",
        dock_type: "street",
        parking_constraint: "van_only",
        temp_requirement: "chilled",
        order_units: 20,
        order_weight_kg: 350,
        order_volume_m3: 2.2,
      },
      {
        order_ref: "S1-003",
        outlet_id: "OUT003",
        brand: "Fresh",
        district: "Colombo",
        depot: "Peliyagoda",
        dock_type: "rear_dock",
        parking_constraint: "normal",
        temp_requirement: "ambient",
        order_units: 50,
        order_weight_kg: 900,
        order_volume_m3: 5.0,
      },
      // Gampaha Fresh
      {
        order_ref: "S1-004",
        outlet_id: "OUT004",
        brand: "Fresh",
        district: "Gampaha",
        depot: "Peliyagoda",
        dock_type: "rear_dock",
        parking_constraint: "normal",
        temp_requirement: "chilled",
        order_units: 40,
        order_weight_kg: 700,
        order_volume_m3: 4.0,
      },
      // Colombo Style
      {
        order_ref: "S1-005",
        outlet_id: "OUT081",
        brand: "Style",
        district: "Colombo",
        depot: "Peliyagoda",
        dock_type: "mall_bay",
        parking_constraint: "mall_dock",
        temp_requirement: "ambient",
        order_units: 80,
        order_weight_kg: 400,
        order_volume_m3: 15.0,
      },
      // Kandy Tech
      {
        order_ref: "S1-006",
        outlet_id: "OUT106",
        brand: "Tech",
        district: "Kandy",
        depot: "Kandy",
        dock_type: "rear_dock",
        parking_constraint: "normal",
        temp_requirement: "ambient",
        order_units: 15,
        order_weight_kg: 1200,
        order_volume_m3: 8.5,
      },
    ];

    const result = solveDailyAllocation(scenarioOrders, FLEET_VEHICLES);

    // Verify 100% Feasibility
    expect(result.report.is_valid).toBe(true);
    expect(result.report.violations).toHaveLength(0);

    // Check that order S1-001 (deferred yesterday) is served
    const s1Assignment = result.assignments.find((a) => a.order_ref === "S1-001");
    expect(s1Assignment?.decision).toBe("served");

    // Check that van_only order S1-002 is assigned to a van
    const s2Assignment = result.assignments.find((a) => a.order_ref === "S1-002");
    if (s2Assignment?.decision === "served") {
      const vehicle = FLEET_VEHICLES.find((v) => v.vehicle_id === s2Assignment.vehicle_id);
      expect(vehicle?.type).toBe("van");
      expect(vehicle?.temp).toBe("reefer");
    }

    // Check that Kandy Tech order is served from Kandy depot
    const s6Assignment = result.assignments.find((a) => a.order_ref === "S1-006");
    if (s6Assignment?.decision === "served") {
      const vehicle = FLEET_VEHICLES.find((v) => v.vehicle_id === s6Assignment.vehicle_id);
      expect(vehicle?.depot).toBe("Kandy");
    }
  });
});
