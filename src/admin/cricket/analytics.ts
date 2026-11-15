import { ballsPerOverOf, type CricketBall, type CricketInnings, type CricketMatch } from "../../api/types";
import { resourceAt } from "./dls";
import {
  ballTotal,
  battingCard,
  chaseInfo,
  inningsSummary,
  isFour,
  isLegal,
  isSix,
  isWicket,
  wicketsToEnd,
} from "./stats";
import { teamKeyOf } from "./teamKey";

// Match analysis worked out from the stored balls, on top of stats.ts: the
// worm, partnerships, win probability, batter-v-bowler match-ups, head to
// head, the pitch map and milestones.

// ===== Worm =====

// One point per legal ball (and the start): the side's total after it, and
// whether a wicket fell since the last point.
export interface WormPoint {
  ball: number;
  runs: number;
  wicket: boolean;
}

export function wormOf(innings: CricketInnings): WormPoint[] {
  const points: WormPoint[] = [{ ball: 0, runs: 0, wicket: false }];
  let runs = 0;
  let legal = 0;
  let wicket = false;
  for (const ball of innings.balls) {
    runs += ballTotal(ball);
    if (isWicket(ball)) wicket = true;
    if (isLegal(ball)) {
      legal += 1;
      points.push({ ball: legal, runs, wicket });
      wicket = false;
    }
  }
  // Runs or a wicket after the last legal ball (a wide, penalty runs).
  const last = points[points.length - 1];
  if (runs !== last.runs || wicket) points.push({ ball: legal, runs, wicket });
  return points;
}

// ===== Partnerships =====

export interface Partnership {
  // 1 = the opening stand.
  wicket: number;
  batters: [number, number];
  runs: number;
  balls: number;
  // Each batter's runs and balls in it (extras are the side's).
  shares: [{ runs: number; balls: number }, { runs: number; balls: number }];
  extras: number;
  // Still going.
  unbroken: boolean;
  // Ended by a batter leaving not out (retired hurt, retired): who left and
  // how. The next stand is then for the same wicket.
  retired: { playerId: number; how: "retired-hurt" | "retired" | "absent-hurt" } | null;
}

// The stands of an innings in order: a new one starts whenever the pair at
// the crease changes (a wicket, or a batter retiring).
export function partnershipsOf(innings: CricketInnings): Partnership[] {
  const stands: Partnership[] = [];
  let current: Partnership | null = null;
  let wickets = 0;
  const pairKey = (a: number, b: number) => [a, b].sort((x, y) => x - y).join("-");
  for (const ball of innings.balls) {
    const key = pairKey(ball.batterId, ball.nonStrikerId);
    if (!current || pairKey(...current.batters) !== key) {
      current = {
        wicket: wickets + 1,
        batters: [ball.batterId, ball.nonStrikerId],
        runs: 0,
        balls: 0,
        shares: [
          { runs: 0, balls: 0 },
          { runs: 0, balls: 0 },
        ],
        extras: 0,
        unbroken: false,
        retired: null,
      };
      stands.push(current);
    }
    current.runs += ballTotal(ball);
    current.extras += ball.extras;
    if (isLegal(ball)) current.balls += 1;
    const slot = ball.batterId === current.batters[0] ? 0 : 1;
    current.shares[slot].runs += ball.runs;
    if (ball.extraType !== "wide" && !ball.noDelivery) current.shares[slot].balls += 1;
    if (isWicket(ball)) wickets += 1;
    else if (ball.dismissedId != null && (ball.wicketType === "retired-hurt" || ball.wicketType === "retired" || ball.wicketType === "absent-hurt"))
      current.retired = { playerId: ball.dismissedId, how: ball.wicketType };
  }
  const last = stands[stands.length - 1];
  if (last && !innings.closed) {
    const atCrease = [innings.strikerId, innings.nonStrikerId];
    last.unbroken = last.batters.every((id) => atCrease.includes(id));
  }
  // A pair that only shared a retirement or an event, with nothing in it.
  return stands.filter((s) => s.balls > 0 || s.runs > 0 || s.unbroken);
}

// ===== Win probability =====

