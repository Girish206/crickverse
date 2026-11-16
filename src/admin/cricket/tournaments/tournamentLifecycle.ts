import type { CricketMatch, CricketTournament } from "../../../api/types";

// A tournament's stages, as the server enforces them (cricket.service.ts):
// - before its first match starts, teams can be auto-generated and an
//   auction started;
// - once marked finished it's locked: no new matches, and its teams, squads,
//   auction and format stay as they ended until it's reopened.

/** Has any of its matches got under way (live, finished or abandoned)? */
export const tournamentStarted = (matches: CricketMatch[] | undefined) =>
  (matches ?? []).some((match) => match.status !== "scheduled");

export const tournamentFinished = (tournament: Pick<CricketTournament, "finishedAt"> | undefined) =>
  Boolean(tournament?.finishedAt);

export const FINISHED_NOTE =
  "This tournament has finished, so its teams, matches and format are locked. Reopen it from the tournament's settings to change them.";
