/**
 * Waypoint Group Official Dataset Seed Generator
 * Ingests 120 Outlets, 60 Vehicles, 4 Seeded Accounts, and 1 Realistic Dispatch Day
 */

import type {
  DbUser,
  DbOutlet,
  DbVehicle,
  DbOrder,
  DbCutoffConfig,
} from "./schema";

export const SEEDED_USERS: DbUser[] = [
  {
    id: "USR-001",
    email: "amaya@waypoint.lk",
    name: "Amaya Jayasinghe",
    role: "Dispatcher",
    initials: "AJ",
    title: "Network Dispatcher & Planning Lead",
    depot: "Peliyagoda",
    created_at: "2026-09-01T08:00:00Z",
  },
  {
    id: "USR-002",
    email: "ruwan@waypoint.lk",
    name: "Ruwan Kumara",
    role: "Loader",
    initials: "RK",
    title: "Warehouse Loading Dock Supervisor",
    depot: "Peliyagoda",
    created_at: "2026-09-01T08:00:00Z",
  },
  {
    id: "USR-003",
    email: "kasun@waypoint.lk",
    name: "Kasun Perera",
    role: "Driver",
    initials: "KP",
    title: "Senior Fleet Delivery Driver",
    vehicle_id: "VEH001",
    created_at: "2026-09-01T08:00:00Z",
  },
  {
    id: "USR-004",
    email: "anjali@waypoint.lk",
    name: "Anjali Fernando",
    role: "Store manager",
    initials: "AF",
    title: "Supermarket Store Manager",
    outlet_id: "OUT001",
    created_at: "2026-09-01T08:00:00Z",
  },
];

export const SEEDED_CUTOFF_CONFIG: DbCutoffConfig = {
  operating_date: "2026-09-28",
  cutoff_time: "16:00",
  cutoff_passed: true,
  plan_published: true,
  published_at: "2026-09-28T04:45:00Z",
  published_by: "Amaya Jayasinghe",
};

// District coordinates centerpoints across Sri Lanka
const DISTRICT_COORDS: Record<string, { lat: number; lng: number }> = {
  Colombo: { lat: 6.9271, lng: 79.8612 },
  Gampaha: { lat: 7.084, lng: 79.9937 },
  Kalutara: { lat: 6.5854, lng: 79.9607 },
  Galle: { lat: 6.0535, lng: 80.221 },
  Matara: { lat: 5.9549, lng: 80.555 },
  Kurunegala: { lat: 7.4863, lng: 80.3623 },
  Puttalam: { lat: 8.0408, lng: 79.8394 },
  Ratnapura: { lat: 6.6828, lng: 80.4032 },
  Kandy: { lat: 7.2906, lng: 80.6337 },
  Matale: { lat: 7.4675, lng: 80.6234 },
  "Nuwara Eliya": { lat: 6.9497, lng: 80.7891 },
  Kegalle: { lat: 7.2513, lng: 80.3464 },
};

/**
 * 120 Official Outlets Dataset (80 Fresh, 25 Style, 15 Tech)
 */
