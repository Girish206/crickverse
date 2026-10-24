import type { CricketFixtureInput } from "../../../api/hooks/cricket/useCricketTournaments";
import type {
  CricketBracketSlot,
  CricketFormat,
  CricketMatch,
  CricketMatchStage,
  CricketPhase,
  CricketPhaseGroup,
  CricketTeamSource,
  CricketTournament,
} from "../../../api/types";
import { standings, type PointsRow } from "../stats";

// Works a tournament's format out from its matches: each group's table,
// who has qualified, which bracket matches can be scheduled, and the
// champion. Nothing here is stored — it all follows from the results.

export const ordinal = (n: number) => {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
};

const isFinished = (match: CricketMatch) => match.status === "completed" || match.status === "abandoned";

export const groupMatches = (phase: CricketPhase, group: CricketPhaseGroup, matches: CricketMatch[]) =>
  matches.filter((match) => match.phaseId === phase.id && match.group === group.name);

// Matches a group plays in full: every pair `legs` times, or each team its
// set number (a series: its length). A group still waiting on its teams
// counts the places it will fill.
export function expectedMatches(phase: CricketPhase, group: CricketPhaseGroup) {
  const n = Math.max(group.teamIndexes.length, group.seeds.length);
  if (phase.kind === "series") return phase.legs;
  if (phase.matchesPerTeam) return (n * phase.matchesPerTeam) / 2;
  return ((n * (n - 1)) / 2) * phase.legs;
}

// Every match the format comes to: each group's, each series' (all its
// matches, even if it's decided early) and every bracket slot.
export function formatMatchCount(format: CricketFormat) {
  return format.phases.reduce(
    (total, phase) =>
      total +
      (phase.kind === "knockout"
        ? phase.slots.length
        : phase.groups.reduce((sum, group) => sum + expectedMatches(phase, group), 0)),
    0,
  );
}

// The match counts every team can be held to across these groups: fewer
// than a full round (n − 1), and only even ones when a group has an odd
// number of teams, as otherwise someone would have to play one fewer.
export function matchesPerTeamChoices(groups: number[][]) {
  const sizes = groups.map((group) => group.length);
  const evenOnly = sizes.some((n) => n % 2 === 1);
  const most = Math.min(...sizes) - 2;
  return Array.from({ length: Math.max(0, most) }, (_, i) => i + 1).filter((count) => !evenOnly || count % 2 === 0);
}

// The format's matches in a phase's slot (knockout or series), if scheduled.
export const slotMatch = (code: string, matches: CricketMatch[]) => matches.find((match) => match.slot === code);

// A group's table. A super league also counts its teams' results against
// each other in the earlier round-robin phases.
export function groupTable(
  tournament: CricketTournament,
  format: CricketFormat,
  phase: CricketPhase,
  group: CricketPhaseGroup,
  matches: CricketMatch[],
): PointsRow[] {
  const teams = group.teamIndexes.map((teamIndex) => ({
    teamIndex,
    name: tournament.teams[teamIndex]?.name ?? "Removed team",
  }));
  return standings(teams, groupTableMatches(format, phase, group, matches));
}

// The matches a group's table counts: its own, plus (when points carry)
// the earlier round-robin ones (standings keeps those between its teams).
export function groupTableMatches(
  format: CricketFormat,
  phase: CricketPhase,
  group: CricketPhaseGroup,
  matches: CricketMatch[],
): CricketMatch[] {
  const counted = groupMatches(phase, group, matches);
  if (!phase.carryPoints) return counted;
  const earlier = format.phases
    .slice(0, format.phases.indexOf(phase))
    .filter((p) => p.kind === "round-robin")
    .map((p) => p.id);
  return [...counted, ...matches.filter((match) => match.phaseId && earlier.includes(match.phaseId))];
}

// Every match of the group played (or washed out), so its places are final.
export function isGroupDone(phase: CricketPhase, group: CricketPhaseGroup, matches: CricketMatch[]) {
  if (group.teamIndexes.length < 2) return false;
  const own = groupMatches(phase, group, matches);
  if (phase.kind === "series") return seriesScore(phase, group, matches).decided;
  return own.length >= expectedMatches(phase, group) && own.every(isFinished);
}

