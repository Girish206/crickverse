import type { CricketMatch } from "../../../api/types";
import {
  ballLabel,
  battingCard,
  bowlingCard,
  chaseInfo,
  inningsSummary,
  oversOf,
  oversText,
  rate,
  strikeRate,
  type NameOf,
} from "../stats";
import { MatchAwards } from "./MatchAwards";

// The read-only "Live" tab for players: the score, who's in, this over and
// the last few. Once it's over, the result and the awards.
export function LiveView({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  const innings = match.innings[match.innings.length - 1];
  if (match.status === "scheduled" || !innings) {
    return <div className="admin-empty-state">The match hasn't started yet.</div>;
  }
  if (match.status !== "live") {
    return (
      <>
        {match.resultText && <div className="admin-banner admin-banner-success mb-3">{match.resultText}</div>}
        <MatchAwards match={match} nameOf={nameOf} />
      </>
    );
  }

  const summary = inningsSummary(innings);
  const chase = innings === match.innings[1] ? chaseInfo(match) : null;
  const batting = battingCard(innings);
  const bowlerRow = bowlingCard(innings).find((row) => row.playerId === innings.bowlerId);
  const overs = oversOf(innings);
  const recent = overs.slice(-4).reverse();

  return (
    <div className="cricket-scorer">
      <div className="cricket-scorer-head">
        <div>
          <span className="cricket-scorer-team">{match.teams[innings.battingTeam].name} batting</span>
          <strong className="cricket-scorer-score">
            {summary.runs}/{summary.wickets} <small>({summary.overs} / {match.overs} ov)</small>
          </strong>
        </div>
        <div className="cricket-scorer-rates">
          <span>CRR {rate(summary.runs, summary.legalBalls)}</span>
          {chase && (
            <>
              <span>Target {chase.target}</span>
              <span>RRR {chase.requiredRate}</span>
            </>
          )}
        </div>
      </div>
      {chase && innings.balls.length > 0 && (
        <div className="cricket-chase-line">
          Need <strong>{Math.max(chase.need, 0)}</strong> run{chase.need === 1 ? "" : "s"} from{" "}
          <strong>{chase.ballsLeft}</strong> ball{chase.ballsLeft === 1 ? "" : "s"}
        </div>
      )}
      {chase && innings.balls.length === 0 && (
        <div className="admin-banner admin-banner-success">
          Innings break — {match.teams[innings.battingTeam].name} need {chase.target} to win.
        </div>
      )}

      <div className="admin-table-wrap">
        <table className="cricket-table">
          <thead>
            <tr>
              <th>Batter</th>
              <th>R</th>
              <th>B</th>
              <th>4s</th>
              <th>6s</th>
              <th>SR</th>
            </tr>
          </thead>
          <tbody>
            {[innings.strikerId, innings.nonStrikerId].map((playerId, i) => {
              if (playerId === null) return null;
              const row = batting.find((r) => r.playerId === playerId);
              return (
                <tr key={playerId}>
                  <td className="fw-semibold">
                    {nameOf(playerId)}
                    {i === 0 && " *"}
                  </td>
                  <td className="fw-bold">{row?.runs ?? 0}</td>
                  <td>{row?.balls ?? 0}</td>
                  <td>{row?.fours ?? 0}</td>
                  <td>{row?.sixes ?? 0}</td>
                  <td>{strikeRate(row?.runs ?? 0, row?.balls ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
          <thead>
            <tr>
              <th>Bowler</th>
              <th>O</th>
              <th>M</th>
              <th>R</th>
              <th>W</th>
              <th>Econ</th>
            </tr>
          </thead>
          <tbody>
            {innings.bowlerId !== null && (
              <tr>
                <td className="fw-semibold">{nameOf(innings.bowlerId)}</td>
                <td>{oversText(bowlerRow?.legalBalls ?? 0)}</td>
                <td>{bowlerRow?.maidens ?? 0}</td>
                <td>{bowlerRow?.runs ?? 0}</td>
                <td className="fw-bold">{bowlerRow?.wickets ?? 0}</td>
                <td>{rate(bowlerRow?.runs ?? 0, bowlerRow?.legalBalls ?? 0)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {recent.length > 0 && (
        <section className="cricket-recent-overs">
          <h2 className="cricket-section-title">Recent overs</h2>
          {recent.map((over) => (
            <div key={over.number} className="cricket-this-over">
              <span>
                Ov {over.number + 1} · {nameOf(over.bowlerId)}
              </span>
              {over.balls.map((ball, i) => (
                <span key={i} className={`cricket-ball-chip is-${ballLabel(ball)}`}>
                  {ballLabel(ball)}
                </span>
              ))}
              <strong className="cricket-over-runs">= {over.runs}</strong>
            </div>
          ))}
        </section>
      )}

      <MatchAwards match={match} nameOf={nameOf} />
    </div>
  );
}
