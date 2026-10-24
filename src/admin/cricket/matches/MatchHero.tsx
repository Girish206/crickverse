import { useEffect, useState } from "react";
import type { CricketMatch } from "../../../api/types";
import { monogram } from "../../../utils/format";
import { avatarColorFor } from "../avatarColor";
import { chaseInfo, inningsSummary, rate } from "../stats";
import { battingOrder, matchStageLabel, teamScore } from "./matchUtils";

// "in 2 days", "in 3h 20m", "in 45m", or "Starting soon" once it's due.
function startsIn(at: Date, now: number) {
  const minutes = Math.round((at.getTime() - now) / 60000);
  if (minutes <= 0) return "Starting soon";
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

// The current time, refreshed every minute.
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

// An upcoming match: both sides facing each other, the start time between them.
function FaceOff({ match, colors }: { match: CricketMatch; colors: string[] }) {
  const now = useNow();
  const at = match.scheduledAt ? new Date(match.scheduledAt) : null;
  const side = (slot: number) => (
    <div className="cricket-faceoff-team">
      <span className="cricket-faceoff-badge" style={{ background: colors[slot] }}>
        {monogram(match.teams[slot].name)}
      </span>
      <span className="cricket-faceoff-name">{match.teams[slot].name}</span>
    </div>
  );
  return (
    <div className="cricket-faceoff">
      {side(0)}
      <div className="cricket-faceoff-mid">
        {at ? (
          <>
            <span className="cricket-faceoff-time">
              {at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </span>
            <span className="cricket-faceoff-date">
              {at.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
            </span>
            <span className="cricket-faceoff-countdown">{startsIn(at, now)}</span>
          </>
        ) : (
          <>
            <span className="cricket-faceoff-vs">VS</span>
            <span className="cricket-faceoff-date">Time not set</span>
          </>
        )}
      </div>
      {side(1)}
    </div>
  );
}

interface MatchHeroProps {
  match: CricketMatch;
}

// The match card at the top of the match page (under its PageHeader): both
// sides facing each other with their scores, then the result or a one-line
// state of play.
export function MatchHero({ match }: MatchHeroProps) {
  const current = match.innings[match.innings.length - 1];
  // Each side's badge colour, nudged apart when both names hash alike.
  const colorA = avatarColorFor(match.teams[0].name);
  let colorB = avatarColorFor(match.teams[1].name);
  for (let salt = 1; colorB === colorA && salt < 12; salt++) colorB = avatarColorFor(`${match.teams[1].name}#${salt}`);
  const colors = [colorA, colorB];
  const battingNow = match.status === "live" && current ? current.battingTeam : null;

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
  }

  return (
    <div className={`card cricket-hero is-${match.status}`}>
      {match.status === "scheduled" ? (
        <FaceOff match={match} colors={colors} />
      ) : (
        <div className="cricket-hero-board">
          {battingOrder(match).flatMap((slot, i) => {
            const team = match.teams[slot];
            const score = teamScore(match, slot);
            const won = match.winner === slot;
            const lost = match.status === "completed" && match.winner !== null && !won;
            const vs = (
              <span key="vs" className="cricket-hero-vs">
                VS
              </span>
            );
            const row = (
              <div key={slot} className={`cricket-hero-row ${i === 1 ? "is-right" : ""} ${battingNow === slot ? "is-batting" : ""} ${lost ? "is-lost" : ""}`}>
                <span className="cricket-hero-badge" style={{ background: colors[slot] }}>
                  {monogram(team.name)}
                </span>
                <span className="cricket-hero-side">
                  <span className="cricket-hero-name">
                    <span>{team.name}</span>
                    {battingNow === slot && <i className="fa-solid fa-baseball-bat-ball" title="Batting" aria-label="Batting"></i>}
                  </span>
                  {score ? (
                    <span className="cricket-hero-score">
                      {score.runs} <small>({score.overs})</small>
                    </span>
                  ) : (
                    <span className="cricket-hero-overs">Yet to bat</span>
                  )}
                </span>
              </div>
            );
            // Side by side, "VS" between them.
            return i === 0 ? [row] : [vs, row];
          })}
        </div>
      )}

      {/* Under the scores, the result (or state of play); the details live
          in the Info and Summary tabs. */}
      {match.status !== "scheduled" && (match.resultText || headline) && (
        <div className="cricket-hero-foot">
          {match.resultText ? (
            <span className={`cricket-hero-headline is-result ${match.winner === null ? "is-level" : ""}`.trim()}>
              <i className={`fa-solid ${match.winner === null ? "fa-handshake" : "fa-crown"}`} aria-hidden="true"></i> {match.resultText}
            </span>
          ) : (
            <span className="cricket-hero-headline">{headline}</span>
          )}
        </div>
      )}

      {match.status === "scheduled" && (
        <div className="cricket-hero-meta">
          <span>
            <i className="fa-solid fa-trophy" aria-hidden="true"></i> {matchStageLabel(match)} · {match.overs} ov
          </span>
          {match.venue && (
            <span>
              <i className="fa-solid fa-location-dot" aria-hidden="true"></i> {match.venue}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
