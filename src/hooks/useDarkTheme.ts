import { useLayoutEffect, useState } from "react";

const STORAGE_KEY = "crickverse_darkMode";

// The visitor's own choice from an earlier toggle, or null if they never
// picked one.
function storedChoice(): boolean | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    // Storage unavailable (private mode etc.) — fall back to the default.
  }
  return null;
}

// Toggles `body.dark-theme`, which the public site's palette (site.css) keys
// off. A visitor's toggle choice is remembered and always wins; until they
// make one, `defaultDark` decides (dark for the site, light for portfolios
// using the classic design).
export function useDarkTheme(defaultDark = true) {
  const [choice, setChoice] = useState(storedChoice);
  const isDark = choice ?? defaultDark;

  // Before paint, so a dark visit never flashes the light palette first.
  useLayoutEffect(() => {
    document.body.classList.toggle("dark-theme", isDark);
  }, [isDark]);

  function toggle() {
    const next = !isDark;
    setChoice(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Not persisted — the toggle still applies for this visit.
    }
  }

  return { isDark, toggle };
}
