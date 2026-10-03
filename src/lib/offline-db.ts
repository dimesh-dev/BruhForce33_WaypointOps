/**
 * Waypoint Offline-First IndexedDB Client
 * Handles local route caching, offline POD queueing, and network resilience
 */

export interface OfflinePodItem {
  id: string; // e.g. "POD-OFFLINE-12345"
  order_id: string;
  driver_name: string;
  recipient_name: string;
  recipient_phone?: string;
  items_received: number;
  condition_confirmed: boolean;
  proof_notes: string;
  signature_svg_or_hash?: string;
  photo_url?: string;
  captured_at: string;
  sync_attempts: number;
  status: "pending" | "synced" | "conflict";
}

export interface CachedManifest {
  vehicle_id: string;
  cached_at: string;
  stops: any[];
  total_stops: number;
}

const DB_NAME = "waypoint_offline_v1";
const DB_VERSION = 1;

class OfflineDatabase {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  private init(): Promise<IDBDatabase | null> {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return Promise.resolve(null);
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        try {
          const request = window.indexedDB.open(DB_NAME, DB_VERSION);

          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains("pod_queue")) {
              db.createObjectStore("pod_queue", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("manifests")) {
              db.createObjectStore("manifests", { keyPath: "vehicle_id" });
            }
            if (!db.objectStoreNames.contains("sync_logs")) {
              db.createObjectStore("sync_logs", { keyPath: "timestamp" });
            }
          };

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => {
            console.warn("IndexedDB open error, using localStorage fallback");
            resolve(null);
          };
        } catch (e) {
          resolve(null);
        }
      });
    }

    return this.dbPromise;
  }

  // --- POD Queue ---
  async queuePod(item: Omit<OfflinePodItem, "id" | "captured_at" | "sync_attempts" | "status">): Promise<OfflinePodItem> {
    const fullItem: OfflinePodItem = {
      ...item,
      id: `POD-OFFLINE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      captured_at: new Date().toISOString(),
      sync_attempts: 0,
      status: "pending",
    };

    const db = await this.init();
    if (db) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction("pod_queue", "readwrite");
        const store = tx.objectStore("pod_queue");
        const req = store.put(fullItem);
        req.onsuccess = () => resolve(fullItem);
        req.onerror = () => reject(req.error);
      });
    } else {
      // LocalStorage fallback
      const queue = this.getLocalStorageQueue();
      queue.push(fullItem);
      this.saveLocalStorageQueue(queue);
      return fullItem;
    }
  }

  async getQueuedPods(): Promise<OfflinePodItem[]> {
    const db = await this.init();
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction("pod_queue", "readonly");
        const store = tx.objectStore("pod_queue");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve(this.getLocalStorageQueue());
      });
    } else {
      return this.getLocalStorageQueue();
    }
  }

  async removeQueuedPod(id: string): Promise<void> {
    const db = await this.init();
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction("pod_queue", "readwrite");
        const store = tx.objectStore("pod_queue");
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } else {
      const queue = this.getLocalStorageQueue().filter((q) => q.id !== id);
      this.saveLocalStorageQueue(queue);
    }
  }

  async clearQueuedPods(): Promise<void> {
    const db = await this.init();
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction("pod_queue", "readwrite");
        const store = tx.objectStore("pod_queue");
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } else {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("waypoint_offline_pods");
      }
    }
  }

  // --- Driver Manifest Caching ---
  async cacheDriverManifest(vehicle_id: string, stops: any[]): Promise<void> {
    const manifest: CachedManifest = {
      vehicle_id,
      cached_at: new Date().toISOString(),
      stops,
      total_stops: stops.length,
    };

    const db = await this.init();
    if (db) {
      const tx = db.transaction("manifests", "readwrite");
      tx.objectStore("manifests").put(manifest);
    } else if (typeof window !== "undefined") {
      window.localStorage.setItem(`waypoint_manifest_${vehicle_id}`, JSON.stringify(manifest));
    }
  }

  async getCachedDriverManifest(vehicle_id: string): Promise<CachedManifest | null> {
    const db = await this.init();
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction("manifests", "readonly");
        const req = tx.objectStore("manifests").get(vehicle_id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } else if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(`waypoint_manifest_${vehicle_id}`);
      return raw ? JSON.parse(raw) : null;
    }
    return null;
  }

  // --- LocalStorage Helpers ---
  private getLocalStorageQueue(): OfflinePodItem[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("waypoint_offline_pods");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalStorageQueue(queue: OfflinePodItem[]) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("waypoint_offline_pods", JSON.stringify(queue));
    } catch (e) {
      console.error("Failed to save to localStorage:", e);
    }
  }
}

export const offlineDb = new OfflineDatabase();
