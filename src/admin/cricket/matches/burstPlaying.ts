import { useSyncExternalStore } from "react";

// Whether a burst is on screen, for the scorer: the next batter / bowler
// picker waits for it to finish rather than opening under it.
let playing = false;
const listeners = new Set<() => void>();
export function setBurstPlaying(on: boolean) {
  if (playing === on) return;
  playing = on;
  listeners.forEach((listener) => listener());
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
// Read live, for an effect running in the same commit the ball arrived in
// (before the hook's value has caught up).
export const isBurstPlaying = () => playing;
export const useBurstPlaying = () => useSyncExternalStore(subscribe, isBurstPlaying);
