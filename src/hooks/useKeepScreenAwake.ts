import { useEffect } from "react";

// Stops the phone's screen dimming and locking while `active`. The browser
// drops the lock whenever the page is hidden, so it's taken again on coming
// back. In the Android app, navigator.wakeLock is the phone's own
// (nativeShell.ts). Without support, or if refused (say on low battery), the
// screen just sleeps as usual.
export function useKeepScreenAwake(active: boolean) {
  useEffect(() => {
    if (!active || !navigator.wakeLock) return;
    let stopped = false;
    let requesting = false;
    let lock: WakeLockSentinel | null = null;

    const acquire = async () => {
      if (requesting || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      requesting = true;
      try {
        const granted = await navigator.wakeLock.request("screen");
        if (stopped) void granted.release();
        else lock = granted;
      } catch {
        // Refused: nothing to hold.
      }
      requesting = false;
    };

    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release();
    };
  }, [active]);
}
