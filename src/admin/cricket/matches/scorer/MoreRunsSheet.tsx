import { useState } from "react";
import type { CricketBallInput } from "../../../../api/hooks/cricket/useCricketMatches";
import { BottomSheet } from "../../BottomSheet";
import { RunChoice } from "./RunChoice";

// The pad's "5, 6…": runs beyond its own buttons (overthrows, all-run
// fives), and a 4 or 6 the batters ran rather than hit to the rope.
export function MoreRunsSheet({
  bowlerName,
  strikerName,
  busy,
  onRecord,
  onClose,
}: {
  bowlerName: string;
  strikerName: string;
  busy: boolean;
  onRecord: (ball: Partial<CricketBallInput>) => void;
  onClose: () => void;
}) {
  const [runs, setRuns] = useState(5);
  // A 4 or 6 the batters ran (it didn't reach the rope).
  const [allRun, setAllRun] = useState(false);

  return (
    <BottomSheet
      title="Runs"
      icon="fa-solid fa-person-running"
      onClose={onClose}
      footer={
        <button
          type="button"
          className="cricket-sheet-submit"
          onClick={() => {
            // A 4 or 6 the batters ran: not a boundary.
            onRecord(allRun && (runs === 4 || runs === 6) ? { runs, boundary: false } : { runs });
            onClose();
          }}
          disabled={busy}
        >
          <i className="fa-solid fa-check" aria-hidden="true"></i> Record {runs} run{runs === 1 ? "" : "s"}
        </button>
      }
    >
      <p className="cricket-sheet-context">
        <i className="fa-solid fa-baseball" aria-hidden="true"></i> {bowlerName} to {strikerName}
      </p>
      <label className="cricket-sheet-label">Runs off the bat</label>
      {/* The server takes up to 7 off one ball. */}
      <RunChoice value={runs} onChange={setRuns} min={4} max={7} />
      {(runs === 4 || runs === 6) && (
        <div className="d-flex mt-2">
          <button type="button" className="cricket-shot-toggle" role="switch" aria-checked={allRun} onClick={() => setAllRun((v) => !v)}>
            <span className={`cricket-shot-toggle-knob ${allRun ? "is-on" : ""}`.trim()} aria-hidden="true"></span>
            All run — didn't reach the boundary
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
