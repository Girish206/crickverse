import { useState } from "react";
import type { CricketMatch } from "../../../api/types";
import { useSetCricketPlayerOfMatch } from "../../../api/hooks/cricket/useCricketMatches";
import { BottomSheet } from "../BottomSheet";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { matchImpact, points, tookPart, type NameOf } from "../stats";
import { usePlayerPhotos } from "./matchUtils";

// Organiser's override of the player of the match: a one-line summary with
// a "Change" button that opens a tap-friendly list of the players, ranked by
// impact, with "Auto" (top impact) first.
export function PotmPicker({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  const [open, setOpen] = useState(false);
  const setPlayerOfMatch = useSetCricketPlayerOfMatch();
  const photoOf = usePlayerPhotos();
  const rows = matchImpact(match);
  const auto = rows.find(tookPart)?.playerId ?? null;
  const ranked = new Set(rows.map((row) => row.playerId));
  // Everyone in the XIs; those who didn't feature come last with no points.
  const players = [
    ...rows,
    ...match.teams.flatMap((team, slot) =>
      team.playerIds.filter((id) => !ranked.has(id)).map((playerId) => ({ playerId, team: slot, total: null })),
    ),
  ];
  const picked = match.playerOfMatchId ?? null;

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
            <small>{picked !== null ? " · Picked by you" : " · Auto (top impact)"}</small>
          </strong>
        </div>
        <button type="button" className="cricket-potm-change" onClick={() => setOpen(true)}>
          <i className="fa-solid fa-pen" aria-hidden="true"></i> Change
        </button>
      </div>

      {open && (
        <BottomSheet title="Player of the match" onClose={() => setOpen(false)}>
          <ul className="cricket-potm-list">
            <li>
              <button type="button" className={picked === null ? "is-selected" : ""} onClick={() => choose(null)}>
                <span className="cricket-potm-auto" aria-hidden="true">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                </span>
                <span className="cricket-potm-who">
                  <strong>Auto</strong>
                  <small>Top impact{auto !== null ? ` · ${nameOf(auto)}` : ""}</small>
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
