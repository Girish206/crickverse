// Shapes returned by the shared API (portfolio-server) for /admin/cricket.
export type CricketPlayerRole = "batter" | "bowler" | "all-rounder" | "wicket-keeper";

export interface CricketPlayer {
  id: number;
  name: string;
  role: CricketPlayerRole | null;
  // Profile photo (/api/files/<id>); null = show their initial.
  photoUrl: string | null;
  // Super admins only: digits only, unique; null on players added before
  // numbers were required. Players see neither field for anyone.
  mobile?: string | null;
  // Whether they can sign in to see their own stats (an account with the
  // same mobile and cricket access).
  hasLogin?: boolean;
  createdAt?: string;
}

// The signed-in user's cricket identity (GET /admin/cricket/me).
export interface CricketMe {
  // The player whose mobile matches the account's; null if none does.
  player: CricketPlayer | null;
  accountMobile: string | null;
  tournaments: CricketTournament[];
  matches: CricketMatch[];
  // Tournaments they follow (or follow a team in), those tournaments'
  // matches (a followed team's only) and the matches of players they
  // follow, leaving out ones they play in.
  followedTournaments: CricketTournament[];
  followedMatches: CricketMatch[];
  followedPlayerMatches: CricketMatch[];
  // The ones they created (and so organise).
  createdTournaments: CricketTournament[];
  createdMatches: CricketMatch[];
  // The ones they were made a scorer of (a tournament's scorers score all
  // its matches).
  scoringTournaments: CricketTournament[];
  scoringMatches: CricketMatch[];
  // Teams made outside a tournament that they created or play for.
  savedTeams: CricketSavedTeam[];
}

// A team made outside any tournament ("Create team"). One-off matches that
// pick it carry its teamKey ("f:<uuid>") on their side.
export interface CricketSavedTeam {
  id: number;
  teamKey: string;
  name: string;
  playerIds: number[];
  captainId: number | null;
  viceCaptainId: number | null;
  keeperId: number | null;
  createdById: number;
  createdAt: string;
}

export type CricketFollowKind = "player" | "team" | "tournament";

// What's followed: a player or tournament by id, or a team by its
// tournament's id plus its index (teamIndex is null for the other kinds).
export interface CricketFollowTarget {
  kind: CricketFollowKind;
  targetId: number;
  teamIndex: number | null;
}

export interface CricketFollow extends CricketFollowTarget {
  id: number;
  followerId: number;
  createdAt: string;
}

// The signed-in player's follows; playerId is null when the account has no
// player (and so can't follow anything).
export interface CricketMyFollows {
  playerId: number | null;
  follows: CricketFollow[];
}

export interface CricketFollowCounts {
  followers: number;
  // Players only: how many they follow.
  following: number | null;
}

// A side's captain, vice-captain and wicket-keeper (null = not picked).
export interface CricketTeamRoles {
  captainId: number | null;
  viceCaptainId: number | null;
  keeperId: number | null;
}

export interface CricketTeam {
  name: string;
  playerIds: number[];
  // Leadership, each one of playerIds; null / missing = not picked.
  captainId?: number | null;
  viceCaptainId?: number | null;
  keeperId?: number | null;
  // Built by hand or copied from another tournament; missing = generated
  // from matched sets. Generating only refills the generated teams.
  manual?: boolean;
}

// Teams generated from matched sets (the ones generating refills).
export const isGeneratedTeam = (team: CricketTeam) => !team.manual;

// Players judged equal in strength — generating teams sends each one to a
// different team. Holds at most one player per team.
export interface CricketMatchSet {
  playerIds: number[];
}

