import type { CricketBall, CricketInnings, CricketMatch, CricketMatchStage, CricketTournament } from "../../api/types";
import { liveDlsPar } from "./dls";
import { ballsPerOverOf } from "../../api/types";

// Everything shown on scorecards, points tables and leaderboards is derived
// here from the stored balls — the same rules the server scores with
// (portfolio-server src/modules/cricket/cricket.scoring.ts).

export const isLegal = (ball: CricketBall) => !ball.noDelivery && ball.extraType !== "wide" && ball.extraType !== "no-ball";
// Leaving without being out: retired hurt and retired may bat again,
// absent hurt can't bat at all.
const NOT_OUT_EXITS = ["retired-hurt", "retired", "absent-hurt"];
export const isWicket = (ball: CricketBall) => ball.wicketType !== null && !NOT_OUT_EXITS.includes(ball.wicketType);
// Out, or absent hurt: either way they can't bat (again) this innings.
export const cantBat = (ball: CricketBall) => isWicket(ball) || ball.wicketType === "absent-hurt";
// A catch, whoever took it (a caught behind is the keeper's).
export const isCatch = (ball: CricketBall) => ball.wicketType === "caught" || ball.wicketType === "caught-behind";
export const ballTotal = (ball: CricketBall) => ball.runs + ball.extras;
const BOWLER_WICKETS = ["bowled", "caught", "caught-behind", "lbw", "stumped", "hit-wicket"];
const creditsBowler = (ball: CricketBall) => ball.wicketType !== null && BOWLER_WICKETS.includes(ball.wicketType);
// Byes and leg-byes aren't charged to the bowler — nor are those run off a
// no-ball (only its one-run penalty is), nor penalty runs.
const conceded = (ball: CricketBall) =>
  ball.runs +
  (ball.extraType === "wide" ? ball.extras : ball.extraType === "no-ball" ? (ball.byeType ? 1 : ball.extras) : 0);

// A 4 or 6 off the bat that reached the boundary (all-run ones don't count;
// older balls don't say, and count).
export const isFour = (ball: CricketBall) => ball.runs === 4 && ball.boundary !== false;
export const isSix = (ball: CricketBall) => ball.runs === 6 && ball.boundary !== false;

// Overs as "4.3". perOver is the match's balls an over (ballsPerOverOf).
export const oversText = (legalBalls: number, perOver = 6) =>
  `${Math.floor(legalBalls / perOver)}.${legalBalls % perOver}`;

// Runs per over.
export const rate = (runs: number, legalBalls: number, perOver = 6) =>
  legalBalls ? ((runs * perOver) / legalBalls).toFixed(2) : "0.00";

export const strikeRate = (runs: number, balls: number) => (balls ? ((runs * 100) / balls).toFixed(1) : "–");

export function inningsSummary(innings: CricketInnings | undefined, perOver = 6) {
  const balls = innings?.balls ?? [];
  const extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0, total: 0 };
  for (const ball of balls) {
    if (ball.extraType === "wide") extras.wides += ball.extras;
    // Byes run off a no-ball are byes; the no-ball itself is its penalty.
    if (ball.extraType === "no-ball") extras.noBalls += ball.byeType ? 1 : ball.extras;
    if (ball.extraType === "no-ball" && ball.byeType === "bye") extras.byes += ball.extras - 1;
    if (ball.extraType === "no-ball" && ball.byeType === "leg-bye") extras.legByes += ball.extras - 1;
    if (ball.extraType === "bye") extras.byes += ball.extras;
    if (ball.extraType === "leg-bye") extras.legByes += ball.extras;
    if (ball.extraType === "penalty") extras.penalty += ball.extras;
    extras.total += ball.extras;
  }
  const runs = balls.reduce((sum, ball) => sum + ballTotal(ball), 0);
  const wickets = balls.filter(isWicket).length;
  const legalBalls = balls.filter(isLegal).length;
  return { runs, wickets, legalBalls, overs: oversText(legalBalls, perOver), extras };
}

// How one innings' overs divide: the powerplay, then the middle overs, then
// the death overs (the last quarter, at most 10: 16-20 of 20, 41-50 of 50).
// Without a powerplay its overs are 0 and the middle overs start at the first.
// Null for a Test with none, which has no overs to divide.
//
// Overs cut by rain shrink the powerplay in proportion (6 of 20 is 3 of 10),
// but never below what had been bowled at the cut, and one already finished
// stays as it was. A closed innings goes by the overs it was played to, so a
// shortened chase leaves the first innings' overs alone.
export function inningsPlan(match: CricketMatch, index: number) {
  if (!match.powerplayOvers && match.matchType === "test") return null;
  const perOver = ballsPerOverOf(match);
  const innings = match.innings[index];
  const limit = (innings.closed ? innings.oversLimit : null) ?? match.overs;
  let powerplay = match.powerplayOvers ?? 0;
  let overs = match.scheduledOvers ?? match.overs;
  for (const cut of match.interruptions ?? []) {
    // Only what touched this innings; "no more play" cuts nothing to scale by.
    if (cut.innings > index || cut.ballsLeftAfter === 0) continue;
    const cutTo = (cut.balls + cut.ballsLeftAfter) / perOver;
    const bowled = cut.innings === index ? cut.balls : 0;
    if (bowled < powerplay * perOver) {
      powerplay = Math.max(1, Math.ceil(bowled / perOver), Math.round((powerplay * cutTo) / overs));
    }
    overs = cutTo;
  }
  powerplay = Math.min(powerplay, limit);
  const death = Math.min(Math.ceil(limit / 4), 10, limit - powerplay);
  return { limit, powerplay, middleEnd: limit - death };
}

// One innings for its match notes: what each part of its plan (inningsPlan)
// produced, null until a ball is bowled in it, and when the side reached
// each 50.
export function inningsPhases(innings: CricketInnings, perOver = 6, plan: ReturnType<typeof inningsPlan> = null) {
  const powerplayBalls = (plan?.powerplay ?? 0) * perOver;
  const middleBalls = (plan?.middleEnd ?? 0) * perOver;
  // Something after the last ball (penalty runs) belongs to the last over.
  const lastBall = (plan?.limit ?? 0) * perOver - 1;
  const newPhase = () => ({ balls: 0, runs: 0, wickets: 0, legalBalls: 0, extras: 0 });
  const powerplay = newPhase();
  const middle = newPhase();
  const death = newPhase();
  const milestones: { runs: number; overs: string; wickets: number; ballsTaken: number }[] = [];
  let total = 0;
  let legal = 0;
  let wickets = 0;
  let legalAtLast = 0;
  for (const ball of innings.balls) {
    const at = Math.min(legal, lastBall);
    const phase = at < powerplayBalls ? powerplay : at < middleBalls ? middle : death;
    phase.balls += 1;
    phase.runs += ballTotal(ball);
    phase.extras += ball.extras;
    total += ballTotal(ball);
    if (isWicket(ball)) {
      phase.wickets += 1;
      wickets += 1;
    }
    if (isLegal(ball)) {
      phase.legalBalls += 1;
      legal += 1;
    }
    while (total >= (milestones.length + 1) * 50) {
      milestones.push({ runs: (milestones.length + 1) * 50, overs: oversText(legal, perOver), wickets, ballsTaken: legal - legalAtLast });
      legalAtLast = legal;
    }
  }
  const played = (phase: typeof powerplay) => (plan && phase.balls > 0 ? phase : null);
  return { powerplay: played(powerplay), middle: played(middle), death: played(death), milestones };
}

// Whether the next delivery is a free hit: after a no-ball, and still after
// a wide or no-ball bowled on the free hit itself (as the server rules).
export function isFreeHitNext(match: CricketMatch, innings: CricketInnings) {
  if (match.freeHit === false) return false;
  let freeHit = false;
  for (const ball of innings.balls) {
    if (ball.noDelivery) continue;
    if (ball.extraType === "no-ball") {
      freeHit = ball.freeHit !== false;
    } else if (ball.extraType !== "wide") {
      freeHit = false;
    }
  }
  return freeHit;
}

