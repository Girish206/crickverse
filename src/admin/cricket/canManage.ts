import type { CricketMatch, CricketTournament } from "../../api/types";

interface Viewer {
  sub: string;
  isSuperAdmin: boolean;
}

const createdBy = (createdById: number | null, viewer: Viewer) =>
  createdById !== null && String(createdById) === viewer.sub;

// Super admins manage everything; anyone else the tournaments they created.
// Mirrors canManageTournament() in the API.
export function canManageTournament(viewer: Viewer | null, tournament: CricketTournament | undefined) {
  if (!viewer) return false;
  return viewer.isSuperAdmin || Boolean(tournament && createdBy(tournament.createdById, viewer));
}

// A match is also managed by its own creator and its tournament's creator.
export function canManageMatch(
  viewer: Viewer | null,
  match: CricketMatch | undefined,
  tournament: CricketTournament | undefined,
) {
  if (!viewer) return false;
  if (viewer.isSuperAdmin) return true;
  if (match && createdBy(match.createdById, viewer)) return true;
  return Boolean(match?.tournamentId && tournament && createdBy(tournament.createdById, viewer));
}

// What the viewer may do with a match (mirrors matchAccessOf() in the API):
// "organise" deletes it, "captain" (either side's captain) also picks its
// scorers, "score" (its and its tournament's scorers) edits, starts and
// scores it — as do the two above. myPlayerId is the viewer's own player.
export type MatchAccess = "organise" | "captain" | "score";

export function matchAccess(
  viewer: Viewer | null,
  match: CricketMatch | undefined,
  tournament: CricketTournament | undefined,
  myPlayerId: number | null | undefined,
): MatchAccess | null {
  if (canManageMatch(viewer, match, tournament)) return "organise";
  if (!viewer || !match || myPlayerId == null) return null;
  if (match.teams.some((team) => team.captainId === myPlayerId)) return "captain";
  if (match.scorerIds.includes(myPlayerId) || tournament?.scorerIds.includes(myPlayerId)) return "score";
  return null;
}
