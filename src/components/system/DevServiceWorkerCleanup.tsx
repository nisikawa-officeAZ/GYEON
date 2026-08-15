"use client";

import { useEffect } from "react";

// DEVELOPMENT-ONLY safety net for a stale service worker.
//
// next-pwa disables NEW service-worker registration in development (next.config
// `disable: process.env.NODE_ENV === "development"`), but it does NOT unregister a service worker
// that a PRIOR production/registered session already installed in the browser. A lingering SW keeps
// intercepting navigations and Server Action POSTs with its cached workbox strategies (NetworkFirst /
// StaleWhileRevalidate / CacheFirst), so requests can stop reaching the running dev server. The Wizard
// could then display a cached result (e.g. an estimate number) that was never actually persisted.
//
// This unregisters any lingering SW and clears its caches in DEVELOPMENT ONLY. In production it is a
// no-op, so the intended PWA/offline behaviour is completely unchanged.
export default function DevServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
    if (typeof caches !== "undefined") {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
  }, []);
  return null;
}
