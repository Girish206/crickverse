import { Fragment } from "react";
import type { CricketBall, CricketInnings } from "../../../api/types";
import { ScrollableOverBalls } from "../matches/Scorecard";
import { ballChipClass, ballLabel, conceded, dismissalText, oversOf, type NameOf } from "../stats";

// One player's balls in one innings, the same way round as a batter or a
// bowler: every ball in one row, as on the Live tab ("Over 2  1 4 0  = 5"),
// then a line per player at the other end (the bowlers they faced, or the
// batters they bowled to), in the order they met: name, the balls, runs (balls).
// A batter's runs are off the bat; a bowler's are those charged to them.
export function PlayerBallLog({
  innings,
  playerId,
  as,
  perOver,
  nameOf,
}: {
  innings: CricketInnings;
  playerId: number;
  as: "batter" | "bowler";
  perOver: number;
  nameOf: NameOf;
}) {
  const batting = as === "batter";
  const mine = (ball: CricketBall) =>
    ball.extraType !== "penalty" && (batting ? ball.batterId : ball.bowlerId) === playerId;
  const runsOf = (balls: CricketBall[]) =>
    balls.reduce((sum, ball) => sum + (batting ? ball.runs : conceded(ball)), 0);
  // Wides aren't balls faced, nor legal balls bowled; a no-ball is faced.
  const ballsOf = (balls: CricketBall[]) =>
    balls.filter((ball) => ball.extraType !== "wide" && (batting || ball.extraType !== "no-ball")).length;

  const overs = oversOf(innings, perOver)
    .map((over) => ({ number: over.number, balls: over.balls.filter(mine) }))
    .filter((over) => over.balls.length > 0);
  if (overs.length === 0) return null;

  const byOther = new Map<number, CricketBall[]>();
  for (const ball of innings.balls.filter(mine)) {
    const other = batting ? ball.bowlerId : ball.batterId;
    byOther.set(other, [...(byOther.get(other) ?? []), ball]);
  }

  const chip = (ball: CricketBall, i: number) => (
    <span
      key={i}
      className={ballChipClass(ball)}
      title={`${nameOf(ball.bowlerId)} to ${nameOf(ball.batterId)}${
        ball.wicketType ? ` — ${nameOf(ball.dismissedId)} ${dismissalText(ball, nameOf)}` : ""
      }`}
    >
      {ballLabel(ball) === "0" ? "•" : ballLabel(ball)}
    </span>
  );

  return (
    <>
      <ScrollableOverBalls
        className="cricket-prev-over-balls-wrap cricket-live-overs cricket-batter-overs"
        scrollEndKey={innings.balls.length}
      >
        {overs.map((over) => (
          <Fragment key={over.number}>
            <span className="cricket-live-overs-label">Over {over.number + 1}</span>
            {over.balls.map(chip)}
            <span className="cricket-live-overs-total">= {runsOf(over.balls)}</span>
          </Fragment>
        ))}
      </ScrollableOverBalls>
      <ul className="cricket-batter-balls">
        {[...byOther].map(([otherId, balls]) => (
          <li key={otherId}>
            <span className="cricket-batter-balls-name">{nameOf(otherId)}</span>
            <span className="cricket-batter-balls-chips">{balls.map(chip)}</span>
            <span className="cricket-batter-balls-score">
              {runsOf(balls)} <small>({ballsOf(balls)})</small>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
