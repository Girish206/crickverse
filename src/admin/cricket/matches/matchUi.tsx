import { useNavigate } from "react-router-dom";
import type { CricketMatch, CricketMatchStatus } from "../../../api/types";
import { avatarColorFor } from "../avatarColor";
import { formatMatchDate, battingOrder, matchStageLabel, teamScore } from "./matchUtils";

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

// "Test Strikers" → "TS", for the team badge.
function teamInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

// The fixture/result card used on every match list; opens the match centre.
export function MatchCard({
  match,
  tournamentName,
  footnote,
}: {
  match: CricketMatch;
  tournamentName?: string;
  // An extra line at the bottom, e.g. the viewer's own figures.
  footnote?: string | null;
}) {
  const navigate = useNavigate();
  const open = () => navigate(`/matches/${match.id}`);
  const decided = match.status === "completed" && match.winner !== null;
  return (
    <div
      className={`cricket-match-card is-${match.status}`}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === "Enter" && open()}
    >
      <div className="cricket-match-card-top">
        <span className="cricket-match-card-meta">
          <span className="cricket-match-card-stage">{matchStageLabel(match)}</span>
          <span className="cricket-match-card-context">
            {" · "}
            {tournamentName ? `${tournamentName} · ` : ""}
            {match.overs} ov
          </span>
        </span>
        <MatchStatusBadge status={match.status} />
      </div>

      <div className="cricket-match-card-teams">
        {battingOrder(match).map((slot) => {
          const team = match.teams[slot];
          const score = teamScore(match, slot);
          const state = decided ? (match.winner === slot ? "is-winner" : "is-loser") : "";
          return (
            <div className={`cricket-match-card-team ${state}`.trim()} key={slot}>
              <span className="cricket-match-card-badge" style={{ background: avatarColorFor(team.name) }} aria-hidden="true">
                {teamInitials(team.name)}
              </span>
              <span className="cricket-match-card-name">{team.name}</span>
              {match.winner === slot && decided && (
                <i className="fa-solid fa-trophy cricket-match-card-trophy" aria-label="Winner"></i>
              )}
              {score ? (
                <span className="cricket-match-card-score">
                  {score.runs} <small>({score.overs})</small>
                </span>
              ) : (
                match.status === "live" && <span className="cricket-match-card-yet">Yet to bat</span>
              )}
            </div>
          );
        })}
      </div>

      {(match.resultText || match.status === "live") && (
        <div className="cricket-match-card-result">{match.resultText ?? "In progress"}</div>
      )}
      <div className="cricket-match-card-when">
        <span>
          <i className="fa-regular fa-calendar" aria-hidden="true"></i>
          {formatMatchDate(match.scheduledAt)}
        </span>
        {match.venue && (
          <span>
            <i className="fa-solid fa-location-dot" aria-hidden="true"></i>
            {match.venue}
          </span>
        )}
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
