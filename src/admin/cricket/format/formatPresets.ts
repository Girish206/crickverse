import type {
  CricketBracketSlot,
  CricketFormat,
  CricketMatchStage,
  CricketPhase,
  CricketTeamSource,
} from "../../../api/types";

// The formats an organiser picks from. Each builds the tournament's phases
// for its team count; the options tune it (legs, groups, who goes through).

export type PresetId =
  | "ipl"
  | "league-semis"
  | "league-final"
  | "groups-knockout"
  | "groups-super"
  | "knockout"
  | "series"
  | "tri-series";

export interface PresetOptions {
  // Times each pair meets in the league / groups.
  legs: number;
  // Instead: each team plays just this many league / group matches.
  matchesPerTeam: number | null;
  groupCount: number;
  // Per group, who goes through.
  qualify: number;
  seriesLength: number;
  // Semi-final formats: the losing semi-finalists play for 3rd.
  thirdPlace: boolean;
}

export interface Preset {
  id: PresetId;
  name: string;
  note: string;
  icon: string;
  // Why it doesn't fit this many teams (null = it does).
  unfit: (teamCount: number) => string | null;
  // Whether the first phase is groups the organiser fills (vs one league).
  usesGroups: boolean;
  defaults: (teamCount: number) => PresetOptions;
}

const base: PresetOptions = { legs: 1, matchesPerTeam: null, groupCount: 1, qualify: 0, seriesLength: 3, thirdPlace: false };

const atLeast = (min: number) => (teamCount: number) => (teamCount < min ? `Needs at least ${min} teams` : null);

export const PRESETS: Preset[] = [
  {
    id: "ipl",
    name: "League + IPL playoffs",
    note: "Everyone plays everyone, then Qualifier 1, Eliminator, Qualifier 2 and the Final for the top 4",
    icon: "fa-trophy",
    unfit: atLeast(4),
    usesGroups: false,
    defaults: () => ({ ...base, qualify: 4 }),
  },
  {
    id: "league-semis",
    name: "League + semi-finals",
    note: "Round-robin, then 1st v 4th and 2nd v 3rd semi-finals and the Final",
    icon: "fa-medal",
    unfit: atLeast(4),
    usesGroups: false,
    defaults: () => ({ ...base, qualify: 4 }),
  },
  {
    id: "league-final",
    name: "League + final",
    note: "Round-robin, then the top two meet in the Final",
    icon: "fa-list-ol",
    unfit: atLeast(3),
    usesGroups: false,
    defaults: () => ({ ...base, qualify: 2 }),
  },
  {
    id: "groups-knockout",
    name: "Groups + knockouts",
    note: "Teams split into groups; the group toppers cross over into quarter / semi-finals",
    icon: "fa-layer-group",
    unfit: atLeast(4),
    usesGroups: true,
    defaults: (teamCount) => ({ ...base, groupCount: teamCount >= 12 ? 4 : 2, qualify: 2 }),
  },
  {
    id: "groups-super",
    name: "Groups + super league + playoffs",
    note: "Groups, then the qualifiers play a super league (Super 4 / 6 / 8), then semi-finals or a final",
    icon: "fa-star",
    unfit: atLeast(6),
    usesGroups: true,
    defaults: (teamCount) => ({ ...base, groupCount: 2, qualify: teamCount >= 8 ? 3 : 2 }),
  },
  {
    id: "knockout",
    name: "Straight knockout",
    note: "Lose and you're out — any number of teams; the top seeds get a bye when it doesn't divide evenly",
    icon: "fa-sitemap",
    unfit: atLeast(2),
    usesGroups: false,
    defaults: () => base,
  },
  {
    id: "series",
    name: "Bilateral series",
    note: "Two teams play a best-of series",
    icon: "fa-right-left",
    unfit: (teamCount) => (teamCount === 2 ? null : "Needs exactly 2 teams"),
    usesGroups: false,
    defaults: () => ({ ...base, seriesLength: 3 }),
  },
  {
    id: "tri-series",
    name: "Tri-series",
    note: "Three teams play each other twice, then the top two meet in the Final",
    icon: "fa-circle-nodes",
    unfit: (teamCount) => (teamCount === 3 ? null : "Needs exactly 3 teams"),
    usesGroups: false,
    defaults: () => ({ ...base, legs: 2, qualify: 2 }),
  },
];

export const presetOf = (id: string) => PRESETS.find((preset) => preset.id === id);

export const GROUP_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H"];

const rank = (phaseId: string, group: string | null, place: number): CricketTeamSource => ({
  from: "rank",
  phaseId,
  group,
  rank: place,
});
const winner = (slot: string): CricketTeamSource => ({ from: "winner", slot });
const loser = (slot: string): CricketTeamSource => ({ from: "loser", slot });

const slot = (
  code: string,
  label: string,
  stage: CricketMatchStage,
  home: CricketTeamSource,
  away: CricketTeamSource,
): CricketBracketSlot => ({ code, label, stage, home, away });

