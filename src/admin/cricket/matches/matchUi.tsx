import { useNavigate } from "react-router-dom";
import type { CricketMatch, CricketMatchStatus } from "../../../api/types";
import { formatMatchDate, battingOrder, stageLabel, teamScore } from "./matchUtils";

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

// Compact fixture/result card; opens the match centre.
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
  return (
    <div
      className={`cricket-match-card is-${match.status}`}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === "Enter" && open()}
    >
      <div className="cricket-match-card-top">
        <span>
          {tournamentName ? `${tournamentName} · ` : ""}
          {stageLabel(match.stage)} · {match.overs} ov
        </span>
        <MatchStatusBadge status={match.status} />
      </div>
      {battingOrder(match).map((slot) => {
          const team = match.teams[slot];
        const score = teamScore(match, slot);
        return (
          <div className={`cricket-match-card-team ${match.winner === slot ? "is-winner" : ""}`} key={slot}>
            <span className="cricket-match-card-name">{team.name}</span>
            {score && (
              <span className="cricket-match-card-score">
                {score.runs} <small>({score.overs})</small>
              </span>
            )}
          </div>
        );
      })}
      <div className="cricket-match-card-foot">
        {(match.resultText || match.status === "live") && (
          <div className="cricket-match-card-result">{match.resultText ?? "In progress"}</div>
        )}
        <div className="cricket-match-card-when">
          {formatMatchDate(match.scheduledAt)}
          {match.venue ? ` · ${match.venue}` : ""}
        </div>
      </div>
      {footnote && <div className="cricket-match-card-note">{footnote}</div>}
    </div>
  );
}
