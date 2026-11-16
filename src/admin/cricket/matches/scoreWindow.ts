// The pinned score popped out of the browser into its own small window that
// stays on top of every other app (Document Picture-in-Picture: Chrome and
// Edge on desktop). The page renders into it, so it keeps updating while the
// tab that opened it stays open, even in the background.

import { useSyncExternalStore } from "react";
import { setPinnedMatch } from "./pinnedMatch";

type PipApi = {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
};

const pipApi = () => (window as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture;

export const canPopOutScore = () => typeof window !== "undefined" && Boolean(pipApi()) && window.top === window;

let scoreWindow: Window | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export function useScoreWindow() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => scoreWindow,
    () => null,
  );
}

// The window starts as a blank page: give it the app's styles (and theme) so
// the card looks the same. <base> first, so the styles' relative font and
// image URLs still point at the app.
function copyStyles(target: Window) {
  const doc = target.document;
  const base = doc.createElement("base");
  base.href = window.location.origin + "/";
  doc.head.append(base);
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = doc.createElement("style");
      style.textContent = Array.from(sheet.cssRules, (rule) => rule.cssText).join("\n");
      doc.head.append(style);
    } catch {
      // A cross-origin sheet (Google Fonts) can't be read: link it instead.
      if (sheet.href) {
        const link = doc.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        doc.head.append(link);
      }
    }
  }
  for (const attr of ["data-bs-theme", "data-theme", "class"]) {
    const value = document.documentElement.getAttribute(attr);
    if (value !== null) doc.documentElement.setAttribute(attr, value);
  }
  doc.title = "Live score";
  doc.body.classList.add("cv-score-window");
}

// Must run from a click (the browser only opens it on a user gesture).
export async function popOutScore() {
  const api = pipApi();
  if (!api) return false;
  if (scoreWindow) {
    scoreWindow.focus();
    return true;
  }
  const opened = await api.requestWindow({ width: 320, height: 150 });
  copyStyles(opened);
  opened.addEventListener("pagehide", () => {
    if (scoreWindow === opened) {
      scoreWindow = null;
      notify();
    }
  });
  scoreWindow = opened;
  notify();
  return true;
}

// Pins a match (from a click). On desktop Chrome / Edge the score also pops
// out at once: an in-page card can't show over other browser tabs or apps.
// Returns whether it popped out.
export async function pinScore(id: number) {
  setPinnedMatch(id);
  if (!canPopOutScore()) return false;
  try {
    return await popOutScore();
  } catch {
    // Blocked or dismissed: the in-app card still shows.
    return false;
  }
}

export function closeScoreWindow() {
  scoreWindow?.close();
}
