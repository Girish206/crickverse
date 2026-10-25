import { useEffect, useLayoutEffect, useState } from "react";

const STORAGE_KEY = "crickverse_darkMode";
const DEVICE_DARK = "(prefers-color-scheme: dark)";

const deviceIsDark = () => typeof window !== "undefined" && window.matchMedia?.(DEVICE_DARK).matches === true;

// Saved as "<chosen dark>:<device dark when chosen>", e.g. "true:false".
// The older bare "true" / "false" (no device part) is dropped, so those
// visitors follow the device again.
function forgetChoice() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable — nothing saved to forget.
  }
}

// The visitor's own choice from an earlier toggle, or null if they never
// picked one, went back to the device's, or the device has switched theme
// since they picked (that newer setting wins).
function storedChoice(): boolean | null {
  try {
    const [chosen, deviceThen] = (localStorage.getItem(STORAGE_KEY) ?? "").split(":");
    if (deviceThen === undefined) {
      if (chosen) forgetChoice();
      return null;
    }
    if ((deviceThen === "true") !== deviceIsDark()) {
      forgetChoice();
      return null;
    }
    return chosen === "true";
  } catch {
    // Storage unavailable (private mode etc.) — fall back to the device's.
  }
  return null;
}

// Toggles `body.dark-theme`, which the public site's palette (site.css) keys
// off. The device's light / dark setting decides, following it as it
// changes (say at sunset), until the visitor toggles; their choice is then
// remembered and wins, until the device switches theme (then or between
// visits) or they toggle back to what the device shows.
export function useDarkTheme() {
  const [choice, setChoice] = useState(storedChoice);
  const [device, setDevice] = useState(deviceIsDark);
  const isDark = choice ?? device;

  useEffect(() => {
    const query = window.matchMedia?.(DEVICE_DARK);
    if (!query) return;
    // The device switching is newer than any choice, so it takes over.
    const onChange = () => {
      setDevice(query.matches);
      setChoice(null);
      forgetChoice();
    };
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
    if (followDevice) forgetChoice();
    else {
      try {
        localStorage.setItem(STORAGE_KEY, `${next}:${device}`);
      } catch {
        // Not persisted — the toggle still applies for this visit.
      }
    }
  }

  return { isDark, toggle };
}
