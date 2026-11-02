import { oversText, rate, type BowlingRow, type NameOf } from "../../stats";

// How much each bowler has bowled this innings and, with a bowling limit, how
// much they have left. Wider than a phone, it scrolls sideways.
export function BowlerOversTable({
  rows,
  currentBowlerId,
  perOver,
  overLimit,
  oversUsed,
  nameOf,
}: {
  rows: BowlingRow[];
  currentBowlerId: number | null;
  perOver: number;
  overLimit: number | null;
  // Overs the bowler has started, which is what the limit counts.
  oversUsed: (bowlerId: number) => number;
  nameOf: NameOf;
}) {
  return (
    <div className="cricket-bowler-overs">
      <div className="cricket-bowler-overs-row is-head" aria-hidden="true">
        <span>Bowler</span>
        <span>O</span>
        <span>M</span>
        <span>R</span>
        <span>W</span>
        <span>Eco</span>
        <span>0s</span>
        <span>NB</span>
        <span>WD</span>
      </div>
      {rows.map((row) => {
        const left = overLimit === null ? null : Math.max(0, overLimit - oversUsed(row.playerId));
        return (
          <div key={row.playerId} className={`cricket-bowler-overs-row${row.playerId === currentBowlerId ? " is-current" : ""}`}>
            <span className="cricket-bowler-overs-name">
              <strong>{nameOf(row.playerId)}</strong>
              {left !== null && (
                <small className={left === 0 ? "is-used-up" : ""}>
                  {left === 0 ? "Overs used up" : `${left} over${left === 1 ? "" : "s"} left`}
                </small>
              )}
            </span>
            <strong>{oversText(row.legalBalls, perOver)}</strong>
            <span>{row.maidens}</span>
            <span>{row.runs}</span>
            <span>{row.wickets}</span>
            <span>{rate(row.runs, row.legalBalls, perOver)}</span>
            <span>{row.dots}</span>
            <span>{row.noBalls}</span>
            <span>{row.wides}</span>
          </div>
        );
      })}
    </div>
  );
}
