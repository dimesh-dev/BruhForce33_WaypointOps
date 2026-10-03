export type Role = "dispatcher" | "loader" | "driver" | "store_manager";
export type Brand = "Fresh" | "Style" | "Tech";

export interface User {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  depot: string | null;
  vehicle_id: string | null;
  outlet_id: string | null;
}

export interface Clock {
  now: string;
  local_date: string;
  local_minutes: number;
  ordering_run_date: string | null;
  ordering_cutoff: string | null;
  simulated: boolean;
}

export interface Me {
  user: User;
  run_date: string;
  clock: Clock;
}

export interface Stop {
  id: number;
  seq: number;
  order_id: string;
  status: "pending" | "arrived" | "delivered" | "failed";
  loaded: boolean;
  arrival_min: number;
  service_start_min: number;
  depart_min: number;
  window_open_min: number;
  window_close_min: number;
  service_min: number;
  completed_at: string | null;
  outlet_id: string;
  outlet_name: string;
  dock_type: string;
  parking_constraint: string;
  temp_requirement: "chilled" | "ambient";
  units: number;
  weight_kg: number;
  volume_m3: number;
  order_status: string;
}

export interface Trip {
  id: number;
  plan_id: number;
  vehicle_id: string;
  trip_no: 1 | 2;
  brand: Brand;
  district: string;
  depot: string;
  depart_min: number;
  return_min: number;
  trip_minutes: number;
  weight_kg: number;
  volume_m3: number;
  distance_km: number;
  fuel_l: number;
  status: string;
  vehicle_type: "truck" | "van";
  vehicle_temp: "reefer" | "ambient";
  weight_cap_kg: number;
  volume_cap_m3: number;
  driver_name: string;
  version: number;
  plan_status: string;
  run_date: string;
  ready_at: string | null;
  departed_at: string | null;
  stops: Stop[];
}

export interface PlanSummary {
  orders: number;
  served: number;
  deferred: number;
  service_rate_pct: number;
  trips: number;
  vehicles_used: number;
  reefer_trips: number;
  total_volume_m3: number;
  total_fuel_l: number;
  by_brand: Record<Brand, { orders: number; served: number }>;
  binding: string[];
}

export interface Plan {
  id: number;
  version: number;
  status: "draft" | "published" | "superseded";
  summary: PlanSummary;
  created_at: string;
  published_at: string | null;
}

export interface Deferral {
  id: number;
  order_id: string;
  from_date: string;
  to_date: string;
  code: string;
  reason: string;
  unavoidable: boolean;
  outlet_id: string;
  outlet_name: string;
  brand: Brand;
  district: string;
  temp_requirement: string;
  volume_m3: number;
  deferred_count: number;
  parking_constraint: string;
}

export interface QueueOrder {
  order_id: string;
  outlet_id: string;
  outlet_name: string;
  brand: Brand;
  district: string;
  depot: string;
  temp_requirement: "chilled" | "ambient";
  units: number;
  weight_kg: number;
  volume_m3: number;
  status: string;
  requested_date: string;
  run_date: string;
  deferred_count: number;
  placed_at: string;
  parking_constraint: string;
  dock_type: string;
  window_open_time: string;
  window_close_time: string;
  mall_window: string | null;
}

export interface Issue {
  id: number;
  kind:
    "loading_shortfall" | "delivery_issue" | "receipt_issue" | "sync_conflict";
  category: string;
  order_id: string | null;
  trip_id: number | null;
  outlet_id: string | null;
  outlet_name: string | null;
  units_affected: number | null;
  description: string;
  blocks_departure: boolean;
  status: "open" | "resolved";
  resolution: string | null;
  reported_by_name: string | null;
  created_at: string;
  vehicle_id: string | null;
  trip_no: number | null;
}

export interface VehicleLite {
  vehicle_id: string;
  type: "truck" | "van";
  temp: "reefer" | "ambient";
  depot: string;
  status: "available" | "in_workshop";
  volume_cap_m3: number;
  weight_cap_kg: number;
  driver_name: string;
}

export interface Board {
  run: {
    run_date: string;
    dow_name: string;
    is_payday: number;
    festival: string | null;
    festival_ramp: number;
    monsoon: number;
    cutoff_at: string | null;
    closed_at: string | null;
  };
  plans: Plan[];
  active_plan: Plan | null;
  published_plan: Plan | null;
  trips: Trip[];
  deferrals: Deferral[];
  orders: QueueOrder[];
  issues: Issue[];
  vehicles: VehicleLite[];
  skipped: {
    outlet_id: string;
    outlet_name: string;
    last_skipped: string;
    times: number;
  }[];
}

export interface AppEvent {
  id: number;
  type: string;
  title: string;
  detail: string;
  severity: "info" | "success" | "warning" | "critical";
  order_id: string | null;
  created_at: string;
}

export interface Violation {
  rule: string;
  message: string;
}
