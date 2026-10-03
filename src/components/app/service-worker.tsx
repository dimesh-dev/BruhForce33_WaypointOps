"use client";
import { useEffect } from "react";

/** Registers the service worker that keeps the app shell and last-seen data available offline. */
export function ServiceWorker() {
  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    )
      return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
