import type { ReactNode } from "react";
import type { CricketPlayer } from "../../../api/types";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { PlayerLink } from "../players/PlayerProfileSheet";

const RING = 2 * Math.PI * 34;

// A team's Info tab: its captain, its win/loss record around a win-rate
// ring, then a few facts (players, matches, standings) as tiles.
export function TeamRecordCard({
  captain,
  played,
  won,
  lost,
  tied,
  tiedLabel = "Tied",
  facts,
}: {
  captain: CricketPlayer | undefined;
  played: number;
  won: number;
  lost: number;
  tied: number;
  tiedLabel?: string;
  facts: [string, ReactNode][];
}) {
  const winRate = played > 0 ? Math.round((won / played) * 100) : null;
  return (
    <div className="cricket-team-record">
      <div className="cricket-team-record-captain">
        {captain ? (
          <PlayerAvatar name={captain.name} photoUrl={captain.photoUrl} className="cricket-team-record-avatar" />
        ) : (
          <span className="cricket-team-record-avatar is-empty" aria-hidden="true">
            <i className="fa-solid fa-user"></i>
          </span>
        )}
        <span>
          <small>
            <i className="fa-solid fa-crown" aria-hidden="true"></i> Captain
          </small>
          <strong>{captain ? <PlayerLink playerId={captain.id}>{captain.name}</PlayerLink> : "Not picked yet"}</strong>
        </span>
      </div>

      <div className="cricket-team-record-main">
        <div
          className="cricket-team-record-ring"
          role="img"
          aria-label={winRate === null ? "No results yet" : `Won ${winRate}% of ${played} played`}
        >
          <svg viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r="34" className="track" />
            {winRate !== null && winRate > 0 && (
              <circle
                cx="40"
                cy="40"
                r="34"
                className="fill"
                strokeDasharray={`${(RING * winRate) / 100} ${RING}`}
              />
            )}
          </svg>
          <span>
            <strong>{winRate === null ? "—" : `${winRate}%`}</strong>
            <small>{winRate === null ? "No results" : "Win rate"}</small>
          </span>
        </div>
        <div className="cricket-team-record-wlt">
          {(
            [
              ["Won", won, "is-won"],
              ["Lost", lost, "is-lost"],
              [tiedLabel, tied, "is-tied"],
            ] as const
          ).map(([label, value, tone]) => (
            <div key={label} className={tone}>
              <strong>{value}</strong>
              <small>{label}</small>
            </div>
          ))}
          <p>
            {played} {played === 1 ? "match" : "matches"} played
          </p>
        </div>
      </div>

      <dl className="cricket-team-record-facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
