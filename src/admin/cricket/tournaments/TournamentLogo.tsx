import type { CricketTournament } from "../../../api/types";
import { logoFor } from "./tournamentArt";

// The tournament's logo (or its stock one) as a small round badge.
export function TournamentLogo({
  tournament,
  className = "",
}: {
  tournament: Pick<CricketTournament, "id" | "logoUrl">;
  className?: string;
}) {
  return (
    <span
      className={`cricket-tour-badge ${className}`.trim()}
      style={{ backgroundImage: `url(${logoFor(tournament)})` }}
      aria-hidden="true"
    />
  );
}