export const SEEDED_OUTLETS: DbOutlet[] = [
  // 80 Fresh Outlets
  ...Array.from({ length: 80 }, (_, i) => {
    const idNum = i + 1;
    const outlet_id = `OUT${String(idNum).padStart(3, "0")}`;
    const districts = [
      "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale",
      "Kurunegala", "Galle", "Matara", "Kegalle", "Ratnapura"
    ];
    const district = districts[i % districts.length];
    const depot: "Peliyagoda" | "Kandy" = ["Kandy", "Matale", "Nuwara Eliya", "Kegalle"].includes(district) ? "Kandy" : "Peliyagoda";
    const dock_type: "rear_dock" | "street" | "mall_bay" = i % 5 === 0 ? "mall_bay" : i % 3 === 0 ? "street" : "rear_dock";
    const parking_constraint: "normal" | "van_only" | "mall_dock" = i % 7 === 0 ? "van_only" : dock_type === "mall_bay" ? "mall_dock" : "normal";
    const coords = DISTRICT_COORDS[district] || { lat: 6.9271, lng: 79.8612 };

    return {
      outlet_id,
      name: `Waypoint Fresh · ${district} #${(i % 12) + 1}`,
      brand: "Fresh" as const,
      district,
      depot,
      dock_type,
      parking_constraint,
      mall_window: dock_type === "mall_bay" ? "06:00-08:00" : undefined,
      window_open_time: "05:30",
      window_close_time: "08:00",
      latitude: coords.lat + (Math.sin(i) * 0.04),
      longitude: coords.lng + (Math.cos(i) * 0.04),
      contact_person: `Manager ${idNum}`,
      contact_phone: `+94 77 ${1000000 + idNum}`,
    };
  }),

  // 25 Style Outlets
  ...Array.from({ length: 25 }, (_, i) => {
    const idNum = i + 81;
    const outlet_id = `OUT${String(idNum).padStart(3, "0")}`;
    const districts = ["Colombo", "Gampaha", "Kandy", "Kurunegala", "Galle"];
    const district = districts[i % districts.length];
    const depot: "Peliyagoda" | "Kandy" = district === "Kandy" ? "Kandy" : "Peliyagoda";
    const isMall = i % 2 === 0;
    const dock_type: "rear_dock" | "street" | "mall_bay" = isMall ? "mall_bay" : "rear_dock";
    const parking_constraint: "normal" | "van_only" | "mall_dock" = isMall ? "mall_dock" : i % 5 === 0 ? "van_only" : "normal";
    const coords = DISTRICT_COORDS[district] || { lat: 6.9271, lng: 79.8612 };

    return {
      outlet_id,
      name: isMall ? `Waypoint Style · ${district} Mall #${(i % 4) + 1}` : `Waypoint Style · ${district} High St #${(i % 4) + 1}`,
      brand: "Style" as const,
      district,
      depot,
      dock_type,
      parking_constraint,
      mall_window: isMall ? "09:00-11:00" : undefined,
      window_open_time: isMall ? "09:00" : "08:30",
      window_close_time: isMall ? "11:00" : "15:00",
      latitude: coords.lat + (Math.sin(i) * 0.03),
      longitude: coords.lng + (Math.cos(i) * 0.03),
      contact_person: `Style Lead ${idNum}`,
      contact_phone: `+94 71 ${2000000 + idNum}`,
    };
  }),

  // 15 Tech Outlets
  ...Array.from({ length: 15 }, (_, i) => {
    const idNum = i + 106;
    const outlet_id = `OUT${String(idNum).padStart(3, "0")}`;
    const districts = ["Colombo", "Gampaha", "Kalutara", "Kandy", "Kurunegala", "Galle"];
    const district = districts[i % districts.length];
    const depot: "Peliyagoda" | "Kandy" = district === "Kandy" ? "Kandy" : "Peliyagoda";
    const dock_type: "rear_dock" | "street" | "mall_bay" = i % 3 === 0 ? "mall_bay" : "rear_dock";
    const parking_constraint: "normal" | "van_only" | "mall_dock" = i % 4 === 0 ? "van_only" : dock_type === "mall_bay" ? "mall_dock" : "normal";
    const coords = DISTRICT_COORDS[district] || { lat: 6.9271, lng: 79.8612 };

    return {
      outlet_id,
      name: `Waypoint Tech · ${district} Megastore #${(i % 3) + 1}`,
      brand: "Tech" as const,
      district,
      depot,
      dock_type,
      parking_constraint,
      mall_window: dock_type === "mall_bay" ? "10:00-12:00" : undefined,
      window_open_time: "09:00",
      window_close_time: "16:00",
      latitude: coords.lat + (Math.sin(i) * 0.03),
      longitude: coords.lng + (Math.cos(i) * 0.03),
      contact_person: `Tech Officer ${idNum}`,
      contact_phone: `+94 76 ${3000000 + idNum}`,
    };
  }),
];

/**
 * 60 Official Vehicles (12 Reefer Trucks, 40 Dry Trucks, 4 Reefer Vans, 4 Dry Vans)
 */
