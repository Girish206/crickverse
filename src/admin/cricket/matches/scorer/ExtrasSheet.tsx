import { useState } from "react";
import type { CricketBallInput } from "../../../../api/hooks/cricket/useCricketMatches";
import type { CricketExtraType } from "../../../../api/types";
import { BottomSheet } from "../../BottomSheet";
import { EXTRA_ICONS, EXTRA_LABELS } from "./extras";
import { RunChoice } from "./RunChoice";

// A wide, no ball, bye or leg bye: the runs that came off it (and, for a no
// ball, whether they were off the bat and whether the next ball's a free
// hit). Runs off the bat off a no ball go through the shot map
// (onRecordShot); the rest are recorded as they are.
export function ExtrasSheet({
  type,
  bowlerName,
  strikerName,
  freeHitDefault,
  busy,
  onRecord,
  onRecordShot,
  onClose,
}: {
  type: CricketExtraType;
  bowlerName: string;
  strikerName: string;
  // The match plays free hits after a no ball.
  freeHitDefault: boolean;
  busy: boolean;
  onRecord: (ball: Partial<CricketBallInput>) => void;
  onRecordShot: (ball: Partial<CricketBallInput>) => void;
  onClose: () => void;
}) {
  const [runs, setRuns] = useState(type === "bye" || type === "leg-bye" ? 1 : 0);
  // A no ball's runs: off the bat (null), or byes / leg-byes.
  const [byes, setByes] = useState<"bye" | "leg-bye" | null>(null);
  const [freeHit, setFreeHit] = useState(freeHitDefault);

  function submit() {
    if (type === "wide") onRecord({ extraType: "wide", extras: 1 + runs });
    // Byes or leg-byes off a no ball are extras on top of its penalty.
    if (type === "no-ball" && byes && runs > 0) {
      onRecord({ extraType: "no-ball", runs: 0, extras: 1 + runs, byeType: byes, freeHit });
    } else if (type === "no-ball") {
      onRecordShot({ extraType: "no-ball", extras: 1, runs: byes ? 0 : runs, freeHit });
    }
    if (type === "bye" || type === "leg-bye") onRecord({ extraType: type, extras: Math.max(runs, 1) });
    onClose();
  }

  return (
    <BottomSheet
      title={EXTRA_LABELS[type]}
      icon={`fa-solid ${EXTRA_ICONS[type]}`}
      onClose={onClose}
      footer={
        <button type="button" className="cricket-sheet-submit" onClick={submit} disabled={busy}>
          <i className="fa-solid fa-check" aria-hidden="true"></i> Record {EXTRA_LABELS[type].toLowerCase()}
          {type === "wide" || type === "no-ball" ? ` + ${runs}` : ` ${Math.max(runs, 1)}`}
        </button>
      }
    >
      <p className="cricket-sheet-context">
        <i className="fa-solid fa-baseball" aria-hidden="true"></i> {bowlerName} to {strikerName}
      </p>
      {type === "no-ball" && (
        <>
          <label className="cricket-sheet-label">The runs were</label>
          <div className="cricket-chip-choice" role="radiogroup" aria-label="The runs were">
            {(
              [
                [null, "Off the bat"],
                ["bye", "Byes"],
                ["leg-bye", "Leg byes"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={byes === value}
                className={byes === value ? "active" : ""}
                onClick={() => setByes(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
      <label className="cricket-sheet-label">
        {type === "no-ball"
          ? byes
            ? `${byes === "bye" ? "Byes" : "Leg byes"} run (1-run penalty added)`
            : "Runs off the bat (1-run penalty added)"
          : type === "wide"
            ? "Runs run as well (1-run penalty added)"
            : "Runs run"}
      </label>
      <RunChoice value={runs} onChange={setRuns} min={type === "bye" || type === "leg-bye" ? 1 : 0} />
      {type === "no-ball" && (
        <div className="cricket-freehit-choice mt-3 pt-2 border-top">
          <label className="cricket-sheet-label mb-1">Free hit on next ball?</label>
          <div className="cricket-chip-choice" role="radiogroup" aria-label="Free hit on next ball">
            <button type="button" role="radio" aria-checked={freeHit} className={freeHit ? "active" : ""} onClick={() => setFreeHit(true)}>
              <i className="fa-solid fa-bolt text-warning me-1" aria-hidden="true"></i> Yes (Free hit)
            </button>
            <button type="button" role="radio" aria-checked={!freeHit} className={!freeHit ? "active" : ""} onClick={() => setFreeHit(false)}>
              <i className="fa-solid fa-ban me-1" aria-hidden="true"></i> No free hit
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