// Wickets that end an innings: all but one of the side, or all of them when
// the last batter bats on alone.
export const wicketsToEnd = (match: CricketMatch, innings: CricketInnings) =>
  match.teams[innings.battingTeam].playerIds.length - (match.lastManStands ? 0 : 1);

export const scoreText = (innings: CricketInnings | undefined) => {
  const summary = inningsSummary(innings);
  return `${summary.runs}/${summary.wickets}`;
};

// Each ball's over number (0-based): legal balls bowled before it, / the
// balls an over.
function overIndexes(balls: CricketBall[], perOver = 6) {
  let legal = 0;
  return balls.map((ball) => {
    const over = Math.floor(legal / perOver);
    if (isLegal(ball)) legal += 1;
    return over;
  });
}

export function oversOf(innings: CricketInnings, perOver = 6) {
  const indexes = overIndexes(innings.balls, perOver);
  const overs: { number: number; bowlerId: number; balls: CricketBall[]; runs: number }[] = [];
  innings.balls.forEach((ball, i) => {
    let over = overs[overs.length - 1];
    if (!over || over.number !== indexes[i]) {
      over = { number: indexes[i], bowlerId: ball.bowlerId, balls: [], runs: 0 };
      overs.push(over);
    }
    over.balls.push(ball);
    over.runs += ballTotal(ball);
  });
  return overs;
}

// Short label for a ball chip: "4", "W", "1wd", "nb", "2lb"…
export function ballLabel(ball: CricketBall) {
  if (ball.extraType === "penalty") return `${ball.extras}pen`;
  if (isWicket(ball)) return "W";
  if (ball.wicketType === "retired-hurt") return "RH";
  if (ball.wicketType === "retired") return "RT";
  if (ball.wicketType === "absent-hurt") return "AH";
  if (ball.extraType === "wide") return ball.extras > 1 ? `${ball.extras - 1}wd` : "wd";
  if (ball.extraType === "no-ball") return ball.runs + ball.extras > 1 ? `${ball.runs + ball.extras - 1}nb` : "nb";
  if (ball.extraType === "bye") return `${ball.extras}b`;
  if (ball.extraType === "leg-bye") return `${ball.extras}lb`;
  return String(ball.runs);
}

// A ball chip's classes, which colour it by what the ball was. An all-run
// four is plain runs; any extra is an extra, whatever was run off it.
export function ballChipClass(ball: CricketBall) {
  const kind = isWicket(ball) ? "is-W" : ball.extraType ? "is-extra" : isFour(ball) ? "is-4" : isSix(ball) ? "is-6" : "is-run";
  return `cricket-ball-chip ${kind}`;
}

export type NameOf = (playerId: number | null) => string;

export function dismissalText(ball: CricketBall, nameOf: NameOf) {
  const bowler = nameOf(ball.bowlerId);
  const fielder = nameOf(ball.fielderId);
  switch (ball.wicketType) {
    case "bowled":
      return `b ${bowler}`;
    case "caught":
      return ball.fielderId === ball.bowlerId ? `c & b ${bowler}` : `c ${fielder} b ${bowler}`;
    case "caught-behind":
      return `c †${fielder} b ${bowler}`;
    case "lbw":
      return `lbw b ${bowler}`;
    case "run-out":
      // Run out at the bowler's end before the ball (a "Mankad").
      if (ball.noDelivery) return `run out (${bowler}) at the non-striker's end`;
      return ball.fielderId
        ? `run out (${fielder}${ball.secondFielderId ? `/${nameOf(ball.secondFielderId)}` : ""})`
        : "run out";
    case "stumped":
      return `st ${fielder} b ${bowler}`;
    case "hit-wicket":
      return `hit wicket b ${bowler}`;
    case "hit-ball-twice":
      return "hit the ball twice";
    case "obstructing-field":
      return "obstructing the field";
    case "retired-out":
      return "retired out";
    case "timed-out":
      return "timed out";
    case "retired-hurt":
      return "retired hurt";
    case "retired":
      return "retired not out";
    case "absent-hurt":
      return "absent hurt";
    default:
      return "";
  }
}

export interface BattingRow {
  playerId: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  // The ball they got out (or retired) on; null = not out.
  outBall: CricketBall | null;
}

// Batters in the order they came in, including the two at the crease.
export function battingCard(innings: CricketInnings): BattingRow[] {
  const order: number[] = [];
  const seen = (playerId: number | null) => {
    if (playerId !== null && !order.includes(playerId)) order.push(playerId);
  };
  for (const ball of innings.balls) {
    seen(ball.batterId);
    seen(ball.nonStrikerId);
  }
  seen(innings.strikerId);
  seen(innings.nonStrikerId);
  return order.map((playerId) => {
    const faced = innings.balls.filter((ball) => ball.batterId === playerId);
    // The last dismissal counts (a retired-hurt batter can come back).
    const outs = innings.balls.filter((ball) => ball.dismissedId === playerId && ball.wicketType);
    const lastOut = outs[outs.length - 1] ?? null;
    const backIn = innings.strikerId === playerId || innings.nonStrikerId === playerId;
    return {
      playerId,
      runs: faced.reduce((sum, ball) => sum + ball.runs, 0),
      balls: faced.filter((ball) => ball.extraType !== "wide" && !ball.noDelivery).length,
      fours: faced.filter(isFour).length,
      sixes: faced.filter(isSix).length,
      outBall: backIn ? null : lastOut,
    };
  });
}

export interface BowlingRow {
  playerId: number;
  legalBalls: number;
  maidens: number;
  runs: number;
  wickets: number;
  // Legal balls nothing was scored off (byes/leg-byes aren't the bowler's).
  dots: number;
  wides: number;
  noBalls: number;
}

export function bowlingCard(innings: CricketInnings, perOver = 6): BowlingRow[] {
  const rows = new Map<number, BowlingRow>();
  for (const ball of innings.balls) {
    // Penalty runs are nobody's.
    if (ball.extraType === "penalty") continue;
    const row = rows.get(ball.bowlerId) ?? {
      playerId: ball.bowlerId,
      legalBalls: 0,
      maidens: 0,
      runs: 0,
      wickets: 0,
      dots: 0,
      wides: 0,
      noBalls: 0,
    };
    if (isLegal(ball)) row.legalBalls += 1;
    if (isLegal(ball) && conceded(ball) === 0) row.dots += 1;
    row.runs += conceded(ball);
    if (creditsBowler(ball)) row.wickets += 1;
    if (ball.extraType === "wide") row.wides += 1;
    if (ball.extraType === "no-ball") row.noBalls += 1;
    rows.set(ball.bowlerId, row);
  }
  for (const over of oversOf(innings, perOver)) {
    if (isMaiden(over, perOver)) rows.get(over.bowlerId)!.maidens += 1;
  }
  return [...rows.values()];
}

// A full over with nothing conceded, bowled start to finish by one bowler
// (an over finished by someone else is no one's maiden).
function isMaiden(over: { bowlerId: number; balls: CricketBall[] }, perOver: number) {
  const bowled = over.balls.filter((ball) => !ball.noDelivery);
  return (
    over.balls.filter(isLegal).length === perOver &&
    bowled.every((ball) => ball.bowlerId === over.bowlerId) &&
    over.balls.every((ball) => conceded(ball) === 0)
  );
}

export function fallOfWickets(innings: CricketInnings, perOver = 6) {
  const result: { wicket: number; score: number; playerId: number; overs: string }[] = [];
  let runs = 0;
  let legal = 0;
  for (const ball of innings.balls) {
    runs += ballTotal(ball);
    if (isLegal(ball)) legal += 1;
    if (isWicket(ball) && ball.dismissedId !== null) {
      result.push({ wicket: result.length + 1, score: runs, playerId: ball.dismissedId, overs: oversText(legal, perOver) });
    }
  }
  return result;
}

// Live chase numbers for the second innings (a rain-revised target when
// one is set).
export function chaseInfo(match: CricketMatch) {
  if (match.innings.length < 2) return null;
  const perOver = ballsPerOverOf(match);
  const firstInnings = inningsSummary(match.innings[0]).runs;
  const target = match.revisedTarget ?? firstInnings + 1;
  const now = inningsSummary(match.innings[1]);
  const ballsLeft = match.overs * perOver - now.legalBalls;
  const need = target - now.runs;
  // The par score if play stopped now, and how far ahead of it they are.
  const par = liveDlsPar(match, firstInnings, now);
  return {
    target,
    revised: match.revisedTarget != null,
    dlsPar: par,
    dlsMargin: par === null ? null : now.runs - par,
    need,
    ballsLeft,
    requiredRate: rate(Math.max(need, 0), ballsLeft, perOver),
  };
}

