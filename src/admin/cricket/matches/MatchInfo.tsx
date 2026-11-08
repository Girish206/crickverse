import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMatchCreator } from "../../../api/hooks/cricket/useCricketMatches";
import {
  ballsPerOverOf,
  type CricketInnings,
  type CricketMatch,
  type CricketMatchEvent,
  type CricketMatchViewers,
  type CricketTournament,
} from "../../../api/types";
import { BallTypeBadge } from "../CricketChoices";
import { OrganiserCard } from "../OrganiserCard";
import { labelOf, MATCH_TYPES, PITCH_TYPES } from "../cricketOptions";
import { inningsPhases, inningsPlan, inningsSummary, isLegal, oversText, type NameOf } from "../stats";
import { matchStageLabel } from "./matchUtils";

const dateText = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
const timeText = (value: string) => new Date(value).toLocaleTimeString(undefined, { hour: "numeric", hour12: true, minute: "2-digit" });

// "42 min", "1 min", or "< 1 min".
function minutesText(ms: number) {
  const minutes = Math.round(ms / 60000);
  return minutes < 1 ? "< 1 min" : `${minutes} min`;
}

// A line of the match's log, in words.
function eventText(event: CricketMatchEvent, nameOf: NameOf) {
  switch (event.kind) {
    case "scorer-change":
      return event.fromName
        ? `Scoring passed from ${event.fromName} to ${event.toName ?? "someone else"}`
        : `${event.toName ?? "Someone"} started scoring`;
    case "strike-swap":
      return `Strike swapped: ${nameOf(event.toId)} on strike`;
    case "batter-change":
      return `Batter changed: ${nameOf(event.fromId)} to ${nameOf(event.toId)}`;
    case "bowler-change":
      return `Bowler changed: ${nameOf(event.fromId)} to ${nameOf(event.toId)}`;
    case "ball-corrected":
      return "A ball was corrected";
    case "squad-change":
      return event.fromId === null ? `${nameOf(event.toId)} joined the side` : `${nameOf(event.toId)} came in for ${nameOf(event.fromId)}`;
    case "rain":
      return event.overs === null ? "Rain: no more play" : `Rain: reduced to ${event.overs} overs`;
    case "reopened":
      return "Match reopened";
    default:
      return null;
  }
}

const overRange = (first: number, last: number) => (first === last ? `${first}` : `${first}–${last}`);

