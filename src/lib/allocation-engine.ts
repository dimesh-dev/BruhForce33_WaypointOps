/**
 * Waypoint Group Planning & Allocation Engine
 * Tech-Triathlon 2026 Feasibility Solver & Constraint Validator
 * 
 * Strict compliance with all 7 Feasibility Rules from the Challenge Booklet (Pages 20-21, 28-31).
 */

import {
  type OutletRecord,
  type VehicleRecord,
  type DistrictTravelRecord,
  DISTRICT_TRAVEL,
  SERVICE_ALLOWANCES,
  FLEET_VEHICLES,
  OUTLETS,
  OUTLETS_MAP,
  VEHICLES_MAP,
} from "./dataset-reference";

export interface OrderPlanningInput {
  order_ref: string;
  outlet_id: string;
  brand: "Fresh" | "Style" | "Tech";
  district: string;
  depot: "Peliyagoda" | "Kandy";
  dock_type: "rear_dock" | "street" | "mall_bay";
  parking_constraint: "normal" | "van_only" | "mall_dock";
  temp_requirement: "chilled" | "ambient";
  order_units: number;
  order_weight_kg: number;
  order_volume_m3: number;
  deferred_yesterday?: number;
  days_since_last_served?: number;
  mall_window?: string;
  window_open_time?: string;
  window_close_time?: string;
  outlet_name?: string;
}

export interface OrderAssignment {
  order_ref: string;
  outlet_id: string;
  decision: "served" | "deferred";
  vehicle_id?: string;
  trip_id?: 1 | 2;
  deferral_reason?: string;
}

export interface ConstraintViolation {
  rule_number: number;
  rule_name: string;
  severity: "error" | "warning";
  vehicle_id?: string;
  trip_id?: 1 | 2;
  order_ref?: string;
  outlet_id?: string;
  message: string;
}

export interface TripMetrics {
  vehicle_id: string;
  trip_id: 1 | 2;
  brand: "Fresh" | "Style" | "Tech";
  district: string;
  depot: "Peliyagoda" | "Kandy";
  order_count: number;
  orders: OrderPlanningInput[];
  total_weight_kg: number;
  total_volume_m3: number;
  outbound_travel_min: number;
  inter_stop_travel_min: number;
  handling_time_min: number;
  total_trip_min: number;
  weight_utilization_pct: number;
  volume_utilization_pct: number;
  is_valid: boolean;
  violations: ConstraintViolation[];
}

export interface VehicleUtilization {
  vehicle_id: string;
  vehicle: VehicleRecord;
  trips: TripMetrics[];
  fresh_minutes_used: number;
  style_tech_minutes_used: number;
  fresh_budget_max: 270;
  style_tech_budget_max: 480;
  total_orders_served: number;
  total_weight_kg: number;
  total_volume_m3: number;
  is_available: boolean;
  is_valid: boolean;
  violations: ConstraintViolation[];
}

export interface FeasibilityReport {
  is_valid: boolean;
  rules_checked: number;
  violations: ConstraintViolation[];
  trips: TripMetrics[];
  vehicles: VehicleUtilization[];
  summary: {
    total_orders: number;
    served_orders: number;
    deferred_orders: number;
    service_rate_pct: number;
    total_weight_kg: number;
    total_volume_m3: number;
    total_trips: number;
    vehicles_used: number;
    total_travel_time_min: number;
    total_handling_time_min: number;
    total_plan_minutes: number;
  };
}

/**
 * Calculates exact trip time in minutes per Challenge Booklet Page 20-21:
 * trip_minutes = outbound travel + inter-stop travel + total handling time
 */