// A match that got under way: balls were bowled. A walkover, or a match
// abandoned before the toss, isn't a game anyone played in.
export const wasPlayed = (match: CricketMatch) =>
  match.status !== "scheduled" && match.innings.some((innings) => innings.balls.length > 0);

// ===== Aggregates across matches =====

export interface PlayerStats {
  playerId: number;
  matches: number;
  innings: number;
  runs: number;
  ballsFaced: number;
  notOuts: number;
  highest: number;
  highestNotOut: boolean;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  ducks: number;
  bowlingInnings: number;
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  bestWickets: number;
  bestRuns: number;
  threeWickets: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  playerOfMatch: number;
  // Impact points summed over matches (see matchImpact).
  impact: number;
  battingImpact: number;
  bowlingImpact: number;
  fieldingImpact: number;
  // Matches they batted, bowled or fielded a dismissal in.
  impactMatches: number;
}

const emptyStats = (playerId: number): PlayerStats => ({
  playerId,
  matches: 0,
  innings: 0,
  runs: 0,
  ballsFaced: 0,
  notOuts: 0,
  highest: 0,
  highestNotOut: false,
  fours: 0,
  sixes: 0,
  fifties: 0,
  hundreds: 0,
  ducks: 0,
  bowlingInnings: 0,
  ballsBowled: 0,
  runsConceded: 0,
  wickets: 0,
  maidens: 0,
  bestWickets: 0,
  bestRuns: 0,
  threeWickets: 0,
  catches: 0,
  stumpings: 0,
  runOuts: 0,
  playerOfMatch: 0,
  impact: 0,
  battingImpact: 0,
  bowlingImpact: 0,
  fieldingImpact: 0,
  impactMatches: 0,
});

// Per-player totals over every match that has started.
export function playerStats(matches: CricketMatch[]): Map<number, PlayerStats> {
  const stats = new Map<number, PlayerStats>();
  const of = (playerId: number) => {
    let entry = stats.get(playerId);
    if (!entry) {
      entry = emptyStats(playerId);
      stats.set(playerId, entry);
    }
    return entry;
  };
  for (const match of matches) {
    if (!wasPlayed(match)) continue;
    const perOver = ballsPerOverOf(match);
    match.teams.forEach((team) => team.playerIds.forEach((playerId) => (of(playerId).matches += 1)));
    const potm = playerOfMatch(match);
    if (potm !== null) of(potm).playerOfMatch += 1;
    for (const row of matchImpact(match)) {
      if (!tookPart(row)) continue;
      const entry = of(row.playerId);
      entry.impact += row.total;
      entry.battingImpact += row.batting;
      entry.bowlingImpact += row.bowling;
      entry.fieldingImpact += row.fielding;
      entry.impactMatches += 1;
    }
    for (const innings of match.innings) {
      for (const row of battingCard(innings)) {
        const entry = of(row.playerId);
        entry.innings += 1;
        entry.runs += row.runs;
        entry.ballsFaced += row.balls;
        entry.fours += row.fours;
        entry.sixes += row.sixes;
        const notOut = row.outBall === null || !isWicket(row.outBall);
        if (notOut) entry.notOuts += 1;
        if (row.runs >= 100) entry.hundreds += 1;
        else if (row.runs >= 50) entry.fifties += 1;
        if (row.runs === 0 && !notOut) entry.ducks += 1;
        if (entry.innings === 1 || row.runs > entry.highest || (row.runs === entry.highest && notOut)) {
          entry.highest = row.runs;
          entry.highestNotOut = notOut;
        }
      }
      for (const row of bowlingCard(innings, perOver)) {
        const entry = of(row.playerId);
        entry.bowlingInnings += 1;
        entry.ballsBowled += row.legalBalls;
        entry.runsConceded += row.runs;
        entry.wickets += row.wickets;
        entry.maidens += row.maidens;
        if (row.wickets >= 3) entry.threeWickets += 1;
        const better =
          row.wickets > entry.bestWickets || (row.wickets === entry.bestWickets && row.runs < entry.bestRuns);
        if (entry.bowlingInnings === 1 || better) {
          entry.bestWickets = row.wickets;
          entry.bestRuns = row.runs;
        }
      }
      for (const ball of innings.balls) {
        if (ball.fielderId === null) continue;
        if (isCatch(ball)) of(ball.fielderId).catches += 1;
        if (ball.wicketType === "stumped") of(ball.fielderId).stumpings += 1;
        if (ball.wicketType === "run-out") {
          of(ball.fielderId).runOuts += 1;
          if (ball.secondFielderId) of(ball.secondFielderId).runOuts += 1;
        }
      }
    }
  }
  return stats;
}

// Runs per dismissal; never dismissed has no average, shown as "–" like the official scorecards.
export const battingAverage = (s: PlayerStats) =>
  s.innings - s.notOuts > 0 ? (s.runs / (s.innings - s.notOuts)).toFixed(2) : "–";

// Two decimals, as they're stored: match by match they add up to the total.
export const points = (n: number) => (Math.round(n * 100) / 100).toString();

export const impactPerMatch = (s: PlayerStats) => (s.impactMatches ? (s.impact / s.impactMatches).toFixed(1) : "–");

export const bestBowling = (s: PlayerStats) => (s.bowlingInnings ? `${s.bestWickets}/${s.bestRuns}` : "–");

export interface PointsRow {
  teamIndex: number;
  name: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  nrr: number;
  runsFor: number;
  ballsFor: number;
  runsAgainst: number;
  ballsAgainst: number;
}

const KNOCKOUT_STAGES = new Set<CricketMatchStage>([
  "round-of-16",
  "quarter-final",
  "eliminator",
  "qualifier-1",
  "qualifier-2",
  "semi-final",
  "third-place",
  "final",
]);

export const isKnockoutStage = (stage: CricketMatchStage | null) => stage !== null && KNOCKOUT_STAGES.has(stage);

// Knockouts and friendlies don't count towards a points table.
export const countsForTable = (match: CricketMatch) => !isKnockoutStage(match.stage) && match.stage !== "friendly";

// ===== Net run rate =====
// The ICC's rules (playing conditions, "Net Run Rate"): runs scored per
// over faced, less runs conceded per over bowled, over a team's matches.
//  - An all-out side counts as having faced its full quota of overs: the
//    overs it was due in that innings, after any rain cut.
//  - When the chase had a revised target (rain), the side batting first is
//    credited with the target less one, off the overs the chase was given;
//    when rain ended the chase and par decided it, with the par score off
//    the overs the chase had faced.
//  - No results, and matches awarded (walkover, forfeit, conceded), don't
//    count.

export interface NrrSide {
  runs: number;
  balls: number;
  // Why the figures aren't simply the innings as played, if they aren't.
  note: string | null;
}

export interface NrrMatchLine {
  match: CricketMatch;
  // Per side (0 / 1 as in match.teams): what they made and faced.
  sides: [NrrSide, NrrSide];
}

const AWARDED = new Set(["walkover", "forfeit", "concede"]);

// The balls each innings was due: the first innings' after any cut to it,
// the chase's as the match has them now.
function inningsQuota(match: CricketMatch, index: number) {
  const perOver = ballsPerOverOf(match);
  if (index === 1) return match.overs * perOver;
  const cuts = (match.interruptions ?? []).filter((i) => i.innings === 0);
  const last = cuts[cuts.length - 1];
  if (last) return last.balls + last.ballsLeftAfter;
  // Only the chase was cut: the first innings had the overs the match began with.
  return (match.scheduledOvers ?? match.overs) * perOver;
}

