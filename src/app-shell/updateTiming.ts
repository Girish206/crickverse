import { toast } from "sonner";

// When to switch into a new build, shared by the website (webUpdate.ts) and
// the Android app (liveUpdate.ts).

// Set just before switching, so the new build can say it updated.
const UPDATED_KEY = "rm-updated-at";

// Scoring a match: a reload mid-over would interrupt the scorer, so updates
// wait until they leave the screen.
const SCORING = /^\/matches\/[^/]+\/score\/?$/;

// Mid-task: scoring, typing, or a sheet/dialog open (it could hold unsaved
// input). Switching then would lose or interrupt it.
export function isBusy(): boolean {
  if (SCORING.test(window.location.pathname)) return true;
  if (document.activeElement?.matches("input, textarea, select, [contenteditable='true']")) return true;
  return document.querySelector('[aria-modal="true"], .swal2-container') !== null;
}

// Runs `apply` now, or once the person is done: when they leave the scoring
// screen or close the open sheet, or the app goes to the background,
// whichever comes first.
export function whenFree(apply: () => void) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    window.clearInterval(poll);
    document.removeEventListener("visibilitychange", onHidden);
    try {
      localStorage.setItem(UPDATED_KEY, String(Date.now()));
    } catch {
      // Only for the "updated" note.
    }
    apply();
  };
  const onHidden = () => {
    // Backgrounded while scoring: still wait, so coming back to the match
    // doesn't land on a reload.
    if (document.visibilityState === "hidden" && !SCORING.test(window.location.pathname)) run();
  };
  const poll = window.setInterval(() => {
    if (!isBusy()) run();
  }, 2_000);
  document.addEventListener("visibilitychange", onHidden);
  if (!isBusy()) run();
}

// After switching into a new build: a short note that it happened.
export function sayIfJustUpdated() {
  try {
    const at = Number(localStorage.getItem(UPDATED_KEY) || 0);
    if (!at) return;
    localStorage.removeItem(UPDATED_KEY);
    if (Date.now() - at < 60_000) {
      window.setTimeout(() => toast.success("RunMitra updated to the latest version"), 600);
    }
  } catch {
    // No storage: no note.
  }
}
