import { Capacitor } from "@capacitor/core";

// Running inside the Android app (Capacitor) rather than a browser. The app
// loads this same build from the phone (https://localhost), so anything
// that relies on the page's own address being app.runmitra.in is switched here.
export const isNativeApp = Capacitor.isNativePlatform();

// The API. The website calls it on its own address (/api, which Vercel and
// the dev server forward); the app has no such forwarding, so it calls the
// API directly. VITE_API_URL points the app at another one (a test server).
export const API_BASE = isNativeApp
  ? import.meta.env.VITE_API_URL || "https://girish-creations-api.vercel.app/api"
  : "/api";

// Where links people share or scan (match pages, team joins, player QR
// codes) should open: the web app, app.runmitra.in (runmitra.in itself is
// the website, which sends old links on here). In a browser that's the
// page's own address, so a test deploy shares its own links.
const SITE_URL = import.meta.env.VITE_SITE_URL || "https://app.runmitra.in";
export const siteOrigin = () => (isNativeApp ? SITE_URL : window.location.origin);

// Uploaded pictures come back as "/api/files/<id>", which the website
// serves on its own address. In the app that address is the phone, so they
// are pointed at the API. Walks the whole response; only in the app.
const FILE_PATH = /^\/api\/files\//;

export function withAbsoluteFileUrls<T>(data: T): T {
  if (!isNativeApp) return data;
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") return FILE_PATH.test(value) ? new URL(value, API_BASE).toString() : value;
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item)]));
    }
    return value;
  };
  return walk(data) as T;
}
