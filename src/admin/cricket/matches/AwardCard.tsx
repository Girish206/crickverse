import type { ReactNode } from "react";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { PlayerLink } from "../players/PlayerProfileSheet";

// Each award's ribbon colour, the same on match and tournament cards. Anything
// not listed (player of the match / tournament) keeps the primary red.
const AWARD_TONES: Record<string, string> = {
  mvp: "mvp",
  "mvp so far": "mvp",
  "fighter of the match": "fighter",
  "best batter": "batting",
  "most runs": "batting",
  "top run scorer": "batting",
  "highest score": "batting",
  "best bowler": "bowling",
  "best bowling": "bowling",
  "top wicket taker": "bowling",
  "best fielder": "fielding",
  "most catches": "fielding",
  "most sixes": "sixes",
  "most fours": "fours",
  "best strike rate": "strike",
  "best economy": "economy",
};

// One "hero" award (player of the match, best batter…): the winner's photo
// with the award as a ribbon, then their name, team, figures and points.
// Shared by match awards and tournament stats.
export function AwardCard({
  title,
  icon,
  playerId,
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
  // Tapping the name opens this player's profile.
  playerId: number;
  name: string;
  photoUrl?: string | null;
  team?: string;
  line: ReactNode;
  pointsLabel?: string;
  points: ReactNode;
  note?: string;
  featured?: boolean;
}) {
  const tone = AWARD_TONES[title.toLowerCase()];
  return (
    <article className={`cricket-award ${featured ? "is-featured" : ""}`}>
      <div className="cricket-award-photo">
        <PlayerAvatar name={name} photoUrl={photoUrl} className="cricket-award-avatar" />
        <span className={`cricket-award-title ${tone ? `is-${tone}` : ""}`.trim()}>
          <i className={`fa-solid ${icon}`} aria-hidden="true"></i> {title}
        </span>
      </div>
      <div className="cricket-award-body">
        <strong className="cricket-award-name">
          <PlayerLink playerId={playerId}>{name}</PlayerLink>
        </strong>
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
