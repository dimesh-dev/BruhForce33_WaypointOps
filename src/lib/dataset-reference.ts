/**
 * Waypoint Group Official Dataset Reference & Shared Definitions
 * Compliant with Tech-Triathlon 2026 Challenge Specifications
 */

export interface OutletRecord {
  outlet_id: string;
  brand: "Fresh" | "Style" | "Tech";
  name: string;
  district: string;
  depot: "Peliyagoda" | "Kandy";
  dock_type: "rear_dock" | "street" | "mall_bay";
  parking_constraint: "normal" | "van_only" | "mall_dock";
  mall_window?: string;
  window_open_time: string;
  window_close_time: string;
}

export interface VehicleRecord {
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
  driver_name?: string;
}

export interface DistrictTravelRecord {
  district: string;
  depot: "Peliyagoda" | "Kandy";
  road_class: "urban" | "suburban" | "highway" | "hill";
  free_flow_kmh: number;
  depot_to_district_km: number;
  depot_to_district_freeflow_min: number;
  inter_stop_km: number;
  inter_stop_freeflow_min: number;
}

export interface ServiceAllowanceRecord {
  brand: "Fresh" | "Style" | "Tech";
  dock_type: "rear_dock" | "street" | "mall_bay";
  service_allowance_min: number;
}

/**
 * Service allowance lookup table (Page 20, 30 of Challenge Booklet)
 */
export const SERVICE_ALLOWANCES: Record<string, number> = {
  "Fresh:rear_dock": 15,
  "Fresh:street": 16,
  "Fresh:mall_bay": 20,
  "Style:rear_dock": 20,
  "Style:street": 25,
  "Style:mall_bay": 30,
  "Tech:rear_dock": 25,
  "Tech:street": 30,
  "Tech:mall_bay": 35,
};

/**
 * District travel times & distance matrix (Page 20, 29 of Challenge Booklet)
 */
