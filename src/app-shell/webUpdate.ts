import { sayIfJustUpdated, whenFree } from "./updateTiming";

// The website picks up a new deploy on its next page load (sw.js fetches pages
// network first), but a tab or installed app left open never reloads, so it
// would keep running the old build. While it's open, look at the deployed
// build's version (dist/app-version.json, written by vite.config.ts) and
// reload into a newer one once nobody is mid-task.

// This build's version (vite.config.ts), "1.0.<seconds since 1970>".
declare const __APP_BUILD__: string;

const CHECK_EVERY_MS = 2 * 60_000;
// Moving between pages also checks, at most this often.
const MIN_GAP_MS = 60_000;

const buildNumber = (version: string) => Number(version.split(".").pop()) || 0;

let lastCheck = 0;
let reloading = false;

async function checkForUpdate(force = false) {
  if (reloading || document.visibilityState !== "visible" || !navigator.onLine) return;
  if (!force && Date.now() - lastCheck < MIN_GAP_MS) return;
  lastCheck = Date.now();
  try {
    const response = await fetch("/app-version.json", { cache: "no-store" });
    if (!response.ok) return;
    const { version } = (await response.json()) as { version?: string };
    if (!version || buildNumber(version) <= buildNumber(__APP_BUILD__)) return;
    reloading = true;
    whenFree(() => window.location.reload());
  } catch {
    // Offline or mid-deploy: the next check tries again.
  }
}

export function setupWebUpdates() {
  sayIfJustUpdated();
  lastCheck = Date.now();
  document.addEventListener("visibilitychange", () => void checkForUpdate(true));
  window.addEventListener("online", () => void checkForUpdate(true));
  window.addEventListener("focus", () => void checkForUpdate());
  // Page changes in this single-page app (links and Back).
  window.addEventListener("popstate", () => void checkForUpdate());
  document.addEventListener("click", (e) => {
    if ((e.target as Element | null)?.closest?.("a[href]")) void checkForUpdate();
  });
  window.setInterval(() => void checkForUpdate(true), CHECK_EVERY_MS);
}
