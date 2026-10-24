import { useEffect, useLayoutEffect, useState } from "react";

const STORAGE_KEY = "crickverse_darkMode";
const DEVICE_DARK = "(prefers-color-scheme: dark)";

// The visitor's own choice from an earlier toggle, or null if they never
// picked one (or went back to the device's).
function storedChoice(): boolean | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    // Storage unavailable (private mode etc.) — fall back to the device's.
  }
  return null;
}

const deviceIsDark = () => typeof window !== "undefined" && window.matchMedia?.(DEVICE_DARK).matches === true;

// Toggles `body.dark-theme`, which the public site's palette (site.css) keys
// off. The device's light / dark setting decides, following it as it
// changes (say at sunset), until the visitor toggles; their choice is then
// remembered and wins. Toggling back to what the device shows forgets it,
// so the theme follows the device again.
export function useDarkTheme() {
  const [choice, setChoice] = useState(storedChoice);
  const [device, setDevice] = useState(deviceIsDark);
  const isDark = choice ?? device;

  useEffect(() => {
    const query = window.matchMedia?.(DEVICE_DARK);
    if (!query) return;
    const onChange = () => setDevice(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Before paint, so a dark visit never flashes the light palette first.
  useLayoutEffect(() => {
    document.body.classList.toggle("dark-theme", isDark);
  }, [isDark]);

  function toggle() {
    const next = !isDark;
    const followDevice = next === device;
    setChoice(followDevice ? null : next);
    try {
      if (followDevice) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Not persisted — the toggle still applies for this visit.
    }
  }

  return { isDark, toggle };
}