export interface CricketTournament {
  id: number;
  name: string;
  // The squad picked from the shared player list; only they can be matched.
  playerIds: number[];
  // One per team; players are empty until teams are generated.
  teams: CricketTeam[];
  matchSets: CricketMatchSet[];
  generatedAt: string | null;
  // Details (all null on tournaments made before they existed). Images are
  // /api/files/<id> paths.
  logoUrl: string | null;
  bannerUrl: string | null;
  city: string | null;
  ground: string | null;
  organiserName: string | null;
  organiserMobile: string | null;
  organiserEmail: string | null;
  startDate: string | null;
  endDate: string | null;
  category: CricketCategory | null;
  ballType: CricketBallType | null;
  pitchType: CricketPitchType | null;
  matchType: CricketMatchType | null;
  // Default overs per innings for its matches.
  overs: number | null;
  // How it's played (league, groups, playoffs, series...); null = not set
  // up, and every match counts towards one points table. See format/.
  format?: CricketFormat | null;
  // Players who may score (and edit) its matches / it; see canManage.ts.
  scorerIds: number[];
  // The account that created it (null on older ones); see canManage.ts.
  createdById: number | null;
  createdAt: string;
}

// ===== Tournament format =====
// The phases a tournament is played in, in order: a league or groups
// (round-robin), a knockout bracket, or a series between two teams.

export type CricketPhaseKind = "round-robin" | "knockout" | "series";

// Where a bracket (or super-league) team comes from: a team picked
// outright, a finishing place in an earlier phase (group null = its only
// group), or the winner / loser of a knockout match.
export type CricketTeamSource =
  | { from: "team"; teamIndex: number }
  | { from: "rank"; phaseId: string; group: string | null; rank: number }
  | { from: "winner" | "loser"; slot: string };

export interface CricketPhaseGroup {
  name: string;
  // Filled in when the phase starts (straight away for the first one).
  teamIndexes: number[];
  // A later phase's teams: where they come from.
  seeds: CricketTeamSource[];
}

// One knockout match: "Q1", "SF2", "F".
export interface CricketBracketSlot {
  code: string;
  label: string;
  stage: CricketMatchStage;
  home: CricketTeamSource;
  away: CricketTeamSource;
}

export interface CricketPhase {
  id: string;
  name: string;
  kind: CricketPhaseKind;
  groups: CricketPhaseGroup[];
  // Round-robin: times each pair meets; series: its matches.
  legs: number;
  // Round-robin: each team plays just this many (fewer than everyone once,
  // legs 1), no opponent twice. Missing / null = everyone, `legs` times.
  matchesPerTeam?: number | null;
  // Round-robin: how many from each group go through.
  qualify: number;
  // Super league: results between its teams in the earlier phase count.
  carryPoints: boolean;
  slots: CricketBracketSlot[];
}

export interface CricketFormat {
  // Which preset it was built from (formatPresets.ts).
  preset: string;
  phases: CricketPhase[];
  // How its matches are scheduled, so later rounds follow suit.
  schedule?: CricketSchedulePrefs;
}

export interface CricketSchedulePrefs {
  // Every match on one day, back to back.
  oneDay: boolean;
  // Weekdays played on (0 = Sunday ... 6 = Saturday).
  days: number[];
  // Matches a day when the end date isn't fixed.
  perDay: number;
  // "HH:MM", the day's first match.
  time: string;
  minutesBetween: number;
  // Matches at the same time, on different pitches.
  pitches: number;
}

export type CricketCategory =
  | "open"
  | "corporate"
  | "community"
  | "school"
  | "other"
  | "series"
  | "college"
  | "university";
export type CricketBallType = "tennis" | "leather" | "other";
export type CricketPitchType = "rough" | "cement" | "turf" | "astroturf" | "matting";
export type CricketMatchType = "limited-overs" | "box" | "pair" | "test" | "hundred";

export type CricketExtraType = "wide" | "no-ball" | "bye" | "leg-bye";

// How a batter left. "retired-hurt" and "retired" aren't wickets (the
// batter can come back); "absent-hurt" isn't either, but they can't bat.
export type CricketWicketType =
  | "bowled"
  | "caught"
  | "caught-behind"
  | "lbw"
  | "run-out"
  | "stumped"
  | "hit-wicket"
  | "hit-ball-twice"
  | "obstructing-field"
  | "retired-out"
  | "timed-out"
  | "retired-hurt"
  | "retired"
  | "absent-hurt";

