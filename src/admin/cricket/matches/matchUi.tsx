import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import type { CricketMatch, CricketMatchStatus } from "../../../api/types";
import { BALL_TYPES } from "../cricketOptions";
import { formatMatchDate, battingOrder, matchStageLabel, teamInitials, teamScore } from "./matchUtils";
import { TeamMark } from "../teams/TeamMark";

const STATUS_LABELS: Record<CricketMatchStatus, string> = {
  scheduled: "Upcoming",
  live: "Live",
  completed: "Completed",
  abandoned: "No result",
};

export function MatchStatusBadge({ status }: { status: CricketMatchStatus }) {
  return (
    <span className={`cricket-match-status is-${status}`}>
      {status === "live" && <span className="cricket-live-dot" aria-hidden="true"></span>}
      {status === "completed" && <i className="fa-solid fa-circle-check" aria-hidden="true"></i>}
      {STATUS_LABELS[status]}
    </span>
  );
}

// Why a card is shown to this viewer (home page): a ribbon across the top,
// and "mine" cards are tinted so they stand out from followed ones.
export interface MatchTag {
  tone: "mine" | "organising" | "following";
  icon: string;
  label: string;
  // Right end of the ribbon, e.g. when an upcoming match starts.
  aside?: string;
}

// Between the two teams: when an upcoming match starts (time over date),
// else "vs".
function MatchCardCentre({ match }: { match: CricketMatch }) {
  if (match.status !== "scheduled") return <span className="cricket-match-card-vs">vs</span>;
  if (!match.scheduledAt) return <span className="cricket-match-card-when-centre"><strong>TBD</strong><small>Date not set</small></span>;
  const at = new Date(match.scheduledAt);
  return (
    <span className="cricket-match-card-when-centre">
      <strong>{at.toLocaleTimeString(undefined, { hour: "numeric", hour12: true, minute: "2-digit" })}</strong>
      <small>{at.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</small>
    </span>
  );
}

// The fixture/result card used on every match list; opens the match centre.
export function MatchCard({
  match,
  tournamentName,
  footnote,
  tag,
}: {
  match: CricketMatch;
  tournamentName?: string;
  // An extra line at the bottom, e.g. the viewer's own figures.
  footnote?: string | null;
  tag?: MatchTag;
}) {
  const navigate = useNavigate();
  const open = () => navigate(`/matches/${match.id}`);
  const decided = match.status === "completed" && match.winner !== null;
  const ballType = BALL_TYPES.find((type) => type.value === match.ballType);
  const ballColor = ballType?.color;
  const ballLabel = ballType?.label;
  return (
    <div
      className={`cricket-match-card is-${match.status}${tag ? ` has-tag is-${tag.tone}` : ""}`}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === "Enter" && open()}
    >
      {tag && (
        <div className="cricket-match-card-tag">
          <i className={tag.icon} aria-hidden="true"></i>
          <span>{tag.label}</span>
          {tag.aside && <span className="cricket-match-card-tag-aside">{tag.aside}</span>}
        </div>
      )}
      <div className="cricket-match-card-top">
        <span className="cricket-match-card-meta">
          <span className="cricket-match-card-stage">{matchStageLabel(match)}</span>
          {tournamentName && (
            <span className="cricket-match-card-context" title={tournamentName}>
              {tournamentName}
            </span>
          )}
        </span>
        <MatchStatusBadge status={match.status} />
      </div>

      {/* Face-off: first team · when (upcoming) or "vs" · second team, each
          team a centred column of badge, name and score. */}
      <div className="cricket-match-card-teams">
        {battingOrder(match).map((slot, i) => {
          const team = match.teams[slot];
          const score = teamScore(match, slot);
          const state = decided ? (match.winner === slot ? "is-winner" : "is-loser") : "";
          return (
            <Fragment key={slot}>
              {i === 1 && <MatchCardCentre match={match} />}
              <div className={`cricket-match-card-team ${state}`.trim()}>
                <TeamMark className="cricket-match-card-badge" name={team.name} logoUrl={team.logoUrl} text={teamInitials(team.name)} />
                <span className="cricket-match-card-name" title={team.name}>
                  {team.name}
                  {match.winner === slot && decided && (
                    <i className="fa-solid fa-trophy cricket-match-card-trophy" aria-label="Winner"></i>
                  )}
                </span>
                {score ? (
                  <span className="cricket-match-card-score">
                    {score.runs} <small>({score.overs})</small>
                  </span>
                ) : (
                  match.status === "live" && <span className="cricket-match-card-yet">Yet to bat</span>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>

      {match.resultText && <div className="cricket-match-card-result">{match.resultText}</div>}
      <div className="cricket-match-card-when">
        {match.status !== "scheduled" && (
          <span>
            <i className="fa-regular fa-calendar" aria-hidden="true"></i>
            {formatMatchDate(match.scheduledAt)}
          </span>
        )}
        {(match.venue || match.city) && (
          <span className="cricket-match-card-place" title={[match.venue, match.city].filter(Boolean).join(", ")}>
            <i className="fa-solid fa-location-dot" aria-hidden="true"></i>
            {[match.venue, match.city].filter(Boolean).join(", ")}
          </span>
        )}
        <span className="cricket-match-card-overs">
          {/* The ball in its type's colour (tennis green, leather red…). */}
          <i
            className="fa-solid fa-baseball"
            style={ballColor ? { color: ballColor } : undefined}
            title={ballLabel ? `${ballLabel} ball` : undefined}
            aria-hidden="true"
          ></i>
          {match.overs} {match.overs === 1 ? "over" : "overs"}
        </span>
      </div>
      {footnote && (
        <div className="cricket-match-card-note">
          <i className="fa-solid fa-user" aria-hidden="true"></i>
          <span>{footnote}</span>
        </div>
      )}
    </div>
  );
}
