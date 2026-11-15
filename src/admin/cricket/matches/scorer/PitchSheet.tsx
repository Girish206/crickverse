import { BottomSheet } from "../../BottomSheet";
import { PITCH_LENGTHS, PITCH_LINES, type PitchLength, type PitchLine } from "../../analytics";
import { buzz } from "../scorerPrefs";

// Where the ball pitched (the pitch map, when the scorer has it on): one tap
// on a line-by-length grid records the ball, or Skip records it unmarked.
// The batter's end is at the top, as the bowler sees it; lines are for a
// right-hander (a left-hander's "off" is the other side of the stumps).
export function PitchSheet({
  bowlerName,
  leftHanded,
  busy,
  onPick,
  onClose,
}: {
  bowlerName: string;
  leftHanded: boolean;
  busy: boolean;
  onPick: (spot: { line: PitchLine; length: PitchLength } | null) => void;
  onClose: () => void;
}) {
  // A left-hander's off side is on the leg side of a right-hander's grid.
  const lines = leftHanded ? [...PITCH_LINES].reverse() : PITCH_LINES;
  return (
    <BottomSheet title="Where did it pitch?" icon="fa-solid fa-table-cells" onClose={onClose}>
      <p className="cricket-sheet-context">
        {bowlerName}'s ball{leftHanded ? " · left-hander" : ""}. Tap where it landed.
      </p>
      <div className="cricket-pitch-pick" role="group" aria-label="Line and length">
        <span className="cricket-pitch-pick-stumps" aria-hidden="true">
          <i className="fa-solid fa-grip-lines-vertical"></i> Batter
        </span>
        <div className="cricket-pitch-pick-head" aria-hidden="true">
          <span></span>
          {lines.map((line) => (
            <span key={line.value}>{line.label}</span>
          ))}
        </div>
        {PITCH_LENGTHS.map((length) => (
          <div key={length.value} className="cricket-pitch-pick-row">
            <span className="cricket-pitch-pick-len">{length.label}</span>
            {lines.map((line) => (
              <button
                key={line.value}
                type="button"
                className={`cricket-pitch-pick-cell ${line.value === "stumps" ? "is-stumps" : ""}`.trim()}
                disabled={busy}
                aria-label={`${length.label}, ${line.label}`}
                onClick={() => {
                  buzz();
                  onPick({ line: line.value, length: length.value });
                }}
              ></button>
            ))}
          </div>
        ))}
      </div>
      <button type="button" className="cricket-undo-link cricket-pitch-skip" disabled={busy} onClick={() => onPick(null)}>
        Skip — record without the pitch map
      </button>
    </BottomSheet>
  );
}
