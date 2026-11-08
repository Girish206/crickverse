import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

// Which screen sits at each step of this tab's history, so a screen spread
// over several history entries (a match: its view, setup and scoring) can
// leave them all at once. The browser won't say what's behind the current
// page, so each one is noted as it opens; kept for the tab, to survive a
// reload.
const KEY = "cv-screen-trail";

// react-router's position in this tab's history.
const position = (): number => window.history.state?.idx ?? 0;

function readTrail(): (string | null)[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function useScreenTrail() {
  const { key, pathname } = useLocation();

  useLayoutEffect(() => {
    const here = position();
    const trail = readTrail().slice(0, here);
    trail[here] = pathname;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(trail));
    } catch {
      // Storage unavailable: leaving falls back to each screen's default.
    }
  }, [key, pathname]);
}

// How far back (a negative number, for navigate()) the nearest screen outside
// `isOwn` is; null when there's none, as on a page opened straight from a link.
export function stepsBackOutOf(isOwn: (pathname: string) => boolean): number | null {
  const trail = readTrail();
  const here = position();
  for (let at = here - 1; at >= 0; at--) {
    const pathname = trail[at];
    if (!pathname) return null;
    if (!isOwn(pathname)) return at - here;
  }
  return null;
}
