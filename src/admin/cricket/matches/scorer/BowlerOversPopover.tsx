import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { oversText, rate, type BowlingRow, type NameOf } from "../../stats";

// The scorer's "Bowlers" popover: how much each bowler has bowled this
// innings, and with a bowling limit, how much they have left.
export function BowlerOversPopover({
  rows,
  currentBowlerId,
  perOver,
  overLimit,
  oversUsed,
  nameOf,
  onClose,
}: {
  rows: BowlingRow[];
  currentBowlerId: number | null;
  perOver: number;
  overLimit: number | null;
  // Overs the bowler has started, which is what the limit counts.
  oversUsed: (bowlerId: number) => number;
  nameOf: NameOf;
  onClose: () => void;
}) {
  const [closing, setClosing] = useState(false);

  function close() {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 200);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return createPortal(
    <div className={`cricket-popover-backdrop${closing ? " is-closing" : ""}`} onClick={close}>
      <div
        className={`cricket-popover-card${closing ? " is-closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Bowlers"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cricket-popover-handle-wrap" aria-hidden="true">
          <span className="cricket-popover-handle" />
        </div>
        <div className="cricket-popover-header">
          <span className="cricket-prev-overs-title">
            <i className="fa-solid fa-baseball" aria-hidden="true"></i>
            <span>Bowlers ({rows.length})</span>
          </span>
          <button type="button" className="cricket-popover-close" onClick={close} aria-label="Close">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <div className="cricket-popover-body">
          {rows.length === 0 ? (
            <div className="cricket-popover-empty">
              <i className="fa-solid fa-baseball" aria-hidden="true"></i>
              <span>No deliveries bowled in this innings yet.</span>
            </div>
          ) : (
            <div className="cricket-bowler-overs">
              <div className="cricket-bowler-overs-row is-head" aria-hidden="true">
                <span>Bowler</span>
                <span>O</span>
                <span>M</span>
                <span>R</span>
                <span>W</span>
                <span>Econ</span>
              </div>
              {rows.map((row) => {
                const left = overLimit === null ? null : Math.max(0, overLimit - oversUsed(row.playerId));
                return (
                  <div
                    key={row.playerId}
                    className={`cricket-bowler-overs-row${row.playerId === currentBowlerId ? " is-current" : ""}`}
                  >
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