export interface SeriesScore {
  // Wins per side, in the group's team order.
  wins: [number, number];
  played: number;
  // One side can't be caught, or every match is played.
  decided: boolean;
  // The team ahead (null when level).
  leader: number | null;
}

export function seriesScore(phase: CricketPhase, group: CricketPhaseGroup, matches: CricketMatch[]): SeriesScore {
  const [a, b] = group.teamIndexes;
  const wins: [number, number] = [0, 0];
  let played = 0;
  for (const match of groupMatches(phase, group, matches)) {
    if (!isFinished(match)) continue;
    played += 1;
    if (match.status !== "completed" || match.winner === null) continue;
    const winnerIndex = match.teams[match.winner].teamIndex;
    if (winnerIndex === a) wins[0] += 1;
    if (winnerIndex === b) wins[1] += 1;
  }
  const remaining = phase.legs - played;
  const decided = remaining <= 0 || Math.abs(wins[0] - wins[1]) > remaining;
  const leader = wins[0] === wins[1] ? null : wins[0] > wins[1] ? a : b;
  return { wins, played, decided, leader };
}

// Which phase and group a "rank" source points at.
function rankGroup(format: CricketFormat, source: Extract<CricketTeamSource, { from: "rank" }>) {
  const phase = format.phases.find((p) => p.id === source.phaseId);
  const group = phase && (source.group === null ? phase.groups[0] : phase.groups.find((g) => g.name === source.group));
  return phase && group ? { phase, group } : null;
}

// Works out who a source is, once it's settled: a group place when the
// group is done, a winner / loser when the match has a result. A tied
// knockout (no winner) waits for the organiser to replay or decide it.
export function makeResolver(tournament: CricketTournament, format: CricketFormat, matches: CricketMatch[]) {
  const tables = new Map<string, PointsRow[] | null>();
  return function resolve(source: CricketTeamSource): number | null {
    if (source.from === "team") return source.teamIndex;
    if (source.from === "rank") {
      const found = rankGroup(format, source);
      if (!found) return null;
      const key = `${found.phase.id}:${found.group.name}`;
      if (!tables.has(key)) {
        tables.set(
          key,
          isGroupDone(found.phase, found.group, matches)
            ? groupTable(tournament, format, found.phase, found.group, matches)
            : null,
        );
      }
      return tables.get(key)?.[source.rank - 1]?.teamIndex ?? null;
    }
    const match = slotMatch(source.slot, matches);
    if (!match || match.status !== "completed" || match.winner === null) return null;
    const slotIndex = source.from === "winner" ? match.winner : 1 - match.winner;
    return match.teams[slotIndex].teamIndex;
  };
}
export type Resolver = ReturnType<typeof makeResolver>;

// How a source reads before it's known: "A1", "1st, League", "Winner Q1".
export function sourceLabel(format: CricketFormat, source: CricketTeamSource, teamName: (index: number) => string) {
  if (source.from === "team") return teamName(source.teamIndex);
  if (source.from === "rank") {
    const found = rankGroup(format, source);
    if (!found) return "TBD";
    return found.phase.groups.length > 1
      ? `${found.group.name}${source.rank}`
      : `${ordinal(source.rank)}, ${found.phase.name}`;
  }
  return `${source.from === "winner" ? "Winner" : "Loser"} ${source.slot}`;
}

export type PhaseState = "waiting" | "ready" | "playing" | "done";

