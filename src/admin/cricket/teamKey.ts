import type { CricketMatch } from "../../api/types";

// Which team a side is, the same rule as the server's effectiveTeamKey: a
// tournament match's sides are its tournament teams, and an older one-off
// side without a key is its name plus the match's creator, so two people's
// same-named teams stay apart.
export function teamKeyOf(match: CricketMatch, slot: number) {
  const side = match.teams[slot];
  if (match.tournamentId !== null) return `t:${match.tournamentId}:${side.teamIndex}`;
  return side.teamKey ?? `legacy:${match.createdById ?? 0}:${side.name.trim().toLowerCase()}`;
}