// Below an innings' times: the powerplay, middle and death overs, extras, each
// 50 reached, and what was changed by hand while it was scored.
function InningsNotes({ match, innings, index, nameOf }: { match: CricketMatch; innings: CricketInnings; index: number; nameOf: NameOf }) {
  const perOver = ballsPerOverOf(match);
  const summary = inningsSummary(innings, perOver);
  const plan = inningsPlan(match, index);
  const { powerplay, middle, death, milestones } = inningsPhases(innings, perOver, plan);
  const events = (match.events ?? []).filter((event) => (event.innings ?? 0) === index && eventText(event, nameOf));
  const phases = plan
    ? [
        powerplay && { label: "Powerplay", overs: overRange(1, plan.powerplay), ...powerplay },
        middle && { label: "Middle overs", overs: overRange(plan.powerplay + 1, plan.middleEnd), ...middle },
        death && { label: "Death overs", overs: overRange(plan.middleEnd + 1, plan.limit), ...death },
      ].filter((phase) => phase !== null)
    : [];
  const extras = summary.extras;
  if (innings.balls.length === 0 && events.length === 0) return null;

  return (
    <div className="cricket-notes-detail">
      {innings.balls.length > 0 && phases.length > 0 && (
        <table className="cricket-notes-table">
          <thead>
            <tr>
              <th>Overs</th>
              <th>Score</th>
              <th>Faced</th>
              <th>Extras</th>
            </tr>
          </thead>
          <tbody>
            {phases.map((phase) => (
              <tr key={phase.label}>
                <td>
                  {phase.label} <small>Ov {phase.overs}</small>
                </td>
                <td>
                  <strong>
                    {phase.runs}/{phase.wickets}
                  </strong>
                </td>
                <td>{oversText(phase.legalBalls, perOver)}</td>
                <td>{phase.extras}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {innings.balls.length > 0 && (
        <p className="cricket-notes-extras">
          <span>Extras</span>
          <strong>{extras.total}</strong>
          <small>
            wd {extras.wides}, nb {extras.noBalls}, b {extras.byes}, lb {extras.legByes}
            {extras.penalty > 0 && `, pen ${extras.penalty}`}
          </small>
        </p>
      )}
      {milestones.length > 0 && (
        <table className="cricket-notes-table">
          <thead>
            <tr>
              <th>Team score</th>
              <th>Overs</th>
              <th>Wkts</th>
              <th>Balls for 50</th>
            </tr>
          </thead>
          <tbody>
            {milestones.map((milestone) => (
              <tr key={milestone.runs}>
                <td>
                  <strong>{milestone.runs}</strong>
                </td>
                <td>{milestone.overs}</td>
                <td>{milestone.wickets}</td>
                <td>{milestone.ballsTaken}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {events.length > 0 && (
        <ol className="cricket-notes-log" aria-label="Scoring log">
          {events.map((event, i) => (
            <li key={i}>
              <span className="cricket-notes-log-at">
                {event.balls !== null && `${oversText(event.balls, perOver)} ov · `}
                {timeText(event.at)}
              </span>
              <span>
                {eventText(event, nameOf)}
                {event.by && event.kind !== "scorer-change" && <small> by {event.by}</small>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// Each innings' start, end and minutes taken, by the bowling side — for
// their over rate — in one compact table. It started with its first ball
// and ended when it was closed; times not recorded (older matches) show "–".
function MatchNotes({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  if (match.innings.length === 0) return null;
  return (
    <>
      <h2 className="cricket-info-title mt-3">Match notes</h2>
      {/* One card, a row per innings: who bowled (to whom) and when on the
          left, the time it took and its overs on the right. */}
      <div className="cricket-crease cricket-notes">
        {match.innings.map((innings, index) => {
          const startedAt = innings.balls.find((ball) => ball.at)?.at ?? null;
          const endedAt = innings.closed ? (innings.closedAt ?? innings.balls.findLast((ball) => ball.at)?.at ?? null) : null;
          const legalBalls = innings.balls.filter(isLegal).length;
          const taken = startedAt ? (endedAt ? new Date(endedAt).getTime() : Date.now()) - new Date(startedAt).getTime() : null;
          return (
            <div key={index} className="cricket-notes-innings">
              <div className="cricket-notes-row">
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
              <InningsNotes match={match} innings={innings} index={index} nameOf={nameOf} />
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
  if (match.powerplayOvers) rules.push(`${match.powerplayOvers}-over powerplay`);
  return rules.length ? [["Rules", rules.join(" · ")]] : [];
}

type InfoTournament = Pick<CricketTournament, "name"> & Partial<Pick<CricketTournament, "organiserName" | "organiserMobile">>;

// Who ran the match: its tournament's organiser (else whoever made it), and
// the people who actually scored it.
function MatchOfficials({ match, tournament }: { match: CricketMatch; tournament?: InfoTournament }) {
  const named = Boolean(tournament?.organiserName || tournament?.organiserMobile);
  // A tournament match waits for its tournament, which may name someone.
  const { data: creator } = useMatchCreator(match.id, !named && (match.tournamentId === null || tournament !== undefined));
  const organiser = named ? tournament?.organiserName : creator?.name;
  const hasOrganiser = Boolean(organiser || tournament?.organiserMobile);
  const scorers = match.scoredByNames ?? [];
  if (!hasOrganiser && scorers.length === 0) return null;
  return (
    <>
      <h2 className="cricket-info-title mt-3">Match officials</h2>
      {hasOrganiser && <OrganiserCard name={organiser} mobile={tournament?.organiserMobile} />}
      {scorers.length > 0 && (
        <dl className="cricket-info-card mt-2">
          <div className="cricket-info-row">
            <dt>{scorers.length === 1 ? "Scorer" : "Scorers"}</dt>
            <dd>{scorers.join(", ")}</dd>
          </div>
        </dl>
      )}
    </>
  );
}

// The "Info" tab: the match's details card and its officials.
export function MatchInfo({
  match,
  nameOf,
  viewers,
  tournament,
  officials = false,
}: {
  match: CricketMatch;
  nameOf: NameOf;
  viewers?: CricketMatchViewers;
  // A shared public match only knows its tournament's name.
  tournament?: InfoTournament;
  // The organiser and scorers, for signed-in viewers: a public link's data
  // leaves out who runs and scores the match.
  officials?: boolean;
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

      <MatchNotes match={match} nameOf={nameOf} />

      {viewers && (
        <>
          <h2 className="cricket-info-title mt-3">Viewers</h2>
          <dl className="cricket-info-card">
            {match.status === "live" && (
              <div className="cricket-info-row">
                <dt>Watching now</dt>
                <dd>{viewers.watching}</dd>
              </div>
            )}
            <div className="cricket-info-row">
              <dt>Most at once</dt>
              <dd>{viewers.peak}</dd>
            </div>
            <div className="cricket-info-row">
              <dt>Unique viewers</dt>
              <dd>{viewers.unique}</dd>
            </div>
          </dl>
        </>
      )}

      {officials && <MatchOfficials match={match} tournament={tournament} />}
    </div>
  );
}
