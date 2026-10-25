import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { CricketMatch, CricketTournament } from "../../../api/types";
import { BallTypeBadge } from "../CricketChoices";
import { OrganiserCard } from "../OrganiserCard";
import { labelOf, MATCH_TYPES, PITCH_TYPES } from "../cricketOptions";
import { isLegal, oversText } from "../stats";
import { matchStageLabel } from "./matchUtils";

const dateText = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
const timeText = (value: string) => new Date(value).toLocaleTimeString(undefined, { hour: "numeric", hour12: true, minute: "2-digit" });

// "42 min", "1 min", or "Under a minute".
function minutesText(ms: number) {
  const minutes = Math.round(ms / 60000);
  return minutes < 1 ? "Under a minute" : `${minutes} min`;
}

// Each innings' start, end and minutes taken, under the bowling side — for
// their over rate. It started with its first ball and ended when it was
// closed; matches scored before times were recorded say so.
function MatchNotes({ match }: { match: CricketMatch }) {
  if (match.innings.length === 0) return null;
  return (
    <>
      <h2 className="cricket-info-title mt-3">Match notes</h2>
      {match.innings.map((innings) => {
        const startedAt = innings.balls.find((ball) => ball.at)?.at ?? null;
        const endedAt = innings.closed ? (innings.closedAt ?? innings.balls.findLast((ball) => ball.at)?.at ?? null) : null;
        const legalBalls = innings.balls.filter(isLegal).length;
        const taken = startedAt ? (endedAt ? new Date(endedAt).getTime() : Date.now()) - new Date(startedAt).getTime() : null;
        return (
          <div key={innings.battingTeam} className="cricket-info-notes">
            <h3 className="cricket-info-notes-title">
              {match.teams[1 - innings.battingTeam].name} bowling
              <small>to {match.teams[innings.battingTeam].name}</small>
            </h3>
            <dl className="cricket-info-card">
              <div className="cricket-info-row">
                <dt>Start time</dt>
                <dd>{startedAt ? timeText(startedAt) : "Not recorded"}</dd>
              </div>
              <div className="cricket-info-row">
                <dt>End time</dt>
                <dd>{!innings.closed ? "In progress" : endedAt ? timeText(endedAt) : "Not recorded"}</dd>
              </div>
              <div className="cricket-info-row">
                <dt>{innings.closed ? "Time taken" : "Time so far"}</dt>
                <dd>
                  {taken === null ? "Not recorded" : minutesText(taken)}{" "}
                  <small className="text-muted">({oversText(legalBalls)} ov)</small>
                </dd>
              </div>
            </dl>
          </div>
        );
      })}
    </>
  );
}

// The "Info" tab: the match's details card and who organised it.
export function MatchInfo({
  match,
  tournament,
}: {
  match: CricketMatch;
  tournament?: CricketTournament;
}) {
  const venue = [match.venue, match.city].filter(Boolean).join(", ");
  const rows: [string, ReactNode][] = [
    [
      "Tournament",
      match.tournamentId === null ? (
        "None (one-off match)"
      ) : (
        <Link key="tournament" to={`/tournaments/${match.tournamentId}`} className="cricket-info-link">
          {tournament?.name ?? "Tournament"} <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </Link>
      ),
    ],
    ["Round", match.tournamentId === null || match.slot || match.group ? matchStageLabel(match) : `${matchStageLabel(match)} Matches`],
    ["Match type", labelOf(MATCH_TYPES, match.matchType) ?? "Limited Overs"],
    ["Overs", match.overs],
    [
      "Date & time",
      match.scheduledAt ? (
        <span key="datetime" className="cricket-info-datetime">
          <span>{dateText(match.scheduledAt)}</span>
          <span>{timeText(match.scheduledAt)}</span>
        </span>
      ) : (
        "Not set"
      ),
    ],
    ["Venue", venue || "Not set"],
    [
      "Toss",
      match.tossWinner !== null
        ? `${match.teams[match.tossWinner].name} opt to ${match.tossDecision === "bat" ? "bat" : "field"}`
        : "Not yet",
    ],
    ["Ball type", match.ballType ? <BallTypeBadge key="ball" value={match.ballType} /> : "Not set"],
    ["Pitch type", labelOf(PITCH_TYPES, match.pitchType) ?? "Not set"],
    ["Match ID", match.id],
  ];
  if (match.resultText) rows.splice(7, 0, ["Result", match.resultText]);

  return (
    <div className="cricket-info">
      <h2 className="cricket-info-title">Match details</h2>
      <dl className="cricket-info-card">
        {rows.map(([label, value]) => (
          <div key={label} className="cricket-info-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <MatchNotes match={match} />

      {(tournament?.organiserName || tournament?.organiserMobile) && (
        <OrganiserCard name={tournament.organiserName} mobile={tournament.organiserMobile} />
      )}
    </div>
  );
}
