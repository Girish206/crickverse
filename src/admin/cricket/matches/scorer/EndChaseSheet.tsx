import { BottomSheet } from "../../BottomSheet";

// Ending the chase early: either it's over on the scores (the chasing side
// declares, or has no one left to bat), or the result was decided some
// other way and is entered by hand.
export function EndChaseSheet({
  busy,
  onEndInnings,
  onEnterResult,
  onClose,
}: {
  busy: boolean;
  onEndInnings: () => void;
  onEnterResult: () => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet title="End the match?" icon="fa-solid fa-flag-checkered" onClose={onClose}>
      <div className="cricket-settings-list">
        <button type="button" className="cricket-settings-item" disabled={busy} onClick={onEndInnings}>
          <i className="fa-solid fa-calculator" aria-hidden="true"></i>
          <span>
            End the innings — result from the scores
            <small>The chase closes where it stands and the result is worked out</small>
          </span>
          <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </button>
        <button type="button" className="cricket-settings-item" disabled={busy} onClick={onEnterResult}>
          <i className="fa-solid fa-pen-to-square" aria-hidden="true"></i>
          <span>
            Enter the result instead
            <small>Rain, a forfeit, a super over…</small>
          </span>
          <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </button>
      </div>
    </BottomSheet>
  );
}