// Where the first innings ends up if the current run rate holds. Null until a
// legal ball is bowled, once the innings is over, in a chase (the target says
// more) and in a Test (no overs to run out).
export function projectedScore(match: CricketMatch) {
  const innings = match.innings[0];
  if (match.matchType === "test" || match.innings.length !== 1 || innings.closed) return null;
  const { runs, legalBalls } = inningsSummary(innings, ballsPerOverOf(match));
  if (!legalBalls) return null;
  const ballsLeft = Math.max(inningsQuota(match, 0) - legalBalls, 0);
  return Math.round(runs + (runs / legalBalls) * ballsLeft);
}

// A finished match's part in NRR, or null when it takes no part.
export function nrrLine(match: CricketMatch): NrrMatchLine | null {
  if (match.status !== "completed" || match.innings.length === 0) return null;
  if (match.resultMethod && AWARDED.has(match.resultMethod)) return null;
  const perOver = ballsPerOverOf(match);
  const overs = (balls: number) => oversText(balls, perOver);
  const sides: [NrrSide, NrrSide] = [
    { runs: 0, balls: 0, note: null },
    { runs: 0, balls: 0, note: null },
  ];
  match.innings.forEach((innings, index) => {
    const summary = inningsSummary(innings);
    const quota = inningsQuota(match, index);
    const allOut = summary.wickets >= wicketsToEnd(match, innings);
    const side = sides[innings.battingTeam];
    side.runs = summary.runs;
    side.balls = allOut ? quota : summary.legalBalls;
    if (allOut && summary.legalBalls < quota) side.note = `All out — counted as the full ${overs(quota)} overs`;
  });
  // A revised target: the side batting first is credited with what the
  // chase was set (target less one, i.e. par) off the chase's overs.
  if (match.innings.length === 2 && match.revisedTarget != null) {
    const [first, second] = match.innings;
    const chase = sides[second.battingTeam];
    const lastCut = (match.interruptions ?? []).at(-1);
    const endedByRain = match.resultMethod === "dls" && lastCut?.innings === 1 && lastCut.ballsLeftAfter === 0;
    const credited = sides[first.battingTeam];
    credited.runs = match.revisedTarget - 1;
    credited.balls = endedByRain ? inningsSummary(second).legalBalls : inningsQuota(match, 1);
    credited.note = endedByRain
      ? `Rain ended the chase — credited with the DLS par of ${credited.runs} off the ${overs(credited.balls)} overs faced`
      : `Revised target — credited with ${credited.runs} (target less one) off the chase's ${overs(credited.balls)} overs`;
    if (endedByRain && !chase.note) chase.note = "Innings ended by rain";
  }
  return { match, sides };
}

// Runs per over, from balls.
export const runsPerOver = (runs: number, balls: number) => (balls ? (runs * 6) / balls : 0);

// Win 2, tie / no result 1; NRR as above. Only matches between two of the
// given teams count.
export function standings(teams: { teamIndex: number; name: string }[], matches: CricketMatch[]): PointsRow[] {
  const rows = new Map<number, PointsRow>(
    teams.map(({ teamIndex, name }) => [
      teamIndex,
      {
        teamIndex,
        name,
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        noResult: 0,
        points: 0,
        nrr: 0,
        runsFor: 0,
        ballsFor: 0,
        runsAgainst: 0,
        ballsAgainst: 0,
      },
    ]),
  );
  const runFor = new Map(teams.map(({ teamIndex }) => [teamIndex, { runs: 0, balls: 0, against: 0, ballsAgainst: 0 }]));
  for (const match of matches) {
    if (match.status !== "completed" && match.status !== "abandoned") continue;
    const a = rows.get(match.teams[0].teamIndex);
    const b = rows.get(match.teams[1].teamIndex);
    if (!a || !b) continue;
    a.played += 1;
    b.played += 1;
    if (match.status === "abandoned") {
      a.noResult += 1;
      b.noResult += 1;
      continue;
    }
    if (match.winner === null) {
      a.tied += 1;
      b.tied += 1;
    } else {
      rows.get(match.teams[match.winner].teamIndex)!.won += 1;
      rows.get(match.teams[1 - match.winner].teamIndex)!.lost += 1;
    }
    const line = nrrLine(match);
    if (!line) continue;
    line.sides.forEach((side, slot) => {
      const bat = runFor.get(match.teams[slot].teamIndex)!;
      const bowl = runFor.get(match.teams[1 - slot].teamIndex)!;
      bat.runs += side.runs;
      bat.balls += side.balls;
      bowl.against += side.runs;
      bowl.ballsAgainst += side.balls;
    });
  }
  const result = [...rows.values()];
  result.forEach((row) => {
    row.points = row.won * 2 + row.tied + row.noResult;
    const r = runFor.get(row.teamIndex)!;
    row.runsFor = r.runs;
    row.ballsFor = r.balls;
    row.runsAgainst = r.against;
    row.ballsAgainst = r.ballsAgainst;
    row.nrr = runsPerOver(r.runs, r.balls) - runsPerOver(r.against, r.ballsAgainst);
  });
  // Level on points, net run rate and wins: their results against each other.
  const headToHead = (x: PointsRow, y: PointsRow) => {
    let score = 0;
    for (const match of matches) {
      if (match.status !== "completed" || match.winner === null) continue;
      const sides = match.teams.map((team) => team.teamIndex);
      if (!sides.includes(x.teamIndex) || !sides.includes(y.teamIndex)) continue;
      score += match.teams[match.winner].teamIndex === y.teamIndex ? 1 : -1;
    }
    return score;
  };
  return result.sort((x, y) => y.points - x.points || y.nrr - x.nrr || y.won - x.won || headToHead(x, y));
}

// Every team over the tournament's league / group matches.
export function pointsTable(tournament: CricketTournament, matches: CricketMatch[]): PointsRow[] {
  return standings(
    tournament.teams.map((team, teamIndex) => ({ teamIndex, name: team.name })),
    matches.filter(countsForTable),
  );
}

export interface LeagueTable {
  title: string;
  rows: PointsRow[];
  // How many from the top go through, and whether its places are final.
  qualify?: number;
  settled?: boolean;
}

// The points table, one per group when the league is played in groups.
export function leagueTables(tournament: CricketTournament, matches: CricketMatch[]): LeagueTable[] {
  if (tournament.teams.length < 2) return [];
  const league = matches.filter(countsForTable);
  const groups = [...new Set(league.map((m) => m.group).filter((g): g is string => Boolean(g)))].sort();
  if (groups.length <= 1) return [{ title: "Points table", rows: pointsTable(tournament, matches) }];
  return groups.map((group) => {
    const inGroup = league.filter((m) => m.group === group);
    const teamIndexes = [...new Set(inGroup.flatMap((m) => m.teams.map((t) => t.teamIndex)))];
    return {
      title: `Group ${group}`,
      rows: standings(
        teamIndexes.map((teamIndex) => ({ teamIndex, name: tournament.teams[teamIndex]?.name ?? "Team" })),
        inGroup,
      ),
    };
  });
}

// ===== Team stats =====

export interface TeamStats {
  matches: number;
  won: number;
  lost: number;
  // Batting: the team's own innings.
  innings: number;
  runs: number;
  wicketsLost: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  dotsFaced: number;
  extrasReceived: number;
  highest: number | null;
  lowest: number | null;
  // Bowling and fielding: the opponents' innings.
  wickets: number;
  runsConceded: number;
  ballsBowled: number;
  dotsBowled: number;
  maidens: number;
  wides: number;
  noBalls: number;
  foursConceded: number;
  sixesConceded: number;
  catches: number;
  runOuts: number;
  stumpings: number;
}

