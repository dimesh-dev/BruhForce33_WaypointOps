export const hhmm = (min: number | null | undefined) => {
  if (min === null || min === undefined) return "—";
  const m = Math.round(min);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export const longDate = (iso: string | null | undefined) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      })
    : "—";

export const shortDate = (iso: string | null | undefined) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : "—";

/** Clock time of an instant in Asia/Colombo. */
export const colomboTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Colombo",
      })
    : "—";

export const relative = (iso: string) => {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
};

export const titleCase = (s: string) =>
  s.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());

export const ORDER_STATUS: Record<string, { label: string; kind: string }> = {
  confirmed: { label: "Confirmed", kind: "scheduled" },
  planned: { label: "Scheduled", kind: "scheduled" },
  deferred: { label: "Deferred", kind: "deferred" },
  loaded: { label: "Loaded", kind: "scheduled" },
  in_transit: { label: "On the road", kind: "in-transit" },
  delivered: { label: "Delivered", kind: "delivered" },
  failed: { label: "Not delivered", kind: "deferred" },
  received: { label: "Received", kind: "received" },
  disputed: { label: "Issue reported", kind: "at-risk" },
};

export const TRIP_STATUS: Record<string, { label: string; kind: string }> = {
  planned: { label: "Planned", kind: "scheduled" },
  loading: { label: "Loading", kind: "scheduled" },
  blocked: { label: "Shortfall", kind: "at-risk" },
  ready: { label: "Ready", kind: "delivered" },
  in_transit: { label: "On the road", kind: "in-transit" },
  completed: { label: "Completed", kind: "received" },
};

export const DOCK: Record<string, string> = {
  rear_dock: "Rear dock",
  street: "Kerbside",
  mall_bay: "Mall bay",
};
export const ACCESS: Record<string, string> = {
  normal: "Any vehicle",
  van_only: "Van only",
  mall_dock: "Mall window",
};

export const pct = (n: number, d: number) =>
  d > 0 ? Math.round((n / d) * 100) : 0;

export function downloadCsv(
  name: string,
  rows: (string | number | null | undefined)[][],
) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], {
    type: "text/csv",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
