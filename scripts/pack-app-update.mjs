// Packs the built website (dist/) as a live update for the Android app:
//   dist/app-update/runmitra-<version>.zip   the app's files
//   dist/app-update/latest.json              { version, url } of that zip
// Deployed with the website, so the app can fetch and switch to it
// (src/app-shell/liveUpdate.ts). Runs after `vite build` (npm run build).
import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const outDir = join(dist, "app-update");
const { version } = JSON.parse(readFileSync(join(dist, "app-version.json"), "utf8"));

// Every file in dist except the update folder itself and the website-only
// service worker, which the app never loads.
const files = {};
const skip = (path) => path.startsWith("app-update/") || path === "sw.js";
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const path = relative(dist, full).split(sep).join("/");
    if (statSync(full).isDirectory()) walk(full);
    else if (!skip(path)) files[path] = readFileSync(full);
  }
})(dist);

const zip = zipSync(files, { level: 9 });
mkdirSync(outDir, { recursive: true });
const zipName = `runmitra-${version}.zip`;
writeFileSync(join(outDir, zipName), zip);
writeFileSync(join(outDir, "latest.json"), JSON.stringify({ version, url: `/app-update/${zipName}` }));
console.log(`App update ${version}: ${Object.keys(files).length} files, ${(zip.length / 1024 / 1024).toFixed(1)} MB`);