function roundRobin(id: string, name: string, groups: number[][], legs: number, qualify: number): CricketPhase {
  return {
    id,
    name,
    kind: "round-robin",
    groups: groups.map((teamIndexes, index) => ({ name: GROUP_NAMES[index], teamIndexes, seeds: [] })),
    legs,
    qualify,
    carryPoints: false,
    slots: [],
  };
}

const knockout = (id: string, name: string, slots: CricketBracketSlot[]): CricketPhase => ({
  id,
  name,
  kind: "knockout",
  groups: [],
  legs: 1,
  qualify: 0,
  carryPoints: false,
  slots,
});

// Semis from four places (1v4, 2v3), the optional 3rd-place match and the Final.
function semisAndFinal(places: CricketTeamSource[], thirdPlace: boolean) {
  const [first, second, third, fourth] = places;
  return [
    slot("SF1", "Semi-final 1", "semi-final", first, fourth),
    slot("SF2", "Semi-final 2", "semi-final", second, third),
    ...(thirdPlace ? [slot("3P", "3rd Place", "third-place", loser("SF1"), loser("SF2"))] : []),
    slot("F", "Final", "final", winner("SF1"), winner("SF2")),
  ];
}

// Bracket order for n seeds (a power of two) so 1 and 2 can only meet in the
// final: 1v8, 4v5, 2v7, 3v6 for eight.
function bracketOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, next - seed]);
  }
  return order;
}

const ROUNDS: { stage: CricketMatchStage; prefix: string; label: string }[] = [
  { stage: "final", prefix: "F", label: "Final" },
  { stage: "semi-final", prefix: "SF", label: "Semi-final" },
  { stage: "quarter-final", prefix: "QF", label: "Quarter-final" },
  { stage: "round-of-16", prefix: "R", label: "Round of 16" },
];

// A bracket over the seeds, in seed order, round by round. With a team
// count that isn't a power of two the bracket is drawn for the next one up
// and the missing places are byes: the top seeds go straight into the
// second round (their source is the seed itself), so the first round has
// only the teams that need to play.
function bracket(seeds: CricketTeamSource[], thirdPlace: boolean): CricketBracketSlot[] {
  const size = 2 ** Math.ceil(Math.log2(seeds.length));
  const rounds = Math.log2(size);
  const order = bracketOrder(size);
  const slots: CricketBracketSlot[] = [];
  // Who fills each place of the round being drawn: a seed (or null for a
  // bye) in the first round, then the winner of the place pair before.
  let places: (CricketTeamSource | null)[] = order.map((seed) => seeds[seed - 1] ?? null);
  // The round before's matches, for the 3rd-place match (only when both
  // semi-finals are played — a bye leaves no loser).
  let previousWinners: string[] = [];
  for (let round = rounds - 1; round >= 0; round -= 1) {
    const { stage, prefix, label } = ROUNDS[round];
    const pairs = Array.from({ length: places.length / 2 }, (_, i) => [places[i * 2], places[i * 2 + 1]] as const);
    const played = pairs.filter(([home, away]) => home && away).length;
    let number = 0;
    const next: (CricketTeamSource | null)[] = [];
    const winners: string[] = [];
    for (const [home, away] of pairs) {
      if (!home || !away) {
        // A bye: whoever is there goes through without playing.
        next.push(home ?? away);
        continue;
      }
      number += 1;
      const code = played === 1 ? (round === 0 ? prefix : `${prefix}1`) : `${prefix}${number}`;
      if (round === 0 && thirdPlace && previousWinners.length === 2) {
        slots.push(slot("3P", "3rd Place", "third-place", loser(previousWinners[0]), loser(previousWinners[1])));
      }
      slots.push(slot(code, played === 1 ? label : `${label} ${number}`, stage, home, away));
      next.push(winner(code));
      winners.push(code);
    }
    previousWinners = pairs.length === 2 && winners.length === 2 ? winners : [];
    places = next;
  }
  return slots;
}

// The draw (team indexes in seed order) a knockout phase was built from:
// the same bracket drawn over seed numbers, matched slot by slot.
export function knockoutDraw(phase: CricketPhase): number[] {
  const teams = phase.slots.flatMap((s) => [s.home, s.away]).filter((source) => source.from === "team");
  if (teams.length < 2) return [];
  const numbered = Array.from({ length: teams.length }, (_, i): CricketTeamSource => ({ from: "team", teamIndex: i }));
  const plan = teams.length === 2 ? [slot("F", "Final", "final", numbered[0], numbered[1])] : bracket(numbered, false);
  const draw: number[] = [];
  const real = phase.slots.filter((s) => s.stage !== "third-place");
  plan.forEach((planned, i) => {
    const actual = real[i];
    if (!actual) return;
    for (const side of ["home", "away"] as const) {
      const seed = planned[side];
      const team = actual[side];
      if (seed.from === "team" && team.from === "team") draw[seed.teamIndex] = team.teamIndex;
    }
  });
  return draw.length === teams.length && draw.every((teamIndex) => teamIndex !== undefined) ? draw : teams.map((s) => (s as { teamIndex: number }).teamIndex);
}