export function calculateTripDuration(
  depot: "Peliyagoda" | "Kandy",
  district: string,
  brand: "Fresh" | "Style" | "Tech",
  orders: { dock_type: "rear_dock" | "street" | "mall_bay" }[]
): {
  outbound_travel_min: number;
  inter_stop_travel_min: number;
  handling_time_min: number;
  total_trip_min: number;
} {
  const travelKey = `${district}:${depot}`;
  const travelRecord = DISTRICT_TRAVEL[travelKey] || {
    depot_to_district_freeflow_min: 30,
    inter_stop_freeflow_min: 10,
  };

  // Step 1: Outbound travel from depot to district (counted once per trip)
  const outbound_travel_min = travelRecord.depot_to_district_freeflow_min;

  // Step 2: Inter-stop travel (inter_stop_freeflow_min * (n - 1))
  const orderCount = orders.length;
  const inter_stop_travel_min =
    orderCount > 1 ? travelRecord.inter_stop_freeflow_min * (orderCount - 1) : 0;

  // Step 3: Total handling time (sum of service allowances for each order dock_type)
  const handling_time_min = orders.reduce((sum, o) => {
    const allowanceKey = `${brand}:${o.dock_type}`;
    const allowance = SERVICE_ALLOWANCES[allowanceKey] ?? 18;
    return sum + allowance;
  }, 0);

  const total_trip_min = outbound_travel_min + inter_stop_travel_min + handling_time_min;

  return {
    outbound_travel_min,
    inter_stop_travel_min,
    handling_time_min,
    total_trip_min,
  };
}

/**
 * Comprehensive Constraint Validator
 * Checks all 7 Feasibility Rules + Vehicle Workshop Availability
 */
