import { useState } from "react";
import { useEditCricketBall, type CricketBallEdit } from "../../../../api/hooks/cricket/useCricketMatches";
import type { CricketFieldingLapse, CricketMatch, CricketWicketType } from "../../../../api/types";
import { BottomSheet } from "../../BottomSheet";
import { PlayerAvatar } from "../../players/PlayerAvatar";
import { ballChipClass, ballLabel, oversOf, type NameOf } from "../../stats";
import { usePlayerPhotos } from "../matchUtils";
import { PlayerPicker } from "../PlayerPicker";
import { RunChoice } from "./RunChoice";

// The bowler's dismissals, which can be swapped for one another (none moves
// the crease) — as the API allows.
const SWAPPABLE: { value: CricketWicketType; label: string }[] = [
  { value: "bowled", label: "Bowled" },
  { value: "caught", label: "Caught" },
  { value: "caught-behind", label: "Caught behind" },
  { value: "lbw", label: "LBW" },
  { value: "stumped", label: "Stumped" },
  { value: "hit-wicket", label: "Hit wicket" },
];
const BOWLER_OUTS: (CricketWicketType | null)[] = SWAPPABLE.map((kind) => kind.value);
// Dismissals with a fielder to name.
const WITH_FIELDER: (CricketWicketType | null)[] = ["caught", "caught-behind", "stumped", "run-out"];

interface CorrectBallSheetProps {
  match: CricketMatch;
  nameOf: NameOf;
  perOver: number;
  // The ball tapped in the over strip; null starts from the list of balls.
  ballIndex: number | null;
  // Only marking a dropped catch or misfield, not correcting the ball.
  lapseOnly?: boolean;
  onClose: () => void;
}

