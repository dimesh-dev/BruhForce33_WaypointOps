/**
 * Waypoint Group Database Schema & Entity Definitions
 * Tech-Triathlon 2026 Persistent Data Model
 */

export interface DbUser {
  id: string;
  email: string;
  alias?: string;
  name: string;
  role: "Dispatcher" | "Loader" | "Driver" | "Store manager";
  initials: string;
  title: string;
  depot?: "Peliyagoda" | "Kandy";
  outlet_id?: string;
  vehicle_id?: string;
  created_at: string;
}

export interface DbOutlet {
  outlet_id: string;
  name: string;
  brand: "Fresh" | "Style" | "Tech";
  district: string;
  depot: "Peliyagoda" | "Kandy";
  dock_type: "rear_dock" | "street" | "mall_bay";
  parking_constraint: "normal" | "van_only" | "mall_dock";
  mall_window?: string;
  window_open_time: string;
  window_close_time: string;
  latitude: number;
  longitude: number;
  contact_person: string;
  contact_phone: string;
}

export interface DbVehicle {
  vehicle_id: string;
  type: "truck" | "van";
  temp: "reefer" | "ambient";
  weight_cap_kg: number;
  volume_cap_m3: number;
  fuel_type: "diesel" | "electric";
  km_per_l: number;
  weekly_fuel_quota_l: number;
  depot: "Peliyagoda" | "Kandy";
  status: "available" | "in_workshop";
  driver_name: string;
  driver_id?: string;
}

export interface DbOrder {
  order_id: string; // e.g. "ORD0092301" or "WP-2041"
  order_ref: string;
  order_date: string; // ISO date string (YYYY-MM-DD)
  dispatch_date?: string;
  brand: "Fresh" | "Style" | "Tech";
  outlet_id: string;
  outlet_name: string;
  district: string;
  depot: "Peliyagoda" | "Kandy";
  temp_requirement: "chilled" | "ambient";
  order_units: number;
  order_weight_kg: number;
  order_volume_m3: number;
  cutoff_status: "on_time" | "after_cutoff";
  dispatch_status: "scheduled" | "in_transit" | "delivered" | "received" | "deferred" | "at_risk";
  vehicle_id?: string;
  trip_id?: 1 | 2;
  seq_in_route?: number;
  planned_departure_time?: string;
  planned_arrival_time?: string;
  window_open_time: string;
  window_close_time: string;
  eta?: string;
  deferred_yesterday: number;
  days_since_last_served: number;
  deferral_reason?: string;
  receipt_confirmed: boolean;
  receipt_notes?: string;
  reported_discrepancy?: string;
  created_at: string;
  updated_at: string;
}

export interface DbTrip {
  trip_id: string; // e.g. "TRIP-VEH001-1"
  vehicle_id: string;
  trip_number: 1 | 2;
  date: string;
  depot: "Peliyagoda" | "Kandy";
  district: string;
  brand: "Fresh" | "Style" | "Tech";
  status: "planned" | "loading" | "dispatched" | "completed";
  order_count: number;
  total_weight_kg: number;
  total_volume_m3: number;
  outbound_travel_min: number;
  inter_stop_travel_min: number;
  handling_time_min: number;
  total_trip_min: number;
  order_ids: string[];
  created_at: string;
}

export interface DbLoadingLog {
  id: string;
  order_id: string;
  vehicle_id: string;
  trip_id: 1 | 2;
  loader_id: string;
  loader_name: string;
  status: "staged" | "loaded" | "shortfall_flagged";
  shortfall_type?: "missing" | "damaged" | "quantity_discrepancy" | "temperature_fault";
  shortfall_notes?: string;
  timestamp: string;
}

export interface DbPodRecord {
  id: string;
  order_id: string;
  driver_id: string;
  driver_name: string;
  recipient_name: string;
  recipient_phone?: string;
  items_received: number;
  condition_confirmed: boolean;
  proof_notes?: string;
  signature_svg_or_hash?: string;
  photo_url?: string;
  delivered_at: string;
  offline_queued: boolean;
  synced_at?: string;
}

export interface DbDeferralLog {
  id: string;
  order_id: string;
  outlet_id: string;
  brand: string;
  district: string;
  reason: string;
  priority_score: number;
  decided_by: string;
  next_scheduled_date: string;
  timestamp: string;
}

export interface DbCutoffConfig {
  operating_date: string;
  cutoff_time: string; // "16:00"
  cutoff_passed: boolean;
  plan_published: boolean;
  published_at?: string;
  published_by?: string;
}
