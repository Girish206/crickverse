// The match pinned with "Pin score" (PinnedScore.tsx), remembered on this
// device and kept the same across the app's open tabs.

import { useSyncExternalStore } from "react";

const PIN_KEY = "cv-pinned-match";
const parse = (raw: string | null) => {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
};
let pinned: number | null = (() => {
  try {
    return parse(window.localStorage.getItem(PIN_KEY));
  } catch {
    return null;
  }
})();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

// Pinned or unpinned in another tab of the app: follow it here.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== PIN_KEY && event.key !== null) return;
    const next = parse(event.newValue);
    if (next === pinned) return;
    pinned = next;
    notify();
  });
}

export function setPinnedMatch(id: number | null) {
  pinned = id;
  try {
    if (id === null) window.localStorage.removeItem(PIN_KEY);
    else window.localStorage.setItem(PIN_KEY, String(id));
  } catch {
    // Private mode: the pin lasts for this visit only.
  }
  notify();
}

export function usePinnedMatch() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => pinned,
    () => null,
  );
}
