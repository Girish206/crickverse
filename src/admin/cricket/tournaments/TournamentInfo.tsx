import type { ReactNode } from "react";
import type { CricketMatch, CricketTournament } from "../../../api/types";
import { BallTypeBadge } from "../CricketChoices";
import { CATEGORIES, labelOf, MATCH_TYPES, PITCH_TYPES } from "../cricketOptions";
import { OrganiserCard } from "../OrganiserCard";
import { usePlayerNames, usePlayerPhotos } from "../matches/matchUtils";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { PlayerLink } from "../players/PlayerProfileSheet";

const dateText = (value: string) =>
  new Date(value)
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .replace(/ /g, "-");

// Who scores the tournament's matches, each a link to their profile.
function ScorerChips({ playerIds }: { playerIds: number[] }) {
  const nameOf = usePlayerNames();
  const photoOf = usePlayerPhotos();
  if (playerIds.length === 0) return <>Match captains</>;
  return (
    <span className="cricket-scorer-chips">
      {playerIds.map((playerId) => (
        <span key={playerId} className="cricket-scorer-chip">
          <PlayerAvatar name={nameOf(playerId)} photoUrl={photoOf(playerId)} className="cricket-scorer-chip-avatar" />
          <PlayerLink playerId={playerId}>{nameOf(playerId)}</PlayerLink>
        </span>
      ))}
    </span>
  );
}

// The "Info" tab of a tournament: the details card, then who organised it.
export function TournamentInfo({ tournament: t, matches }: { tournament: CricketTournament; matches: CricketMatch[] }) {
  const completed = matches.filter((m) => m.status === "completed").length;
  const venue = [t.ground, t.city].filter(Boolean).join(", ");
  const rows: [string, ReactNode][] = [
    [
      "Dates",
      t.startDate
        ? `${dateText(t.startDate)}${t.endDate && t.endDate !== t.startDate ? ` to ${dateText(t.endDate)}` : ""}`
        : "Not set",
    ],
    ["Venue", venue || "Not set"],
    ["Category", labelOf(CATEGORIES, t.category) ?? "Not set"],
    ["Match type", labelOf(MATCH_TYPES, t.matchType) ?? "Not set"],
    ["Overs", t.overs ?? "Not set"],
    ["Ball type", t.ballType ? <BallTypeBadge key="ball" value={t.ballType} /> : "Not set"],
    ["Pitch type", labelOf(PITCH_TYPES, t.pitchType) ?? "Not set"],
    ["Teams", t.teams.length ? t.teams.map((team) => team.name).join(", ") : "Not picked yet"],
    ["Scorers", <ScorerChips key="scorers" playerIds={t.scorerIds} />],
    ["Squad", `${t.playerIds.length} player${t.playerIds.length === 1 ? "" : "s"}`],
    ["Matches", matches.length ? `${matches.length} (${completed} completed)` : "None yet"],
    ["Tournament ID", t.id],
  ];
  return (
    <div className="cricket-info">
      <dl className="cricket-info-card">
        {rows.map(([label, value]) => (
          <div key={label} className="cricket-info-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {(t.organiserName || t.organiserMobile || t.organiserEmail) && (
        <OrganiserCard name={t.organiserName} mobile={t.organiserMobile} email={t.organiserEmail} />
      )}
    </div>
  );
}