// waiting: its teams aren't known yet; ready: they are, nothing scheduled;
// playing: under way; done: every match has a result.
export function phaseState(phase: CricketPhase, matches: CricketMatch[], resolve: Resolver): PhaseState {
  const own = matches.filter((match) => match.phaseId === phase.id);
  if (phase.kind === "knockout") {
    if (phase.slots.every((slot) => slotMatch(slot.code, own) && isFinished(slotMatch(slot.code, own)!))) return "done";
    if (own.length > 0) return "playing";
    return phase.slots.some((slot) => resolve(slot.home) !== null && resolve(slot.away) !== null) ? "ready" : "waiting";
  }
  const filled = phase.groups.every((group) => group.teamIndexes.length > 0);
  if (!filled) {
    return phase.groups.every((group) => group.seeds.every((seed) => resolve(seed) !== null)) ? "ready" : "waiting";
  }
  if (own.length === 0) return "ready";
  return phase.groups.every((group) => isGroupDone(phase, group, matches)) ? "done" : "playing";
}

// The champion: the last phase's final (or the series' winner) once played.
export function championOf(format: CricketFormat, matches: CricketMatch[], resolve: Resolver): number | null {
  const last = format.phases[format.phases.length - 1];
  if (last.kind === "knockout") {
    const final = last.slots.find((slot) => slot.stage === "final") ?? last.slots[last.slots.length - 1];
    return final ? resolve({ from: "winner", slot: final.code }) : null;
  }
  if (last.kind === "series") {
    const score = seriesScore(last, last.groups[0], matches);
    return score.decided ? score.leader : null;
  }
  return isGroupDone(last, last.groups[0], matches) ? resolve({ from: "rank", phaseId: last.id, group: null, rank: 1 }) : null;
}

// ===== Fixtures =====

// Round-robin by the circle method: every pair meets once per leg, each
// team once per round (a bye when the count is odd). The return leg swaps
// who's listed first.
export function roundRobinRounds(teams: number[], legs: number): [number, number][][] {
  const list = teams.length % 2 === 0 ? [...teams] : [...teams, -1];
  const n = list.length;
  const rounds: [number, number][][] = [];
  for (let round = 0; round < n - 1; round += 1) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < n / 2; i += 1) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a !== -1 && b !== -1) pairs.push(round % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    // Keep the first team fixed and turn the rest one place.
    list.splice(1, 0, list.pop()!);
  }
  const all: [number, number][][] = [];
  for (let leg = 0; leg < legs; leg += 1) {
    all.push(...rounds.map((pairs) => pairs.map(([a, b]): [number, number] => (leg % 2 === 0 ? [a, b] : [b, a]))));
  }
  return all;
}

// Rounds in which each team plays `count` matches, never the same opponent
// twice: the circle method's first rounds for an even number of teams. For
// an odd number (count is then even), each team plays the count / 2 teams
// either side of it in the list, dealt into rounds so nobody plays twice
// in one.
export function partialRounds(teams: number[], count: number): [number, number][][] {
  if (teams.length % 2 === 0) return roundRobinRounds(teams, 1).slice(0, count);
  const n = teams.length;
  const pending: [number, number][] = [];
  for (let gap = 1; gap <= count / 2; gap += 1) {
    for (let i = 0; i < n; i += 1) pending.push([teams[i], teams[(i + gap) % n]]);
  }
  const rounds: [number, number][][] = [];
  while (pending.length > 0) {
    const busy = new Set<number>();
    const pairs: [number, number][] = [];
    for (let i = 0; i < pending.length; ) {
      const [a, b] = pending[i];
      if (busy.has(a) || busy.has(b)) {
        i += 1;
        continue;
      }
      busy.add(a);
      busy.add(b);
      pairs.push([a, b]);
      pending.splice(i, 1);
    }
    rounds.push(pairs);
  }
  return rounds;
}

// The stage a round-robin phase's matches are labelled with.
function roundRobinStage(format: CricketFormat, phase: CricketPhase): CricketMatchStage {
  if (format.phases.indexOf(phase) > 0) return "super-league";
  return phase.groups.length > 1 ? "group" : "league";
}

export type Fixture = Omit<CricketFixtureInput, "scheduledAt" | "venue">;

