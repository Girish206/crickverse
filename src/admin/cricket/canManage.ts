import type { CricketMatch, CricketTournament } from "../../api/types";

interface Viewer {
  sub: string;
  isSuperAdmin: boolean;
}

const createdBy = (createdById: number | null, viewer: Viewer) =>
  createdById !== null && String(createdById) === viewer.sub;

// The tournament's creator, or a co-organiser (a player in organiserIds —
// matched by the viewer's own player, which comes from useCricketMe).
const organises = (tournament: CricketTournament, viewer: Viewer, myPlayerId: number | null | undefined) =>
  createdBy(tournament.createdById, viewer) ||
  (myPlayerId != null && (tournament.organiserIds ?? []).includes(myPlayerId));

// Super admins manage everything; anyone else the tournaments they created
// or were made a co-organiser of. Mirrors canManageTournament() in the API.
export function canManageTournament(
  viewer: Viewer | null,
  tournament: CricketTournament | undefined,
  myPlayerId?: number | null,
) {
  if (!viewer) return false;
  return viewer.isSuperAdmin || Boolean(tournament && organises(tournament, viewer, myPlayerId));
}

// A match is also managed by its own creator and its tournament's
// organisers.
export function canManageMatch(
  viewer: Viewer | null,
  match: CricketMatch | undefined,
  tournament: CricketTournament | undefined,
  myPlayerId?: number | null,
) {
  if (!viewer) return false;
  if (viewer.isSuperAdmin) return true;
  if (match && createdBy(match.createdById, viewer)) return true;
  return Boolean(match?.tournamentId && tournament && organises(tournament, viewer, myPlayerId));
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
  if (canManageMatch(viewer, match, tournament, myPlayerId)) return "organise";
  if (!viewer || !match || myPlayerId == null) return null;
  if (match.teams.some((team) => team.captainId === myPlayerId)) return "captain";
  if (match.scorerIds.includes(myPlayerId) || tournament?.scorerIds.includes(myPlayerId)) return "score";
  return null;
}
