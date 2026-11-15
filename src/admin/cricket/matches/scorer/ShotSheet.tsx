import { useState } from "react";
import type { CricketBallInput } from "../../../../api/hooks/cricket/useCricketMatches";
import { BottomSheet } from "../../BottomSheet";
import { OutArt } from "../OutArt";
import { COMMON_SHOTS, flightOf, SHOT_TYPES, ShotGround, shotHoldMs, shotZoneAt } from "../ShotMap";

type Spot = { x: number; y: number };

// Where the ball went: first the shot played, then a tap on the ground,
// which records it (the line to the spot shows for a moment first). A four
// or six must name the shot; anything else may skip either step.
export function ShotSheet({
  ball,
  strikerName,
  leftHanded,
  busy,
  smallShotsOn,
  onToggleSmallShots,
  onRecord,
  onClose,
}: {
  // The ball waiting for its shot.
  ball: Partial<CricketBallInput>;
  strikerName: string;
  leftHanded: boolean;
  busy: boolean;
  smallShotsOn: boolean;
  onToggleSmallShots: () => void;
  onRecord: (spot: Spot | null, shotType: string | null) => void;
  onClose: () => void;
}) {
  const [spot, setSpot] = useState<Spot | null>(null);
  // The two steps: name the shot, then mark it on the wagon wheel.
  const [step, setStep] = useState<"type" | "spot">("type");
  const [shotType, setShotType] = useState<string | null>(null);
  // "Show more" (the rarer shots).
  const [moreShots, setMoreShots] = useState(false);

  const flight = flightOf(ball.runs, ball.boundary, Boolean(ball.wicketType));
  const needsType = !ball.wicketType && (ball.runs === 4 || ball.runs === 6);
  const word = ball.wicketType
    ? "wicket"
    : ball.runs === 4
      ? "four"
      : ball.runs === 6
        ? "six"
        : `${ball.runs} run${ball.runs === 1 ? "" : "s"}`;

  // A tap on the ground records the ball. Further taps meanwhile are ignored.
  function tap(x: number, y: number) {
    if (spot) return;
    const tapped = { x, y };
    setSpot(tapped);
    setTimeout(() => onRecord(tapped, shotType), shotHoldMs(flight));
  }

  return (
    <BottomSheet
      title={
        step === "type"
          ? ball.wicketType
            ? "What shot was played?"
            : `What shot was the ${word}?`
          : ball.wicketType === "caught"
            ? "Where was the catch taken?"
            : ball.wicketType
              ? "Where was the ball fielded?"
              : `Where did the ${word} go?`
      }
      icon="fa-solid fa-bullseye"
      // Once a spot is tapped the ball is on its way in; it can't be dropped.
      onClose={() => !spot && onClose()}
      footer={
        step === "spot" ? (
          <button type="button" className="cricket-sheet-undo" disabled={busy || Boolean(spot)} onClick={() => onRecord(null, shotType)}>
            Skip — record the {word} without a spot
          </button>
        ) : needsType ? undefined : (
          <button type="button" className="cricket-sheet-undo" onClick={() => setStep("spot")}>
            Skip — don't name the shot
          </button>
        )
      }
    >
      {step === "type" ? (
        <>
          <p className="cricket-sheet-context">
            <i className="fa-solid fa-baseball-bat-ball" aria-hidden="true"></i> {strikerName} · pick the shot
            {needsType ? "" : " (optional)"}
          </p>
          <div className="cricket-out-grid cricket-shot-tiles" role="group" aria-label="Shot played">
            {(moreShots ? SHOT_TYPES : SHOT_TYPES.slice(0, COMMON_SHOTS)).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={shotType === type}
                className={`cricket-out-tile ${shotType === type ? "active" : ""}`.trim()}
                onClick={() => {
                  setShotType(type);
                  setStep("spot");
                }}
              >
                <span className="cricket-out-icon">
                  <OutArt type={`shot:${type}`} />
                </span>
                <span className="cricket-out-label">{type}</span>
              </button>
            ))}
          </div>
          <div className="d-flex justify-content-center">
            <button type="button" className="cricket-out-more" onClick={() => setMoreShots((v) => !v)}>
              {moreShots ? "Show less" : "Show more"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="cricket-sheet-context">
            <i className="fa-solid fa-baseball-bat-ball" aria-hidden="true"></i> {strikerName}
            {shotType && ` · ${shotType}`} ·{" "}
            {spot ? (
              <strong>
                <i className="fa-solid fa-check" aria-hidden="true"></i> {shotZoneAt(spot.x, spot.y)}
              </strong>
            ) : (
              "tap where the ball went to record it"
            )}
          </p>
          <ShotGround marker={spot} markerFlight={flight} onPick={tap} leftHanded={leftHanded} label="Tap where the ball went" />
          <div className="d-flex justify-content-center">
            <button type="button" className="cricket-out-more" disabled={Boolean(spot)} onClick={() => setStep("type")}>
              <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> {shotType ? "Change shot" : "Name the shot"}
            </button>
          </div>
        </>
      )}
      {!ball.wicketType && (
        <div className="d-flex justify-content-center mt-2">
          <button type="button" className="cricket-shot-toggle" role="switch" aria-checked={smallShotsOn} onClick={onToggleSmallShots}>
            <span className={`cricket-shot-toggle-knob ${smallShotsOn ? "is-on" : ""}`.trim()} aria-hidden="true"></span>
            Ask for 1s, 2s and 3s too
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