// A round-robin or series phase's matches, the groups' rounds interleaved
// so the groups take turns.
export function groupFixtures(format: CricketFormat, phase: CricketPhase, groups = phase.groups): Fixture[] {
  if (phase.kind === "series") {
    const [a, b] = groups[0].teamIndexes;
    return Array.from({ length: phase.legs }, (_, i) => ({
      phaseId: phase.id,
      teamAIndex: i % 2 === 0 ? a : b,
      teamBIndex: i % 2 === 0 ? b : a,
      stage: "league",
      group: groups[0].name,
      slot: `M${i + 1}`,
    }));
  }
  const stage = roundRobinStage(format, phase);
  const perGroup = groups.map((group) =>
    phase.matchesPerTeam
      ? partialRounds(group.teamIndexes, phase.matchesPerTeam)
      : roundRobinRounds(group.teamIndexes, phase.legs),
  );
  const rounds: Fixture[][] = [];
  const roundCount = Math.max(0, ...perGroup.map((groupRounds) => groupRounds.length));
  for (let round = 0; round < roundCount; round += 1) {
    rounds.push(
      perGroup.flatMap((groupRounds, g) =>
        (groupRounds[round] ?? []).map(([a, b]) => ({
          phaseId: phase.id,
          teamAIndex: a,
          teamBIndex: b,
          stage,
          group: groups[g].name,
          slot: null,
        })),
      ),
    );
  }
  return evenGaps(rounds);
}

// ===== Even gaps =====
// A round-robin's matches in the order that keeps each team's wait between
// its matches as even as can be: no avoidable back-to-backs, then the
// shortest wait as long as possible, then the longest as short. Tries the
// rounds in order (each round's most-rested teams first) and a few dozen
// most-rested-first orders over all the matches, and keeps the best.

type Order = number[];

// [back-to-backs, −shortest wait, longest wait, spread]; lower is better.
function gapScore(fixtures: Fixture[], order: Order) {
  const total = new Map<number, number>();
  for (const f of fixtures) {
    total.set(f.teamAIndex, (total.get(f.teamAIndex) ?? 0) + 1);
    total.set(f.teamBIndex, (total.get(f.teamBIndex) ?? 0) + 1);
  }
  const last = new Map<number, number>();
  let backToBack = 0;
  let shortest = Infinity;
  let longest = 0;
  let spread = 0;
  order.forEach((index, at) => {
    for (const team of [fixtures[index].teamAIndex, fixtures[index].teamBIndex]) {
      if (last.has(team)) {
        const wait = at - last.get(team)!;
        if (wait === 1) backToBack += 1;
        shortest = Math.min(shortest, wait);
        longest = Math.max(longest, wait);
        spread += (wait - order.length / total.get(team)!) ** 2;
      }
      last.set(team, at);
    }
  });
  return [backToBack, -shortest, longest, spread];
}

const lower = (a: number[], b: number[]) => {
  const at = a.findIndex((value, i) => value !== b[i]);
  return at >= 0 && a[at] < b[at];
};

// Repeatedly the match from `pool` whose less-rested team has waited
// longest (then: teams with more matches left, both teams' wait, `tieBreak`).
function mostRestedFirst(fixtures: Fixture[], pools: Order[], tieBreak: () => number): Order {
  const last = new Map<number, number>();
  const left = new Map<number, number>();
  for (const f of fixtures) {
    left.set(f.teamAIndex, (left.get(f.teamAIndex) ?? 0) + 1);
    left.set(f.teamBIndex, (left.get(f.teamBIndex) ?? 0) + 1);
  }
  const order: Order = [];
  for (const pool of pools) {
    const pending = [...pool];
    while (pending.length > 0) {
      const rest = (team: number) => (last.has(team) ? order.length - last.get(team)! : 1e6);
      let best = 0;
      let bestKey: number[] = [];
      pending.forEach((index, k) => {
        const { teamAIndex: a, teamBIndex: b } = fixtures[index];
        const key = [-Math.min(rest(a), rest(b)), -(left.get(a)! + left.get(b)!), -(rest(a) + rest(b)), tieBreak()];
        if (k === 0 || lower(key, bestKey)) {
          best = k;
          bestKey = key;
        }
      });
      const [index] = pending.splice(best, 1);
      const { teamAIndex: a, teamBIndex: b } = fixtures[index];
      order.push(index);
      last.set(a, order.length - 1);
      last.set(b, order.length - 1);
      left.set(a, left.get(a)! - 1);
      left.set(b, left.get(b)! - 1);
    }
  }
  return order;
}

