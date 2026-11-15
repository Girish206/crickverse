import { useMemo, useSyncExternalStore } from "react";
import type { CricketBall, CricketInnings, CricketMatch } from "../../types";
import { ballsPerOverOf } from "../../types";
import type { CricketBallInput } from "./useCricketMatches";

// Scoring with no signal. Balls scored while offline (or while earlier ones
// are still waiting) are kept on this device, in order, and sent one at a
// time once the connection's back. Meanwhile the match page shows them as
// if saved: withQueued() plays them onto the server's copy of the match, by
// the same rules the API scores with (addBall in the API's
// cricket-match.service.ts).
//
// Only what's simple to play out here can wait: a ball with no wicket that
// doesn't end the innings, and the next bowler at the end of an over.
// Anything else (a wicket, a penalty, the innings' last ball, a correction)
// needs the connection. A ball that fails to send while online can be
// anything; it waits too, and the pad stays locked until it's sent (the
// overlay can't play it out).

export type QueuedItem =
  | { kind: "ball"; ball: CricketBallInput; inningsIndex: number; expectedBalls: number }
  | { kind: "bowler"; bowlerId: number; inningsIndex: number; expectedBalls: number };

// ===== Storage =====

const queueKey = (id: number) => `cricdesk_ball_queue_${id}`;
// Before the queue, one ball waited on its own under this key.
const oldPendingKey = (id: number) => `cricdesk_pending_ball_${id}`;

const EMPTY: QueuedItem[] = [];
const cache = new Map<number, QueuedItem[]>();
const listeners = new Map<number, Set<() => void>>();

function load(id: number): QueuedItem[] {
  try {
    const raw = localStorage.getItem(queueKey(id));
    if (raw) return JSON.parse(raw) as QueuedItem[];
    const old = localStorage.getItem(oldPendingKey(id));
    if (old) {
      const pending = JSON.parse(old) as Omit<Extract<QueuedItem, { kind: "ball" }>, "kind">;
      localStorage.removeItem(oldPendingKey(id));
      const items: QueuedItem[] = [{ kind: "ball", ...pending }];
      localStorage.setItem(queueKey(id), JSON.stringify(items));
      return items;
    }
  } catch {
    // Unreadable: nothing waiting.
  }
  return EMPTY;
}

export function readQueue(id: number): QueuedItem[] {
  if (!id) return EMPTY;
  let items = cache.get(id);
  if (!items) {
    items = load(id);
    cache.set(id, items);
  }
  return items;
}

function writeQueue(id: number, items: QueuedItem[]) {
  const next = items.length ? items : EMPTY;
  cache.set(id, next);
  try {
    if (next.length) localStorage.setItem(queueKey(id), JSON.stringify(next));
    else localStorage.removeItem(queueKey(id));
  } catch {
    // Not kept past a reload; still sent from memory.
  }
  listeners.get(id)?.forEach((fn) => fn());
}

export const enqueue = (id: number, item: QueuedItem) => writeQueue(id, [...readQueue(id), item]);
export const clearQueue = (id: number) => writeQueue(id, []);
// Takes back the last thing scored (Undo while balls are waiting).
export const popQueue = (id: number) => writeQueue(id, readQueue(id).slice(0, -1));
// The first item has been saved.
export function dequeue(id: number, item: QueuedItem) {
  const items = readQueue(id);
  if (items[0] === item) writeQueue(id, items.slice(1));
}

function subscribe(id: number, fn: () => void) {
  let set = listeners.get(id);
  if (!set) listeners.set(id, (set = new Set()));
  set.add(fn);
  return () => {
    set.delete(fn);
  };
}

export function useBallQueue(id: number) {
  return useSyncExternalStore(
    (fn) => subscribe(id, fn),
    () => readQueue(id),
    () => EMPTY,
  );
}

// "Retry now", from the scorer's banner, to whatever is sending the queue.
const nudges = new Set<() => void>();
export const nudgeBallQueue = () => nudges.forEach((fn) => fn());
export function onNudge(fn: () => void) {
  nudges.add(fn);
  return () => {
    nudges.delete(fn);
  };
}

// ===== What can wait =====

const isLegal = (ball: Pick<CricketBall, "noDelivery" | "extraType">) =>
  !ball.noDelivery && ball.extraType !== "wide" && ball.extraType !== "no-ball";

// Runs the batters ran: a wide or no-ball's first extra is its penalty, and
// a short run was still run (as the API's runsRun).
const runsRun = (ball: Pick<CricketBall, "runs" | "extras" | "extraType" | "shortRuns">) =>
  ball.runs + ball.extras - (ball.extraType === "wide" || ball.extraType === "no-ball" ? 1 : 0) + (ball.shortRuns ?? 0);

const total = (balls: CricketBall[]) => balls.reduce((sum, ball) => sum + ball.runs + ball.extras, 0);

function liveInnings(match: CricketMatch): CricketInnings | null {
  const innings = match.innings.at(-1);
  if (match.status !== "live" || !innings || innings.closed) return null;
  return innings;
}

