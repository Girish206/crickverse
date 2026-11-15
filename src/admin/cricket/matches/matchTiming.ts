import type { CricketMatch } from "../../../api/types";

// How long a match was played, given it can be finished and reopened again
// and again: each finish and reopen is logged, and the spells it sat
// finished in between don't count. Also when it may still be reopened.
// Kept apart from matchUtils so it has no browser-only imports.

const REOPEN_WITHIN_MS = 24 * 60 * 60 * 1000;

const lastBallAtOrBefore = (match: CricketMatch, at: number) =>
  Math.max(
    0,
    ...match.innings.flatMap((innings) =>
      innings.balls.map((ball) => (ball.at ? Date.parse(ball.at) : 0)).filter((ballAt) => ballAt <= at),
    ),
  );

// When the match first finished: its first "finished" log line. Older
// matches don't have one, so it's the last ball before the first reopen
// (else when it finished, as editableAfterFinish reads it).
export function originalEndOf(match: CricketMatch): number {
  const events = match.events ?? [];
  const finished = events.find((event) => event.kind === "finished");
  if (finished) return Date.parse(finished.at);
  const reopened = events.find((event) => event.kind === "reopened");
  if (reopened) return lastBallAtOrBefore(match, Date.parse(reopened.at)) || Date.parse(reopened.at);
  const lastBall = lastBallAtOrBefore(match, Infinity);
  return match.completedAt ? Date.parse(match.completedAt) : lastBall;
}

// A finished match can be reopened (any number of times) only within a day
// of when it first ended; the API holds to the same window.
export function reopenableNow(match: CricketMatch, now = Date.now()) {
  if (match.status !== "completed" && match.status !== "abandoned") return false;
  const ended = originalEndOf(match);
  return ended > 0 && now - ended <= REOPEN_WITHIN_MS;
}

// The spells the match sat finished before being reopened, as [from, to]:
// from its "finished" line (older matches: its last ball) to the reopen.
// `innings` keeps only the ones where that innings was the one reopened.
export function closedSpells(match: CricketMatch, innings?: number): [number, number][] {
  const spells: [number, number][] = [];
  let finishedAt: number | null = null;
  for (const event of match.events ?? []) {
    const at = Date.parse(event.at);
    if (event.kind === "finished") finishedAt = at;
    if (event.kind !== "reopened") continue;
    const from = finishedAt ?? lastBallAtOrBefore(match, at);
    finishedAt = null;
    if (!from || from > at) continue;
    if (innings === undefined || event.innings === innings) spells.push([from, at]);
  }
  return spells;
}

// Time actually played between `from` and `to`: the spells it sat closed
// (inside that range) are left out.
export function playedMs(from: number, to: number, spells: [number, number][]) {
  const closed = spells.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(b, to) - Math.max(a, from)), 0);
  return Math.max(0, to - from - closed);
}