export const SEEDED_VEHICLES: DbVehicle[] = [
  // 12 Refrigerated Trucks
  ...Array.from({ length: 12 }, (_, i) => {
    const idNum = i + 1;
    const vehicle_id = `VEH${String(idNum).padStart(3, "0")}`;
    const depot: "Peliyagoda" | "Kandy" = idNum <= 10 ? "Peliyagoda" : "Kandy";
    const driver_names = [
      "Kasun Perera", "Nimal Silva", "Dilan Fernando", "Sunil Bandara",
      "Chaminda Senanayake", "Thilina Jayawardena", "Mahesh Wickramasinghe",
      "Pradeep Kumara", "Nuwan Alwis", "Suresh Mendis", "Priyantha Jayasinghe", "Janaka Ratnayake"
    ];
    return {
      vehicle_id,
      type: "truck" as const,
      temp: "reefer" as const,
      weight_cap_kg: 5000,
      volume_cap_m3: 30,
      fuel_type: "diesel" as const,
      km_per_l: 4.5,
      weekly_fuel_quota_l: 350,
      depot,
      status: (idNum === 5 ? "in_workshop" : "available") as "available" | "in_workshop",
      driver_name: driver_names[i],
      driver_id: idNum === 1 ? "USR-003" : `DRV-${idNum}`,
    };
  }),

  // 40 Dry Trucks
  ...Array.from({ length: 40 }, (_, i) => {
    const idNum = i + 13;
    const vehicle_id = `VEH${String(idNum).padStart(3, "0")}`;
    const depot: "Peliyagoda" | "Kandy" = idNum <= 42 ? "Peliyagoda" : "Kandy";
    return {
      vehicle_id,
      type: "truck" as const,
      temp: "ambient" as const,
      weight_cap_kg: 5000,
      volume_cap_m3: 35,
      fuel_type: "diesel" as const,
      km_per_l: 5.0,
      weekly_fuel_quota_l: 300,
      depot,
      status: (idNum === 20 || idNum === 35 ? "in_workshop" : "available") as "available" | "in_workshop",
      driver_name: `Truck Driver ${idNum}`,
    };
  }),

  // 4 Reefer Vans
  ...Array.from({ length: 4 }, (_, i) => {
    const idNum = i + 53;
    const vehicle_id = `VEH${String(idNum).padStart(3, "0")}`;
    const depot: "Peliyagoda" | "Kandy" = idNum <= 55 ? "Peliyagoda" : "Kandy";
    return {
      vehicle_id,
      type: "van" as const,
      temp: "reefer" as const,
      weight_cap_kg: 1500,
      volume_cap_m3: 10,
      fuel_type: "diesel" as const,
      km_per_l: 8.0,
      weekly_fuel_quota_l: 180,
      depot,
      status: "available" as const,
      driver_name: `Van Driver ${idNum}`,
    };
  }),

  // 4 Dry Vans
  ...Array.from({ length: 4 }, (_, i) => {
    const idNum = i + 57;
    const vehicle_id = `VEH${String(idNum).padStart(3, "0")}`;
    const depot: "Peliyagoda" | "Kandy" = idNum <= 59 ? "Peliyagoda" : "Kandy";
    return {
      vehicle_id,
      type: "van" as const,
      temp: "ambient" as const,
      weight_cap_kg: 1500,
      volume_cap_m3: 12,
      fuel_type: "diesel" as const,
      km_per_l: 8.5,
      weekly_fuel_quota_l: 180,
      depot,
      status: "available" as const,
      driver_name: `Van Driver ${idNum}`,
    };
  }),
];

/**
 * Realistic Dispatch Day Orders (Operating Date: 2026-09-28)
 */