// Why this ball can't wait for the connection, or null when it can.
export function whyNotQueued(match: CricketMatch, ball: CricketBallInput): string | null {
  const innings = liveInnings(match);
  if (!innings || match.matchType === "test") return "This needs a connection";
  if (ball.wicketType) return "Wickets need a connection to record";
  if (ball.extraType === "penalty" || ball.noDelivery) return "Penalty runs need a connection";
  if (innings.strikerId === null || innings.nonStrikerId === null || innings.bowlerId === null) {
    return "Pick the players once you're back online";
  }
  const perOver = ballsPerOverOf(match);
  const legalAfter = innings.balls.filter(isLegal).length + (isLegal(ball) ? 1 : 0);
  if (legalAfter >= match.overs * perOver) return "The innings' last ball needs a connection";
  if (match.innings.length === 2 && innings === match.innings[1]) {
    const target = match.revisedTarget ?? total(match.innings[0].balls) + 1;
    if (total(innings.balls) + ball.runs + ball.extras >= target) return "The winning runs need a connection";
  }
  return null;
}

// Whether this bowler can be put on for the next over while offline (the
// pickers already leave out the ones who can't bowl it).
export function canQueueBowler(match: CricketMatch, bowlerId: number) {
  const innings = liveInnings(match);
  if (!innings || match.matchType === "test") return false;
  if (innings.bowlerId !== null || innings.strikerId === null || innings.nonStrikerId === null) return false;
  if (!match.teams[1 - innings.battingTeam].playerIds.includes(bowlerId)) return false;
  const perOver = ballsPerOverOf(match);
  const legal = innings.balls.filter(isLegal);
  const overJustEnded = legal.length > 0 && legal.length % perOver === 0;
  if (!overJustEnded) return false;
  // The API's own checks: no two overs in a row (The Hundred's sets may run
  // on), and no more than the match's limit (each over they took part in).
  if (match.matchType !== "hundred" && legal[legal.length - 1].bowlerId === bowlerId) return false;
  const limit = match.bowlerOverLimit;
  if (limit) {
    const overs = new Set<number>();
    let count = 0;
    for (const ball of innings.balls) {
      if (ball.noDelivery) continue;
      if (ball.bowlerId === bowlerId) overs.add(Math.floor(count / perOver));
      if (isLegal(ball)) count++;
    }
    if (overs.size >= limit) return false;
  }
  return true;
}

// ===== Playing it out =====

// The match with one waiting item played onto it, or null when that can't
// be done here (it waits for the API to say what happens).
function applyItem(match: CricketMatch, item: QueuedItem): CricketMatch | null {
  const index = match.innings.length - 1;
  const innings = match.innings[index];
  if (item.inningsIndex !== index || item.expectedBalls !== innings.balls.length) return null;
  const next = { ...innings, balls: [...innings.balls] };

  if (item.kind === "bowler") {
    if (!canQueueBowler(match, item.bowlerId)) return null;
    next.bowlerId = item.bowlerId;
  } else {
    if (whyNotQueued(match, item.ball)) return null;
    const ball: CricketBall = {
      ...item.ball,
      batterId: innings.strikerId!,
      nonStrikerId: innings.nonStrikerId!,
      bowlerId: innings.bowlerId!,
      wicketType: null,
      dismissedId: null,
      fielderId: null,
      secondFielderId: null,
      noDelivery: null,
      outEnd: null,
      lapseType: null,
      lapseFielderId: null,
      at: new Date().toISOString(),
    };
    next.balls.push(ball);
    // Odd runs run: the batters changed ends.
    if (runsRun(ball) % 2 === 1) [next.strikerId, next.nonStrikerId] = [next.nonStrikerId, next.strikerId];
    // End of the over: ends swap and a new bowler is needed.
    const legalBalls = next.balls.filter(isLegal).length;
    if (isLegal(ball) && legalBalls % ballsPerOverOf(match) === 0) {
      [next.strikerId, next.nonStrikerId] = [next.nonStrikerId, next.strikerId];
      next.bowlerId = null;
    }
  }
  return { ...match, bowlingAt: null, innings: [...match.innings.slice(0, index), next] };
}

// Already in the server's copy: saved, so no longer waiting.
export function isSaved(match: CricketMatch, item: QueuedItem) {
  const index = match.innings.length - 1;
  if (item.inningsIndex < index) return true;
  if (item.inningsIndex > index) return false;
  const count = match.innings[index].balls.length;
  if (item.expectedBalls < count) return true;
  return item.kind === "bowler" && item.expectedBalls === count && match.innings[index].bowlerId !== null;
}

// The match as the scorer sees it: the server's copy with the waiting items
// played on. `blocked`: one couldn't be (the pad waits for it to send).
export function withQueued(match: CricketMatch, items: QueuedItem[]) {
  let shown = match;
  let waiting = 0;
  for (const item of items) {
    if (isSaved(match, item)) continue;
    waiting += 1;
    const next = applyItem(shown, item);
    if (!next) return { match: shown, waiting, blocked: true };
    shown = next;
  }
  return { match: shown, waiting, blocked: false };
}

export function useQueuedMatch(match: CricketMatch | undefined) {
  const items = useBallQueue(match?.id ?? 0);
  return useMemo(() => (match ? withQueued(match, items) : { match, waiting: 0, blocked: false }), [match, items]);
}
