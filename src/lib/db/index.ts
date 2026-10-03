/**
 * Waypoint Group Persistent Database Client
 * Tech-Triathlon 2026 Persistence Layer
 */

import fs from "fs";
import path from "path";
import type {
  DbUser,
  DbOutlet,
  DbVehicle,
  DbOrder,
  DbTrip,
  DbLoadingLog,
  DbPodRecord,
  DbDeferralLog,
  DbCutoffConfig,
} from "./schema";
import {
  SEEDED_USERS,
  SEEDED_OUTLETS,
  SEEDED_VEHICLES,
  SEEDED_ORDERS,
  SEEDED_CUTOFF_CONFIG,
} from "./seed-data";

interface DatabaseStore {
  users: DbUser[];
  outlets: DbOutlet[];
  vehicles: DbVehicle[];
  orders: DbOrder[];
  trips: DbTrip[];
  loadingLogs: DbLoadingLog[];
  podRecords: DbPodRecord[];
  deferralLogs: DbDeferralLog[];
  cutoffConfig: DbCutoffConfig;
  lastUpdated: string;
}

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "waypoint-store.json");

class DatabaseClient {
  private store: DatabaseStore | null = null;

  private ensureInitialized(): DatabaseStore {
    if (this.store) return this.store;

    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        this.store = JSON.parse(raw);
        return this.store!;
      }
    } catch (e) {
      console.warn("Could not read persistent DB file, re-initializing from seed data:", e);
    }

    // Initialize with full official seed data
    this.store = {
      users: [...SEEDED_USERS],
      outlets: [...SEEDED_OUTLETS],
      vehicles: [...SEEDED_VEHICLES],
      orders: [...SEEDED_ORDERS],
      trips: [],
      loadingLogs: [
        {
          id: "LOAD-001",
          order_id: "ORD0092301",
          vehicle_id: "VEH001",
          trip_id: 1,
          loader_id: "USR-002",
          loader_name: "Ruwan Kumara",
          status: "loaded",
          timestamp: "2026-09-28T05:15:00Z",
        },
      ],
      podRecords: [
        {
          id: "POD-001",
          order_id: "ORD0092302",
          driver_id: "USR-003",
          driver_name: "Kasun Perera",
          recipient_name: "Ruwan Senarath",
          recipient_phone: "+94 77 1234567",
          items_received: 28,
          condition_confirmed: true,
          proof_notes: "Crates received in good order. Ambient temperature verified.",
          delivered_at: "2026-09-28T06:18:00Z",
          offline_queued: false,
          synced_at: "2026-09-28T06:18:00Z",
        },
      ],
      deferralLogs: [
        {
          id: "DEF-001",
          order_id: "ORD0092305",
          outlet_id: "OUT005",
          brand: "Fresh",
          district: "Gampaha",
          reason: "Refrigerated van capacity exhausted in Gampaha; protected priority on next run",
          priority_score: 11000,
          decided_by: "Amaya Jayasinghe",
          next_scheduled_date: "2026-09-29",
          timestamp: "2026-09-28T04:30:00Z",
        },
      ],
      cutoffConfig: { ...SEEDED_CUTOFF_CONFIG },
      lastUpdated: new Date().toISOString(),
    };

    this.persist();
    return this.store;
  }

  private persist() {
    if (!this.store) return;
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      this.store.lastUpdated = new Date().toISOString();
      fs.writeFileSync(DB_FILE, JSON.stringify(this.store, null, 2), "utf-8");
    } catch (e) {
      console.error("Error writing persistent DB file:", e);
    }
  }

  // --- Users ---
  getUsers(): DbUser[] {
    return this.ensureInitialized().users;
  }

  getUserByEmail(email: string): DbUser | undefined {
    return this.ensureInitialized().users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
  }

  getUserById(id: string): DbUser | undefined {
    return this.ensureInitialized().users.find((u) => u.id === id);
  }

  // --- Outlets ---
  getOutlets(filter?: { brand?: string; district?: string; depot?: string }): DbOutlet[] {
    let list = this.ensureInitialized().outlets;
    if (filter?.brand && filter.brand !== "All brands") {
      list = list.filter((o) => o.brand === filter.brand);
    }
    if (filter?.district && filter.district !== "All districts") {
      list = list.filter((o) => o.district === filter.district);
    }
    if (filter?.depot && filter.depot !== "All depots") {
      list = list.filter((o) => o.depot === filter.depot);
    }
    return list;
  }

  getOutletById(outlet_id: string): DbOutlet | undefined {
    return this.ensureInitialized().outlets.find((o) => o.outlet_id === outlet_id);
  }

  // --- Vehicles ---
  getVehicles(filter?: { depot?: string; type?: string; temp?: string; status?: string }): DbVehicle[] {
    let list = this.ensureInitialized().vehicles;
    if (filter?.depot && filter.depot !== "All depots") {
      list = list.filter((v) => v.depot === filter.depot);
    }
    if (filter?.type) list = list.filter((v) => v.type === filter.type);
    if (filter?.temp) list = list.filter((v) => v.temp === filter.temp);
    if (filter?.status) list = list.filter((v) => v.status === filter.status);
    return list;
  }

  getVehicleById(vehicle_id: string): DbVehicle | undefined {
    return this.ensureInitialized().vehicles.find((v) => v.vehicle_id === vehicle_id);
  }

  // --- Orders ---
  getOrders(filter?: {
    brand?: string;
    status?: string;
    district?: string;
    depot?: string;
    outlet_id?: string;
    vehicle_id?: string;
    search?: string;
  }): DbOrder[] {
    let list = this.ensureInitialized().orders;
    if (filter?.brand && filter.brand !== "All brands") {
      list = list.filter((o) => o.brand === filter.brand);
    }
    if (filter?.status && filter.status !== "All statuses") {
      list = list.filter((o) => o.dispatch_status.toLowerCase() === filter.status?.toLowerCase());
    }
    if (filter?.district && filter.district !== "All districts") {
      list = list.filter((o) => o.district === filter.district);
    }
    if (filter?.depot && filter.depot !== "All depots") {
      list = list.filter((o) => o.depot === filter.depot);
    }
    if (filter?.outlet_id) {
      list = list.filter((o) => o.outlet_id === filter.outlet_id);
    }
    if (filter?.vehicle_id) {
      list = list.filter((o) => o.vehicle_id === filter.vehicle_id);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (o) =>
          o.order_ref.toLowerCase().includes(q) ||
          o.order_id.toLowerCase().includes(q) ||
          o.outlet_name.toLowerCase().includes(q) ||
          o.district.toLowerCase().includes(q)
      );
    }
    return list;
  }

  getOrderById(order_id: string): DbOrder | undefined {
    return this.ensureInitialized().orders.find(
      (o) => o.order_id === order_id || o.order_ref === order_id
    );
  }

  createOrder(data: Omit<DbOrder, "order_id" | "created_at" | "updated_at">): DbOrder {
    const store = this.ensureInitialized();
    const idNum = 92300 + store.orders.length + 1;
    const order_id = `ORD${idNum}`;
    const newOrder: DbOrder = {
      ...data,
      order_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.orders.unshift(newOrder);
    this.persist();
    return newOrder;
  }

  updateOrder(order_id: string, updates: Partial<DbOrder>): DbOrder | undefined {
    const store = this.ensureInitialized();
    const idx = store.orders.findIndex((o) => o.order_id === order_id || o.order_ref === order_id);
    if (idx === -1) return undefined;

    store.orders[idx] = {
      ...store.orders[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.persist();
    return store.orders[idx];
  }

  // --- Trips ---
  getTrips(): DbTrip[] {
    return this.ensureInitialized().trips;
  }

  saveTrips(trips: DbTrip[]): void {
    const store = this.ensureInitialized();
    store.trips = trips;
    this.persist();
  }

  // --- Loading Logs ---
  getLoadingLogs(vehicle_id?: string, trip_id?: 1 | 2): DbLoadingLog[] {
    let logs = this.ensureInitialized().loadingLogs;
    if (vehicle_id) logs = logs.filter((l) => l.vehicle_id === vehicle_id);
    if (trip_id) logs = logs.filter((l) => l.trip_id === trip_id);
    return logs;
  }

  createLoadingLog(log: Omit<DbLoadingLog, "id" | "timestamp">): DbLoadingLog {
    const store = this.ensureInitialized();
    const newLog: DbLoadingLog = {
      ...log,
      id: `LOAD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    };
    store.loadingLogs.push(newLog);
    this.persist();
    return newLog;
  }

  // --- POD Records ---
  getPodRecords(order_id?: string): DbPodRecord[] {
    let records = this.ensureInitialized().podRecords;
    if (order_id) records = records.filter((r) => r.order_id === order_id);
    return records;
  }

  createPodRecord(pod: Omit<DbPodRecord, "id" | "delivered_at">): DbPodRecord {
    const store = this.ensureInitialized();
    const newPod: DbPodRecord = {
      ...pod,
      id: `POD-${Date.now()}`,
      delivered_at: new Date().toISOString(),
    };
    store.podRecords.push(newPod);

    // Automatically update order status to delivered/received
    const orderIdx = store.orders.findIndex((o) => o.order_id === pod.order_id || o.order_ref === pod.order_id);
    if (orderIdx !== -1) {
      store.orders[orderIdx].dispatch_status = "delivered";
      store.orders[orderIdx].receipt_confirmed = true;
      store.orders[orderIdx].receipt_notes = pod.proof_notes;
      store.orders[orderIdx].updated_at = new Date().toISOString();
    }

    this.persist();
    return newPod;
  }

  syncPodQueue(
    queuedPods: Array<{
      order_id: string;
      driver_id?: string;
      driver_name?: string;
      recipient_name?: string;
      recipient_phone?: string;
      items_received?: number;
      condition_confirmed?: boolean;
      proof_notes?: string;
      signature_svg_or_hash?: string;
      photo_url?: string;
      delivered_at?: string;
    }>
  ): DbPodRecord[] {
    const results: DbPodRecord[] = [];
    for (const q of queuedPods) {
      const saved = this.createPodRecord({
        order_id: q.order_id,
        driver_id: q.driver_id || "USR-003",
        driver_name: q.driver_name || "Kasun Perera",
        recipient_name: q.recipient_name || "Receiving Staff",
        recipient_phone: q.recipient_phone,
        items_received: q.items_received ?? 30,
        condition_confirmed: q.condition_confirmed ?? true,
        proof_notes: q.proof_notes || "Captured during offline mode.",
        signature_svg_or_hash: q.signature_svg_or_hash,
        photo_url: q.photo_url,
        offline_queued: true,
        synced_at: new Date().toISOString(),
      });
      results.push(saved);
    }
    return results;
  }

  // --- Deferral Logs ---
  getDeferralLogs(): DbDeferralLog[] {
    return this.ensureInitialized().deferralLogs;
  }

  createDeferralLog(log: Omit<DbDeferralLog, "id" | "timestamp">): DbDeferralLog {
    const store = this.ensureInitialized();
    const newLog: DbDeferralLog = {
      ...log,
      id: `DEF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    };
    store.deferralLogs.push(newLog);
    this.persist();
    return newLog;
  }

  // --- Cutoff Config ---
  getCutoffConfig(): DbCutoffConfig {
    return this.ensureInitialized().cutoffConfig;
  }

  updateCutoffConfig(updates: Partial<DbCutoffConfig>): DbCutoffConfig {
    const store = this.ensureInitialized();
    store.cutoffConfig = {
      ...store.cutoffConfig,
      ...updates,
    };
    this.persist();
    return store.cutoffConfig;
  }

  // --- Reset Database for Judge Walkthrough ---
  resetToSeedData(): DatabaseStore {
    this.store = {
      users: [...SEEDED_USERS],
      outlets: [...SEEDED_OUTLETS],
      vehicles: [...SEEDED_VEHICLES],
      orders: [...SEEDED_ORDERS],
      trips: [],
      loadingLogs: [],
      podRecords: [],
      deferralLogs: [],
      cutoffConfig: { ...SEEDED_CUTOFF_CONFIG },
      lastUpdated: new Date().toISOString(),
    };
    this.persist();
    return this.store;
  }
}

export const db = new DatabaseClient();
