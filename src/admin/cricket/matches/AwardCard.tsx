import type { ReactNode } from "react";
import { PlayerAvatar } from "../players/PlayerAvatar";

// One "hero" award (player of the match, best batter…): the winner's photo
// with the award as a ribbon, then their name, team, figures and points.
// Shared by match awards and tournament stats.
export function AwardCard({
  title,
  icon,
  name,
  photoUrl,
  team,
  line,
  pointsLabel = "Pts",
  points,
  note,
  featured,
}: {
  title: string;
  icon: string;
  name: string;
  photoUrl?: string | null;
  team?: string;
  line: ReactNode;
  pointsLabel?: string;
  points: ReactNode;
  note?: string;
  featured?: boolean;
}) {
  return (
    <article className={`cricket-award ${featured ? "is-featured" : ""}`}>
      <div className="cricket-award-photo">
        <PlayerAvatar name={name} photoUrl={photoUrl} className="cricket-award-avatar" />
        <span className="cricket-award-title">
          <i className={`fa-solid ${icon}`} aria-hidden="true"></i> {title}
        </span>
      </div>
      <div className="cricket-award-body">
        <strong className="cricket-award-name">{name}</strong>
        <div className="cricket-award-meta">
          <span className="cricket-award-team">{team ?? note ?? ""}</span>
          <span className="cricket-award-label">{pointsLabel}</span>
        </div>
        <div className="cricket-award-figures">
          <span className="cricket-award-line">{line}</span>
          <span className="cricket-award-points">{points}</span>
        </div>
        {team && note && <small className="cricket-award-note">{note}</small>}
      </div>
    </article>
  );
}
