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
}

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
  // Players who may score (and edit) its matches / it; see canManage.ts.
  scorerIds: number[];
  // The account that created it (null on older ones); see canManage.ts.
  createdById: number | null;
  createdAt: string;
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

// "retired-hurt" isn't a wicket — the batter can come back.
export type CricketWicketType = "bowled" | "caught" | "lbw" | "run-out" | "stumped" | "hit-wicket" | "retired-hurt";

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
  // Where the shot went (the scorer's shot map; see ShotMap.tsx): -1..1
  // with the pitch at the centre, bowler's end up, off side right. Null or
  // missing = not marked.
  shotX?: number | null;
  shotY?: number | null;
  shotZone?: string | null;
}

export interface CricketInnings {
  // 0 or 1: index into the match's teams.
  battingTeam: number;
  strikerId: number | null;
  nonStrikerId: number | null;
  bowlerId: number | null;
  closed: boolean;
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