export const DISTRICT_TRAVEL: Record<string, DistrictTravelRecord> = {
  "Colombo:Peliyagoda": {
    district: "Colombo",
    depot: "Peliyagoda",
    road_class: "urban",
    free_flow_kmh: 30,
    depot_to_district_km: 12,
    depot_to_district_freeflow_min: 24,
    inter_stop_km: 4,
    inter_stop_freeflow_min: 8,
  },
  "Gampaha:Peliyagoda": {
    district: "Gampaha",
    depot: "Peliyagoda",
    road_class: "suburban",
    free_flow_kmh: 40,
    depot_to_district_km: 25,
    depot_to_district_freeflow_min: 37,
    inter_stop_km: 6,
    inter_stop_freeflow_min: 9,
  },
  "Kalutara:Peliyagoda": {
    district: "Kalutara",
    depot: "Peliyagoda",
    road_class: "highway",
    free_flow_kmh: 45,
    depot_to_district_km: 45,
    depot_to_district_freeflow_min: 60,
    inter_stop_km: 8,
    inter_stop_freeflow_min: 12,
  },
  "Galle:Peliyagoda": {
    district: "Galle",
    depot: "Peliyagoda",
    road_class: "highway",
    free_flow_kmh: 60,
    depot_to_district_km: 115,
    depot_to_district_freeflow_min: 110,
    inter_stop_km: 10,
    inter_stop_freeflow_min: 15,
  },
  "Matara:Peliyagoda": {
    district: "Matara",
    depot: "Peliyagoda",
    road_class: "highway",
    free_flow_kmh: 65,
    depot_to_district_km: 155,
    depot_to_district_freeflow_min: 135,
    inter_stop_km: 10,
    inter_stop_freeflow_min: 15,
  },
  "Kurunegala:Peliyagoda": {
    district: "Kurunegala",
    depot: "Peliyagoda",
    road_class: "highway",
    free_flow_kmh: 50,
    depot_to_district_km: 80,
    depot_to_district_freeflow_min: 90,
    inter_stop_km: 8,
    inter_stop_freeflow_min: 12,
  },
  "Puttalam:Peliyagoda": {
    district: "Puttalam",
    depot: "Peliyagoda",
    road_class: "highway",
    free_flow_kmh: 55,
    depot_to_district_km: 125,
    depot_to_district_freeflow_min: 130,
    inter_stop_km: 12,
    inter_stop_freeflow_min: 16,
  },
  "Ratnapura:Peliyagoda": {
    district: "Ratnapura",
    depot: "Peliyagoda",
    road_class: "hill",
    free_flow_kmh: 40,
    depot_to_district_km: 78,
    depot_to_district_freeflow_min: 88,
    inter_stop_km: 7,
    inter_stop_freeflow_min: 13,
  },
  "Kandy:Kandy": {
    district: "Kandy",
    depot: "Kandy",
    road_class: "hill",
    free_flow_kmh: 30,
    depot_to_district_km: 8,
    depot_to_district_freeflow_min: 15,
    inter_stop_km: 4,
    inter_stop_freeflow_min: 10,
  },
  "Matale:Kandy": {
    district: "Matale",
    depot: "Kandy",
    road_class: "hill",
    free_flow_kmh: 35,
    depot_to_district_km: 26,
    depot_to_district_freeflow_min: 38,
    inter_stop_km: 6,
    inter_stop_freeflow_min: 12,
  },
  "Nuwara Eliya:Kandy": {
    district: "Nuwara Eliya",
    depot: "Kandy",
    road_class: "hill",
    free_flow_kmh: 30,
    depot_to_district_km: 72,
    depot_to_district_freeflow_min: 85,
    inter_stop_km: 8,
    inter_stop_freeflow_min: 18,
  },
  "Kegalle:Kandy": {
    district: "Kegalle",
    depot: "Kandy",
    road_class: "hill",
    free_flow_kmh: 40,
    depot_to_district_km: 38,
    depot_to_district_freeflow_min: 48,
    inter_stop_km: 7,
    inter_stop_freeflow_min: 12,
  },
};

/**
 * Full 60-Vehicle Fleet Specification (Page 3, 28 of Booklet)
 * - 12 Refrigerated trucks (5000 kg, 30 m3)
 * - 40 Dry-box trucks (5000 kg, 35 m3)
 * - 4 Refrigerated vans (1500 kg, 10 m3)
 * - 4 Dry-box vans (1500 kg, 12 m3)
 */
export const FLEET_VEHICLES: VehicleRecord[] = [
  // 12 Refrigerated Trucks
  ...Array.from({ length: 12 }, (_, i) => {
    const idNum = i + 1;
    const vehicle_id = `VEH${String(idNum).padStart(3, "0")}`;
    const depot: "Peliyagoda" | "Kandy" = idNum <= 10 ? "Peliyagoda" : "Kandy";
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
      driver_name: ["Kasun Perera", "Nimal Silva", "Dilan Fernando", "Sunil Bandara", "Chaminda Senanayake", "Thilina Jayawardena", "Mahesh Wickramasinghe", "Pradeep Kumara", "Nuwan Alwis", "Suresh Mendis", "Priyantha Jayasinghe", "Janaka Ratnayake"][i],
    };
  }),

  // 40 Dry-Box Trucks
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
      driver_name: `Driver ${idNum}`,
    };
  }),

  // 4 Refrigerated Vans (Van Only + Chilled)
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

  // 4 Dry-Box Vans (Van Only + Ambient)
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
 * 120 Outlets Dataset (80 Fresh, 25 Style, 15 Tech)
 */
