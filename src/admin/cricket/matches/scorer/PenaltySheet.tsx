import { useState } from "react";
import { BottomSheet } from "../../BottomSheet";
import { RunChoice } from "./RunChoice";

// Penalty runs the umpires award the batting side (5 for most fielding
// offences), between deliveries: the crease and the over stay as they are.
export function PenaltySheet({
  battingTeam,
  busy,
  onRecord,
  onClose,
}: {
  battingTeam: string;
  busy: boolean;
  onRecord: (runs: number) => void;
  onClose: () => void;
}) {
  const [runs, setRuns] = useState(5);
  return (
    <BottomSheet
      title="Penalty runs"
      icon="fa-solid fa-gavel"
      onClose={onClose}
      footer={
        <button type="button" className="cricket-sheet-submit" onClick={() => onRecord(runs)} disabled={busy}>
          <i className="fa-solid fa-check" aria-hidden="true"></i> Award {runs} penalty run{runs === 1 ? "" : "s"}
        </button>
      }
    >
      <p className="cricket-sheet-context">
        <i className="fa-solid fa-gavel" aria-hidden="true"></i> To <strong>{battingTeam}</strong> — added to their
        score, not to a batter or the bowler
      </p>
      <label className="cricket-sheet-label">Runs (usually 5)</label>
      <RunChoice value={runs} onChange={setRuns} min={1} max={10} />
    </BottomSheet>
  );
}