export const SEEDED_ORDERS: DbOrder[] = [
  // Order 1: Fresh Colombo Chilled (Assigned to VEH001 Kasun Perera)
  {
    order_id: "ORD0092301",
    order_ref: "WP-2041",
    order_date: "2026-09-28",
    dispatch_date: "2026-09-28",
    brand: "Fresh",
    outlet_id: "OUT001",
    outlet_name: "Waypoint Fresh · Colombo 03",
    district: "Colombo",
    depot: "Peliyagoda",
    temp_requirement: "chilled",
    order_units: 42,
    order_weight_kg: 640,
    order_volume_m3: 4.2,
    cutoff_status: "on_time",
    dispatch_status: "in_transit",
    vehicle_id: "VEH001",
    trip_id: 1,
    seq_in_route: 0,
    planned_departure_time: "05:30",
    planned_arrival_time: "06:15",
    window_open_time: "06:00",
    window_close_time: "07:30",
    eta: "06:42",
    deferred_yesterday: 0,
    days_since_last_served: 1,
    receipt_confirmed: false,
    created_at: "2026-09-27T14:30:00Z",
    updated_at: "2026-09-28T05:30:00Z",
  },
  // Order 2: Fresh Nugegoda Ambient (Delivered)
  {
    order_id: "ORD0092302",
    order_ref: "WP-2042",
    order_date: "2026-09-28",
    dispatch_date: "2026-09-28",
    brand: "Fresh",
    outlet_id: "OUT002",
    outlet_name: "Waypoint Fresh · Nugegoda",
    district: "Colombo",
    depot: "Peliyagoda",
    temp_requirement: "ambient",
    order_units: 28,
    order_weight_kg: 420,
    order_volume_m3: 3.1,
    cutoff_status: "on_time",
    dispatch_status: "delivered",
    vehicle_id: "VEH001",
    trip_id: 1,
    seq_in_route: 1,
    planned_departure_time: "05:30",
    planned_arrival_time: "06:05",
    window_open_time: "06:00",
    window_close_time: "08:00",
    eta: "06:18",
    deferred_yesterday: 0,
    days_since_last_served: 1,
    receipt_confirmed: true,
    receipt_notes: "28 crates verified on delivery dock. Fresh condition confirmed.",
    created_at: "2026-09-27T13:15:00Z",
    updated_at: "2026-09-28T06:20:00Z",
  },
  // Order 3: Style Mall Bay (At risk of mall window)
  {
    order_id: "ORD0092303",
    order_ref: "WP-2043",
    order_date: "2026-09-28",
    dispatch_date: "2026-09-28",
    brand: "Style",
    outlet_id: "OUT081",
    outlet_name: "Waypoint Style · Colombo City Centre",
    district: "Colombo",
    depot: "Peliyagoda",
    temp_requirement: "ambient",
    order_units: 85,
    order_weight_kg: 280,
    order_volume_m3: 12.6,
    cutoff_status: "on_time",
    dispatch_status: "at_risk",
    vehicle_id: "VEH013",
    trip_id: 1,
    seq_in_route: 0,
    planned_departure_time: "08:30",
    planned_arrival_time: "09:30",
    window_open_time: "09:00",
    window_close_time: "10:30",
    eta: "10:42",
    deferred_yesterday: 0,
    days_since_last_served: 3,
    deferral_reason: "Mall delivery window closes at 10:30 AM; estimated arrival 10:42 AM",
    receipt_confirmed: false,
    created_at: "2026-09-27T15:00:00Z",
    updated_at: "2026-09-28T08:30:00Z",
  },
  // Order 4: Tech Kandy Megastore
  {
    order_id: "ORD0092304",
    order_ref: "WP-2044",
    order_date: "2026-09-28",
    dispatch_date: "2026-09-28",
    brand: "Tech",
    outlet_id: "OUT106",
    outlet_name: "Waypoint Tech · Kandy Megastore",
    district: "Kandy",
    depot: "Kandy",
    temp_requirement: "ambient",
    order_units: 14,
    order_weight_kg: 980,
    order_volume_m3: 6.8,
    cutoff_status: "on_time",
    dispatch_status: "scheduled",
    vehicle_id: "VEH011",
    trip_id: 1,
    seq_in_route: 0,
    planned_departure_time: "09:00",
    planned_arrival_time: "10:30",
    window_open_time: "10:00",
    window_close_time: "14:00",
    eta: "11:15",
    deferred_yesterday: 0,
    days_since_last_served: 2,
    receipt_confirmed: false,
    created_at: "2026-09-27T11:00:00Z",
    updated_at: "2026-09-28T09:00:00Z",
  },
  // Order 5: Fresh Kadawatha (Deferred yesterday, starvation protection test)
  {
    order_id: "ORD0092305",
    order_ref: "WP-2045",
    order_date: "2026-09-28",
    dispatch_date: undefined,
    brand: "Fresh",
    outlet_id: "OUT005",
    outlet_name: "Waypoint Fresh · Kadawatha",
    district: "Gampaha",
    depot: "Peliyagoda",
    temp_requirement: "chilled",
    order_units: 22,
    order_weight_kg: 320,
    order_volume_m3: 2.4,
    cutoff_status: "on_time",
    dispatch_status: "deferred",
    vehicle_id: undefined,
    trip_id: undefined,
    planned_departure_time: undefined,
    planned_arrival_time: undefined,
    window_open_time: "05:30",
    window_close_time: "07:45",
    eta: "Next run",
    deferred_yesterday: 1,
    days_since_last_served: 2,
    deferral_reason: "Refrigerated van capacity exhausted in Gampaha; protected priority on next run",
    receipt_confirmed: false,
    created_at: "2026-09-27T15:45:00Z",
    updated_at: "2026-09-28T05:00:00Z",
  },
  // Order 6: Fresh Wattala Chilled
  {
    order_id: "ORD0092306",
    order_ref: "WP-2046",
    order_date: "2026-09-28",
    dispatch_date: "2026-09-28",
    brand: "Fresh",
    outlet_id: "OUT006",
    outlet_name: "Waypoint Fresh · Wattala",
    district: "Gampaha",
    depot: "Peliyagoda",
    temp_requirement: "chilled",
    order_units: 35,
    order_weight_kg: 510,
    order_volume_m3: 3.6,
    cutoff_status: "on_time",
    dispatch_status: "scheduled",
    vehicle_id: "VEH002",
    trip_id: 1,
    seq_in_route: 0,
    planned_departure_time: "05:45",
    planned_arrival_time: "06:45",
    window_open_time: "05:30",
    window_close_time: "07:45",
    eta: "07:10",
    deferred_yesterday: 0,
    days_since_last_served: 1,
    receipt_confirmed: false,
    created_at: "2026-09-27T14:10:00Z",
    updated_at: "2026-09-28T05:45:00Z",
  },
  // Additional realistic orders across Galle, Kalutara, Kurunegala, Matale
  ...Array.from({ length: 24 }, (_, i) => {
    const idNum = i + 7;
    const order_id = `ORD${String(92300 + idNum)}`;
    const order_ref = `WP-${2040 + idNum}`;
    const outlet = SEEDED_OUTLETS[(i * 3 + 2) % SEEDED_OUTLETS.length];
    const isChilled = outlet.brand === "Fresh" && i % 2 === 0;
    const isAfterCutoff = i >= 20;

    return {
      order_id,
      order_ref,
      order_date: "2026-09-28",
      dispatch_date: isAfterCutoff ? undefined : "2026-09-28",
      brand: outlet.brand,
      outlet_id: outlet.outlet_id,
      outlet_name: outlet.name,
      district: outlet.district,
      depot: outlet.depot,
      temp_requirement: isChilled ? ("chilled" as const) : ("ambient" as const),
      order_units: 20 + (i * 3),
      order_weight_kg: 250 + (i * 45),
      order_volume_m3: Number((2.0 + (i * 0.4)).toFixed(1)),
      cutoff_status: isAfterCutoff ? ("after_cutoff" as const) : ("on_time" as const),
      dispatch_status: isAfterCutoff
        ? ("deferred" as const)
        : i % 4 === 0
          ? ("in_transit" as const)
          : i % 3 === 0
            ? ("delivered" as const)
            : ("scheduled" as const),
      vehicle_id: isAfterCutoff ? undefined : isChilled ? "VEH003" : "VEH014",
      trip_id: isAfterCutoff ? undefined : ((i % 2 + 1) as 1 | 2),
      seq_in_route: isAfterCutoff ? undefined : i % 3,
      planned_departure_time: isAfterCutoff ? undefined : "06:00",
      planned_arrival_time: isAfterCutoff ? undefined : "07:30",
      window_open_time: outlet.window_open_time,
      window_close_time: outlet.window_close_time,
      eta: isAfterCutoff ? "Following run (After 4 PM cutoff)" : `0${6 + (i % 3)}:${15 + (i * 5) % 40}`,
      deferred_yesterday: 0,
      days_since_last_served: 1,
      deferral_reason: isAfterCutoff ? "Received after 4:00 PM cutoff; queued for following operating run." : undefined,
      receipt_confirmed: i % 3 === 0,
      created_at: isAfterCutoff ? "2026-09-27T16:45:00Z" : "2026-09-27T13:00:00Z",
      updated_at: "2026-09-28T06:00:00Z",
    };
  }),
];
