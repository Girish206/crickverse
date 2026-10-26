import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ballsPerOverOf, type CricketMatch, type CricketTournament } from "../../../api/types";
import { BallTypeBadge } from "../CricketChoices";
import { OrganiserCard } from "../OrganiserCard";
import { labelOf, MATCH_TYPES, PITCH_TYPES } from "../cricketOptions";
import { isLegal, oversText } from "../stats";
import { matchStageLabel } from "./matchUtils";

const dateText = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
const timeText = (value: string) => new Date(value).toLocaleTimeString(undefined, { hour: "numeric", hour12: true, minute: "2-digit" });

// "42 min", "1 min", or "< 1 min".
function minutesText(ms: number) {
  const minutes = Math.round(ms / 60000);
  return minutes < 1 ? "< 1 min" : `${minutes} min`;
}

// Each innings' start, end and minutes taken, by the bowling side — for
// their over rate — in one compact table. It started with its first ball
// and ended when it was closed; times not recorded (older matches) show "–".
function MatchNotes({ match }: { match: CricketMatch }) {
  if (match.innings.length === 0) return null;
  return (
    <>
      <h2 className="cricket-info-title mt-3">Match notes</h2>
      {/* One card, a row per innings: who bowled (to whom) and when on the
          left, the time it took and its overs on the right. */}
      <div className="cricket-crease cricket-notes">
        {match.innings.map((innings) => {
          const startedAt = innings.balls.find((ball) => ball.at)?.at ?? null;
          const endedAt = innings.closed ? (innings.closedAt ?? innings.balls.findLast((ball) => ball.at)?.at ?? null) : null;
          const legalBalls = innings.balls.filter(isLegal).length;
          const taken = startedAt ? (endedAt ? new Date(endedAt).getTime() : Date.now()) - new Date(startedAt).getTime() : null;
          return (
            <div key={innings.battingTeam} className="cricket-notes-row">
              <div className="cricket-notes-side">
                <strong>{match.teams[1 - innings.battingTeam].name} bowling</strong>
                <small>to {match.teams[innings.battingTeam].name}</small>
                <span className="cricket-notes-when">
                  <i className="fa-regular fa-clock" aria-hidden="true"></i>
                  {startedAt ? timeText(startedAt) : "–"}
                  <i className="fa-solid fa-arrow-right-long" aria-label="to"></i>
                  {!innings.closed ? (
                    <em className="cricket-notes-live">Live</em>
                  ) : endedAt ? (
                    timeText(endedAt)
                  ) : (
                    "–"
                  )}
                </span>
              </div>
              <div className="cricket-notes-time">
                <strong>{taken === null ? "–" : minutesText(taken)}</strong>
                <small>{oversText(legalBalls, ballsPerOverOf(match))} ov</small>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// The match's own rules, only where they differ from the usual: 6-ball
// overs, no bowler limit, free hit on, last batter out ends it.
function playingConditions(match: CricketMatch): [string, ReactNode][] {
  const rules: string[] = [];
  if (ballsPerOverOf(match) !== 6) rules.push(`${ballsPerOverOf(match)}-ball overs`);
  if (match.bowlerOverLimit) rules.push(`${match.bowlerOverLimit} overs a bowler`);
  if (match.lastManStands) rules.push("Last man stands");
  if (match.freeHit === false) rules.push("No free hit");
  return rules.length ? [["Rules", rules.join(" · ")]] : [];
}

// The "Info" tab: the match's details card and who organised it.
export function MatchInfo({
  match,
  tournament,
}: {
  match: CricketMatch;
  // A shared public match only knows its tournament's name.
  tournament?: Pick<CricketTournament, "name"> & Partial<Pick<CricketTournament, "organiserName" | "organiserMobile">>;
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
    ...playingConditions(match),
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
  if (match.resultText) rows.splice(rows.findIndex(([label]) => label === "Toss") + 1, 0, ["Result", match.resultText]);

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
