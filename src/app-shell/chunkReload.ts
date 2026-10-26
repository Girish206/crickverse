// After a new deploy, an open tab still asks for the old build's code
// chunks, which are gone. The fix is a page reload (it picks up the new
// index.html and its chunks). sessionStorage remembers when we last did
// that, so a chunk that's genuinely broken can't reload the page forever.

const KEY = "cv-chunk-reload-at";
// One automatic reload per minute at most.
const GUARD_MS = 60_000;

const CHUNK_ERROR = /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|unable to preload css/i;

// Is this the "old chunk is gone" error (in any of the browsers' wordings)?
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return CHUNK_ERROR.test(message);
}

// Reloads the page unless we already did so in the last minute. Returns
// whether it's reloading.
export function reloadOnceForNewBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < GUARD_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // No storage (private mode): don't risk a loop.
    return false;
  }
  window.location.reload();
  return true;
}
