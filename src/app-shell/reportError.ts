import { apiClient } from "../api/client";
import { isChunkLoadError } from "./chunkReload";
import { isNativeApp } from "./platform";

// Sends a crash to the API (cricket-client-errors.ts there), so organisers
// see what broke on people's phones (Database page) instead of waiting to
// be told. Best effort: a report that fails to send is dropped.

// Noise that isn't a bug in the app: an old build's chunk (reloaded for
// anyway), a browser extension, a ResizeObserver notice, a lost network.
const IGNORED = /ResizeObserver loop|Script error\.?$|Network Error|timeout of \d+ms exceeded|Load failed|Failed to fetch$|AbortError|canceled/i;

const MAX_PER_PAGE_LOAD = 20;
let sent = 0;
// The same error from the same place once a minute at most.
const lastSent = new Map<string, number>();

export function reportError(error: unknown, where?: string) {
  try {
    const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : JSON.stringify(error));
    const message = `${err.name && err.name !== "Error" ? `${err.name}: ` : ""}${err.message}`.slice(0, 500);
    if (!err.message || IGNORED.test(message) || isChunkLoadError(err)) return;
    if (import.meta.env.DEV) return; // Seen in the console already.
    const key = `${message}|${where ?? ""}`;
    const now = Date.now();
    if (sent >= MAX_PER_PAGE_LOAD || now - (lastSent.get(key) ?? 0) < 60_000) return;
    sent++;
    lastSent.set(key, now);
    void apiClient
      .post("/admin/cricket/client-errors", {
        message,
        stack: err.stack?.slice(0, 4000),
        where: where?.slice(0, 100),
        url: (window.location.pathname + window.location.search).slice(0, 300),
        native: isNativeApp,
      })
      .catch(() => {});
  } catch {
    // Reporting must never be the thing that breaks.
  }
}

// Errors nothing else caught: a failing event handler, a promise nobody
// waited on.
export function reportUncaughtErrors() {
  window.addEventListener("error", (event) => reportError(event.error ?? event.message, "uncaught"));
  window.addEventListener("unhandledrejection", (event) => reportError(event.reason, "promise"));
}
