import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import type { CricketMatch } from "../../../api/types";
import { BALL_TYPES } from "../cricketOptions";
import { TeamMark } from "../teams/TeamMark";
import { MatchStatusBadge, type MatchTag } from "./matchUi";
import { battingOrder, formatMatchDate, matchStageLabel, teamInitials, teamScore } from "./matchUtils";

export interface LiveMatchCardProps {
  match: CricketMatch;
  tournamentName?: string;
  footnote?: string | null;
  tag?: MatchTag;
  className?: string;
}

/**
 * Dedicated Live Match Card component with theme background color.
 * Used on Home, My Matches, Tournaments Matches, and everywhere live matches appear.
 */
export function LiveMatchCard({
  match,
  tournamentName,
  footnote,
  tag,
  className = "",
}: LiveMatchCardProps) {
  const navigate = useNavigate();

  const open = () => {
    try {
      sessionStorage.removeItem(`view_match_${match.id}`);
    } catch {
      // ignore
    }
    navigate(`/matches/${match.id}`);
  };

  const ballType = BALL_TYPES.find((type) => type.value === match.ballType);
  const ballColor = ballType?.color;
  const ballLabel = ballType?.label;

  return (
    <div
      className={`cricket-match-card cricket-live-match-card is-live ${tag ? `has-tag is-${tag.tone}` : ""} ${className}`.trim()}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === "Enter" && open()}
      aria-label={`Live match: ${match.teams[0].name} vs ${match.teams[1].name}`}
    >
      {tag && (
        <div className="cricket-match-card-tag">
          <i className={tag.icon} aria-hidden="true" />
          <span>{tag.label}</span>
          {tag.aside && <span className="cricket-match-card-tag-aside">{tag.aside}</span>}
        </div>
      )}

      {/* Header: Stage, Tournament, and Live Status Badge */}
      <div className="cricket-match-card-top">
        <span className="cricket-match-card-meta">
          <span className="cricket-match-card-stage">{matchStageLabel(match)}</span>
          {tournamentName && (
            <span className="cricket-match-card-context" title={tournamentName}>
              {tournamentName}
            </span>
          )}
        </span>
        <MatchStatusBadge status="live" />
      </div>

      {/* Face-off: teams & scores */}
      <div className="cricket-match-card-teams">
        {battingOrder(match).map((slot, i) => {
          const team = match.teams[slot];
          const score = teamScore(match, slot);
          const isBattingNow = match.innings[match.innings.length - 1]?.battingTeam === slot;

          return (
            <Fragment key={slot}>
              {i === 1 && <span className="cricket-match-card-vs">vs</span>}
              <div className={`cricket-match-card-team ${isBattingNow ? "is-batting-now" : ""}`.trim()}>
                <TeamMark
                  className="cricket-match-card-badge"
                  name={team.name}
                  logoUrl={team.logoUrl}
                  text={teamInitials(team.name)}
                />
                <span className="cricket-match-card-name" title={team.name}>
                  {team.name}
                  {isBattingNow && (
                    <i
                      className="fa-solid fa-baseball-bat-ball cricket-match-card-batting-icon"
                      title="Batting now"
                      aria-label="Batting now"
                    />
                  )}
                </span>
                {score ? (
                  <span className={`cricket-match-card-score ${isBattingNow ? "is-current-score" : ""}`.trim()}>
                    {score.runs} <small>({score.overs})</small>
                  </span>
                ) : (
                  <span className="cricket-match-card-yet">Yet to bat</span>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>

      {/* Bottom meta: Date, Venue, Overs */}
      <div className="cricket-match-card-when">
        <span>
          <i className="fa-regular fa-calendar" aria-hidden="true" />
          {formatMatchDate(match.scheduledAt)}
        </span>
        {(match.venue || match.city) && (
          <span className="cricket-match-card-place" title={[match.venue, match.city].filter(Boolean).join(", ")}>
            <i className="fa-solid fa-location-dot" aria-hidden="true" />
            {[match.venue, match.city].filter(Boolean).join(", ")}
          </span>
        )}
        <span className="cricket-match-card-overs">
          <i
            className="fa-solid fa-baseball"
            style={ballColor ? { color: ballColor } : undefined}
            title={ballLabel ? `${ballLabel} ball` : undefined}
            aria-hidden="true"
          />
          {match.overs} {match.overs === 1 ? "over" : "overs"}
        </span>
      </div>

      {footnote && (
        <div className="cricket-match-card-note">
          <i className="fa-solid fa-user" aria-hidden="true" />
          <span>{footnote}</span>
        </div>
      )}
    </div>
  );
}