// A small seeded random (mulberry32), so the same fixtures always come out
// in the same order and the preview doesn't jump about.
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The format page rebuilds its preview on every change, so orders are kept.
const evenGapsCache = new Map<string, Order>();

function evenGaps(rounds: Fixture[][]): Fixture[] {
  const fixtures = rounds.flat();
  if (fixtures.length < 3) return fixtures;
  const key = rounds.map((round) => round.map((f) => `${f.teamAIndex}-${f.teamBIndex}`).join(",")).join("|");
  let order = evenGapsCache.get(key);
  if (!order) {
    // Each round's matches, as indexes into `fixtures`.
    const roundPools: Order[] = [];
    let start = 0;
    for (const round of rounds) {
      roundPools.push(round.map((_, i) => start + i));
      start += round.length;
    }
    const random = seeded(Array.from(key).reduce((hash, ch) => (Math.imul(hash, 31) + ch.charCodeAt(0)) | 0, 7));
    order = mostRestedFirst(fixtures, roundPools, () => 0);
    let score = gapScore(fixtures, order);
    const all = [fixtures.map((_, i) => i)];
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const candidate = mostRestedFirst(fixtures, all, random);
      const candidateScore = gapScore(fixtures, candidate);
      if (lower(candidateScore, score)) {
        order = candidate;
        score = candidateScore;
      }
    }
    if (evenGapsCache.size > 50) evenGapsCache.clear();
    evenGapsCache.set(key, order);
  }
  return order.map((index) => fixtures[index]);
}

// A bracket slot's match, once both its teams are known.
export function slotFixture(phase: CricketPhase, slot: CricketBracketSlot, resolve: Resolver): Fixture | null {
  const home = resolve(slot.home);
  const away = resolve(slot.away);
  if (home === null || away === null || home === away) return null;
  return { phaseId: phase.id, teamAIndex: home, teamBIndex: away, stage: slot.stage, group: null, slot: slot.code };
}

// The first phase's fixtures, made with the format: its groups' matches, or
// a knockout's opening round.
export function openingFixtures(format: CricketFormat, tournament: CricketTournament): Fixture[] {
  const first = format.phases[0];
  if (first.kind !== "knockout") return groupFixtures(format, first);
  const resolve = makeResolver(tournament, format, []);
  return first.slots.flatMap((slot) => slotFixture(first, slot, resolve) ?? []);
}

export interface NextRound {
  phase: CricketPhase;
  // A later round-robin phase's groups, filled in with its qualifiers.
  groups?: CricketPhaseGroup[];
  fixtures: Fixture[];
}

// What can be scheduled now the results are in and isn't yet: each bracket
// match whose two teams are known, and a later league / group phase (a
// super league) once all its qualifiers are. The opening phase's league or
// groups come with the format, so they're never here.
export function nextRounds(format: CricketFormat, matches: CricketMatch[], resolve: Resolver): NextRound[] {
  const rounds: NextRound[] = [];
  format.phases.forEach((phase, index) => {
    if (phase.kind === "knockout") {
      const fixtures = phase.slots.flatMap((slot) => (slotMatch(slot.code, matches) ? [] : (slotFixture(phase, slot, resolve) ?? [])));
      if (fixtures.length > 0) rounds.push({ phase, fixtures });
      return;
    }
    if (index === 0 || matches.some((match) => match.phaseId === phase.id)) return;
    if (phase.groups.some((group) => group.teamIndexes.length > 0)) return;
    const teams = phase.groups.map((group) => group.seeds.map((seed) => resolve(seed)));
    if (teams.some((list) => list.length === 0 || list.some((teamIndex) => teamIndex === null))) return;
    const groups = phase.groups.map((group, g) => ({ ...group, teamIndexes: teams[g] as number[] }));
    rounds.push({ phase, groups, fixtures: groupFixtures(format, phase, groups) });
  });
  return rounds;
}

