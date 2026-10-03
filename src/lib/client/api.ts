"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function api<T = unknown>(
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    method: rest.method ?? (json !== undefined ? "POST" : "GET"),
    headers: {
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (
      res.status === 401 &&
      typeof window !== "undefined" &&
      !url.includes("/auth/")
    )
      window.location.href = "/login";
    throw new ApiError(
      res.status,
      (data as { error?: string }).error ?? res.statusText,
      (data as { details?: unknown }).details,
    );
  }
  return data as T;
}

/** Fetches JSON, optionally polling, and exposes a reload for after mutations. */
export function useApi<T>(url: string | null, pollMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!url);
  const live = useRef(true);
  const reload = useCallback(async () => {
    if (!url) return;
    try {
      const next = await api<T>(url);
      if (live.current) {
        setData(next);
        setError(null);
      }
    } catch (e) {
      if (live.current)
        setError(
          e instanceof ApiError
            ? e
            : new ApiError(0, "You appear to be offline."),
        );
    } finally {
      if (live.current) setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    live.current = true;
    setLoading(!!url);
    reload();
    if (!pollMs) return () => void (live.current = false);
    const t = setInterval(
      () => document.visibilityState === "visible" && reload(),
      pollMs,
    );
    return () => {
      live.current = false;
      clearInterval(t);
    };
  }, [reload, pollMs, url]);
  return { data, error, loading, reload, setData };
}
