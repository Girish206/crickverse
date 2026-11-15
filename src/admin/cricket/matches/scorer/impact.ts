import { ballsPerOverOf, type CricketMatch } from "../../../../api/types";
import { isLegal } from "../../stats";

// Why this player can't be swapped out right now, if they can't (the API
// holds to the same): a batter at the crease, or the bowler mid-over.
export function cantGoOut(match: CricketMatch, team: number, playerId: number) {
  const innings = match.innings.at(-1);
  if (!innings || innings.closed) return null;
  if (innings.battingTeam === team && (innings.strikerId === playerId || innings.nonStrikerId === playerId)) return "At the crease";
  const legal = innings.balls.filter(isLegal).length;
  if (innings.battingTeam !== team && innings.bowlerId === playerId && legal % ballsPerOverOf(match) !== 0) return "Bowling this over";
  return null;
}