export function validateAllocation(
  orders: OrderPlanningInput[],
  assignments: OrderAssignment[],
  vehicles: VehicleRecord[] = FLEET_VEHICLES
): FeasibilityReport {
  const violations: ConstraintViolation[] = [];
  const orderMap = new Map(orders.map((o) => [o.order_ref, o]));
  const vehicleMap = new Map(vehicles.map((v) => [v.vehicle_id, v]));

  // Track assigned orders to check Rule 5 (Whole orders / no duplicate assignments)
  const seenOrders = new Set<string>();

  // Group served orders by vehicle_id and trip_id
  const tripGroups = new Map<string, OrderPlanningInput[]>();
  const vehicleTripsMap = new Map<string, Set<number>>();

  for (const asgn of assignments) {
    const order = orderMap.get(asgn.order_ref);
    if (!order) continue;

    if (asgn.decision === "served") {
      if (!asgn.vehicle_id || !asgn.trip_id) {
        violations.push({
          rule_number: 5,
          rule_name: "Whole orders",
          severity: "error",
          order_ref: asgn.order_ref,
          outlet_id: asgn.outlet_id,
          message: `Served order ${asgn.order_ref} must have both vehicle_id and trip_id specified.`,
        });
        continue;
      }

      if (seenOrders.has(asgn.order_ref)) {
        violations.push({
          rule_number: 5,
          rule_name: "Whole orders",
          severity: "error",
          order_ref: asgn.order_ref,
          outlet_id: asgn.outlet_id,
          message: `Order ${asgn.order_ref} is assigned multiple times. Whole orders cannot be split.`,
        });
      }
      seenOrders.add(asgn.order_ref);

      const tripKey = `${asgn.vehicle_id}:T${asgn.trip_id}`;
      if (!tripGroups.has(tripKey)) {
        tripGroups.set(tripKey, []);
      }
      tripGroups.get(tripKey)!.push(order);

      if (!vehicleTripsMap.has(asgn.vehicle_id)) {
        vehicleTripsMap.set(asgn.vehicle_id, new Set());
      }
      vehicleTripsMap.get(asgn.vehicle_id)!.add(asgn.trip_id);
    }
  }

  const tripMetricsList: TripMetrics[] = [];

  // Evaluate each trip group for Rules 1, 2, 3, 4, 6
  tripGroups.forEach((tripOrders, tripKey) => {
    const [vehicle_id, tripIdStr] = tripKey.split(":T");
    const trip_id = Number(tripIdStr) as 1 | 2;
    const vehicle = vehicleMap.get(vehicle_id);

    const tripViolations: ConstraintViolation[] = [];

    if (!vehicle) {
      const v: ConstraintViolation = {
        rule_number: 0,
        rule_name: "Unknown vehicle",
        severity: "error",
        vehicle_id,
        trip_id,
        message: `Vehicle ${vehicle_id} does not exist in the fleet repository.`,
      };
      violations.push(v);
      tripViolations.push(v);
      return;
    }

    // Vehicle workshop availability check
    if (vehicle.status === "in_workshop") {
      const v: ConstraintViolation = {
        rule_number: 0,
        rule_name: "Vehicle availability",
        severity: "error",
        vehicle_id,
        trip_id,
        message: `Vehicle ${vehicle_id} has status in_workshop and cannot be allocated.`,
      };
      violations.push(v);
      tripViolations.push(v);
    }

    // RULE 1: Brand and district (All orders sharing vehicle_id & trip_id must belong to same brand and district)
    const distinctBrands = Array.from(new Set(tripOrders.map((o) => o.brand)));
    const distinctDistricts = Array.from(new Set(tripOrders.map((o) => o.district)));

    if (distinctBrands.length > 1) {
      const v: ConstraintViolation = {
        rule_number: 1,
        rule_name: "Brand and district",
        severity: "error",
        vehicle_id,
        trip_id,
        message: `Trip carries multiple brands (${distinctBrands.join(", ")}). Must contain only 1 brand.`,
      };
      violations.push(v);
      tripViolations.push(v);
    }

    if (distinctDistricts.length > 1) {
      const v: ConstraintViolation = {
        rule_number: 1,
        rule_name: "Brand and district",
        severity: "error",
        vehicle_id,
        trip_id,
        message: `Trip carries orders across multiple districts (${distinctDistricts.join(", ")}). Must contain only 1 district.`,
      };
      violations.push(v);
      tripViolations.push(v);
    }

    const tripBrand = tripOrders[0].brand;
    const tripDistrict = tripOrders[0].district;
    const tripDepot = tripOrders[0].depot;

    // RULE 2: Refrigeration (Chilled orders require reefer vehicle)
    const hasChilled = tripOrders.some((o) => o.temp_requirement === "chilled");
    if (hasChilled && vehicle.temp !== "reefer") {
      const v: ConstraintViolation = {
        rule_number: 2,
        rule_name: "Refrigeration",
        severity: "error",
        vehicle_id,
        trip_id,
        message: `Trip carries chilled orders but vehicle ${vehicle_id} is ambient (not a reefer).`,
      };
      violations.push(v);
      tripViolations.push(v);
    }

    // RULE 3: Vehicle access (Outlets with parking_constraint = van_only require type = van)
    const hasVanOnly = tripOrders.some((o) => o.parking_constraint === "van_only");
    if (hasVanOnly && vehicle.type !== "van") {
      const v: ConstraintViolation = {
        rule_number: 3,
        rule_name: "Vehicle access",
        severity: "error",
        vehicle_id,
        trip_id,
        message: `Trip includes outlet(s) with van_only access, but vehicle ${vehicle_id} is a truck.`,
      };
      violations.push(v);
      tripViolations.push(v);
    }

    // RULE 4: Home depot (Vehicle may serve only outlets assigned to its own depot)
    const depotMismatches = tripOrders.filter((o) => o.depot !== vehicle.depot);
    if (depotMismatches.length > 0) {
      const v: ConstraintViolation = {
        rule_number: 4,
        rule_name: "Home depot",
        severity: "error",
        vehicle_id,
        trip_id,
        message: `Vehicle home depot is ${vehicle.depot}, but orders belong to ${depotMismatches[0].depot}.`,
      };
      violations.push(v);
      tripViolations.push(v);
    }

    // RULE 6: Capacity (Weight <= weight_cap_kg, Volume <= volume_cap_m3)
    const totalWeight = tripOrders.reduce((sum, o) => sum + (o.order_weight_kg || 0), 0);
    const totalVolume = tripOrders.reduce((sum, o) => sum + (o.order_volume_m3 || 0), 0);

    if (totalWeight > vehicle.weight_cap_kg + 0.001) {
      const v: ConstraintViolation = {
        rule_number: 6,
        rule_name: "Capacity",
        severity: "error",
        vehicle_id,
        trip_id,
        message: `Trip weight ${totalWeight.toFixed(1)}kg exceeds vehicle capacity ${vehicle.weight_cap_kg}kg (+${(totalWeight - vehicle.weight_cap_kg).toFixed(1)}kg).`,
      };
      violations.push(v);
      tripViolations.push(v);
    }

    if (totalVolume > vehicle.volume_cap_m3 + 0.001) {
      const v: ConstraintViolation = {
        rule_number: 6,
        rule_name: "Capacity",
        severity: "error",
        vehicle_id,
        trip_id,
        message: `Trip volume ${totalVolume.toFixed(2)}m³ exceeds vehicle capacity ${vehicle.volume_cap_m3}m³ (+${(totalVolume - vehicle.volume_cap_m3).toFixed(2)}m³).`,
      };
      violations.push(v);
      tripViolations.push(v);
    }

    // Trip time calculation
    const duration = calculateTripDuration(vehicle.depot, tripDistrict, tripBrand, tripOrders);

    tripMetricsList.push({
      vehicle_id,
      trip_id,
      brand: tripBrand,
      district: tripDistrict,
      depot: tripDepot,
      order_count: tripOrders.length,
      orders: tripOrders,
      total_weight_kg: Number(totalWeight.toFixed(1)),
      total_volume_m3: Number(totalVolume.toFixed(2)),
      outbound_travel_min: duration.outbound_travel_min,
      inter_stop_travel_min: duration.inter_stop_travel_min,
      handling_time_min: duration.handling_time_min,
      total_trip_min: duration.total_trip_min,
      weight_utilization_pct: Number(((totalWeight / vehicle.weight_cap_kg) * 100).toFixed(1)),
      volume_utilization_pct: Number(((totalVolume / vehicle.volume_cap_m3) * 100).toFixed(1)),
      is_valid: tripViolations.length === 0,
      violations: tripViolations,
    });
  });

  // RULE 7: Trips and time budgets (Max 2 trips, Fresh <= 270 min, Style+Tech <= 480 min)
  const vehicleSummaries: VehicleUtilization[] = [];

  vehicles.forEach((vehicle) => {
    const vehicleTrips = tripMetricsList.filter((t) => t.vehicle_id === vehicle.vehicle_id);
    const vehicleViolations: ConstraintViolation[] = [];

    // Max 2 trips check
    const tripIds = Array.from(new Set(vehicleTrips.map((t) => t.trip_id)));
    if (tripIds.length > 2 || vehicleTrips.some((t) => t.trip_id > 2 || t.trip_id < 1)) {
      const v: ConstraintViolation = {
        rule_number: 7,
        rule_name: "Trips and time",
        severity: "error",
        vehicle_id: vehicle.vehicle_id,
        message: `Vehicle ${vehicle.vehicle_id} has ${tripIds.length} trips assigned (Maximum allowed is 2).`,
      };
      violations.push(v);
      vehicleViolations.push(v);
    }

    // Time budgets: Fresh budget = 270 min; Style & Tech combined budget = 480 min
    const freshTrips = vehicleTrips.filter((t) => t.brand === "Fresh");
    const styleTechTrips = vehicleTrips.filter((t) => t.brand === "Style" || t.brand === "Tech");

    const freshMinutes = freshTrips.reduce((sum, t) => sum + t.total_trip_min, 0);
    const styleTechMinutes = styleTechTrips.reduce((sum, t) => sum + t.total_trip_min, 0);

    if (freshMinutes > 270) {
      const v: ConstraintViolation = {
        rule_number: 7,
        rule_name: "Trips and time",
        severity: "error",
        vehicle_id: vehicle.vehicle_id,
        message: `Total Fresh trip duration ${freshMinutes}min exceeds the 270 min morning window budget (3:30 AM - 8:00 AM) by ${freshMinutes - 270}min.`,
      };
      violations.push(v);
      vehicleViolations.push(v);
    }

    if (styleTechMinutes > 480) {
      const v: ConstraintViolation = {
        rule_number: 7,
        rule_name: "Trips and time",
        severity: "error",
        vehicle_id: vehicle.vehicle_id,
        message: `Total Style & Tech trip duration ${styleTechMinutes}min exceeds the 480 min trading day budget by ${styleTechMinutes - 480}min.`,
      };
      violations.push(v);
      vehicleViolations.push(v);
    }

    const totalWeight = vehicleTrips.reduce((sum, t) => sum + t.total_weight_kg, 0);
    const totalVolume = vehicleTrips.reduce((sum, t) => sum + t.total_volume_m3, 0);
    const totalOrders = vehicleTrips.reduce((sum, t) => sum + t.order_count, 0);

    vehicleSummaries.push({
      vehicle_id: vehicle.vehicle_id,
      vehicle,
      trips: vehicleTrips,
      fresh_minutes_used: freshMinutes,
      style_tech_minutes_used: styleTechMinutes,
      fresh_budget_max: 270,
      style_tech_budget_max: 480,
      total_orders_served: totalOrders,
      total_weight_kg: Number(totalWeight.toFixed(1)),
      total_volume_m3: Number(totalVolume.toFixed(2)),
      is_available: vehicle.status === "available",
      is_valid: vehicleViolations.length === 0 && vehicleTrips.every((t) => t.is_valid),
      violations: vehicleViolations,
    });
  });

  // Calculate high-level summary metrics
  const servedOrdersCount = seenOrders.size;
  const deferredOrdersCount = orders.length - servedOrdersCount;
  const serviceRatePct = orders.length > 0 ? (servedOrdersCount / orders.length) * 100 : 0;
  const totalWeightServed = tripMetricsList.reduce((sum, t) => sum + t.total_weight_kg, 0);
  const totalVolumeServed = tripMetricsList.reduce((sum, t) => sum + t.total_volume_m3, 0);
  const vehiclesUsedCount = vehicleSummaries.filter((v) => v.trips.length > 0).length;
  const totalTravelTime = tripMetricsList.reduce(
    (sum, t) => sum + t.outbound_travel_min + t.inter_stop_travel_min,
    0
  );
  const totalHandlingTime = tripMetricsList.reduce((sum, t) => sum + t.handling_time_min, 0);

  return {
    is_valid: violations.length === 0,
    rules_checked: 7,
    violations,
    trips: tripMetricsList,
    vehicles: vehicleSummaries,
    summary: {
      total_orders: orders.length,
      served_orders: servedOrdersCount,
      deferred_orders: deferredOrdersCount,
      service_rate_pct: Number(serviceRatePct.toFixed(1)),
      total_weight_kg: Number(totalWeightServed.toFixed(1)),
      total_volume_m3: Number(totalVolumeServed.toFixed(2)),
      total_trips: tripMetricsList.length,
      vehicles_used: vehiclesUsedCount,
      total_travel_time_min: totalTravelTime,
      total_handling_time_min: totalHandlingTime,
      total_plan_minutes: totalTravelTime + totalHandlingTime,
    },
  };
}