// Totals for one team (its index in the tournament) over the given matches:
// what it scored batting and what it gave away / took bowling and fielding.
// A dot is a legal ball with nothing scored off it.
export function teamStats(matches: CricketMatch[], teamIndex: number): TeamStats {
  const t: TeamStats = {
    matches: 0, won: 0, lost: 0,
    innings: 0, runs: 0, wicketsLost: 0, ballsFaced: 0, fours: 0, sixes: 0, dotsFaced: 0, extrasReceived: 0,
    highest: null, lowest: null,
    wickets: 0, runsConceded: 0, ballsBowled: 0, dotsBowled: 0, maidens: 0, wides: 0, noBalls: 0,
    foursConceded: 0, sixesConceded: 0, catches: 0, runOuts: 0, stumpings: 0,
  };
  for (const match of matches) {
    const slot = match.teams.findIndex((team) => team.teamIndex === teamIndex);
    if (slot === -1 || !match.innings.some((innings) => innings.balls.length > 0)) continue;
    t.matches += 1;
    if (match.status === "completed" && match.winner !== null) {
      if (match.winner === slot) t.won += 1;
      else t.lost += 1;
    }
    for (const innings of match.innings) {
      if (innings.balls.length === 0) continue;
      const summary = inningsSummary(innings);
      const dot = (ball: CricketBall) => isLegal(ball) && ballTotal(ball) === 0;
      if (innings.battingTeam === slot) {
        t.innings += 1;
        t.runs += summary.runs;
        t.wicketsLost += summary.wickets;
        t.ballsFaced += summary.legalBalls;
        t.extrasReceived += summary.extras.total;
        for (const ball of innings.balls) {
          if (isFour(ball)) t.fours += 1;
          if (isSix(ball)) t.sixes += 1;
          if (dot(ball)) t.dotsFaced += 1;
        }
        if (innings.closed) {
          t.highest = Math.max(t.highest ?? 0, summary.runs);
          t.lowest = Math.min(t.lowest ?? Infinity, summary.runs);
        }
      } else {
        t.wickets += summary.wickets;
        t.runsConceded += summary.runs;
        t.ballsBowled += summary.legalBalls;
        t.wides += summary.extras.wides;
        t.noBalls += summary.extras.noBalls;
        for (const ball of innings.balls) {
          if (isFour(ball)) t.foursConceded += 1;
          if (isSix(ball)) t.sixesConceded += 1;
          if (dot(ball)) t.dotsBowled += 1;
          if (isCatch(ball)) t.catches += 1;
          if (ball.wicketType === "run-out") t.runOuts += 1;
          if (ball.wicketType === "stumped") t.stumpings += 1;
        }
        for (const over of oversOf(innings, ballsPerOverOf(match))) {
          if (isMaiden(over, ballsPerOverOf(match))) t.maidens += 1;
        }
      }
    }
  }
  return t;
}

export interface InningsTotal {
  teamName: string;
  runs: number;
  wickets: number;
  overs: string;
}

export interface TournamentStats {
  matches: number;
  completed: number;
  wonBattingFirst: number;
  wonChasing: number;
  tiedOrNoResult: number;
  runs: number;
  balls: number;
  wickets: number;
  fours: number;
  sixes: number;
  dots: number;
  extras: number;
  wides: number;
  noBalls: number;
  maidens: number;
  bowled: number;
  caught: number;
  lbw: number;
  runOuts: number;
  stumpings: number;
  fifties: number;
  hundreds: number;
  ducks: number;
  highest: InningsTotal | null;
  lowest: InningsTotal | null;
  firstInningsRuns: number;
  firstInnings: number;
}

// Totals over every scored match of a tournament. Highest / lowest totals and
// the average first-innings score only count finished innings.
export function tournamentStats(matches: CricketMatch[]): TournamentStats {
  const t: TournamentStats = {
    matches: 0, completed: 0, wonBattingFirst: 0, wonChasing: 0, tiedOrNoResult: 0,
    runs: 0, balls: 0, wickets: 0, fours: 0, sixes: 0, dots: 0, extras: 0, wides: 0, noBalls: 0, maidens: 0,
    bowled: 0, caught: 0, lbw: 0, runOuts: 0, stumpings: 0, fifties: 0, hundreds: 0, ducks: 0,
    highest: null, lowest: null, firstInningsRuns: 0, firstInnings: 0,
  };
  for (const match of matches) {
    if (!match.innings.some((innings) => innings.balls.length > 0)) continue;
    t.matches += 1;
    if (match.status === "completed" || match.status === "abandoned") {
      t.completed += 1;
      const first = match.innings[0]?.battingTeam;
      if (match.status === "abandoned" || match.winner === null) t.tiedOrNoResult += 1;
      else if (match.winner === first) t.wonBattingFirst += 1;
      else t.wonChasing += 1;
    }
    match.innings.forEach((innings, index) => {
      if (innings.balls.length === 0) return;
      const summary = inningsSummary(innings);
      t.runs += summary.runs;
      t.balls += summary.legalBalls;
      t.wickets += summary.wickets;
      t.extras += summary.extras.total;
      t.wides += summary.extras.wides;
      t.noBalls += summary.extras.noBalls;
      for (const ball of innings.balls) {
        if (isFour(ball)) t.fours += 1;
        if (isSix(ball)) t.sixes += 1;
        if (isLegal(ball) && ballTotal(ball) === 0) t.dots += 1;
        if (ball.wicketType === "bowled") t.bowled += 1;
        if (isCatch(ball)) t.caught += 1;
        if (ball.wicketType === "lbw") t.lbw += 1;
        if (ball.wicketType === "run-out") t.runOuts += 1;
        if (ball.wicketType === "stumped") t.stumpings += 1;
      }
      for (const row of battingCard(innings)) {
        if (row.runs >= 100) t.hundreds += 1;
        else if (row.runs >= 50) t.fifties += 1;
        if (row.runs === 0 && row.outBall !== null && isWicket(row.outBall)) t.ducks += 1;
      }
      for (const row of bowlingCard(innings)) t.maidens += row.maidens;
      if (!innings.closed) return;
      const total = {
        teamName: match.teams[innings.battingTeam].name,
        runs: summary.runs,
        wickets: summary.wickets,
        overs: summary.overs,
      };
      if (!t.highest || total.runs > t.highest.runs) t.highest = total;
      if (!t.lowest || total.runs < t.lowest.runs) t.lowest = total;
      if (index === 0) {
        t.firstInningsRuns += summary.runs;
        t.firstInnings += 1;
      }
    });
  }
  return t;
}

// ===== MVP points =====
// The MVP method: every run counts, and a wicket is worth more
// in a longer match and for a higher batter. Instead of pace bonuses, batters
// and bowlers gain or lose points for the runs they make or give away against
// par (the match's rate). Weighting each ball's points by its Pressure Index,
// is turned off for now: see the commented code
// below and in matchImpact to bring it back.
// Player of the match (unless the organiser picks one), best batter / bowler
// and the MVP tables come from these; best fielder goes by points and
// dismissals (see matchAwards).
export const MVP_POINTS = {
  runsPerPoint: 10,
  // On top of the runs, for hitting the boundary (all-run ones don't count).
  fourBonus: 0.1,
  sixBonus: 0.2,
  // On top of the bowler's full points for a catch or stumping.
  fielderShare: 0.2,
  // On top of the catch's own points, when the scorer marks it as excellent.
  excellentCatchBonus: 0.3,
  // Taken off the fielder's points.
  droppedCatchPenalty: 0.3,
  misfieldPenalty: 0.1,
  // Best haul in an innings, biggest first.
  hauls: [
    { wickets: 10, points: 1.5 },
    { wickets: 5, points: 1 },
    { wickets: 3, points: 0.5 },
  ],
} as const;

// By the match's overs per side: `upTo` is the longest match each row covers.
export const MVP_WICKET_VALUES = [
  { upTo: 7, runsPerWicket: 12, maidensPerWicket: 1 },
  { upTo: 12, runsPerWicket: 14, maidensPerWicket: 2 },
  { upTo: 16, runsPerWicket: 16, maidensPerWicket: 2 },
  { upTo: 20, runsPerWicket: 18, maidensPerWicket: 2 },
  { upTo: 26, runsPerWicket: 20, maidensPerWicket: 2 },
  { upTo: 35, runsPerWicket: 22, maidensPerWicket: 3 },
  { upTo: 40, runsPerWicket: 22, maidensPerWicket: 3 },
  { upTo: 50, runsPerWicket: 25, maidensPerWicket: 3 },
  { upTo: Infinity, runsPerWicket: 27, maidensPerWicket: 6 },
];

type MvpMatchLength = Pick<CricketMatch, "matchType" | "overs"> & { scheduledOvers?: number | null };