// The standard normal distribution's CDF (Abramowitz and Stegun 26.2.17).
function normalCdf(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

// The chasing side's chance of winning, 0-100, while a limited-overs chase
// is on (null otherwise). Their expected runs from here are the target
// scaled by the Duckworth-Lewis resources they have left (overs and
// wickets) against what they started with — so a side going at par sits at
// about 50% — and the spread of that grows with the runs still to come.
// Wickets scale to the side's size, so box and pair cricket read the same.
export function winProbability(match: CricketMatch): { chasing: number; percent: number } | null {
  if (match.status !== "live" || match.matchType === "test" || match.innings.length !== 2) return null;
  const chase = chaseInfo(match);
  const innings = match.innings[1];
  if (!chase || innings.closed) return null;
  const { wickets } = inningsSummary(innings, ballsPerOverOf(match));
  const toEnd = Math.max(1, wicketsToEnd(match, innings));
  const chasing = innings.battingTeam;
  if (chase.need <= 0) return { chasing, percent: 100 };
  if (wickets >= toEnd || chase.ballsLeft <= 0) return { chasing, percent: 0 };
  const scaledWickets = Math.min(9, Math.round((wickets * 10) / toEnd));
  const startBalls = match.overs * ballsPerOverOf(match);
  const left = resourceAt(chase.ballsLeft, scaledWickets);
  const start = Math.max(1, resourceAt(startBalls, 0));
  const expected = ((chase.target - 1) * left) / start;
  const spread = 2 + 1.6 * Math.sqrt(Math.max(expected, 1));
  const percent = Math.round(normalCdf((expected - chase.need + 0.5) / spread) * 100);
  return { chasing, percent: Math.max(1, Math.min(99, percent)) };
}

// ===== Match-ups =====

export interface Matchup {
  // 0 or 1: the batter's side (index into the match's teams).
  battingTeam: number;
  batterId: number;
  bowlerId: number;
  runs: number;
  balls: number;
  dots: number;
  fours: number;
  sixes: number;
  // The bowler got them out.
  out: boolean;
  // Out, or left, some other way off this bowler's ball ("Run out",
  // "Retired hurt"…), not the bowler's wicket; null if not.
  otherOut: string | null;
}

const OTHER_OUTS: Record<string, string> = {
  "run-out": "Run out",
  "hit-ball-twice": "Hit the ball twice",
  "obstructing-field": "Obstructing the field",
  "retired-out": "Retired out",
  "timed-out": "Timed out",
  "retired-hurt": "Retired hurt",
  retired: "Retired",
  "absent-hurt": "Absent hurt",
};

// Every batter against every bowler they faced in the match, in the order
// they first met (so a batter's bowlers come in the order they bowled to them).
export function matchupsOf(match: CricketMatch): Matchup[] {
  const rows = new Map<string, Matchup>();
  // Run outs and the like, put on their row once every row is counted (the
  // non-striker run out has their own row only if they faced this bowler).
  const others: { key: string; label: string }[] = [];
  for (const innings of match.innings) {
    for (const ball of innings.balls) {
      const other = OTHER_OUTS[ball.wicketType ?? ""];
      if (other && ball.dismissedId != null) others.push({ key: `${ball.dismissedId}:${ball.bowlerId}`, label: other });
      if (ball.noDelivery || ball.extraType === "penalty") continue;
      const key = `${ball.batterId}:${ball.bowlerId}`;
      const row = rows.get(key) ?? { battingTeam: innings.battingTeam, batterId: ball.batterId, bowlerId: ball.bowlerId, runs: 0, balls: 0, dots: 0, fours: 0, sixes: 0, out: false, otherOut: null };
      row.runs += ball.runs;
      if (ball.extraType !== "wide") row.balls += 1;
      if (isLegal(ball) && ball.runs === 0) row.dots += 1;
      if (isFour(ball)) row.fours += 1;
      if (isSix(ball)) row.sixes += 1;
      const bowlerOut = ["bowled", "caught", "caught-behind", "lbw", "stumped", "hit-wicket"].includes(ball.wicketType ?? "");
      if (bowlerOut && ball.dismissedId === ball.batterId) row.out = true;
      rows.set(key, row);
    }
  }
  for (const { key, label } of others) {
    const row = rows.get(key);
    if (row) row.otherOut = label;
  }
  return [...rows.values()].filter((r) => r.balls > 0);
}

// ===== Head to head =====

export interface HeadToHead {
  // Finished meetings, newest first.
  matches: CricketMatch[];
  // Wins for this match's side 0 and side 1, and those with no winner.
  wins: [number, number];
  noResult: number;
}

// Earlier meetings of this match's two sides, among the matches given
// (teamKeyOf decides whether a side is the same team).
export function headToHead(match: CricketMatch, all: CricketMatch[]): HeadToHead {
  const keys = [teamKeyOf(match, 0), teamKeyOf(match, 1)];
  const result: HeadToHead = { matches: [], wins: [0, 0], noResult: 0 };
  for (const other of all) {
    if (other.id === match.id || (other.status !== "completed" && other.status !== "abandoned")) continue;
    const otherKeys = [teamKeyOf(other, 0), teamKeyOf(other, 1)];
    const slotOf = (key: string) => otherKeys.indexOf(key);
    if (slotOf(keys[0]) === -1 || slotOf(keys[1]) === -1) continue;
    result.matches.push(other);
    if (other.winner === null || other.status === "abandoned") result.noResult += 1;
    else result.wins[otherKeys[other.winner] === keys[0] ? 0 : 1] += 1;
  }
  const when = (m: CricketMatch) => new Date(m.completedAt ?? m.scheduledAt ?? 0).getTime();
  result.matches.sort((a, b) => when(b) - when(a));
  return result;
}

// ===== Pitch map =====

export const PITCH_LINES = [
  { value: "wide-off", label: "Wide off" },
  { value: "off", label: "Off" },
  { value: "stumps", label: "Stumps" },
  { value: "leg", label: "Leg" },
] as const;
export const PITCH_LENGTHS = [
  { value: "full-toss", label: "Full toss" },
  { value: "yorker", label: "Yorker" },
  { value: "full", label: "Full" },
  { value: "good", label: "Good" },
  { value: "short", label: "Short" },
] as const;
export type PitchLine = (typeof PITCH_LINES)[number]["value"];
export type PitchLength = (typeof PITCH_LENGTHS)[number]["value"];

export interface PitchCell {
  balls: number;
  runs: number;
  wickets: number;
  dots: number;
}

// Balls marked on the pitch map, by line and length (cells[length][line]).
export function pitchGrid(balls: CricketBall[]) {
  const cells = PITCH_LENGTHS.map(() => PITCH_LINES.map((): PitchCell => ({ balls: 0, runs: 0, wickets: 0, dots: 0 })));
  let marked = 0;
  for (const ball of balls) {
    const row = PITCH_LENGTHS.findIndex((l) => l.value === ball.pitchLength);
    const col = PITCH_LINES.findIndex((l) => l.value === ball.pitchLine);
    if (row === -1 || col === -1) continue;
    const cell = cells[row][col];
    marked += 1;
    cell.balls += 1;
    cell.runs += ballTotal(ball);
    if (isWicket(ball)) cell.wickets += 1;
    if (isLegal(ball) && ballTotal(ball) === 0) cell.dots += 1;
  }
  return { cells, marked };
}

// ===== Milestones =====

export type Milestone =
  | { kind: "fifty" | "hundred"; playerId: number; runs: number; balls: number }
  | { kind: "three-wickets" | "five-wickets"; playerId: number; wickets: number }
  | { kind: "hat-trick"; playerId: number }
  | { kind: "on-a-hat-trick"; playerId: number }
  | { kind: "team"; runs: number };

const BOWLER_OUTS = ["bowled", "caught", "caught-behind", "lbw", "stumped", "hit-wicket"];
const creditsBowler = (ball: CricketBall) => BOWLER_OUTS.includes(ball.wicketType ?? "");

// A bowler's balls that make or break a hat-trick: wides and no-balls that
// took no wicket, and events between balls, are left out.
const hatTrickBalls = (balls: CricketBall[], bowlerId: number) =>
  balls.filter((b) => b.bowlerId === bowlerId && !b.noDelivery && (isWicket(b) || (b.extraType !== "wide" && b.extraType !== "no-ball")));

// What the newest ball of an innings brought up (the server sends the
// biggest of these to followers too: cricket-milestones.ts there).
export function milestonesOf(innings: CricketInnings): Milestone[] {
  const balls = innings.balls;
  const ball = balls[balls.length - 1];
  if (!ball) return [];
  const found: Milestone[] = [];
  if (ball.runs > 0) {
    const row = battingCard(innings).find((r) => r.playerId === ball.batterId);
    if (row) {
      const before = row.runs - ball.runs;
      if (before < 100 && row.runs >= 100) found.push({ kind: "hundred", playerId: row.playerId, runs: row.runs, balls: row.balls });
      else if (before < 50 && row.runs >= 50) found.push({ kind: "fifty", playerId: row.playerId, runs: row.runs, balls: row.balls });
    }
  }
  if (creditsBowler(ball)) {
    const wickets = balls.filter((b) => b.bowlerId === ball.bowlerId && creditsBowler(b)).length;
    if (wickets === 5) found.push({ kind: "five-wickets", playerId: ball.bowlerId, wickets });
    else if (wickets === 3) found.push({ kind: "three-wickets", playerId: ball.bowlerId, wickets });
    const mine = hatTrickBalls(balls, ball.bowlerId);
    const lastThree = mine.slice(-3);
    const lastTwo = mine.slice(-2);
    if (lastThree.length === 3 && lastThree.every(creditsBowler) && !(mine.length >= 4 && creditsBowler(mine[mine.length - 4]))) {
      found.push({ kind: "hat-trick", playerId: ball.bowlerId });
    } else if (lastTwo.length === 2 && lastTwo.every(creditsBowler) && (mine.length < 3 || !creditsBowler(mine[mine.length - 3]))) {
      found.push({ kind: "on-a-hat-trick", playerId: ball.bowlerId });
    }
  }
  // The side's hundreds (100, 200...).
  const total = inningsSummary(innings).runs;
  const before = total - ballTotal(ball);
  if (Math.floor(total / 100) > Math.floor(before / 100) && total >= 100) found.push({ kind: "team", runs: Math.floor(total / 100) * 100 });
  return found;
}
