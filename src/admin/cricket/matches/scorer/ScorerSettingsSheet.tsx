import type { ReactNode } from "react";
import type { CricketMatch } from "../../../../api/types";
import { BottomSheet } from "../../BottomSheet";
import type { NameOf } from "../../stats";

type Slot = "strikerId" | "nonStrikerId" | "bowlerId";

// The scorer's settings sheet (the top bar's gear): who's in, the rarer
// scoring actions, the match's own options (`matchSettings`), and ending
// play. Each action closes the sheet first. Anything that changes the score
// on the server is off while offline or while balls are waiting to send
// (`queueing`); the shot map switch isn't.
export function ScorerSettingsSheet({
  match,
  nameOf,
  busy,
  queueing,
  needsPlayers,
  smallShotsOn,
  hapticsOn,
  pitchMapOn,
  onToggleHaptics,
  onTogglePitchMap,
  matchSettings,
  onClose,
  onChangePlayer,
  onSwapStrike,
  onCorrect,
  onManageSquads,
  onToggleSmallShots,
  onShortRun,
  onPenalty,
  onRain,
  onEndInnings,
  onAbandon,
}: {
  match: CricketMatch;
  nameOf: NameOf;
  busy: boolean;
  queueing: boolean;
  needsPlayers: boolean;
  smallShotsOn: boolean;
  hapticsOn: boolean;
  pitchMapOn: boolean;
  onToggleHaptics: () => void;
  onTogglePitchMap: () => void;
  matchSettings: ReactNode;
  onClose: () => void;
  onChangePlayer: (slot: Slot) => void;
  onSwapStrike: () => void;
  onCorrect: () => void;
  onManageSquads: () => void;
  onToggleSmallShots: () => void;
  onShortRun: () => void;
  onPenalty: () => void;
  onRain: () => void;
  onEndInnings: () => void;
  onAbandon: () => void;
}) {
  const innings = match.innings[match.innings.length - 1];
  const then = (action: () => void) => () => {
    onClose();
    action();
  };
  const offline = busy || queueing;

  return (
    <BottomSheet title="Match settings" icon="fa-solid fa-gear" onClose={onClose}>
      <h3 className="cricket-sheet-label">Players</h3>
      <div className="cricket-settings-list">
        {(
          [
            ["strikerId", "Change striker", "fa-baseball-bat-ball"],
            ["nonStrikerId", "Change non-striker", "fa-user"],
            ["bowlerId", "Change bowler", "fa-baseball"],
          ] as const
        ).map(([slot, label, icon]) => (
          <button
            key={slot}
            type="button"
            className="cricket-settings-item"
            disabled={offline || innings[slot] === null}
            // The same "why?" step as tapping them.
            onClick={then(() => onChangePlayer(slot))}
          >
            <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
            <span>
              {label}
              <small>{innings[slot] === null ? "Not picked yet" : nameOf(innings[slot])}</small>
            </span>
            <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
          </button>
        ))}
        <button
          type="button"
          className="cricket-settings-item"
          disabled={offline || innings.strikerId === null || innings.nonStrikerId === null}
          onClick={then(onSwapStrike)}
        >
          <i className="fa-solid fa-arrow-right-arrow-left fa-rotate-90" aria-hidden="true"></i>
          <span>
            Swap strike
            <small>{nameOf(innings.nonStrikerId)} faces the next ball</small>
          </span>
        </button>
      </div>

      <h3 className="cricket-sheet-label">Scoring</h3>
      <div className="cricket-settings-list">
        <button
          type="button"
          className="cricket-settings-item"
          disabled={offline || innings.balls.length === 0}
          onClick={then(onCorrect)}
        >
          <i className="fa-solid fa-pen" aria-hidden="true"></i>
          <span>
            Correct a ball
            <small>Fix a fielder, the runs, how a batter was out or who bowled</small>
          </span>
          <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </button>
        <button type="button" className="cricket-settings-item" disabled={offline} onClick={then(onManageSquads)}>
          <i className="fa-solid fa-users-gear" aria-hidden="true"></i>
          <span>
            Manage squads
            <small>Add a player, remove one, or move one to the other side</small>
          </span>
          <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          className="cricket-settings-item"
          role="switch"
          aria-checked={smallShotsOn}
          onClick={onToggleSmallShots}
        >
          <i className="fa-solid fa-bullseye" aria-hidden="true"></i>
          <span>
            Shot map for 1s, 2s and 3s
            <small>Fours, sixes, catches and run-outs always ask where the ball went</small>
          </span>
          <span className={`cricket-shot-toggle-knob ${smallShotsOn ? "is-on" : ""}`.trim()} aria-hidden="true"></span>
        </button>
        <button type="button" className="cricket-settings-item" role="switch" aria-checked={pitchMapOn} onClick={onTogglePitchMap}>
          <i className="fa-solid fa-table-cells" aria-hidden="true"></i>
          <span>
            Pitch map
            <small>Ask where each ball pitched (line and length), for the bowlers' maps in Insights</small>
          </span>
          <span className={`cricket-shot-toggle-knob ${pitchMapOn ? "is-on" : ""}`.trim()} aria-hidden="true"></span>
        </button>
        <button type="button" className="cricket-settings-item" role="switch" aria-checked={hapticsOn} onClick={onToggleHaptics}>
          <i className="fa-solid fa-mobile-screen-button" aria-hidden="true"></i>
          <span>
            Vibrate on tap
            <small>A short buzz on every pad tap, so you know it took without looking</small>
          </span>
          <span className={`cricket-shot-toggle-knob ${hapticsOn ? "is-on" : ""}`.trim()} aria-hidden="true"></span>
        </button>
        <button type="button" className="cricket-settings-item" disabled={offline || needsPlayers} onClick={then(onShortRun)}>
          <i className="fa-solid fa-person-running" aria-hidden="true"></i>
          <span>
            Short run
            <small>A run not completed: it isn't scored, but the batters stay where they ran to</small>
          </span>
          <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </button>
        <button type="button" className="cricket-settings-item" disabled={offline || needsPlayers} onClick={then(onPenalty)}>
          <i className="fa-solid fa-gavel text-warning" aria-hidden="true"></i>
          <span>
            Penalty runs
            <small>Award 5 penalty runs to batting or fielding side</small>
          </span>
          <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </button>
      </div>

      {matchSettings}

      <h3 className="cricket-sheet-label">End play</h3>
      <div className="cricket-settings-list">
        <button type="button" className="cricket-settings-item" disabled={offline} onClick={then(onRain)}>
          <i className="fa-solid fa-cloud-showers-heavy" aria-hidden="true"></i>
          <span>
            Rain interruption (DLS)
            <small>Cut the overs or stop play; the target is worked out by Duckworth-Lewis</small>
          </span>
          <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </button>
        <button type="button" className="cricket-settings-item" disabled={offline} onClick={then(onEndInnings)}>
          <i className="fa-solid fa-flag-checkered" aria-hidden="true"></i>
          <span>
            {match.innings.length === 2 ? "End match" : "End innings"}
            <small>{match.innings.length === 2 ? "Close the chase and work out the result" : "The other side bats next"}</small>
          </span>
        </button>
        <button type="button" className="cricket-settings-item is-danger" disabled={offline} onClick={then(onAbandon)}>
          <i className="fa-solid fa-cloud-rain" aria-hidden="true"></i>
          <span>
            Abandon match
            <small>Recorded as a no result</small>
          </span>
        </button>
      </div>
    </BottomSheet>
  );
}