// Fixes an earlier ball of this innings without undoing everything after
// it: the fielder, the kind of a bowler's dismissal, its runs (the API moves
// the strike on the balls after it to match), boundary or all run, who
// bowled the over, or a fielding mistake on it.
export function CorrectBallSheet({ match, nameOf, perOver, ballIndex, lapseOnly = false, onClose }: CorrectBallSheetProps) {
  const [chosen, setChosen] = useState<number | null>(ballIndex);
  const inningsIndex = match.innings.length - 1;
  const innings = match.innings[inningsIndex];

  if (chosen !== null && innings.balls[chosen]) {
    return (
      <BallEditor
        key={chosen}
        match={match}
        nameOf={nameOf}
        perOver={perOver}
        ballIndex={chosen}
        lapseOnly={lapseOnly}
        // From the list, back goes back to it; from a tapped chip, it closes.
        onBack={ballIndex === null ? () => setChosen(null) : onClose}
        onClose={onClose}
      />
    );
  }

  const overs = oversOf(innings, perOver).reverse();
  return (
    <BottomSheet title="Correct a ball" icon="fa-solid fa-pen" onClose={onClose} fullScreen>
      <p className="cricket-sheet-context">
        <i className="fa-solid fa-hand-pointer" aria-hidden="true"></i> Tap the ball to correct
      </p>
      {overs.length === 0 ? (
        <div className="admin-empty-state">No balls bowled yet this innings.</div>
      ) : (
        <div className="cricket-correct-overs">
          {overs.map((over) => (
            <div key={over.number} className="cricket-correct-over">
              <small>
                Over {over.number + 1} · {nameOf(over.bowlerId)} · {over.runs} run{over.runs === 1 ? "" : "s"}
              </small>
              <div className="cricket-this-over">
                {over.balls.map((ball) => {
                  const index = innings.balls.indexOf(ball);
                  return (
                    <button
                      key={index}
                      type="button"
                      className={`${ballChipClass(ball)} cricket-chip-btn`}
                      disabled={ball.extraType === "penalty"}
                      onClick={() => setChosen(index)}
                    >
                      {ballLabel(ball)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}

function BallEditor({
  match,
  nameOf,
  perOver,
  ballIndex,
  lapseOnly,
  onBack,
  onClose,
}: {
  match: CricketMatch;
  nameOf: NameOf;
  perOver: number;
  ballIndex: number;
  lapseOnly: boolean;
  onBack: () => void;
  onClose: () => void;
}) {
  const editBall = useEditCricketBall();
  const photoOf = usePlayerPhotos();
  const inningsIndex = match.innings.length - 1;
  const innings = match.innings[inningsIndex];
  const ball = innings.balls[ballIndex];
  const fieldingXi = match.teams[1 - innings.battingTeam].playerIds;
  const over = oversOf(innings, perOver).find((o) => o.balls.includes(ball));

  const [runs, setRuns] = useState(ball.runs);
  const [boundary, setBoundary] = useState(ball.boundary !== false);
  const [kind, setKind] = useState(ball.wicketType);
  const [fielderId, setFielderId] = useState(ball.fielderId);
  const [secondFielderId, setSecondFielderId] = useState(ball.secondFielderId ?? null);
  const [bowlerId, setBowlerId] = useState(ball.bowlerId);
  const [excellentCatch, setExcellentCatch] = useState(Boolean(ball.excellentCatch));
  const [lapseType, setLapseType] = useState<CricketFieldingLapse | null>(ball.lapseType ?? null);
  const [lapseFielderId, setLapseFielderId] = useState(ball.lapseFielderId ?? null);
  const [picking, setPicking] = useState<"fielderId" | "secondFielderId" | "bowlerId" | "lapseFielderId" | null>(null);

  // What can change on this ball, as the API allows.
  const runsEditable =
    !ball.noDelivery &&
    (ball.extraType === null || (ball.extraType === "no-ball" && !ball.byeType)) &&
    !BOWLER_OUTS.includes(ball.wicketType);
  const kindEditable = BOWLER_OUTS.includes(ball.wicketType) && ball.extraType === null;
  const takesFielder = WITH_FIELDER.includes(kind);
  const boundaryEditable = runsEditable && (runs === 4 || runs === 6);
  const bowlerEditable = ball.extraType !== "penalty";
  const catchTaken = (kind === "caught" || kind === "caught-behind") && fielderId !== null;
  const lapseEditable = !ball.noDelivery;
  // Nothing comes off the bat on a wide, bye or leg-bye, so there's no catch.
  const lapseChoices: { value: CricketFieldingLapse | null; label: string }[] = [
    { value: null, label: "None" },
    ...(ball.extraType === null || ball.extraType === "no-ball" ? [{ value: "dropped-catch" as const, label: "Dropped catch" }] : []),
    { value: "misfield", label: "Misfield" },
  ];
  // A mistake chosen, but not yet who made it.
  const lapseIncomplete = lapseType !== null && lapseFielderId === null;
  // An odd change puts the batters at the other ends from here on (as the API
  // works it out). A run-out's end, or a batter alone, leaves them placed.
  const strikeMoves =
    (runs - ball.runs) % 2 !== 0 && ball.batterId !== ball.nonStrikerId && !(ball.wicketType === "run-out" && ball.outEnd);

  const edit: CricketBallEdit = {};
  if (runsEditable && runs !== ball.runs) edit.runs = runs;
  if (boundaryEditable && (edit.runs !== undefined || boundary !== (ball.boundary !== false))) edit.boundary = boundary;
  else if (!boundaryEditable && edit.runs !== undefined && ball.boundary != null) edit.boundary = null;
  if (kindEditable && kind !== null && kind !== ball.wicketType) edit.wicketType = kind;
  if (ball.wicketType) {
    const nextFielder = takesFielder ? fielderId : null;
    if (nextFielder !== ball.fielderId) edit.fielderId = nextFielder;
    const nextSecond = kind === "run-out" && nextFielder !== null ? secondFielderId : null;
    if (nextSecond !== (ball.secondFielderId ?? null)) edit.secondFielderId = nextSecond;
    const nextExcellent = catchTaken && excellentCatch;
    if (nextExcellent !== Boolean(ball.excellentCatch)) edit.excellentCatch = nextExcellent;
  }
  if (lapseEditable && !lapseIncomplete && (lapseType !== (ball.lapseType ?? null) || lapseFielderId !== (ball.lapseFielderId ?? null))) {
    edit.fieldingLapse = lapseType === null || lapseFielderId === null ? null : { type: lapseType, fielderId: lapseFielderId };
  }
  if (bowlerEditable && bowlerId !== ball.bowlerId) edit.bowlerId = bowlerId;
  const changed = Object.keys(edit).length > 0;

  function save() {
    editBall.mutate({ id: match.id, inningsIndex, ballIndex, ...edit }, { onSuccess: onClose });
  }

  // A card that opens the fielding side's list.
  function playerSlot(
    slot: "fielderId" | "secondFielderId" | "bowlerId" | "lapseFielderId",
    label: string,
    playerId: number | null,
    prompt = `Choose ${label.toLowerCase()}`,
  ) {
    return (
      <button
        type="button"
        className={`cricket-slot cricket-fielder-slot ${playerId !== null ? "is-chosen" : ""}`.trim()}
        disabled={editBall.isPending}
        onClick={() => setPicking(slot)}
      >
        {playerId !== null ? (
          <PlayerAvatar name={nameOf(playerId)} photoUrl={photoOf(playerId)} className="cricket-fielder-avatar" />
        ) : (
          <span className="cricket-slot-icon">
            <i className="fa-solid fa-user-plus" aria-hidden="true"></i>
          </span>
        )}
        <span className="cricket-slot-text">
          <small>{label}</small>
          <strong>{playerId === null ? prompt : nameOf(playerId)}</strong>
        </span>
        <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
      </button>
    );
  }

  const nothing = !runsEditable && !kindEditable && !ball.wicketType && !bowlerEditable;

  // Any fielding mistake on this ball: the choice and who made it.
  const lapseSection = lapseEditable && (
    <>
      <label className="cricket-sheet-label">Fielding mistake</label>
      <div className="cricket-chip-choice" role="radiogroup" aria-label="Fielding mistake">
        {lapseChoices.map((option) => (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={lapseType === option.value}
            className={lapseType === option.value ? "active" : ""}
            onClick={() => {
              setLapseType(option.value);
              if (option.value === null) setLapseFielderId(null);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      {lapseType !== null && (
        <div className="cricket-sheet-gap">
          {playerSlot(
            "lapseFielderId",
            lapseType === "dropped-catch" ? "Dropped by" : "Misfield by",
            lapseFielderId,
            lapseType === "dropped-catch" ? "Choose who dropped it" : "Choose who misfielded",
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      <BottomSheet
        title={lapseOnly ? "Drop or misfield" : "Correct a ball"}
        icon={lapseOnly ? "fa-solid fa-circle-xmark" : "fa-solid fa-pen"}
        onClose={onClose}
        footer={
          <div className="cricket-sheet-actions">
            <button type="button" className="cricket-sheet-undo" onClick={onBack} disabled={editBall.isPending}>
              <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> Back
            </button>
            <button type="button" className="cricket-sheet-submit" onClick={save} disabled={!changed || lapseIncomplete || editBall.isPending}>
              <i className="fa-solid fa-check" aria-hidden="true"></i> {editBall.isPending ? "Saving..." : lapseOnly ? "Save" : "Save correction"}
            </button>
          </div>
        }
      >
        <p className="cricket-sheet-context">
          <span className={ballChipClass(ball)}>{ballLabel(ball)}</span> Over {(over?.number ?? 0) + 1} ·{" "}
          {nameOf(ball.bowlerId)} to {nameOf(ball.batterId)}
        </p>

        {lapseOnly ? lapseSection : <>
        {nothing && <p className="admin-hint">Nothing on this one can be corrected — undo it instead.</p>}

        {kindEditable && (
          <>
            <label className="cricket-sheet-label">How out</label>
            <div className="cricket-chip-choice" role="radiogroup" aria-label="How out">
              {SWAPPABLE.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={kind === option.value}
                  className={kind === option.value ? "active" : ""}
                  onClick={() => setKind(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}

        {ball.wicketType && takesFielder && (
          <>
            <label className="cricket-sheet-label">{kind === "run-out" ? "Fielders" : "Fielder"}</label>
            <div className="cricket-fielder-slots">
              {playerSlot("fielderId", kind === "caught" ? "Caught by" : kind === "run-out" ? "Fielder 1" : "Wicket-keeper", fielderId)}
              {kind === "run-out" && fielderId !== null && playerSlot("secondFielderId", "Fielder 2", secondFielderId)}
            </div>
            {fielderId !== null && (
              <button
                type="button"
                className="cricket-undo-link"
                onClick={() => {
                  setFielderId(null);
                  setSecondFielderId(null);
                }}
              >
                <i className="fa-solid fa-xmark" aria-hidden="true"></i> No fielder named
              </button>
            )}
            {catchTaken && (
              <div className="cricket-sheet-gap">
                <button type="button" className="cricket-shot-toggle" role="switch" aria-checked={excellentCatch} onClick={() => setExcellentCatch((v) => !v)}>
                  <span className={`cricket-shot-toggle-knob ${excellentCatch ? "is-on" : ""}`.trim()} aria-hidden="true"></span>
                  Excellent catch
                </button>
              </div>
            )}
          </>
        )}

        {runsEditable && (
          <>
            <label className="cricket-sheet-label">Runs off the bat</label>
            <RunChoice value={runs} onChange={setRuns} max={7} />
            {strikeMoves && (
              <p className="admin-hint">
                The batters finish at the other ends, so the balls after this one move to the other batter, up to the next wicket or strike change made by hand.
              </p>
            )}
          </>
        )}

        {boundaryEditable && (
          <>
            <label className="cricket-sheet-label">The {runs === 4 ? "four" : "six"}</label>
            <div className="cricket-chip-choice" role="radiogroup" aria-label="Boundary">
              {[true, false].map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  role="radio"
                  aria-checked={boundary === value}
                  className={boundary === value ? "active" : ""}
                  onClick={() => setBoundary(value)}
                >
                  {value ? "Reached the boundary" : "All run"}
                </button>
              ))}
            </div>
          </>
        )}

        {bowlerEditable && (
          <>
            <label className="cricket-sheet-label">Bowler of this over</label>
            {playerSlot("bowlerId", "Bowler", bowlerId)}
            {bowlerId !== ball.bowlerId && (
              <p className="admin-hint">Every ball of over {(over?.number ?? 0) + 1} moves to {nameOf(bowlerId)}.</p>
            )}
          </>
        )}

        {lapseSection}
        </>}
      </BottomSheet>

      {picking && (
        <PlayerPicker
          title={
            picking === "bowlerId"
              ? "Who bowled the over?"
              : picking === "lapseFielderId"
                ? lapseType === "dropped-catch" ? "Who dropped it?" : "Who misfielded?"
                : picking === "secondFielderId" ? "Fielder 2" : "Fielder"
          }
          icon={`fa-solid ${picking === "bowlerId" ? "fa-baseball" : "fa-hand"}`}
          items={fieldingXi
            .filter((id) => (picking === "secondFielderId" ? id !== fielderId : picking === "fielderId" ? id !== secondFielderId : true))
            .map((id) => ({ id, tag: picking !== "bowlerId" && id === bowlerId ? "Bowler" : undefined }))}
          nameOf={nameOf}
          selectedId={picking === "bowlerId" ? bowlerId : picking === "fielderId" ? fielderId : picking === "lapseFielderId" ? lapseFielderId : secondFielderId}
          onPick={(id) => {
            if (picking === "bowlerId") setBowlerId(id);
            else if (picking === "fielderId") setFielderId(id);
            else if (picking === "lapseFielderId") setLapseFielderId(id);
            else setSecondFielderId(id);
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </>
  );
}