export interface CricketBall {
  // Who was in place when it was bowled.
  batterId: number;
  nonStrikerId: number;
  bowlerId: number;
  // Runs off the bat.
  runs: number;
  extraType: CricketExtraType | null;
  // A wide/no-ball counts its 1-run penalty plus anything run.
  extras: number;
  wicketType: CricketWicketType | null;
  dismissedId: number | null;
  fielderId: number | null;
  // A run-out's second fielder (the one who broke the stumps), when two
  // were involved. Missing on older balls.
  secondFielderId?: number | null;
  // An event between deliveries (a retirement, a Mankad, a timed out): no
  // ball bowled, so it counts for no batter, bowler or over.
  noDelivery?: boolean | null;
  // Where the shot went (the scorer's shot map; see ShotMap.tsx): -1..1
  // with the pitch at the centre, bowler's end up, off side right. Null or
  // missing = not marked.
  shotX?: number | null;
  shotY?: number | null;
  shotZone?: string | null;
  // When it was recorded. Missing on older balls.
  at?: string | null;
}

export interface CricketInnings {
  // 0 or 1: index into the match's teams.
  battingTeam: number;
  strikerId: number | null;
  nonStrikerId: number | null;
  bowlerId: number | null;
  closed: boolean;
  // When it was closed; it started with its first ball's `at`. Missing
  // on older innings.
  closedAt?: string | null;
  balls: CricketBall[];
}

export interface CricketMatchTeam {
  // Index into the tournament's teams.
  teamIndex: number;
  name: string;
  // Playing XI (the team's roster until the match starts).
  playerIds: number[];
  // This match's leaders (copied from the tournament team; set at the start).
  captainId?: number | null;
  viceCaptainId?: number | null;
  keeperId?: number | null;
  // Which team a one-off side is ("t:<tournamentId>:<index>" or "f:<uuid>");
  // missing on tournament matches and older one-offs. Read it through
  // teamKeyOf.
  teamKey?: string | null;
}

export type CricketMatchStatus = "scheduled" | "live" | "completed" | "abandoned";

export type CricketMatchStage =
  | "league"
  | "group"
  | "super-league"
  | "round-of-16"
  | "quarter-final"
  | "eliminator"
  | "qualifier-1"
  | "qualifier-2"
  | "semi-final"
  | "third-place"
  | "final"
  | "friendly";

// Every ground and city already used on a match or tournament.
export interface CricketPlaces {
  grounds: string[];
  cities: string[];
}

export interface CricketMatch {
  id: number;
  // Null for a standalone match.
  tournamentId: number | null;
  teams: CricketMatchTeam[];
  overs: number;
  scheduledAt: string | null;
  venue: string | null;
  stage: CricketMatchStage | null;
  // Its place in the tournament's format: phase id, group ("A") and
  // knockout / series slot ("Q1", "M2"). Missing on matches made by hand.
  phaseId?: string | null;
  group?: string | null;
  slot?: string | null;
  city: string | null;
  matchType: CricketMatchType | null;
  ballType: CricketBallType | null;
  pitchType: CricketPitchType | null;
  status: CricketMatchStatus;
  tossWinner: number | null;
  tossDecision: "bat" | "bowl" | null;
  innings: CricketInnings[];
  // 0 or 1; null for a tie or no result.
  winner: number | null;
  resultText: string | null;
  playerOfMatchId: number | null;
  // Players who may score (and edit) its matches / it; see canManage.ts.
  scorerIds: number[];
  // Who's scoring it right now (one person at a time; see useScoringSeat):
  // their account and name.
  scoringById?: number | null;
  scoringByName?: string | null;
  // The account that created it (null on older ones); see canManage.ts.
  createdById: number | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  data: T;
}
