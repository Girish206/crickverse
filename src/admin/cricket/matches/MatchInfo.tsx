import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { CricketMatch, CricketTournament } from "../../../api/types";
import { BallTypeBadge } from "../CricketChoices";
import { OrganiserCard } from "../OrganiserCard";
import { labelOf, MATCH_TYPES, PITCH_TYPES } from "../cricketOptions";
import { stageLabel } from "./matchUtils";

const dateText = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
const timeText = (value: string) => new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

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
      <Link key="tournament" to={`/tournaments/${match.tournamentId}`} className="cricket-info-link">
        {tournament?.name ?? "Tournament"} <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
      </Link>,
    ],
    ["Round", `${stageLabel(match.stage)} Matches`],
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
    [
      "Venue",
      venue ? (
        <a
          key="venue"
          className="cricket-info-link"
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`}
          target="_blank"
          rel="noreferrer"
        >
          {venue} <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </a>
      ) : (
        "Not set"
      ),
    ],
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

      {(tournament?.organiserName || tournament?.organiserMobile) && (
        <OrganiserCard name={tournament.organiserName} mobile={tournament.organiserMobile} />
      )}
    </div>
  );
}
