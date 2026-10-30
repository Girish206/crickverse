import { ballsPerOverOf, type CricketMatch } from "../../../api/types";
import { PlayerLink } from "../players/PlayerProfileSheet";
import {
  battingCard,
  bowlingCard,
  chaseInfo,
  inningsSummary,
  isFreeHitNext,
  oversText,
  rate,
  strikeRate,
  type NameOf,
} from "../stats";
import { Commentary } from "./Commentary";
import { MatchAwards } from "./MatchAwards";
import { ResultBanner } from "./result/ResultNote";
import { ScoreHead } from "./ScoreHead";

// The read-only "Live" tab for players: the score, who's in, then
// commentary on the last two overs (the Overs tab has them all). The awards (top performers) wait
// until it's over, with the result.
export function LiveView({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  const innings = match.innings[match.innings.length - 1];
  if (match.status === "scheduled" || !innings) {
    return <div className="admin-empty-state">The match hasn't started yet.</div>;
  }
  if (match.status !== "live") {
    return (
      <>
        <ResultBanner match={match} />
        <MatchAwards match={match} nameOf={nameOf} />
      </>
    );
  }

  const perOver = ballsPerOverOf(match);
  const summary = inningsSummary(innings, perOver);
  const chase = innings === match.innings[1] ? chaseInfo(match) : null;
  const batting = battingCard(innings);
  const freeHit = isFreeHitNext(match, innings);
  const bowlerRow = bowlingCard(innings, perOver).find((row) => row.playerId === innings.bowlerId);

  return (
    <div className="cricket-scorer">
      <ScoreHead
        data={{
          team: match.teams[innings.battingTeam].name,
          logoUrl: match.teams[innings.battingTeam].logoUrl,
          inningsTag: match.innings.length === 2 ? "2nd Inn" : "1st Inn",
          score: `${summary.runs}/${summary.wickets}`,
          overs: summary.overs,
          maxOvers: match.overs,
          crr: rate(summary.runs, summary.legalBalls, perOver),
          chase,
          // Before the chase's first ball, the banner below says what's needed.
          need: chase && innings.balls.length > 0 ? { runs: chase.need, balls: chase.ballsLeft } : null,
        }}
      />
      {/* The next ball can't get the batter out (bar a run-out): a no-ball
          was just bowled. */}
      {freeHit && (
        <div className="cricket-free-hit" role="status">
          <i className="fa-solid fa-bolt" aria-hidden="true"></i> FREE HIT
        </div>
      )}
      {chase && innings.balls.length === 0 && (
        <div className="admin-banner admin-banner-success">
          Innings break — {match.teams[innings.battingTeam].name} need {chase.target} to win{chase.revised && " (revised target)"}.
        </div>
      )}

      {/* Who's in, Cricbuzz style: Batter R B 4s 6s SR, then Bowler O M R W
          ECO, on one grid so every column lines up. */}
      <section className="cricket-crease is-table">
        <div className="cricket-crease-head">
          <span>Batter</span>
          <span>R</span>
          <span>B</span>
          <span>4s</span>
          <span>6s</span>
          <span>SR</span>
        </div>
        {[innings.strikerId, innings.nonStrikerId].map((playerId, i) => {
          if (playerId === null) return null;
          const row = batting.find((r) => r.playerId === playerId);
          return (
            <div key={playerId} className="cricket-crease-row">
              <span className="cricket-crease-name">
                <PlayerLink playerId={playerId}>{nameOf(playerId)}</PlayerLink>
                {i === 0 && <span className="cricket-crease-strike" title="On strike" aria-label="On strike"> *</span>}
              </span>
              <span className="cricket-crease-main">{row?.runs ?? 0}</span>
              <span>{row?.balls ?? 0}</span>
              <span>{row?.fours ?? 0}</span>
              <span>{row?.sixes ?? 0}</span>
              <span>{strikeRate(row?.runs ?? 0, row?.balls ?? 0)}</span>
            </div>
          );
        })}
        {innings.bowlerId !== null && (
          <>
            <div className="cricket-crease-head">
              <span>Bowler</span>
              <span>O</span>
              <span>M</span>
              <span>R</span>
              <span>W</span>
              <span>ECO</span>
            </div>
            <div className="cricket-crease-row">
              <span className="cricket-crease-name">
                <PlayerLink playerId={innings.bowlerId}>{nameOf(innings.bowlerId)}</PlayerLink>
              </span>
              <span>{oversText(bowlerRow?.legalBalls ?? 0, perOver)}</span>
              <span>{bowlerRow?.maidens ?? 0}</span>
              <span>{bowlerRow?.runs ?? 0}</span>
              <span className="cricket-crease-main">{bowlerRow?.wickets ?? 0}</span>
              <span>{rate(bowlerRow?.runs ?? 0, bowlerRow?.legalBalls ?? 0, perOver)}</span>
            </div>
          </>
        )}
      </section>

      <Commentary match={match} nameOf={nameOf} />
    </div>
  );
}