export const OUTLETS: OutletRecord[] = [
  // 80 Fresh Outlets (OUT001 to OUT080)
  ...Array.from({ length: 80 }, (_, i) => {
    const idNum = i + 1;
    const outlet_id = `OUT${String(idNum).padStart(3, "0")}`;
    const districts = ["Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Kurunegala", "Galle", "Matara", "Kegalle", "Ratnapura"];
    const district = districts[i % districts.length];
    const depot: "Peliyagoda" | "Kandy" = ["Kandy", "Matale", "Nuwara Eliya", "Kegalle"].includes(district) ? "Kandy" : "Peliyagoda";
    const dock_type: "rear_dock" | "street" | "mall_bay" = i % 5 === 0 ? "mall_bay" : i % 3 === 0 ? "street" : "rear_dock";
    const parking_constraint: "normal" | "van_only" | "mall_dock" = i % 7 === 0 ? "van_only" : dock_type === "mall_bay" ? "mall_dock" : "normal";
    
    return {
      outlet_id,
      brand: "Fresh" as const,
      name: `Waypoint Fresh · ${district} #${(i % 12) + 1}`,
      district,
      depot,
      dock_type,
      parking_constraint,
      mall_window: dock_type === "mall_bay" ? "06:00-08:00" : undefined,
      window_open_time: "05:30",
      window_close_time: "08:00",
    };
  }),

  // 25 Style Outlets (OUT081 to OUT105)
  ...Array.from({ length: 25 }, (_, i) => {
    const idNum = i + 81;
    const outlet_id = `OUT${String(idNum).padStart(3, "0")}`;
    const districts = ["Colombo", "Gampaha", "Kandy", "Kurunegala", "Galle"];
    const district = districts[i % districts.length];
    const depot: "Peliyagoda" | "Kandy" = district === "Kandy" ? "Kandy" : "Peliyagoda";
    const isMall = i % 2 === 0;
    const dock_type: "rear_dock" | "street" | "mall_bay" = isMall ? "mall_bay" : "rear_dock";
    const parking_constraint: "normal" | "van_only" | "mall_dock" = isMall ? "mall_dock" : i % 5 === 0 ? "van_only" : "normal";
    
    return {
      outlet_id,
      brand: "Style" as const,
      name: isMall ? `Waypoint Style · ${district} Mall #${(i % 4) + 1}` : `Waypoint Style · ${district} High St #${(i % 4) + 1}`,
      district,
      depot,
      dock_type,
      parking_constraint,
      mall_window: isMall ? "09:00-11:00" : undefined,
      window_open_time: isMall ? "09:00" : "08:30",
      window_close_time: isMall ? "11:00" : "15:00",
    };
  }),

  // 15 Tech Outlets (OUT106 to OUT120)
  ...Array.from({ length: 15 }, (_, i) => {
    const idNum = i + 106;
    const outlet_id = `OUT${String(idNum).padStart(3, "0")}`;
    const districts = ["Colombo", "Gampaha", "Kalutara", "Kandy", "Kurunegala", "Galle"];
    const district = districts[i % districts.length];
    const depot: "Peliyagoda" | "Kandy" = district === "Kandy" ? "Kandy" : "Peliyagoda";
    const dock_type: "rear_dock" | "street" | "mall_bay" = i % 3 === 0 ? "mall_bay" : "rear_dock";
    const parking_constraint: "normal" | "van_only" | "mall_dock" = i % 4 === 0 ? "van_only" : dock_type === "mall_bay" ? "mall_dock" : "normal";

    return {
      outlet_id,
      brand: "Tech" as const,
      name: `Waypoint Tech · ${district} Megastore #${(i % 3) + 1}`,
      district,
      depot,
      dock_type,
      parking_constraint,
      mall_window: dock_type === "mall_bay" ? "10:00-12:00" : undefined,
      window_open_time: "09:00",
      window_close_time: "16:00",
    };
  }),
];

export const OUTLETS_MAP = new Map<string, OutletRecord>(
  OUTLETS.map((o) => [o.outlet_id, o])
);

export const VEHICLES_MAP = new Map<string, VehicleRecord>(
  FLEET_VEHICLES.map((v) => [v.vehicle_id, v])
);