export interface ScheduleOptions {
  // "YYYY-MM-DD"; blank leaves the dates to set later.
  startDate: string;
  // Finish by this date ("YYYY-MM-DD"): the matches are spread evenly over
  // the playing days up to it. Blank = not fixed: perDay a day until done.
  endDate: string;
  // Everything on startDate, back to back.
  oneDay: boolean;
  // Weekdays matches are played on (0 = Sunday ... 6 = Saturday).
  days: number[];
  // With an end date: playing days kept free at the end for later rounds.
  reserveDays: number;
  // Without an end date: start times a day.
  perDay: number;
  // "HH:MM", the day's first match.
  time: string;
  // From one start time to the next.
  minutesBetween: number;
  // Matches played at the same time, on different pitches of the ground.
  pitches: number;
  venue: string;
}

// Groups fixtures, in order, into start times of up to `pitches` matches
// each, so no team plays twice at once (a clashing match waits for the
// next start time).
function startTimes(fixtures: Fixture[], pitches: number) {
  const pending = fixtures.map((fixture, index) => ({ fixture, index }));
  const slotOf = new Array<number>(fixtures.length);
  const pitchOf = new Array<number>(fixtures.length);
  let slot = 0;
  for (; pending.length > 0; slot += 1) {
    const busy = new Set<number>();
    let pitch = 0;
    for (let i = 0; i < pending.length && pitch < pitches; ) {
      const { fixture, index } = pending[i];
      if (busy.has(fixture.teamAIndex) || busy.has(fixture.teamBIndex)) {
        i += 1;
        continue;
      }
      busy.add(fixture.teamAIndex);
      busy.add(fixture.teamBIndex);
      slotOf[index] = slot;
      pitchOf[index] = pitch;
      pitch += 1;
      pending.splice(i, 1);
    }
  }
  return { slotOf, pitchOf, slots: slot };
}

const parseDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
};

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// The playing days from `from` on (only the chosen weekdays): up to `until`
// when given, else the first `count` of them.
export function playingDates(from: Date, days: number[], until: Date | null, count = Infinity): Date[] {
  const allowed = new Set(days.length ? days : ALL_DAYS);
  const dates: Date[] = [];
  for (const at = new Date(from); dates.length < count && (!until || at <= until); at.setDate(at.getDate() + 1)) {
    if (allowed.has(at.getDay())) dates.push(new Date(at));
  }
  return dates;
}

// The next playing day after `after` (the day itself is never returned).
export function nextPlayingDate(after: Date, days: number[]) {
  const from = new Date(after.getFullYear(), after.getMonth(), after.getDate() + 1);
  return playingDates(from, days, null, 1)[0];
}

export interface SchedulePlan {
  fixtures: CricketFixtureInput[];
  // Most start times on one day, and the days with matches.
  perDay: number;
  matchDays: number;
  lastStart: string | null;
  // Why the schedule doesn't work, if it doesn't.
  problem: string | null;
}

