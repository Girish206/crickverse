import { apiClient } from "../../client";
import type { ApiEnvelope } from "../../types";

// Follows a live match by long polling (the server's cricket-live.ts): one
// ask at a time, carrying the match's updatedAt; the server holds it open
// until the match changes (a new ball arrives within about a second) or
// answers an empty 204 after ~25s, and the next ask goes out at once. So a
// viewer costs one request per ball, or per 25 quiet seconds.
//
// Paused while the tab is hidden. A match never written since updatedAt was
// added has no stamp to wait on: it's asked every few seconds until its next
// change stamps it.

const NO_STAMP_MS = 4_000;
const RETRY_MS = 3_000;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
  });

const visible = (signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const check = () => {
      if (document.hidden && !signal.aborted) return;
      document.removeEventListener("visibilitychange", check);
      resolve();
    };
    document.addEventListener("visibilitychange", check);
    signal.addEventListener("abort", check, { once: true });
  });

export function followLive<T>({
  url,
  ask,
  apply,
}: {
  url: string;
  // What to send: `known` balls and the held match's `since`, or nothing to
  // wait (nothing held yet, or the scorer is mid-save).
  ask: () => { known: string; since: string | null | undefined } | undefined;
  // A changed match: add it onto what's held.
  apply: (data: T) => void;
}) {
  const stop = new AbortController();
  const { signal } = stop;

  void (async () => {
    while (!signal.aborted) {
      if (document.hidden) {
        await visible(signal);
        continue;
      }
      const params = ask();
      if (!params) {
        await sleep(500, signal);
        continue;
      }
      try {
        const { data, status } = await apiClient.get<ApiEnvelope<T>>(url, {
          params: { known: params.known, since: params.since ?? undefined },
          signal,
        });
        if (status !== 204 && !signal.aborted) apply(data.data);
        if (!params.since) await sleep(NO_STAMP_MS, signal);
      } catch {
        // Offline, a deploy, too many asks: try again shortly.
        await sleep(RETRY_MS, signal);
      }
    }
  })();

  return () => stop.abort();
}
