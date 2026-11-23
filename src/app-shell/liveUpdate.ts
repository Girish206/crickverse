import { App } from "@capacitor/app";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { LATEST_BUILD_EVENT, siteOrigin } from "./platform";
import { sayIfJustUpdated, whenFree } from "./updateTiming";

// Live updates for the Android app. The app carries its own copy of the
// website, so a deploy wouldn't reach it until a new app release. Instead,
// every website build also publishes that copy as a zip, with
// app-update/latest.json naming the newest one (scripts/pack-app-update.mjs).
// The app checks it, downloads a newer copy in the background, and switches
// to it once nobody is mid-task (not while scoring), as the website does. If a
// new copy fails to start, the plugin goes back to the last one that worked.
//
// When to check: on opening, on coming back to the front, and whenever an API
// reply says a newer build is out (the X-App-Build header, see platform.ts).
// No timer: a phone only asks for latest.json when there's something to get.
//
// Only web code changes this way. A change to the app itself (a new plugin,
// Android settings) still needs a new release in the Play Store.

// This build's version (vite.config.ts), "1.0.<seconds since 1970>".
declare const __APP_BUILD__: string;

// An API reply says there's a newer build: check, but not more often than
// this while it's still there (a download that keeps failing would otherwise
// be retried on every reply).
const RETRY_AFTER_MS = 30_000;

// The number that orders builds: the last part of "1.0.<seconds>".
const buildNumber = (version: string) => Number(version.split(".").pop()) || 0;

let checking = false;
let applying = false;
let lastNoticeCheck = 0;

async function checkForUpdate() {
  if (checking || applying || !navigator.onLine) return;
  checking = true;
  try {
    const response = await fetch(`${siteOrigin()}/app-update/latest.json`, { cache: "no-store" });
    if (!response.ok) return;
    const latest = (await response.json()) as { version?: string; url?: string; checksum?: string };
    // The updater won't download without the zip's SHA-256.
    if (!latest.version || !latest.url || !latest.checksum) return;
    // Only ever forward, never back to an older build.
    if (buildNumber(latest.version) <= buildNumber(__APP_BUILD__)) return;

    // Downloaded already (on an earlier check)? Use that copy.
    const { bundles } = await CapacitorUpdater.list();
    let bundle = bundles.find((b) => b.version === latest.version && b.status !== "error");
    if (!bundle) {
      bundle = await CapacitorUpdater.download({
        url: new URL(latest.url, siteOrigin()).toString(),
        version: latest.version,
        checksum: latest.checksum,
      });
    }
    const id = bundle.id;
    // Used on the next start even if it isn't switched to now.
    await CapacitorUpdater.next({ id });
    applying = true;
    whenFree(() => {
      void CapacitorUpdater.set({ id }).catch(() => {
        applying = false;
      });
    });
  } catch {
    // Offline, the server mid-deploy, or a failed download: the next check
    // tries again.
  } finally {
    checking = false;
  }
}

export function setupLiveUpdates() {
  sayIfJustUpdated();
  // This copy started fine; without this the plugin would go back to the
  // previous one.
  void CapacitorUpdater.notifyAppReady().catch(() => {});
  // A test build (npm run android:*:dev, on the dev API) must not swap itself
  // for the live app's build.
  if (import.meta.env.MODE !== "production") return;

  void checkForUpdate();
  void App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) void checkForUpdate();
  });
  window.addEventListener(LATEST_BUILD_EVENT, (event) => {
    const version = (event as CustomEvent<string>).detail;
    if (buildNumber(version) <= buildNumber(__APP_BUILD__)) return;
    if (Date.now() - lastNoticeCheck < RETRY_AFTER_MS) return;
    lastNoticeCheck = Date.now();
    void checkForUpdate();
  });
}
