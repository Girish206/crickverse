import { Fragment } from "react";
import { ballsPerOverOf, type CricketInnings, type CricketMatch } from "../../../api/types";
import { ballChipClass, ballLabel, oversOf } from "../stats";
import { ScrollableOverBalls } from "./Scorecard";

// The Live tab's ball history of the innings in play: one row of
// "Over 2  1 W 0 4 0 1  = 6", oldest to newest, that stays scrolled to the latest ball.
export function OversHistory({ match, innings }: { match: CricketMatch; innings: CricketInnings }) {
  const overs = oversOf(innings, ballsPerOverOf(match));
  if (overs.length === 0) return null;

  return (
    <ScrollableOverBalls className="cricket-prev-over-balls-wrap cricket-live-overs" scrollEndKey={innings.balls.length}>
      {overs.map((over) => (
        <Fragment key={over.number}>
          <span className="cricket-live-overs-label">Over {over.number + 1}</span>
          {over.balls.map((ball, i) => (
            <span key={i} className={ballChipClass(ball)}>
              {ballLabel(ball)}
            </span>
          ))}
          <span className="cricket-live-overs-total">= {over.runs}</span>
        </Fragment>
      ))}
    </ScrollableOverBalls>
  );
}
