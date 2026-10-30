import { useState } from "react";
import type { CricketMatch } from "../../../api/types";
import { useSetCricketPlayerOfMatch } from "../../../api/hooks/cricket/useCricketMatches";
import { BottomSheet } from "../BottomSheet";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { autoPlayerOfMatch, matchImpact, points, type NameOf } from "../stats";
import { usePlayerPhotos } from "./matchUtils";

// Organiser's override of the player of the match: a one-line summary with
// a "Change" button that opens a tap-friendly list of players from the winning
// team (or both if tied), ranked by MVP points, with "Auto" (winning team's top scorer) first.
export function PotmPicker({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  const [open, setOpen] = useState(false);
  const setPlayerOfMatch = useSetCricketPlayerOfMatch();
  const photoOf = usePlayerPhotos();
  const rows = matchImpact(match);
  const auto = autoPlayerOfMatch(match, rows)?.playerId ?? null;
  const picked = match.playerOfMatchId ?? null;

  const winningTeam = match.winner;
  const winningTeamName = winningTeam !== null ? match.teams[winningTeam]?.name : null;
  const eligibleRows = winningTeam !== null ? rows.filter((r) => r.team === winningTeam) : rows;
  const eligibleTeams = winningTeam !== null ? [winningTeam] : [0, 1];
  const ranked = new Set(eligibleRows.map((row) => row.playerId));
  // Everyone in the winning team's XI (or both if tied); those who didn't feature come last with no points.
  let players = [
    ...eligibleRows,
    ...eligibleTeams.flatMap((slot) =>
      match.teams[slot].playerIds
        .filter((id) => !ranked.has(id))
        .map((playerId) => ({ playerId, team: slot, total: null })),
    ),
  ];
  if (picked !== null && !players.some((p) => p.playerId === picked)) {
    const existing = rows.find((r) => r.playerId === picked) ?? {
      playerId: picked,
      team: Math.max(0, match.teams.findIndex((t) => t.playerIds.includes(picked))),
      total: null,
    };
    players = [existing as (typeof players)[number], ...players];
  }

  function choose(playerId: number | null) {
    setPlayerOfMatch.mutate({ id: match.id, playerId });
    setOpen(false);
  }

  return (
    <>
      <div className="cricket-potm-row">
        <div className="cricket-potm-row-text">
          <span>Player of the match</span>
          <strong>
            {picked !== null ? nameOf(picked) : auto !== null ? nameOf(auto) : "—"}
            <small>
              {picked !== null
                ? " · Picked by you"
                : winningTeamName
                  ? ` · Auto (${winningTeamName})`
                  : " · Auto (top MVP points)"}
            </small>
          </strong>
        </div>
        <button type="button" className="cricket-potm-change" onClick={() => setOpen(true)}>
          <i className="fa-solid fa-pen" aria-hidden="true"></i> Change
        </button>
      </div>

      {open && (
        <BottomSheet
          title={winningTeamName ? `Player of the match · ${winningTeamName}` : "Player of the match"}
          onClose={() => setOpen(false)}
        >
          <ul className="cricket-potm-list">
            <li>
              <button type="button" className={picked === null ? "is-selected" : ""} onClick={() => choose(null)}>
                <span className="cricket-potm-auto" aria-hidden="true">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                </span>
                <span className="cricket-potm-who">
                  <strong>Auto</strong>
                  <small>
                    Top MVP points{winningTeamName ? ` (${winningTeamName})` : ""}
                    {auto !== null ? ` · ${nameOf(auto)}` : ""}
                  </small>
                </span>
                {picked === null && <i className="fa-solid fa-check cricket-potm-check" aria-hidden="true"></i>}
              </button>
            </li>
            {players.map((row) => (
              <li key={row.playerId}>
                <button
                  type="button"
                  className={picked === row.playerId ? "is-selected" : ""}
                  onClick={() => choose(row.playerId)}
                >
                  <PlayerAvatar
                    name={nameOf(row.playerId)}
                    photoUrl={photoOf(row.playerId)}
                    className="cricket-potm-avatar"
                  />
                  <span className="cricket-potm-who">
                    <strong>{nameOf(row.playerId)}</strong>
                    <small>{match.teams[row.team]?.name}</small>
                  </span>
                  <span className="cricket-potm-pts">{row.total !== null ? `${points(row.total)} pts` : "—"}</span>
                  {picked === row.playerId && (
                    <i className="fa-solid fa-check cricket-potm-check" aria-hidden="true"></i>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet>
      )}
    </>
  );
}
