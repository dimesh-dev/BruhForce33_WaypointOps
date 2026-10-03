"use client";
/**
 * Device-side outbox for driver field events, stored in IndexedDB so records
 * survive refreshes, closed tabs and lost coverage. Every event carries a
 * client_event_id that the server uses for idempotent replay.
 */

export type OutboxKind =
  "trip.depart" | "stop.arrive" | "stop.deliver" | "stop.fail" | "issue.report";

export interface OutboxEvent {
  client_event_id: string;
  kind: OutboxKind;
  recorded_at: string;
  device_id: string;
  payload: Record<string, unknown>;
  attempts: number;
  last_error?: string;
}

const DB = "waypoint-field";
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("outbox"))
        db.createObjectStore("outbox", { keyPath: "client_event_id" });
      if (!db.objectStoreNames.contains("snapshots"))
        db.createObjectStore("snapshots");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? (req.result as T) : undefined);
    t.onerror = () => reject(t.error);
  });
}

export function deviceId(): string {
  try {
    let id = localStorage.getItem("waypoint-device-id");
    if (!id) {
      id = `dev-${crypto.randomUUID().slice(0, 8)}`;
      localStorage.setItem("waypoint-device-id", id);
    }
    return id;
  } catch {
    return "dev-unknown";
  }
}

export async function enqueue(
  kind: OutboxKind,
  payload: Record<string, unknown>,
): Promise<OutboxEvent> {
  const event: OutboxEvent = {
    client_event_id: crypto.randomUUID(),
    kind,
    recorded_at: new Date().toISOString(),
    device_id: deviceId(),
    payload,
    attempts: 0,
  };
  await run("outbox", "readwrite", (s) => s.put(event));
  return event;
}

export async function pending(): Promise<OutboxEvent[]> {
  const all =
    (await run<OutboxEvent[]>("outbox", "readonly", (s) => s.getAll())) ?? [];
  return all.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
}

export async function update(event: OutboxEvent) {
  await run("outbox", "readwrite", (s) => s.put(event));
}

export async function remove(ids: string[]) {
  await run("outbox", "readwrite", (s) => {
    ids.forEach((id) => s.delete(id));
  });
}

export async function saveSnapshot(key: string, value: unknown) {
  await run("snapshots", "readwrite", (s) =>
    s.put({ value, saved_at: new Date().toISOString() }, key),
  );
}

export async function loadSnapshot<T>(
  key: string,
): Promise<{ value: T; saved_at: string } | undefined> {
  return run("snapshots", "readonly", (s) => s.get(key));
}
