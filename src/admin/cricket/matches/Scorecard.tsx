import { Fragment, useState } from "react";
import type { CricketMatch } from "../../../api/types";
import { PlayerLink } from "../players/PlayerProfileSheet";
import {
  ballChipClass,
  ballLabel,
  battingCard,
  bowlingCard,
  dismissalText,
  fallOfWickets,
  inningsSummary,
  isWicket,
  oversOf,
  oversText,
  rate,
  type NameOf,
} from "../stats";

// Per-innings scorecard in the CricHeroes style: a coloured bar with the
// team and score (tap to collapse), batters with how they got out under
// their name, then extras, total, fall of wickets and the bowlers.
export function Scorecard({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  // The innings in progress (or the last one) starts open.
  const [open, setOpen] = useState<Set<number>>(() => new Set([match.innings.length - 1]));
  if (match.innings.length === 0) return <div className="admin-empty-state">The match hasn't started yet.</div>;
  const toggle = (index: number) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  return (
    <div className="cricket-scorecard">
      {match.innings.map((innings, index) => {
        const summary = inningsSummary(innings);
        const batting = battingCard(innings);
        const batted = new Set(batting.map((row) => row.playerId));
        const didNotBat = match.teams[innings.battingTeam].playerIds.filter((id) => !batted.has(id));
        const fow = fallOfWickets(innings);
        const isOpen = open.has(index);
        return (
          <section className="cricket-innings" key={index}>
            <button
              type="button"
              className="cricket-innings-bar"
              aria-expanded={isOpen}
              onClick={() => toggle(index)}
            >
              <span className="cricket-innings-team">{match.teams[innings.battingTeam].name}</span>
              <span className="cricket-innings-score">
                <strong>
                  {summary.runs}/{summary.wickets}
                </strong>{" "}
                <small>({summary.overs} Ov)</small>
              </span>
              <i className={`fa-solid fa-chevron-${isOpen ? "up" : "down"}`} aria-hidden="true"></i>
            </button>
            {isOpen && (
              <div className="cricket-innings-body">
                <table className="cricket-table">
                  <thead>
                    <tr>
                      <th>Batters</th>
                      <th>R</th>
                      <th>B</th>
                      <th>4s</th>
                      <th>6s</th>
                      <th>SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batting.map((row) => (
                      <tr key={row.playerId}>
                        <td className="cricket-bat-cell">
                          <span className="cricket-bat-name">
                            <PlayerLink playerId={row.playerId}>{nameOf(row.playerId)}</PlayerLink>
                            {row.outBall === null ? "*" : ""}
                          </span>
                          <small className="cricket-dismissal">
                            {row.outBall ? dismissalText(row.outBall, nameOf) : "not out"}
                          </small>
                        </td>
                        <td className="fw-bold">{row.runs}</td>
                        <td>{row.balls}</td>
                        <td>{row.fours}</td>
                        <td>{row.sixes}</td>
                        <td>{row.balls ? Math.round((row.runs * 100) / row.balls) : 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="cricket-innings-row">
                  <span>Extras</span>
                  <span>
                    <strong>{summary.extras.total}</strong>{" "}
                    <small>
                      (wd {summary.extras.wides}, nb {summary.extras.noBalls}, b {summary.extras.byes}, lb{" "}
                      {summary.extras.legByes})
                    </small>
                  </span>
                </div>
                <div className="cricket-innings-row is-total">
                  <span>Total</span>
                  <span>
                    <strong>
                      {summary.runs}/{summary.wickets}
                    </strong>{" "}
                    <small>
                      ({summary.overs} Ov, RR {rate(summary.runs, summary.legalBalls)})
                    </small>
                  </span>
                </div>
                {didNotBat.length > 0 && (
                  <p className="cricket-innings-note">
                    <span>Yet to bat / did not bat</span>
                    {didNotBat.map((id, i) => (
                      <Fragment key={id}>
                        {i > 0 && ", "}
                        <PlayerLink playerId={id}>{nameOf(id)}</PlayerLink>
                      </Fragment>
                    ))}
                  </p>
                )}
                <table className="cricket-table">
                  <thead>
                    <tr>
                      <th>Bowlers</th>
                      <th>O</th>
                      <th>M</th>
                      <th>R</th>
                      <th>W</th>
                      <th>Eco</th>
                      <th>0s</th>
                      <th>NB</th>
                      <th>WD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bowlingCard(innings).map((row) => (
                      <tr key={row.playerId}>
                        <td className="cricket-bat-cell">
                          <span className="cricket-bat-name">
                            <PlayerLink playerId={row.playerId}>{nameOf(row.playerId)}</PlayerLink>
                          </span>
                        </td>
                        <td>{row.legalBalls % 6 === 0 ? row.legalBalls / 6 : oversText(row.legalBalls)}</td>
                        <td>{row.maidens}</td>
                        <td>{row.runs}</td>
                        <td className="fw-bold">{row.wickets}</td>
                        <td>{rate(row.runs, row.legalBalls)}</td>
                        <td>{row.dots}</td>
                        <td>{row.noBalls}</td>
                        <td>{row.wides}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {fow.length > 0 && (
                  <table className="cricket-table cricket-fow">
                    <thead>
                      <tr>
                        <th>Fall of wickets</th>
                        <th>Score (over)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fow.map((w) => (
                        <tr key={w.wicket}>
                          <td>
                            <span className="cricket-bat-name">
                              {w.wicket}. <PlayerLink playerId={w.playerId}>{nameOf(w.playerId)}</PlayerLink>
                            </span>
                          </td>
                          <td>
                            <strong>{w.score}</strong> <small className="text-muted">({w.overs} Ov)</small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// Over-by-over log for one side at a time, latest first: the score after
// each over, who bowled to whom, every ball and the runs it cost.
export function BallByBall({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  const bowled = match.innings.filter((innings) => innings.balls.length > 0);
  const [picked, setPicked] = useState<number | null>(null);
  if (bowled.length === 0) {
    return <div className="admin-empty-state">No balls bowled yet.</div>;
  }
  const innings = bowled.find((inn) => inn.battingTeam === picked) ?? bowled[bowled.length - 1];

  // Score at the end of each over.
  const overs: (ReturnType<typeof oversOf>[number] & { score: string; batters: number[] })[] = [];
  let runs = 0;
  let wickets = 0;
  for (const over of oversOf(innings)) {
    runs += over.runs;
    wickets += over.balls.filter(isWicket).length;
    overs.push({ ...over, score: `${runs}-${wickets}`, batters: [...new Set(over.balls.map((ball) => ball.batterId))] });
  }

  return (
    <div className="cricket-overs-log">
      {bowled.length > 1 && (
        <div className="cricket-chip-choice" role="radiogroup" aria-label="Batting side">
          {bowled.map((inn) => (
            <button
              key={inn.battingTeam}
              type="button"
              role="radio"
              aria-checked={inn === innings}
              className={inn === innings ? "active" : ""}
              onClick={() => setPicked(inn.battingTeam)}
            >
              {match.teams[inn.battingTeam].name}
            </button>
          ))}
        </div>
      )}
      <ol className="cricket-over-cards">
        {[...overs].reverse().map((over) => (
          <li key={over.number} className="cricket-over-card">
            <div className="cricket-over-card-num">
              <strong>Ov {over.number + 1}</strong>
              <small>{over.score}</small>
            </div>
            <div className="cricket-over-card-body">
              <span className="cricket-over-card-who">
                <PlayerLink playerId={over.bowlerId}>{nameOf(over.bowlerId)}</PlayerLink> to{" "}
                {over.batters.map((id, i) => (
                  <Fragment key={id}>
                    {i > 0 && ", "}
                    <PlayerLink playerId={id}>{nameOf(id)}</PlayerLink>
                  </Fragment>
                ))}
              </span>
              <div className="cricket-this-over">
                {over.balls.map((ball, i) => (
                  <span
                    key={i}
                    className={ballChipClass(ball)}
                    title={`${nameOf(ball.bowlerId)} to ${nameOf(ball.batterId)}${
                      ball.wicketType ? ` — ${nameOf(ball.dismissedId)} ${dismissalText(ball, nameOf)}` : ""
                    }`}
                  >
                    {ballLabel(ball) === "0" ? "•" : ballLabel(ball)}
                  </span>
                ))}
              </div>
            </div>
            <div className="cricket-over-card-runs">
              <strong>{over.runs}</strong>
              <small>Run{over.runs === 1 ? "" : "s"}</small>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
