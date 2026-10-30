// RunMitra service worker: makes the app installable and lets it open
// offline. Kept small on purpose:
// - pages (navigations): network first, so a new deploy shows at once;
//   offline, the last copy of the app's page (index.html) is used.
// - the build's hashed files under /assets/: cache first (a new build gets
//   new file names, so a cached one is never out of date).
// - /api/* and everything else: never touched, always the network.
// It also shows match notifications (Web Push) and opens them on a tap.
//
// Bump VERSION to throw away every cache on the next visit.
const VERSION = "v2";
const SHELL_CACHE = `cricdesk-shell-${VERSION}`;
const ASSET_CACHE = `cricdesk-assets-${VERSION}`;
const SHELL_URL = "/";

// A Vite build file: "name-<hash>.ext", e.g. /assets/index-B3x9_aQf.js.
// The hand-placed files in public/assets (bootstrap.min.css, sounds…) have
// no hash, so they keep coming from the network.
const HASHED = /^\/assets\/.+-[\w-]{8,}\.[a-z0-9]+$/i;

// Save the app's page and the scripts/styles it starts with, so the first
// offline open works. Lazily-loaded pages are cached as they're visited.
async function precacheShell() {
  const shell = await caches.open(SHELL_CACHE);
  const response = await fetch(SHELL_URL, { cache: "no-cache" });
  if (!response.ok) return;
  await shell.put(SHELL_URL, response.clone());
  const html = await response.text();
  const files = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]).filter((p) => HASHED.test(p));
  const assets = await caches.open(ASSET_CACHE);
  await Promise.all(files.map((file) => assets.add(file).catch(() => {})));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell().catch(() => {}));
  // The page is network-first, so the new worker can take over at once.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [SHELL_CACHE, ASSET_CACHE];
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("cricdesk-") && !keep.includes(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    // Every app address serves the same index.html: keep the latest copy.
    // (Not a redirect: Safari refuses a cached redirect for a page.)
    if (response.ok && response.type === "basic" && !response.redirected) {
      const shell = await caches.open(SHELL_CACHE);
      await shell.put(SHELL_URL, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(SHELL_URL, { cacheName: SHELL_CACHE });
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request, { cacheName: ASSET_CACHE });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const assets = await caches.open(ASSET_CACHE);
    await assets.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // The API is always live data: never cached.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  } else if (HASHED.test(url.pathname)) {
    event.respondWith(cacheFirstAsset(request));
  }
});

// ===== Match notifications =====
// The server pushes JSON: {title, body, url, tag}. A tag replaces an older
// notification about the same match instead of stacking up.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "RunMitra";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || undefined,
      data: { url: data.url || "/" },
    }),
  );
});

// A tap opens the match: in a RunMitra tab already open (brought to the
// front and sent there), or else in a new window.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || "/";
  // Only ever our own pages.
  const target = new URL(raw, self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin + "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        if (open.url !== url && "navigate" in open) {
          try {
            await open.navigate(url);
          } catch {
            // Not ours to steer (not yet controlled by this worker): open a new one.
            await self.clients.openWindow(url);
          }
        }
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
