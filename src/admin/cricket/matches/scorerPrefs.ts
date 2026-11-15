import { useSyncExternalStore } from "react";
import type { Lang } from "../i18n";

// Choices kept on this device for scoring and watching: spoken calls,
// vibration on the scoring pad, the pad's language and whether the pitch
// map is asked for. Same pattern as the burst sounds' mute (burstSounds.ts).

export interface ScorerPrefs {
  // Read each ball out loud (scorer or viewer).
  voice: boolean;
  // A short buzz on every pad tap (phones that can).
  haptics: boolean;
  // The pad's and the voice's language.
  lang: Lang;
  // Ask where each delivery pitched.
  pitchMap: boolean;
}

const KEY = "cricdesk_scorer_prefs";
const DEFAULTS: ScorerPrefs = { voice: false, haptics: true, lang: "en", pitchMap: false };

let prefs: ScorerPrefs = (() => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
})();
const listeners = new Set<() => void>();

export function setScorerPref<K extends keyof ScorerPrefs>(key: K, value: ScorerPrefs[K]) {
  prefs = { ...prefs, [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Private mode: lasts for this visit.
  }
  listeners.forEach((fn) => fn());
}

export const getScorerPrefs = () => prefs;

export function useScorerPrefs() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => prefs,
    () => DEFAULTS,
  );
}

// A short buzz, when it's on and the phone can.
export function buzz(ms = 12) {
  if (!prefs.haptics) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not allowed here (an iframe, an old browser): nothing to do.
  }
}
