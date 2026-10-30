import { useState } from "react";
import type { CricketMatch } from "../../../api/types";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { PlayerLink } from "../players/PlayerProfileSheet";
import { impactLine, matchAwards, points, type NameOf } from "../stats";
import { PillSelect } from "../PillSelect";
import { MvpPointsHelp } from "./MvpPointsGuide";

// The "MVP" tab: everyone who took part, ranked by MVP points, with where
// their points came from.
export function MatchMvp({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  const [team, setTeam] = useState<number | null>(null);
  const { data: players } = useCricketPlayers();
  const photoOf = (playerId: number) => players?.find((player) => player.id === playerId)?.photoUrl;
  const awards = matchAwards(match);
  if (awards.rows.length === 0) {
    return <div className="admin-empty-state">The MVP ranking appears once the first ball is bowled.</div>;
  }
  const rows = awards.rows.filter((row) => team === null || row.team === team);
  const potmId = awards.playerOfMatch?.playerId ?? null;

  return (
    <div className="cricket-mvp">
      <div className="cricket-mvp-head">
        <PillSelect
          label="Team"
          value={team === null ? "both" : String(team)}
          options={[
            { value: "both", label: "Both teams" },
            ...[0, 1].map((slot) => ({ value: String(slot), label: match.teams[slot].name })),
          ]}
          onChange={(value) => setTeam(value === "both" ? null : Number(value))}
        />
        <MvpPointsHelp />
      </div>

      <ol className="cricket-mvp-list">
        {rows.map((row) => {
          const name = nameOf(row.playerId);
          const rank = awards.rows.indexOf(row) + 1;
          const parts = [
            row.batting ? `Bat ${points(row.batting)}` : null,
            row.bowling ? `Bowl ${points(row.bowling)}` : null,
            row.fielding ? `Field ${points(row.fielding)}` : null,
          ].filter(Boolean);
          return (
            <li key={row.playerId} className={`cricket-mvp-row ${rank === 1 ? "is-top" : ""}`}>
              <span className="cricket-mvp-rank">{rank}</span>
              <PlayerAvatar name={name} photoUrl={photoOf(row.playerId)} className="cricket-mvp-avatar" />
              <span className="cricket-mvp-body">
                <strong>
                  <PlayerLink playerId={row.playerId}>{name}</PlayerLink>
                  {row.playerId === potmId && (
                    <i className="fa-solid fa-medal" title="Player of the match" aria-label="Player of the match"></i>
                  )}
                </strong>
                <small>
                  {match.teams[row.team].name} · {impactLine(row) || "Did not score"}
                </small>
                {parts.length > 0 && <small className="cricket-mvp-split">{parts.join(" · ")}</small>}
              </span>
              <span className="cricket-mvp-total">
                {points(row.total)}
                <small>pts</small>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