// Crossover from groups, in bracket seed order: the group winners first,
// then each runner-up placed to meet the winner of the paired group (A1 v
// B2, B1 v A2, C1 v D2, D1 v C2), so two from one group meet in the final
// at the earliest.
function crossover(groupCount: number, qualify: number, phaseId: string): CricketTeamSource[] {
  const names = GROUP_NAMES.slice(0, groupCount);
  const winners = names.map((name) => rank(phaseId, name, 1));
  if (qualify === 1) return winners;
  const partner = (i: number) => i ^ 1;
  const runnersUp = names.map((_, j) => rank(phaseId, names[partner(groupCount - 1 - j)], 2));
  return [...winners, ...runnersUp];
}

// The phases for a preset. `groups` is the first phase's teams (one list
// for a league or series, one per group, or the knockout draw order).
export function buildFormat(id: PresetId, options: PresetOptions, groups: number[][]): CricketFormat {
  const { legs, qualify, thirdPlace } = options;
  const top = (count: number) => Array.from({ length: count }, (_, i) => rank("p1", null, i + 1));
  let phases: CricketPhase[];
  switch (id) {
    case "ipl": {
      const [first, second, third, fourth] = top(4);
      phases = [
        roundRobin("p1", "League", groups, legs, 4),
        knockout("p2", "Playoffs", [
          slot("Q1", "Qualifier 1", "qualifier-1", first, second),
          slot("E", "Eliminator", "eliminator", third, fourth),
          slot("Q2", "Qualifier 2", "qualifier-2", loser("Q1"), winner("E")),
          slot("F", "Final", "final", winner("Q1"), winner("Q2")),
        ]),
      ];
      break;
    }
    case "league-semis":
      phases = [roundRobin("p1", "League", groups, legs, 4), knockout("p2", "Playoffs", semisAndFinal(top(4), thirdPlace))];
      break;
    case "league-final":
    case "tri-series": {
      const [first, second] = top(2);
      phases = [
        roundRobin("p1", id === "tri-series" ? "Tri-series" : "League", groups, legs, 2),
        knockout("p2", "Final", [slot("F", "Final", "final", first, second)]),
      ];
      break;
    }
    case "groups-knockout": {
      const seeds = crossover(groups.length, qualify, "p1");
      phases = [
        roundRobin("p1", "Group Stage", groups, legs, qualify),
        knockout("p2", "Knockouts", seeds.length === 2 ? [slot("F", "Final", "final", seeds[0], seeds[1])] : bracket(seeds, thirdPlace)),
      ];
      break;
    }
    case "groups-super": {
      const names = GROUP_NAMES.slice(0, groups.length);
      const seeds = Array.from({ length: qualify }, (_, place) => names.map((name) => rank("p1", name, place + 1))).flat();
      const superCount = seeds.length;
      const superName = `Super ${superCount}`;
      const playoffs = superCount >= 4 ? 4 : 2;
      const places = Array.from({ length: playoffs }, (_, i) => rank("p2", null, i + 1));
      phases = [
        roundRobin("p1", "Group Stage", groups, legs, qualify),
        {
          ...roundRobin("p2", superName, [[]], 1, playoffs),
          groups: [{ name: "A", teamIndexes: [], seeds }],
          carryPoints: true,
        },
        knockout(
          "p3",
          "Playoffs",
          playoffs === 4 ? semisAndFinal(places, thirdPlace) : [slot("F", "Final", "final", places[0], places[1])],
        ),
      ];
      break;
    }
    case "knockout": {
      const draw = groups.flat().map((teamIndex): CricketTeamSource => ({ from: "team", teamIndex }));
      phases = [knockout("p1", "Knockout", draw.length === 2 ? [slot("F", "Final", "final", draw[0], draw[1])] : bracket(draw, thirdPlace))];
      break;
    }
    case "series":
      phases = [{ ...roundRobin("p1", `${options.seriesLength}-match series`, groups, options.seriesLength, 1), kind: "series" }];
      break;
  }
  // A set number of matches per team applies to the opening league / groups.
  if (options.matchesPerTeam && phases[0].kind === "round-robin") {
    phases[0] = { ...phases[0], legs: 1, matchesPerTeam: options.matchesPerTeam };
  }
  return { preset: id, phases };
}

// The first phase's teams split into groups, in turn (snake order keeps
// the seeding even: A B B A A B ...).
export function snakeGroups(teamIndexes: number[], groupCount: number): number[][] {
  const groups: number[][] = Array.from({ length: groupCount }, () => []);
  teamIndexes.forEach((teamIndex, i) => {
    const lap = Math.floor(i / groupCount);
    const pos = i % groupCount;
    groups[lap % 2 === 0 ? pos : groupCount - 1 - pos].push(teamIndex);
  });
  return groups;
}