export function mvpRules(match: MvpMatchLength) {
  if (match.matchType === "test") return { runsPerWicket: 25, maidensPerWicket: 6, paceWeight: 0.125 };
  // A rain-cut match keeps the value of the match it set out to be.
  const overs = match.scheduledOvers ?? match.overs;
  const { runsPerWicket, maidensPerWicket } = MVP_WICKET_VALUES.find((row) => overs <= row.upTo)!;
  // How much a run above or below par counts: pace matters less in longer games.
  const paceWeight = overs <= 20 ? 0.5 : overs <= 35 ? 0.375 : overs <= 50 ? 0.25 : 0.125;
  return { runsPerWicket, maidensPerWicket, paceWeight };
}

// Pressure Index: turned off for now, kept here to bring back (see matchImpact).
// // A competitive scoring rate for the match's length, in runs a ball. Sets the
// // score a side batting first is measured against (T20: 162).
// const competitiveRate = (overs: number) =>
//   overs <= 7 ? 1.7 : overs <= 12 ? 1.55 : overs <= 20 ? 1.35 : overs <= 35 ? 1.1 : overs <= 50 ? 0.95 : 0.6;
// 
// // How hard the moment is for the batting side, 0 (calm) to 100 (extreme), from
// // the runs still needed against par for the balls left, and the wickets gone.
// // Tuned to these T20 examples: 35 from 15 with 4 wickets left
// // is 68, 20 from 9 is 52, and 20 from 8 with 3 left is 81.
// function pressureIndex(
//   match: CricketMatch,
//   { needed, ballsLeft, quota, wickets, wicketsToLose }: { needed: number; ballsLeft: number; quota: number; wickets: number; wicketsToLose: number },
// ) {
//   const wicketsStress = 230 * (wickets / Math.max(1, wicketsToLose)) ** 4;
//   // A Test has time on its side, so only the wickets press.
//   if (match.matchType === "test") return Math.min(100, 2 + wicketsStress);
//   const rate = competitiveRate(match.scheduledOvers ?? match.overs);
//   // Runs over par count for more with fewer balls left to find them.
//   const scale = 0.1 * rate * quota * (1 + ballsLeft / quota);
//   const runsOverPar = (needed - ballsLeft * rate) / scale;
//   return Math.max(0, Math.min(100, 2 + 44 * runsOverPar + wicketsStress));
// }
// 
// // The Pressure Index before each ball of an innings.
// export function inningsPressure(match: CricketMatch, innings: CricketInnings) {
//   const index = match.innings.indexOf(innings);
//   const perOver = ballsPerOverOf(match);
//   // Past the first two (or in a Test), a super over: one over a side.
//   const superOver = match.matchType !== "test" && index >= 2;
//   const quota = superOver ? perOver : Math.max(1, inningsQuota(match, index));
//   const chasing = match.matchType !== "test" && index % 2 === 1;
//   const before = match.innings[index - 1];
//   const target = !chasing
//     ? competitiveRate(match.scheduledOvers ?? match.overs) * quota
//     : index === 1
//       ? (match.revisedTarget ?? inningsSummary(before, perOver).runs + 1)
//       : inningsSummary(before, perOver).runs + 1;
//   const wicketsToLose = superOver ? 2 : wicketsToEnd(match, innings);
//   let runs = 0;
//   let legal = 0;
//   let wickets = 0;
//   return innings.balls.map((ball) => {
//     const pressure = pressureIndex(match, {
//       needed: target - runs,
//       ballsLeft: Math.max(0, quota - legal),
//       quota,
//       wickets,
//       wicketsToLose,
//     });
//     runs += ballTotal(ball);
//     if (isLegal(ball)) legal += 1;
//     if (isWicket(ball)) wickets += 1;
//     return pressure;
//   });
// }
// 
// // What a ball's points are multiplied by: 0.6 when calm up to 1.5 at extreme.
// export const pressureWeight = (pressure: number) => 0.6 + (0.9 * pressure) / 100;


// Points for dismissing the batter at `position` (1 = opener).
export function wicketPoints(rules: ReturnType<typeof mvpRules>, position = 1) {
  const strength = position <= 4 ? 1 : position <= 8 ? 0.8 : 0.6;
  return (rules.runsPerWicket * strength) / MVP_POINTS.runsPerPoint;
}

// One source of a player's points in a match.
export interface MvpSource {
  group: "batting" | "bowling" | "fielding";
  kind:
    | "runs"
    | "fours"
    | "sixes"
    | "par"
    | "wickets"
    | "hauls"
    | "maidens"
    | "catches"
    | "excellentCatches"
    | "stumpings"
    | "runOuts"
    | "droppedCatches"
    | "misfields"
    | "floor";
  // How many: runs, wickets, maidens… For "par", runs above (or below) par.
  count: number;
  // Points before pressure, and with it.
  base: number;
  points: number;
}