/**
 * Priority Scoring algorithm for fairness and SLA protection
 * Higher score = higher allocation priority
 */
export function calculateOrderPriority(order: OrderPlanningInput): number {
  let score = 0;
  // 1. Starvation prevention: Orders skipped on previous run get absolute top priority
  if (order.deferred_yesterday === 1) score += 10000;
  // 2. Days since last served
  score += (order.days_since_last_served || 0) * 1000;
  // 3. Perishable Fresh chilled orders (morning 8 AM store opening requirement)
  if (order.brand === "Fresh" && order.temp_requirement === "chilled") score += 500;
  // 4. Fresh ambient orders
  if (order.brand === "Fresh") score += 200;
  // 5. Density and efficiency score
  score += (order.order_weight_kg || 1) / (order.order_volume_m3 || 1);
  return score;
}

export interface SolveOptions {
  strategy?: "priority_first" | "max_utilization" | "balanced";
  strictReeferOnlyForChilled?: boolean;
}

/**
 * Automated Planning & Allocation Engine (High-Performance Optimizer)
 * Solves daily multi-depot, multi-brand, multi-district fleet allocation
 * Guaranteed 100% compliant with all 7 Feasibility Rules.
 */
export function solveDailyAllocation(
  orders: OrderPlanningInput[],
  fleet: VehicleRecord[] = FLEET_VEHICLES,
  options: SolveOptions = {}
): {
  assignments: OrderAssignment[];
  report: FeasibilityReport;
  deferrals: { order_ref: string; outlet_id: string; reason: string; priority: number }[];
} {
  const assignments: OrderAssignment[] = [];
  const deferrals: { order_ref: string; outlet_id: string; reason: string; priority: number }[] = [];

  // Filter out vehicles that are in workshop
  const availableVehicles = fleet.filter((v) => v.status === "available");

  // Group vehicles by depot
  const depotVehicles = {
    Peliyagoda: availableVehicles.filter((v) => v.depot === "Peliyagoda"),
    Kandy: availableVehicles.filter((v) => v.depot === "Kandy"),
  };

  // State tracker for each vehicle during allocation
  interface VehicleState {
    vehicle: VehicleRecord;
    trip1?: {
      brand: "Fresh" | "Style" | "Tech";
      district: string;
      orders: OrderPlanningInput[];
      weight: number;
      volume: number;
      duration_min: number;
    };
    trip2?: {
      brand: "Fresh" | "Style" | "Tech";
      district: string;
      orders: OrderPlanningInput[];
      weight: number;
      volume: number;
      duration_min: number;
    };
    fresh_minutes_used: number;
    style_tech_minutes_used: number;
  }

  const vehicleStates = new Map<string, VehicleState>();
  availableVehicles.forEach((v) => {
    vehicleStates.set(v.vehicle_id, {
      vehicle: v,
      fresh_minutes_used: 0,
      style_tech_minutes_used: 0,
    });
  });

  // Calculate priorities and sort orders
  const scoredOrders = orders.map((o) => ({
    order: o,
    priority: calculateOrderPriority(o),
  }));

  // Group orders strictly by (depot, brand, district) to ensure Rule 1 & Rule 4
  type PartitionKey = `${"Peliyagoda" | "Kandy"}::${"Fresh" | "Style" | "Tech"}::${string}`;
  const partitions = new Map<PartitionKey, { order: OrderPlanningInput; priority: number }[]>();

  scoredOrders.forEach((item) => {
    const key: PartitionKey = `${item.order.depot}::${item.order.brand}::${item.order.district}`;
    if (!partitions.has(key)) {
      partitions.set(key, []);
    }
    partitions.get(key)!.push(item);
  });

  // Sort partitions by highest total priority
  const sortedPartitions = Array.from(partitions.entries()).sort(([, a], [, b]) => {
    const maxA = Math.max(...a.map((x) => x.priority));
    const maxB = Math.max(...b.map((x) => x.priority));
    return maxB - maxA;
  });

  // Helper to attempt packing a candidate set of orders into a vehicle trip
  function canFitInTrip(
    vState: VehicleState,
    tripNumber: 1 | 2,
    brand: "Fresh" | "Style" | "Tech",
    district: string,
    existingOrders: OrderPlanningInput[],
    newOrder: OrderPlanningInput
  ): boolean {
    const v = vState.vehicle;

    // Rule 2: Refrigeration
    if (newOrder.temp_requirement === "chilled" && v.temp !== "reefer") {
      return false;
    }

    // Rule 3: Vehicle access
    if (newOrder.parking_constraint === "van_only" && v.type !== "van") {
      return false;
    }

    // Rule 6: Capacity
    const candidateOrders = [...existingOrders, newOrder];
    const candidateWeight = candidateOrders.reduce((sum, o) => sum + o.order_weight_kg, 0);
    const candidateVolume = candidateOrders.reduce((sum, o) => sum + o.order_volume_m3, 0);

    if (candidateWeight > v.weight_cap_kg || candidateVolume > v.volume_cap_m3) {
      return false;
    }

    // Rule 7: Time Budget calculation
    const duration = calculateTripDuration(v.depot, district, brand, candidateOrders);

    if (brand === "Fresh") {
      const otherTripFreshMin =
        tripNumber === 1
          ? vState.trip2?.brand === "Fresh"
            ? vState.trip2.duration_min
            : 0
          : vState.trip1?.brand === "Fresh"
            ? vState.trip1.duration_min
            : 0;

      if (duration.total_trip_min + otherTripFreshMin > 270) {
        return false;
      }
    } else {
      const otherTripStyleTechMin =
        tripNumber === 1
          ? vState.trip2 && vState.trip2.brand !== "Fresh"
            ? vState.trip2.duration_min
            : 0
          : vState.trip1 && vState.trip1.brand !== "Fresh"
            ? vState.trip1.duration_min
            : 0;

      if (duration.total_trip_min + otherTripStyleTechMin > 480) {
        return false;
      }
    }

    return true;
  }

  // Process each partition
  sortedPartitions.forEach(([partitionKey, partitionOrders]) => {
    const [depotStr, brandStr, district] = partitionKey.split("::");
    const depot = depotStr as "Peliyagoda" | "Kandy";
    const brand = brandStr as "Fresh" | "Style" | "Tech";

    // Sort orders inside partition: van_only first, then by priority descending
    partitionOrders.sort((a, b) => {
      if (a.order.parking_constraint === "van_only" && b.order.parking_constraint !== "van_only") return -1;
      if (a.order.parking_constraint !== "van_only" && b.order.parking_constraint === "van_only") return 1;
      return b.priority - a.priority;
    });

    const unassignedInPartition: { order: OrderPlanningInput; priority: number }[] = [];

    // Prioritize specialized vehicles (Vans for van_only, Reefer for chilled)
    const availableForDepot = availableVehicles
      .filter((v) => v.depot === depot)
      .map((v) => vehicleStates.get(v.vehicle_id)!);

    // Sort available vehicles so constrained resources are used when needed:
    // (e.g. Vans matched to van_only, Reefers matched to chilled)
    for (const item of partitionOrders) {
      const order = item.order;
      let assigned = false;

      // Filter vehicle candidates based on hard access / temp requirements
      const candidateVehicles = availableForDepot.filter((vs) => {
        if (order.parking_constraint === "van_only" && vs.vehicle.type !== "van") return false;
        if (order.temp_requirement === "chilled" && vs.vehicle.temp !== "reefer") return false;
        return true;
      });

      // Sort candidate vehicles:
      // 1. Prefer vehicle already running a trip in the same (brand, district) to consolidate stops
      // 2. Prefer vehicle with trip 1 done, scheduling trip 2
      // 3. Prefer dry trucks for ambient, preserving reefers for chilled
      candidateVehicles.sort((a, b) => {
        const aHasMatchingTrip1 = a.trip1 && a.trip1.brand === brand && a.trip1.district === district;
        const bHasMatchingTrip1 = b.trip1 && b.trip1.brand === brand && b.trip1.district === district;
        if (aHasMatchingTrip1 && !bHasMatchingTrip1) return -1;
        if (!aHasMatchingTrip1 && bHasMatchingTrip1) return 1;

        // Preserve reefer trucks if order is ambient
        if (order.temp_requirement === "ambient") {
          if (a.vehicle.temp === "ambient" && b.vehicle.temp === "reefer") return -1;
          if (a.vehicle.temp === "reefer" && b.vehicle.temp === "ambient") return 1;
        }
        return 0;
      });

      // Try assigning to existing Trip 1 or Trip 2, or start a new Trip
      for (const vs of candidateVehicles) {
        // Option A: Add to Trip 1 if same brand and district
        if (
          vs.trip1 &&
          vs.trip1.brand === brand &&
          vs.trip1.district === district &&
          canFitInTrip(vs, 1, brand, district, vs.trip1.orders, order)
        ) {
          vs.trip1.orders.push(order);
          vs.trip1.weight += order.order_weight_kg;
          vs.trip1.volume += order.order_volume_m3;
          const dur = calculateTripDuration(depot, district, brand, vs.trip1.orders);
          vs.trip1.duration_min = dur.total_trip_min;
          if (brand === "Fresh") vs.fresh_minutes_used = dur.total_trip_min;
          else vs.style_tech_minutes_used = dur.total_trip_min;

          assignments.push({
            order_ref: order.order_ref,
            outlet_id: order.outlet_id,
            decision: "served",
            vehicle_id: vs.vehicle.vehicle_id,
            trip_id: 1,
          });
          assigned = true;
          break;
        }

        // Option B: Add to Trip 2 if same brand and district
        if (
          vs.trip2 &&
          vs.trip2.brand === brand &&
          vs.trip2.district === district &&
          canFitInTrip(vs, 2, brand, district, vs.trip2.orders, order)
        ) {
          vs.trip2.orders.push(order);
          vs.trip2.weight += order.order_weight_kg;
          vs.trip2.volume += order.order_volume_m3;
          const dur = calculateTripDuration(depot, district, brand, vs.trip2.orders);
          vs.trip2.duration_min = dur.total_trip_min;
          if (brand === "Fresh") vs.fresh_minutes_used += dur.total_trip_min;
          else vs.style_tech_minutes_used += dur.total_trip_min;

          assignments.push({
            order_ref: order.order_ref,
            outlet_id: order.outlet_id,
            decision: "served",
            vehicle_id: vs.vehicle.vehicle_id,
            trip_id: 2,
          });
          assigned = true;
          break;
        }

        // Option C: Start new Trip 1 if vehicle has no trips yet
        if (!vs.trip1 && canFitInTrip(vs, 1, brand, district, [], order)) {
          const dur = calculateTripDuration(depot, district, brand, [order]);
          vs.trip1 = {
            brand,
            district,
            orders: [order],
            weight: order.order_weight_kg,
            volume: order.order_volume_m3,
            duration_min: dur.total_trip_min,
          };
          if (brand === "Fresh") vs.fresh_minutes_used = dur.total_trip_min;
          else vs.style_tech_minutes_used = dur.total_trip_min;

          assignments.push({
            order_ref: order.order_ref,
            outlet_id: order.outlet_id,
            decision: "served",
            vehicle_id: vs.vehicle.vehicle_id,
            trip_id: 1,
          });
          assigned = true;
          break;
        }

        // Option D: Start new Trip 2 if vehicle has Trip 1 but no Trip 2
        if (vs.trip1 && !vs.trip2 && canFitInTrip(vs, 2, brand, district, [], order)) {
          const dur = calculateTripDuration(depot, district, brand, [order]);
          vs.trip2 = {
            brand,
            district,
            orders: [order],
            weight: order.order_weight_kg,
            volume: order.order_volume_m3,
            duration_min: dur.total_trip_min,
          };
          if (brand === "Fresh") vs.fresh_minutes_used += dur.total_trip_min;
          else vs.style_tech_minutes_used += dur.total_trip_min;

          assignments.push({
            order_ref: order.order_ref,
            outlet_id: order.outlet_id,
            decision: "served",
            vehicle_id: vs.vehicle.vehicle_id,
            trip_id: 2,
          });
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        unassignedInPartition.push(item);
      }
    }

    // For any unassigned orders, formulate clear, domain-accurate deferral reasons
    unassignedInPartition.forEach(({ order, priority }) => {
      let reason = "Fleet capacity limit reached for operating window.";
      if (order.parking_constraint === "van_only") {
        reason = `Van vehicle capacity exhausted for ${district} district (van_only restriction).`;
      } else if (order.temp_requirement === "chilled") {
        reason = `Refrigerated fleet capacity exhausted at ${depot} depot for early morning window (3:30-8:00 AM).`;
      } else if (brand === "Fresh") {
        reason = `Morning pre-opening time budget (270 min) reached for ${district} runs.`;
      } else {
        reason = `Trading day fleet capacity allocated to higher priority deliveries; deferred to next run.`;
      }

      deferrals.push({
        order_ref: order.order_ref,
        outlet_id: order.outlet_id,
        reason,
        priority,
      });

      assignments.push({
        order_ref: order.order_ref,
        outlet_id: order.outlet_id,
        decision: "deferred",
        deferral_reason: reason,
      });
    });
  });

  // Run the full validation engine to verify the generated plan
  const report = validateAllocation(orders, assignments, fleet);

  return {
    assignments,
    report,
    deferrals,
  };
}
