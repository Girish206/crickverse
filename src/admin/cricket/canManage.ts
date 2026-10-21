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
