import type { CricketMatch } from "../../../api/types";
import { monogram } from "../../../utils/format";
import { avatarColorFor } from "../avatarColor";
import { PlayerLink } from "../players/PlayerProfileSheet";
import { chaseInfo, impactLine, inningsSummary, matchAwards, rate, type NameOf } from "../stats";
import { formatMatchDate, battingOrder, stageLabel, teamScore } from "./matchUtils";

interface MatchHeroProps {
  match: CricketMatch;
  nameOf: NameOf;
}

// The match card at the top of the match page (under its PageHeader): both
// sides facing each other with their scores, a one-line state of play, then
// when/where.
export function MatchHero({ match, nameOf }: MatchHeroProps) {
  const current = match.innings[match.innings.length - 1];
  // Each side's badge colour, nudged apart when both names hash alike.
  const colorA = avatarColorFor(match.teams[0].name);
  let colorB = avatarColorFor(match.teams[1].name);
  for (let salt = 1; colorB === colorA && salt < 12; salt++) colorB = avatarColorFor(`${match.teams[1].name}#${salt}`);
  const colors = [colorA, colorB];
  const battingNow = match.status === "live" && current ? current.battingTeam : null;
  const potm = matchAwards(match).playerOfMatch;

  // One line saying where the game is.
  let headline: string | null = null;
  if (match.status === "live" && current) {
    const chase = match.innings.length === 2 ? chaseInfo(match) : null;
    const batting = match.teams[current.battingTeam].name;
    if (chase && current.balls.length === 0) {
      headline = `Innings break — ${batting} need ${chase.target} to win`;
    } else if (chase) {
      headline = `${batting} need ${Math.max(chase.need, 0)} run${chase.need === 1 ? "" : "s"} from ${chase.ballsLeft} ball${chase.ballsLeft === 1 ? "" : "s"}`;
    } else {
      const now = inningsSummary(current);
      headline = `${batting} batting · CRR ${rate(now.runs, now.legalBalls)}`;
    }
  } else if (match.status === "scheduled") {
    headline = match.scheduledAt ? `Starts ${formatMatchDate(match.scheduledAt)}` : "Not started yet";
  }

  return (
    <div className={`card cricket-hero is-${match.status}`}>
      <div className="cricket-hero-board">
        {battingOrder(match).map((slot) => {
          const team = match.teams[slot];
          const score = teamScore(match, slot);
          const won = match.winner === slot;
          const lost = match.status === "completed" && match.winner !== null && !won;
          return (
            <div key={slot} className={`cricket-hero-row ${battingNow === slot ? "is-batting" : ""} ${lost ? "is-lost" : ""}`}>
              <span className="cricket-hero-badge" style={{ background: colors[slot] }}>
                {monogram(team.name)}
              </span>
              <span className="cricket-hero-name">
                <span>{team.name}</span>
                {battingNow === slot && <i className="fa-solid fa-baseball-bat-ball" title="Batting" aria-label="Batting"></i>}
                {won && <i className="fa-solid fa-trophy" title="Winner" aria-label="Winner"></i>}
              </span>
              {score ? (
                <span className="cricket-hero-score">
                  {score.runs} <small>({score.overs})</small>
                </span>
              ) : (
                match.status !== "scheduled" && <span className="cricket-hero-overs">Yet to bat</span>
              )}
            </div>
          );
        })}
      </div>

      {match.resultText ? (
        <div className="cricket-hero-headline is-result">
          <i className="fa-solid fa-trophy" aria-hidden="true"></i> {match.resultText}
        </div>
      ) : (
        headline && <div className="cricket-hero-headline">{headline}</div>
      )}

      {potm && (
        <div className="cricket-hero-potm">
          <i className="fa-solid fa-medal" aria-hidden="true"></i> Player of the match{" "}
          <strong>
            <PlayerLink playerId={potm.playerId}>{nameOf(potm.playerId)}</PlayerLink>
          </strong>
          <small>{impactLine(potm)}</small>
        </div>
      )}

      <div className="cricket-hero-meta">
        <span>
          <i className="fa-solid fa-trophy" aria-hidden="true"></i> {stageLabel(match.stage)} · {match.overs} ov
        </span>
        {match.status !== "scheduled" && match.scheduledAt && (
          <span>
            <i className="fa-regular fa-calendar" aria-hidden="true"></i> {formatMatchDate(match.scheduledAt)}
          </span>
        )}
        {match.venue && (
          <span>
            <i className="fa-solid fa-location-dot" aria-hidden="true"></i> {match.venue}
          </span>
        )}
        {match.tossWinner !== null && (
          <span className="cricket-hero-toss">
            <i className="fa-solid fa-coins" aria-hidden="true"></i> {match.teams[match.tossWinner].name} won the toss, chose to{" "}
            {match.tossDecision}
          </span>
        )}
      </div>
    </div>
  );
}
