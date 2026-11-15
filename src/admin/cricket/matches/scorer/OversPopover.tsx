import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CricketInnings } from "../../../../api/types";
import { ballChipClass, ballLabel, isLegal, isWicket, oversOf, type BowlingRow, type NameOf } from "../../stats";
import { ScrollableOverBalls } from "../Scorecard";
import { BowlerOversTable } from "./BowlerOversTable";

// How many overs the popover starts with.
const LAST_OVERS_SHOWN = 3;
// The closing slide's length (scorer.css).
const CLOSE_MS = 200;

type Over = ReturnType<typeof oversOf>[number];

// The scorer's bowlers & overs popover: each bowler's figures, then the
// innings' overs, newest first (the last few until asked for them all).
// Tapping a ball opens it to be corrected.
export function OversPopover({
  innings,
  perOver,
  bowling,
  overLimit,
  oversUsed,
  currentOver,
  nameOf,
  busy,
  onCorrect,
  onClosed,
}: {
  innings: CricketInnings;
  perOver: number;
  bowling: BowlingRow[];
  overLimit: number | null;
  oversUsed: (bowlerId: number) => number;
  // The over the scorer's strip shows (highlighted here).
  currentOver: Over | undefined;
  nameOf: NameOf;
  busy: boolean;
  onCorrect: (ballIndex: number) => void;
  onClosed: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const [allShown, setAllShown] = useState(false);

  // Slides away, then tells the scorer it's gone.
  function close() {
    if (closing) return;
    setClosing(true);
    setTimeout(onClosed, CLOSE_MS);
  }

  useEffect(() => {
    if (closing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setClosing(true);
      setTimeout(onClosed, CLOSE_MS);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closing, onClosed]);

  const allOvers = oversOf(innings, perOver);
  const reversedOvers = [...allOvers].reverse();
  const shownOvers = allShown ? reversedOvers : reversedOvers.slice(0, LAST_OVERS_SHOWN);

  let cumR = 0;
  let cumW = 0;
  const overScores = new Map<number, { score: string }>();
  for (const ov of allOvers) {
    cumR += ov.runs;
    cumW += ov.balls.filter(isWicket).length;
    overScores.set(ov.number, { score: `${cumR}/${cumW}` });
  }

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
            <span>Bowlers ({bowling.length})</span>
          </span>
          <button type="button" className="cricket-popover-close" onClick={close} aria-label="Close">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <div className="cricket-popover-body">
          {reversedOvers.length === 0 ? (
            <div className="cricket-popover-empty">
              <i className="fa-solid fa-baseball" aria-hidden="true"></i>
              <span>No deliveries bowled in this innings yet.</span>
            </div>
          ) : (
            <>
              <BowlerOversTable
                rows={bowling}
                currentBowlerId={innings.bowlerId}
                perOver={perOver}
                overLimit={overLimit}
                oversUsed={oversUsed}
                nameOf={nameOf}
              />
              <h3 className="cricket-popover-section">
                {allShown || allOvers.length <= LAST_OVERS_SHOWN ? `Overs (${allOvers.length})` : `Last ${LAST_OVERS_SHOWN} overs`}
              </h3>
              <div className="cricket-prev-overs-list">
                {shownOvers.map((over) => {
                  const overWkts = over.balls.filter(isWicket).length;
                  const scoreAtEnd = overScores.get(over.number)?.score;
                  const legalBalls = over.balls.filter(isLegal).length;
                  const isIncomplete = legalBalls < perOver;
                  const isCurrentOver = over.number === currentOver?.number;
                  const remainingBalls = isIncomplete ? Math.max(0, perOver - legalBalls) : 0;

                  return (
                    <div key={over.number} className={`cricket-prev-over-item${isCurrentOver ? " is-current-over" : ""}`}>
                      <div className="cricket-prev-over-meta">
                        <div className="cricket-prev-over-left">
                          <span className="cricket-prev-over-badge">Over {over.number + 1}</span>
                          <span className="cricket-prev-over-bowler">{nameOf(over.bowlerId)}</span>
                          {isIncomplete && (
                            <span className="cricket-over-incomplete-badge is-live">
                              <span className="cricket-over-live-dot" aria-hidden="true" />
                              {over.number}.{legalBalls} ov
                            </span>
                          )}
                        </div>
                        <div className="cricket-prev-over-right">
                          <span className="cricket-prev-over-runs">
                            <strong>{over.runs}</strong> {over.runs === 1 ? "run" : "runs"}
                            {overWkts > 0 && (
                              <span className="cricket-prev-over-wkts">
                                {" "}
                                · {overWkts} {overWkts === 1 ? "wkt" : "wkts"}
                              </span>
                            )}
                          </span>
                          {scoreAtEnd && <span className="cricket-prev-over-score">({scoreAtEnd})</span>}
                        </div>
                      </div>
                      <ScrollableOverBalls className="cricket-prev-over-balls-wrap">
                        {over.balls.map((ball, bi) => {
                          const originalIndex = innings.balls.indexOf(ball);
                          return (
                            <button
                              key={bi}
                              type="button"
                              className={`${ballChipClass(ball)} cricket-chip-btn`}
                              disabled={busy || ball.extraType === "penalty"}
                              onClick={() => {
                                close();
                                onCorrect(originalIndex);
                              }}
                              title="Tap to correct this ball"
                            >
                              {ballLabel(ball)}
                            </button>
                          );
                        })}
                        {remainingBalls > 0 &&
                          Array.from({ length: remainingBalls }, (_, i) => (
                            <span key={`empty-${i}`} className="cricket-ball-slot-empty" title="Remaining ball in this over" aria-hidden="true" />
                          ))}
                      </ScrollableOverBalls>
                    </div>
                  );
                })}
              </div>
              {/* Tapping a ball corrects it, so the older ones stay in reach. */}
              {!allShown && allOvers.length > LAST_OVERS_SHOWN && (
                <button type="button" className="cricket-popover-more" onClick={() => setAllShown(true)}>
                  Show all {allOvers.length} overs
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