export interface ImpactRow {
  playerId: number;
  // 0 or 1: the player's side in this match.
  team: number;
  batting: number;
  bowling: number;
  fielding: number;
  total: number;
  sources: MvpSource[];
  bat: { runs: number; balls: number; fours: number; sixes: number; out: boolean } | null;
  bowl: { wickets: number; runs: number; legalBalls: number; maidens: number; dots: number } | null;
  catches: number;
  stumpings: number;
  runOuts: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round1Count = (n: number) => Math.round(n * 10) / 10;

// Runs a ball across the whole match so far. Separate rates because extras
// like byes are nobody's: off the bat for batters, charged for bowlers.
function matchRates(match: CricketMatch, perOver: number) {
  let batRuns = 0;
  let batBalls = 0;
  let bowlRuns = 0;
  let bowlBalls = 0;
  for (const innings of match.innings) {
    for (const card of battingCard(innings)) {
      batRuns += card.runs;
      batBalls += card.balls;
    }
    for (const card of bowlingCard(innings, perOver)) {
      bowlRuns += card.runs;
      bowlBalls += card.legalBalls;
    }
  }
  return { batting: batBalls > 0 ? batRuns / batBalls : 0, bowling: bowlBalls > 0 ? bowlRuns / bowlBalls : 0 };
}

// Every player's MVP points in a match. A finished match keeps the points it
// was locked with, however the rules have changed since (see buildMvpLock).
export function matchImpact(match: CricketMatch): ImpactRow[] {
  return match.mvpLock?.rows ?? calculateMatchImpact(match);
}

function calculateMatchImpact(match: CricketMatch): ImpactRow[] {
  const rules = mvpRules(match);
  const perOver = ballsPerOverOf(match);
  const rates = matchRates(match, perOver);
  const rows = new Map<number, ImpactRow>();
  const of = (playerId: number) => {
    let row = rows.get(playerId);
    if (!row) {
      row = {
        playerId,
        team: Math.max(0, match.teams.findIndex((team) => team.playerIds.includes(playerId))),
        batting: 0,
        bowling: 0,
        fielding: 0,
        total: 0,
        sources: [],
        bat: null,
        bowl: null,
        catches: 0,
        stumpings: 0,
        runOuts: 0,
      };
      rows.set(playerId, row);
    }
    return row;
  };
  match.teams.forEach((team) => team.playerIds.forEach(of));
  // Every point goes through here, so a player's sources always add up to their total.
  const credit = (playerId: number, group: MvpSource["group"], kind: MvpSource["kind"], count: number, base: number, weight = 1) => {
    const row = of(playerId);
    row[group] += base * weight;
    let source = row.sources.find((s) => s.group === group && s.kind === kind);
    if (!source) {
      source = { group, kind, count: 0, base: 0, points: 0 };
      row.sources.push(source);
    }
    source.count += count;
    source.base += base;
    source.points += base * weight;
  };

  for (const innings of match.innings) {
    const battingOrder = battingCard(innings);

    for (const card of battingOrder) {
      const row = of(card.playerId);
      const out = card.outBall !== null && isWicket(card.outBall);
      const bat = row.bat ?? { runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
      row.bat = {
        runs: bat.runs + card.runs,
        balls: bat.balls + card.balls,
        fours: bat.fours + card.fours,
        sixes: bat.sixes + card.sixes,
        out: out || bat.out,
      };
    }

    for (const card of bowlingCard(innings, perOver)) {
      const row = of(card.playerId);
      const haul = MVP_POINTS.hauls.find((tier) => card.wickets >= tier.wickets)?.points ?? 0;
      const maidenBonus = (card.maidens * wicketPoints(rules)) / rules.maidensPerWicket;
      if (haul) credit(card.playerId, "bowling", "hauls", 1, haul);
      if (card.maidens) credit(card.playerId, "bowling", "maidens", card.maidens, maidenBonus);
      const bowl = row.bowl ?? { wickets: 0, runs: 0, legalBalls: 0, maidens: 0, dots: 0 };
      row.bowl = {
        wickets: bowl.wickets + card.wickets,
        runs: bowl.runs + card.runs,
        legalBalls: bowl.legalBalls + card.legalBalls,
        maidens: bowl.maidens + card.maidens,
        dots: bowl.dots + card.dots,
      };
    }

    // Pressure is turned off for now. To bring it back, use these three lines
    // in place of the two below them.
    // const pressures = inningsPressure(match, innings);
    // for (const [i, ball] of innings.balls.entries()) {
    //   const weight = pressureWeight(pressures[i]);
    for (const ball of innings.balls) {
      const weight = 1;
      // Penalty runs are nobody's.
      if (ball.extraType !== "penalty") {
        const faced = ball.extraType !== "wide" && !ball.noDelivery;
        const aboveParRuns = ball.runs - (faced ? rates.batting : 0);
        const savedRuns = (isLegal(ball) ? rates.bowling : 0) - conceded(ball);
        credit(ball.batterId, "batting", "runs", ball.runs, ball.runs / MVP_POINTS.runsPerPoint, weight);
        if (isFour(ball)) credit(ball.batterId, "batting", "fours", 1, MVP_POINTS.fourBonus, weight);
        if (isSix(ball)) credit(ball.batterId, "batting", "sixes", 1, MVP_POINTS.sixBonus, weight);
        credit(ball.batterId, "batting", "par", aboveParRuns, (aboveParRuns * rules.paceWeight) / MVP_POINTS.runsPerPoint, weight);
        credit(ball.bowlerId, "bowling", "par", savedRuns, (savedRuns * rules.paceWeight) / MVP_POINTS.runsPerPoint, weight);
      }

      const dismissed = ball.dismissedId ?? ball.batterId;
      const position = battingOrder.findIndex((card) => card.playerId === dismissed) + 1;
      const value = wicketPoints(rules, position);
      const mankad = ball.wicketType === "run-out" && ball.noDelivery;
      if (creditsBowler(ball) || mankad) credit(ball.bowlerId, "bowling", "wickets", 1, value, weight);

      if (ball.lapseFielderId != null) {
        const dropped = ball.lapseType === "dropped-catch";
        credit(
          ball.lapseFielderId,
          "fielding",
          dropped ? "droppedCatches" : "misfields",
          1,
          -(dropped ? MVP_POINTS.droppedCatchPenalty : MVP_POINTS.misfieldPenalty),
          weight,
        );
      }

      if (ball.fielderId === null) continue;
      const fielder = of(ball.fielderId);
      if (isCatch(ball)) {
        fielder.catches += 1;
        credit(ball.fielderId, "fielding", "catches", 1, value * MVP_POINTS.fielderShare, weight);
        if (ball.excellentCatch) credit(ball.fielderId, "fielding", "excellentCatches", 1, MVP_POINTS.excellentCatchBonus, weight);
      } else if (ball.wicketType === "stumped") {
        fielder.stumpings += 1;
        credit(ball.fielderId, "fielding", "stumpings", 1, value * MVP_POINTS.fielderShare, weight);
      } else if (ball.wicketType === "run-out") {
        fielder.runOuts += 1;
        if (ball.secondFielderId) {
          // Two fielders split the wicket.
          of(ball.secondFielderId).runOuts += 1;
          credit(ball.secondFielderId, "fielding", "runOuts", 1, value / 2, weight);
          credit(ball.fielderId, "fielding", "runOuts", 1, value / 2, weight);
        } else if (!mankad) {
          credit(ball.fielderId, "fielding", "runOuts", 1, value, weight);
        }
      }
    }
  }

  for (const row of rows.values()) {
    // A poor day with the bat or ball can't cancel out the rest of a match.
    if (row.batting < 0) credit(row.playerId, "batting", "floor", 0, -row.batting);
    if (row.bowling < 0) credit(row.playerId, "bowling", "floor", 0, -row.bowling);
    row.batting = round2(row.batting);
    row.bowling = round2(row.bowling);
    row.fielding = round2(row.fielding);
    row.sources = row.sources
      .map((source) => ({ ...source, count: round1Count(source.count), base: round2(source.base), points: round2(source.points) }))
      .filter((source) => source.points !== 0);
    // Rounding each one can leave them a point or two of a hundredth off their
    // group's total: the biggest takes up the difference, so they add up.
    for (const group of ["batting", "bowling", "fielding"] as const) {
      const sources = row.sources.filter((source) => source.group === group);
      const gap = round2(row[group] - sources.reduce((sum, source) => sum + source.points, 0));
      if (gap === 0 || sources.length === 0) continue;
      const biggest = sources.reduce((top, source) => (Math.abs(source.points) > Math.abs(top.points) ? source : top));
      biggest.points = round2(biggest.points + gap);
    }
    row.total = round2(row.batting + row.bowling + row.fielding);
  }
  // Best first; level on points goes to the winning side, then more runs
  // and wickets.
  const contribution = (row: ImpactRow) => (row.bat?.runs ?? 0) + (row.bowl?.wickets ?? 0) * 20;
  return [...rows.values()].sort(
    (a, b) =>
      b.total - a.total ||
      Number(b.team === match.winner) - Number(a.team === match.winner) ||
      contribution(b) - contribution(a),
  );
}

// Did anything in the match (batted, bowled or had a hand in a dismissal)?
export const tookPart = (row: ImpactRow) =>
  row.bat !== null || row.bowl !== null || row.catches + row.stumpings + row.runOuts > 0 || row.fielding !== 0;

const dismissalsBy = (row: ImpactRow) => row.catches + row.stumpings + row.runOuts;

export interface MatchAwards {
  rows: ImpactRow[];
  playerOfMatch: ImpactRow | null;
  // True when it's the top impact score rather than the admin's pick.
  autoPicked: boolean;
  // The losing side's best, if in the top three and not player of the match.
  fighterOfMatch: ImpactRow | null;
  bestBatter: ImpactRow | null;
  bestBowler: ImpactRow | null;
  bestFielder: ImpactRow | null;
}

// Highest `score`, then highest `tie`.
function topBy(rows: ImpactRow[], score: (row: ImpactRow) => number, tie: (row: ImpactRow) => number) {
  let best: ImpactRow | null = null;
  for (const row of rows) {
    if (!best || score(row) > score(best) || (score(row) === score(best) && tie(row) > tie(best))) best = row;
  }
  return best;
}

// Automatic Player of the Match: the winning side's best if they're in the top
// three on MVP points, else the top scorer overall, whichever side they're on.
export function autoPlayerOfMatch(match: CricketMatch, rows?: ImpactRow[]): ImpactRow | null {
  if (match.status !== "completed") return null;
  const list = (rows ?? matchImpact(match)).filter(tookPart);
  if (match.mvpLock) return list.find((row) => row.playerId === match.mvpLock!.autoPlayerOfMatchId) ?? null;
  if (match.winner !== null) {
    const winning = list.slice(0, 3).find((row) => row.team === match.winner);
    if (winning) return winning;
  }
  return list[0] ?? null;
}

// Who the award rules pick from a match's players (before any organiser's pick
// of player of the match).
function awardWinners(match: CricketMatch, rows: ImpactRow[]) {
  return {
    // The losing side's best in the top three: fighter of the match, unless
    // they're also player of the match.
    fighter:
      match.status === "completed" && match.winner !== null
        ? (rows.slice(0, 3).find((row) => row.team !== match.winner) ?? null)
        : null,
    // Most batting points (more runs break a tie); most bowling points (more
    // wickets break a tie).
    bestBatter: topBy(
      rows.filter((row) => row.bat && row.bat.runs > 0),
      (row) => row.batting,
      (row) => row.bat!.runs,
    ),
    bestBowler: topBy(
      rows.filter((row) => row.bowl && row.bowl.legalBalls > 0 && (row.bowl.wickets > 0 || row.bowl.dots > 0)),
      (row) => row.bowling,
      (row) => row.bowl!.wickets,
    ),
    bestFielder: topBy(
      rows.filter((row) => dismissalsBy(row) > 0),
      (row) => row.fielding,
      dismissalsBy,
    ),
  };
}

export function matchAwards(match: CricketMatch): MatchAwards {
  const everyone = matchImpact(match);
  const rows = everyone.filter(tookPart);
  const picked = everyone.find((row) => row.playerId === match.playerOfMatchId);
  const auto = autoPlayerOfMatch(match, rows);
  const playerOfMatch = picked ?? auto;
  const lock = match.mvpLock;
  const byId = (playerId: number | null) => rows.find((row) => row.playerId === playerId) ?? null;
  const { fighter, bestBatter, bestBowler, bestFielder } = lock
    ? {
        fighter: byId(lock.fighterId),
        bestBatter: byId(lock.bestBatterId),
        bestBowler: byId(lock.bestBowlerId),
        bestFielder: byId(lock.bestFielderId),
      }
    : awardWinners(match, rows);
  return {
    rows,
    playerOfMatch,
    autoPicked: !picked && auto !== null,
    fighterOfMatch: fighter && fighter.playerId !== playerOfMatch?.playerId ? fighter : null,
    bestBatter,
    bestBowler,
    bestFielder,
  };
}

// A finished match's MVP points and awards as today's rules have them, to save
// on it. Once saved, later changes to the rules leave the match alone.
export interface MvpLock {
  rows: ImpactRow[];
  autoPlayerOfMatchId: number | null;
  fighterId: number | null;
  bestBatterId: number | null;
  bestBowlerId: number | null;
  bestFielderId: number | null;
}

// A match's heroes: its awards, the top of the MVP ranking, and the best at
// each stat. Strike rate and economy need enough balls to mean something, which
// depends on the length of the match.
export function matchHeroes(match: CricketMatch) {
  const awards = matchAwards(match);
  const { rows } = awards;
  const perOver = ballsPerOverOf(match);
  const overs = match.scheduledOvers ?? match.overs;
  const minBallsFaced = Math.min(10, Math.max(1, Math.round((overs * perOver) / 3)));
  const minOversBowled = Math.min(2, Math.max(1, Math.ceil(overs / 5)));
  return {
    ...awards,
    mvp: rows[0] ?? null,
    // Most runs (quicker breaks a tie); most wickets (cheaper breaks a tie).
    mostRuns: topBy(rows.filter((row) => row.bat && row.bat.runs > 0), (row) => row.bat!.runs, (row) => -row.bat!.balls),
    bestFigures: topBy(rows.filter((row) => row.bowl && row.bowl.wickets > 0), (row) => row.bowl!.wickets, (row) => -row.bowl!.runs),
    mostCatches: topBy(rows.filter((row) => row.catches > 0), (row) => row.catches, (row) => row.fielding),
    mostSixes: topBy(rows.filter((row) => row.bat && row.bat.sixes > 0), (row) => row.bat!.sixes, (row) => row.bat!.runs),
    mostFours: topBy(rows.filter((row) => row.bat && row.bat.fours > 0), (row) => row.bat!.fours, (row) => row.bat!.runs),
    bestStrikeRate: topBy(
      rows.filter((row) => row.bat && row.bat.balls >= minBallsFaced),
      (row) => row.bat!.runs / row.bat!.balls,
      (row) => row.bat!.runs,
    ),
    bestEconomy: topBy(
      rows.filter((row) => row.bowl && row.bowl.legalBalls >= minOversBowled * perOver),
      (row) => -row.bowl!.runs / row.bowl!.legalBalls,
      (row) => row.bowl!.wickets,
    ),
    minBallsFaced,
    minOversBowled,
  };
}

export const isFinished = (match: CricketMatch) => match.status === "completed" || match.status === "abandoned";

export function buildMvpLock(match: CricketMatch): MvpLock {
  const fresh = { ...match, mvpLock: null };
  const rows = calculateMatchImpact(fresh);
  const played = rows.filter(tookPart);
  const winners = awardWinners(fresh, played);
  return {
    rows,
    autoPlayerOfMatchId: autoPlayerOfMatch(fresh, played)?.playerId ?? null,
    fighterId: winners.fighter?.playerId ?? null,
    bestBatterId: winners.bestBatter?.playerId ?? null,
    bestBowlerId: winners.bestBowler?.playerId ?? null,
    bestFielderId: winners.bestFielder?.playerId ?? null,
  };
}

// The admin's pick, else (once the match is over) the automatic one above.
export function playerOfMatch(match: CricketMatch): number | null {
  if (match.playerOfMatchId !== null) return match.playerOfMatchId;
  return autoPlayerOfMatch(match)?.playerId ?? null;
}

// When a match is (or was) on, for ordering them.
const matchTime = (match: CricketMatch) => new Date(match.scheduledAt ?? match.createdAt).getTime();

// One player's part in each started match they took part in, in the order
// they were played.
export function playerMatchLines(matches: CricketMatch[], playerId: number) {
  return matches
    .filter((match) => match.status !== "scheduled")
    .sort((a, b) => matchTime(a) - matchTime(b))
    .flatMap((match) => {
      const row = matchImpact(match).find((r) => r.playerId === playerId);
      return row && tookPart(row) ? [{ match, row }] : [];
    });
}

// A player's MVP points added up across matches, source by source: the same
// matches and totals as the MVP boards (see playerStats).
export function playerImpactTotals(matches: CricketMatch[], playerId: number) {
  const totals = { sources: [] as MvpSource[], batting: 0, bowling: 0, fielding: 0, total: 0, matches: 0 };
  for (const match of matches) {
    if (!wasPlayed(match)) continue;
    const row = matchImpact(match).find((r) => r.playerId === playerId);
    if (!row || !tookPart(row)) continue;
    totals.matches += 1;
    totals.batting += row.batting;
    totals.bowling += row.bowling;
    totals.fielding += row.fielding;
    totals.total += row.total;
    for (const source of row.sources) {
      const seen = totals.sources.find((s) => s.group === source.group && s.kind === source.kind);
      if (seen) {
        seen.count += source.count;
        seen.base += source.base;
        seen.points += source.points;
      } else {
        totals.sources.push({ ...source });
      }
    }
  }
  return {
    ...totals,
    batting: round2(totals.batting),
    bowling: round2(totals.bowling),
    fielding: round2(totals.fielding),
    total: round2(totals.total),
    sources: totals.sources.map((s) => ({ ...s, count: round1Count(s.count), base: round2(s.base), points: round2(s.points) })),
  };
}

// One team's matches against the others in `matches`, in the order they
// were played, with how each went for them.
export function teamMatchLines(matches: CricketMatch[], teamIndex: number) {
  return [...matches]
    .sort((a, b) => matchTime(a) - matchTime(b))
    .flatMap((match) => {
      const slot = match.teams.findIndex((team) => team.teamIndex === teamIndex);
      if (slot === -1) return [];
      const outcome: "won" | "lost" | "tied" | "nr" | null =
        match.status === "abandoned"
          ? "nr"
          : match.status !== "completed"
            ? null
            : match.winner === null
              ? "tied"
              : match.winner === slot
                ? "won"
                : "lost";
      return [{ match, slot, opponent: match.teams[1 - slot], outcome }];
    });
}

// "54 (32) · 3/18 (4.0) · 2 ct"
export function impactLine(row: ImpactRow, perOver = 6) {
  const parts: string[] = [];
  if (row.bat) parts.push(`${row.bat.runs}${row.bat.out ? "" : "*"} (${row.bat.balls})`);
  if (row.bowl && row.bowl.legalBalls > 0) {
    parts.push(`${row.bowl.wickets}/${row.bowl.runs} (${oversText(row.bowl.legalBalls, perOver)})`);
  }
  if (row.catches) parts.push(`${row.catches} ct`);
  if (row.stumpings) parts.push(`${row.stumpings} st`);
  if (row.runOuts) parts.push(`${row.runOuts} ro`);
  return parts.join(" · ");
}
