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
}

export interface CricketTeam {
  name: string;
  playerIds: number[];
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
}

export type CricketMatchStatus = "scheduled" | "live" | "completed" | "abandoned";

export type CricketMatchStage = "league" | "quarter-final" | "semi-final" | "final";

export interface CricketMatch {
  id: number;
  tournamentId: number;
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