// Gives each fixture a date, time and ground. All on one day; or spread
// evenly over the chosen weekdays up to the end date (less the days kept
// free for later rounds); or, with no end date, perDay start times each
// playing day until done. Each start time takes up to `pitches` matches.
export function planSchedule(fixtures: Fixture[], options: ScheduleOptions): SchedulePlan {
  const pitches = Math.max(1, options.pitches);
  const { slotOf, pitchOf, slots } = startTimes(fixtures, pitches);
  const ground = options.venue.trim();
  const withTime = (fixture: Fixture, i: number, at: Date | null): CricketFixtureInput => ({
    ...fixture,
    scheduledAt: at ? at.toISOString() : null,
    venue: [ground, pitches > 1 ? `Pitch ${pitchOf[i] + 1}` : ""].filter(Boolean).join(" · ") || null,
  });
  const start = parseDate(options.startDate);
  if (!start || slots === 0) {
    return { fixtures: fixtures.map((f, i) => withTime(f, i, null)), perDay: 0, matchDays: 0, lastStart: null, problem: null };
  }

  // The playing days, and which of them each start time falls on.
  let dates: Date[];
  let dayOfSlot: (slot: number) => number;
  let problem: string | null = null;
  const end = options.oneDay ? null : parseDate(options.endDate);
  if (options.oneDay) {
    dates = [start];
    dayOfSlot = () => 0;
  } else if (end) {
    const all = playingDates(start, options.days, end);
    const usable = all.slice(0, Math.max(0, all.length - Math.max(0, options.reserveDays)));
    if (usable.length === 0) {
      problem =
        all.length === 0
          ? "There are no playing days between these dates."
          : "No playing days are left once the days for later rounds are kept free.";
    }
    dates = usable.length ? usable : [start];
    // Evenly: start time s of S goes on day floor(s × days / S).
    dayOfSlot = (slot) => Math.floor((slot * dates.length) / slots);
  } else {
    const perDay = Math.max(1, options.perDay);
    dates = playingDates(start, options.days, null, Math.ceil(slots / perDay));
    dayOfSlot = (slot) => Math.floor(slot / perDay);
  }

  const firstSlotOfDay = new Map<number, number>();
  const perDayCount = new Map<number, number>();
  for (let slot = 0; slot < slots; slot += 1) {
    const day = dayOfSlot(slot);
    if (!firstSlotOfDay.has(day)) firstSlotOfDay.set(day, slot);
    perDayCount.set(day, (perDayCount.get(day) ?? 0) + 1);
  }
  const [hour, minute] = (options.time || "09:00").split(":").map(Number);
  const timeOf = (slot: number) => {
    const day = dayOfSlot(slot);
    const date = dates[day];
    const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute);
    at.setMinutes(at.getMinutes() + (slot - firstSlotOfDay.get(day)!) * options.minutesBetween);
    return at;
  };

  // A day whose last start time spills past midnight.
  const perDay = Math.max(...perDayCount.values());
  const overflows = [...perDayCount.keys()].some((day) => timeOf(firstSlotOfDay.get(day)! + perDayCount.get(day)! - 1).getDate() !== dates[day].getDate());
  if (!problem && overflows) {
    problem = "Too many matches for one day — start earlier, shorten the gap, play more at the same time or allow more days.";
  }
  return {
    fixtures: fixtures.map((fixture, i) => withTime(fixture, i, timeOf(slotOf[i]))),
    perDay,
    matchDays: perDayCount.size,
    lastStart: timeOf(slots - 1).toISOString(),
    problem,
  };
}

// How many matches in a row a bracket slot waits on within its phase
// (0 = its teams come from elsewhere): its column in the bracket.
export function slotDepth(phase: CricketPhase, slot: CricketBracketSlot, seen = new Map<string, number>()): number {
  if (!seen.has(slot.code)) {
    const feeders = [slot.home, slot.away].flatMap((source) =>
      source.from === "winner" || source.from === "loser" ? phase.slots.filter((s) => s.code === source.slot) : [],
    );
    seen.set(slot.code, feeders.length ? 1 + Math.max(...feeders.map((feeder) => slotDepth(phase, feeder, seen))) : 0);
  }
  return seen.get(slot.code)!;
}

// Playing days the phases after `index` need: a knockout's rounds (bracket
// columns), a later round-robin's rounds, a series' matches.
export function laterRoundDays(format: CricketFormat, index: number) {
  return format.phases.slice(index + 1).reduce((total, phase) => {
    if (phase.kind === "knockout") return total + new Set(phase.slots.map((slot) => slotDepth(phase, slot))).size;
    if (phase.kind === "series") return total + phase.legs;
    const size = Math.max(...phase.groups.map((group) => Math.max(group.teamIndexes.length, group.seeds.length)));
    return total + (size % 2 === 0 ? size - 1 : size) * phase.legs;
  }, 0);
}
