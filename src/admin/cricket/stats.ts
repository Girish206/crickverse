import type { CricketBall, CricketInnings, CricketMatch, CricketMatchStage, CricketTournament } from "../../api/types";

// Everything shown on scorecards, points tables and leaderboards is derived
// here from the stored balls — the same rules the server scores with
// (portfolio-server src/modules/cricket/cricket.scoring.ts).

export const isLegal = (ball: CricketBall) => ball.extraType !== "wide" && ball.extraType !== "no-ball";
export const isWicket = (ball: CricketBall) => ball.wicketType !== null && ball.wicketType !== "retired-hurt";
export const ballTotal = (ball: CricketBall) => ball.runs + ball.extras;
const BOWLER_WICKETS = ["bowled", "caught", "lbw", "stumped", "hit-wicket"];
const creditsBowler = (ball: CricketBall) => ball.wicketType !== null && BOWLER_WICKETS.includes(ball.wicketType);
// Byes and leg-byes aren't charged to the bowler.
const conceded = (ball: CricketBall) =>
  ball.runs + (ball.extraType === "wide" || ball.extraType === "no-ball" ? ball.extras : 0);

export const oversText = (legalBalls: number) => `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;

export const rate = (runs: number, legalBalls: number) => (legalBalls ? ((runs * 6) / legalBalls).toFixed(2) : "0.00");

export const strikeRate = (runs: number, balls: number) => (balls ? ((runs * 100) / balls).toFixed(1) : "–");

export function inningsSummary(innings: CricketInnings | undefined) {
  const balls = innings?.balls ?? [];
  const extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 };
  for (const ball of balls) {
    if (ball.extraType === "wide") extras.wides += ball.extras;
    if (ball.extraType === "no-ball") extras.noBalls += ball.extras;
    if (ball.extraType === "bye") extras.byes += ball.extras;
    if (ball.extraType === "leg-bye") extras.legByes += ball.extras;
    extras.total += ball.extras;
  }
  const runs = balls.reduce((sum, ball) => sum + ballTotal(ball), 0);
  const wickets = balls.filter(isWicket).length;
  const legalBalls = balls.filter(isLegal).length;
  return { runs, wickets, legalBalls, overs: oversText(legalBalls), extras };
}

export const scoreText = (innings: CricketInnings | undefined) => {
  const summary = inningsSummary(innings);
  return `${summary.runs}/${summary.wickets}`;
};

// Each ball's over number (0-based): legal balls bowled before it, / 6.
function overIndexes(balls: CricketBall[]) {
  let legal = 0;
  return balls.map((ball) => {
    const over = Math.floor(legal / 6);
    if (isLegal(ball)) legal += 1;
    return over;
  });
}

export function oversOf(innings: CricketInnings) {
  const indexes = overIndexes(innings.balls);
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
  if (isWicket(ball)) return "W";
  if (ball.wicketType === "retired-hurt") return "RH";
  if (ball.extraType === "wide") return ball.extras > 1 ? `${ball.extras - 1}wd` : "wd";
  if (ball.extraType === "no-ball") return ball.runs + ball.extras > 1 ? `${ball.runs + ball.extras - 1}nb` : "nb";
  if (ball.extraType === "bye") return `${ball.extras}b`;
  if (ball.extraType === "leg-bye") return `${ball.extras}lb`;
  return String(ball.runs);
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
    case "lbw":
      return `lbw b ${bowler}`;
    case "run-out":
      return ball.fielderId ? `run out (${fielder})` : "run out";
    case "stumped":
      return `st ${fielder} b ${bowler}`;
    case "hit-wicket":
      return `hit wicket b ${bowler}`;
    case "retired-hurt":
      return "retired hurt";
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
      balls: faced.filter((ball) => ball.extraType !== "wide").length,
      fours: faced.filter((ball) => ball.runs === 4).length,
      sixes: faced.filter((ball) => ball.runs === 6).length,
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

export function bowlingCard(innings: CricketInnings): BowlingRow[] {
  const rows = new Map<number, BowlingRow>();
  for (const ball of innings.balls) {
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
  for (const over of oversOf(innings)) {
    const complete = over.balls.filter(isLegal).length === 6;
    if (complete && over.balls.every((ball) => conceded(ball) === 0)) rows.get(over.bowlerId)!.maidens += 1;
  }
  return [...rows.values()];
}

export function fallOfWickets(innings: CricketInnings) {
  const result: { wicket: number; score: number; playerId: number; overs: string }[] = [];
  let runs = 0;
  let legal = 0;
  for (const ball of innings.balls) {
    runs += ballTotal(ball);
    if (isLegal(ball)) legal += 1;
    if (isWicket(ball) && ball.dismissedId !== null) {
      result.push({ wicket: result.length + 1, score: runs, playerId: ball.dismissedId, overs: oversText(legal) });
    }
  }
  return result;
}

// Live chase numbers for the second innings.
export function chaseInfo(match: CricketMatch) {
  if (match.innings.length < 2) return null;
  const target = inningsSummary(match.innings[0]).runs + 1;
  const now = inningsSummary(match.innings[1]);
  const ballsLeft = match.overs * 6 - now.legalBalls;
  const need = target - now.runs;
  return { target, need, ballsLeft, requiredRate: rate(Math.max(need, 0), ballsLeft) };
}

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
    if (match.status === "scheduled") continue;
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
        const notOut = row.outBall === null || row.outBall.wicketType === "retired-hurt";
        if (notOut) entry.notOuts += 1;
        if (row.runs >= 100) entry.hundreds += 1;
        else if (row.runs >= 50) entry.fifties += 1;
        if (row.runs === 0 && !notOut) entry.ducks += 1;
        if (entry.innings === 1 || row.runs > entry.highest || (row.runs === entry.highest && notOut)) {
          entry.highest = row.runs;
          entry.highestNotOut = notOut;
        }
      }
      for (const row of bowlingCard(innings)) {
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
        if (ball.wicketType === "caught") of(ball.fielderId).catches += 1;
        if (ball.wicketType === "stumped") of(ball.fielderId).stumpings += 1;
        if (ball.wicketType === "run-out") of(ball.fielderId).runOuts += 1;
      }
    }
  }
  return stats;
}

export const battingAverage = (s: PlayerStats) =>
  s.innings - s.notOuts > 0 ? (s.runs / (s.innings - s.notOuts)).toFixed(2) : s.runs ? "∞" : "–";

export const points = (n: number) => (Math.round(n * 10) / 10).toString();

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

// Win 2, tie / no result 1. Net run rate counts an all-out side as having
// faced its full quota of overs, as the standard rule does. Only matches
// between two of the given teams count.
export function standings(teams: { teamIndex: number; name: string }[], matches: CricketMatch[]): PointsRow[] {
  const rows = new Map<number, PointsRow>(
    teams.map(({ teamIndex, name }) => [
      teamIndex,
      { teamIndex, name, played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0, nrr: 0 },
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
    for (const innings of match.innings) {
      const summary = inningsSummary(innings);
      const batting = match.teams[innings.battingTeam];
      const allOut = summary.wickets >= batting.playerIds.length - 1;
      const balls = allOut ? match.overs * 6 : summary.legalBalls;
      const bat = runFor.get(batting.teamIndex)!;
      const bowl = runFor.get(match.teams[1 - innings.battingTeam].teamIndex)!;
      bat.runs += summary.runs;
      bat.balls += balls;
      bowl.against += summary.runs;
      bowl.ballsAgainst += balls;
    }
  }
  const result = [...rows.values()];
  result.forEach((row) => {
    row.points = row.won * 2 + row.tied + row.noResult;
    const r = runFor.get(row.teamIndex)!;
    const forRate = r.balls ? (r.runs * 6) / r.balls : 0;
    const againstRate = r.ballsAgainst ? (r.against * 6) / r.ballsAgainst : 0;
    row.nrr = forRate - againstRate;
  });
  return result.sort((x, y) => y.points - x.points || y.nrr - x.nrr || y.won - x.won);
}

// Every team over the tournament's league / group matches.
export function pointsTable(tournament: CricketTournament, matches: CricketMatch[]): PointsRow[] {
  return standings(
    tournament.teams.map((team, teamIndex) => ({ teamIndex, name: team.name })),
    matches.filter(countsForTable),
  );
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
          if (ball.runs === 4) t.fours += 1;
          if (ball.runs === 6) t.sixes += 1;
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
          if (ball.runs === 4) t.foursConceded += 1;
          if (ball.runs === 6) t.sixesConceded += 1;
          if (dot(ball)) t.dotsBowled += 1;
          if (ball.wicketType === "caught") t.catches += 1;
          if (ball.wicketType === "run-out") t.runOuts += 1;
          if (ball.wicketType === "stumped") t.stumpings += 1;
        }
        for (const over of oversOf(innings)) {
          if (over.balls.filter(isLegal).length === 6 && over.balls.every((ball) => conceded(ball) === 0)) t.maidens += 1;
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
        if (ball.runs === 4) t.fours += 1;
        if (ball.runs === 6) t.sixes += 1;
        if (isLegal(ball) && ballTotal(ball) === 0) t.dots += 1;
        if (ball.wicketType === "bowled") t.bowled += 1;
        if (ball.wicketType === "caught") t.caught += 1;
        if (ball.wicketType === "lbw") t.lbw += 1;
        if (ball.wicketType === "run-out") t.runOuts += 1;
        if (ball.wicketType === "stumped") t.stumpings += 1;
      }
      for (const row of battingCard(innings)) {
        if (row.runs >= 100) t.hundreds += 1;
        else if (row.runs >= 50) t.fifties += 1;
        if (row.runs === 0 && row.outBall !== null && row.outBall.wicketType !== "retired-hurt") t.ducks += 1;
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

// ===== Impact points =====
// One number per player per match that weighs batting, bowling and fielding
// against how the match went, so a quick 30 in a low-scoring game counts for
// more than a slow 30 in a run-fest. Player of the match, best batter, best
// bowler and the MVP tables are all picked from these.
//
// Batting:  1 per run, +1 per four, +2 per six, +4 at 25, +8 more at 50,
//           +16 more at 100; half a point per run scored above (or below,
//           after 6 balls) the match's par rate; -4 for a duck.
// Bowling:  20 per wicket, +4 if it was a top-order batter, +4 if they had
//           25+; +6 / +12 / +20 for 3 / 4 / 5 wickets; 1 per dot, 8 per
//           maiden; 0.75 per run saved (or leaked) against the par economy.
// Fielding: 8 per catch, 10 per stumping or run-out.
// Winning side: +10% on top.

export interface ImpactRow {
  playerId: number;
  // 0 or 1: the player's side in this match.
  team: number;
  batting: number;
  bowling: number;
  fielding: number;
  winBonus: number;
  total: number;
  bat: { runs: number; balls: number; fours: number; sixes: number; out: boolean } | null;
  bowl: { wickets: number; runs: number; legalBalls: number; maidens: number } | null;
  catches: number;
  stumpings: number;
  runOuts: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function matchImpact(match: CricketMatch): ImpactRow[] {
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
        winBonus: 0,
        total: 0,
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

  const cards = match.innings.map((innings) => ({ innings, batting: battingCard(innings), bowling: bowlingCard(innings) }));
  // Par for this match: what an average ball went for, off the bat and against the bowler.
  let batRuns = 0;
  let faced = 0;
  let conceded = 0;
  let legal = 0;
  for (const card of cards) {
    for (const row of card.batting) {
      batRuns += row.runs;
      faced += row.balls;
    }
    for (const row of card.bowling) {
      conceded += row.runs;
      legal += row.legalBalls;
    }
  }
  const batPar = faced ? batRuns / faced : 1;
  const bowlPar = legal ? conceded / legal : 1;

  for (const { innings, batting, bowling } of cards) {
    const position = new Map(batting.map((row, index) => [row.playerId, index]));
    const finalRuns = new Map(batting.map((row) => [row.playerId, row.runs]));

    for (const card of batting) {
      const row = of(card.playerId);
      const out = card.outBall !== null && card.outBall.wicketType !== "retired-hurt";
      let points = card.runs + card.fours + card.sixes * 2;
      if (card.runs >= 25) points += 4;
      if (card.runs >= 50) points += 8;
      if (card.runs >= 100) points += 16;
      const tempo = (card.runs - card.balls * batPar) * 0.5;
      if (tempo > 0 || card.balls >= 6) points += tempo;
      if (out && card.runs === 0) points -= 4;
      row.batting += points;
      const bat = row.bat ?? { runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
      row.bat = {
        runs: bat.runs + card.runs,
        balls: bat.balls + card.balls,
        fours: bat.fours + card.fours,
        sixes: bat.sixes + card.sixes,
        out: out || bat.out,
      };
    }

    for (const card of bowling) {
      const row = of(card.playerId);
      let points = card.dots + card.maidens * 8 + (card.legalBalls * bowlPar - card.runs) * 0.75;
      if (card.wickets >= 3) points += 6;
      if (card.wickets >= 4) points += 6;
      if (card.wickets >= 5) points += 8;
      row.bowling += points;
      const bowl = row.bowl ?? { wickets: 0, runs: 0, legalBalls: 0, maidens: 0 };
      row.bowl = {
        wickets: bowl.wickets + card.wickets,
        runs: bowl.runs + card.runs,
        legalBalls: bowl.legalBalls + card.legalBalls,
        maidens: bowl.maidens + card.maidens,
      };
    }

    for (const ball of innings.balls) {
      if (creditsBowler(ball) && ball.dismissedId !== null) {
        let points = 20;
        if ((position.get(ball.dismissedId) ?? 99) < 4) points += 4;
        if ((finalRuns.get(ball.dismissedId) ?? 0) >= 25) points += 4;
        of(ball.bowlerId).bowling += points;
      }
      if (ball.fielderId === null) continue;
      const fielder = of(ball.fielderId);
      if (ball.wicketType === "caught") {
        fielder.catches += 1;
        fielder.fielding += 8;
      } else if (ball.wicketType === "stumped") {
        fielder.stumpings += 1;
        fielder.fielding += 10;
      } else if (ball.wicketType === "run-out") {
        fielder.runOuts += 1;
        fielder.fielding += 10;
      }
    }
  }

  for (const row of rows.values()) {
    const base = row.batting + row.bowling + row.fielding;
    const winBonus = match.winner === row.team && base > 0 ? base * 0.1 : 0;
    row.batting = round1(row.batting);
    row.bowling = round1(row.bowling);
    row.fielding = round1(row.fielding);
    row.winBonus = round1(winBonus);
    row.total = round1(base + winBonus);
  }
  // Best first; level on points goes to the winning side.
  return [...rows.values()].sort(
    (a, b) => b.total - a.total || Number(b.team === match.winner) - Number(a.team === match.winner),
  );
}

// Did anything in the match (batted, bowled or had a hand in a dismissal)?
export const tookPart = (row: ImpactRow) =>
  row.bat !== null || row.bowl !== null || row.catches + row.stumpings + row.runOuts > 0;

const dismissalsBy = (row: ImpactRow) => row.catches + row.stumpings + row.runOuts;

export interface MatchAwards {
  rows: ImpactRow[];
  playerOfMatch: ImpactRow | null;
  // True when it's the top impact score rather than the admin's pick.
  autoPicked: boolean;
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

export function matchAwards(match: CricketMatch): MatchAwards {
  const everyone = matchImpact(match);
  const rows = everyone.filter(tookPart);
  const picked = everyone.find((row) => row.playerId === match.playerOfMatchId);
  const auto = match.status === "completed" ? (rows[0] ?? null) : null;
  return {
    rows,
    playerOfMatch: picked ?? auto,
    autoPicked: !picked && auto !== null,
    bestBatter: topBy(
      rows.filter((row) => row.bat && row.bat.runs > 0),
      (row) => row.batting,
      (row) => row.bat!.runs,
    ),
    bestBowler: topBy(
      rows.filter((row) => row.bowl && row.bowl.legalBalls > 0),
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

// The admin's pick, else (once the match is over) the top impact score.
export function playerOfMatch(match: CricketMatch): number | null {
  if (match.playerOfMatchId !== null) return match.playerOfMatchId;
  if (match.status !== "completed") return null;
  return matchImpact(match).find(tookPart)?.playerId ?? null;
}

// "54 (32) · 3/18 (4.0) · 2 ct"
export function impactLine(row: ImpactRow) {
  const parts: string[] = [];
  if (row.bat) parts.push(`${row.bat.runs}${row.bat.out ? "" : "*"} (${row.bat.balls})`);
  if (row.bowl && row.bowl.legalBalls > 0) {
    parts.push(`${row.bowl.wickets}/${row.bowl.runs} (${oversText(row.bowl.legalBalls)})`);
  }
  if (row.catches) parts.push(`${row.catches} ct`);
  if (row.stumpings) parts.push(`${row.stumpings} st`);
  if (row.runOuts) parts.push(`${row.runOuts} ro`);
  return parts.join(" · ");
}
