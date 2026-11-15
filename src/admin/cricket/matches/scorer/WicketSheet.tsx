import { useState } from "react";
import type { CricketMatch } from "../../../../api/types";
import { BottomSheet } from "../../BottomSheet";
import { PlayerAvatar } from "../../players/PlayerAvatar";
import type { NameOf } from "../../stats";
import { usePlayerPhotos } from "../matchUtils";
import { OutArt } from "../OutArt";
import { PlayerPicker, type PickItem } from "../PlayerPicker";
import { RunChoice } from "./RunChoice";
import {
  allowedOnFreeHit,
  blankWicket,
  DELIVERIES,
  outEndOf,
  outKind,
  OUT_KINDS,
  type OutKind,
  type WicketDraft,
} from "./wicket";

// The scorer's Wicket sheet: how out, who, off what delivery, the fielders
// and runs completed. Some tiles record at once; the rest fill in a draft
// that Record sends (onSubmit, which LiveScorer turns into a ball).
export function WicketSheet({
  match,
  nameOf,
  busy,
  incomingDue,
  freeHit,
  lastMan,
  facing,
  incomingItems,
  showMoreOuts,
  onSubmit,
  onClose,
}: {
  match: CricketMatch;
  nameOf: NameOf;
  busy: boolean;
  // A crease is empty: only timed out / absent hurt can happen.
  incomingDue: boolean;
  freeHit: boolean;
  // Batting on alone (last man stands).
  lastMan: boolean;
  // Who's on strike (alone, the one batter).
  facing: number | null;
  // Batters yet to come in (a timed out / absent hurt).
  incomingItems: PickItem[];
  // Open on the rarer out types too.
  showMoreOuts: boolean;
  onSubmit: (draft: WicketDraft) => void;
  onClose: () => void;
}) {
  const innings = match.innings[match.innings.length - 1];
  const bowlingXi = match.teams[1 - innings.battingTeam].playerIds;
  const photoOf = usePlayerPhotos();
  const [wicket, setWicket] = useState<WicketDraft>({ ...blankWicket, dismissedId: facing });
  const kind = wicket.key ? outKind(wicket.key) : null;
  // "Show more" (the rarer out types).
  const [moreOuts, setMoreOuts] = useState(showMoreOuts);
  // Choosing the incoming batter for a timed out / absent hurt.
  const [pickingIncoming, setPickingIncoming] = useState(false);
  // The fielding side's list, opened from one of the fielder cards (a
  // run-out can name a second fielder).
  const [pickingFielder, setPickingFielder] = useState<"fielderId" | "secondFielderId" | null>(null);

  // Taps a tile: the ones needing nothing more record there and then; the
  // others fill in what they already know (the keeper as fielder).
  function chooseOut(next: OutKind) {
    const keeperId = match.teams[1 - innings.battingTeam].keeperId ?? null;
    const draft: WicketDraft = {
      ...wicket,
      key: next.key,
      dismissedId: next.who === "striker" ? facing : next.who === "non-striker" && !lastMan ? innings.nonStrikerId : null,
      fielderId: next.keeper && keeperId !== null && bowlingXi.includes(keeperId) ? keeperId : next.step === "fielder" ? null : wicket.fielderId,
      // Neither stumped nor hit wicket off a no ball; byes only for a run-out.
      delivery:
        ((next.key === "stumped" || next.key === "hit-wicket") && wicket.delivery === "no-ball") ||
        (next.key !== "run-out" && (wicket.delivery === "bye" || wicket.delivery === "leg-bye"))
          ? "normal"
          : wicket.delivery,
      outEnd: null,
      excellentCatch: false,
    };
    if (next.step === "instant") onSubmit(draft);
    else setWicket(draft);
  }

  // A card for a fielder: "Choose fielder" until one is picked, then their
  // photo and name. Tapping it opens the fielding side's list.
  function fielderSlot(slot: "fielderId" | "secondFielderId", label: string | null) {
    const playerId = wicket[slot];
    return (
      <button
        type="button"
        className={`cricket-slot cricket-fielder-slot ${playerId !== null ? "is-chosen" : ""}`.trim()}
        disabled={busy}
        onClick={() => setPickingFielder(slot)}
      >
        {playerId !== null ? (
          <PlayerAvatar name={nameOf(playerId)} photoUrl={photoOf(playerId)} className="cricket-fielder-avatar" />
        ) : (
          <span className="cricket-slot-icon">
            <i className="fa-solid fa-user-plus" aria-hidden="true"></i>
          </span>
        )}
        <span className="cricket-slot-text">
          <small>
            {playerId === null
              ? `${label ? `${label} · ` : ""}Optional`
              : `${label ?? "Fielder"}${playerId === innings.bowlerId ? " · Bowler" : ""}`}
          </small>
          <strong>{playerId === null ? `Choose ${label?.toLowerCase() ?? "fielder"}` : nameOf(playerId)}</strong>
        </span>
        <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
      </button>
    );
  }

  return (
    <>
      {pickingFielder && (
        <PlayerPicker
          title={pickingFielder === "secondFielderId" ? "Fielder 2" : kind?.keeper ? "Wicket-keeper" : kind?.key === "caught" ? "Caught by" : "Fielder"}
          icon="fa-solid fa-hand"
          items={bowlingXi
            .filter((id) => id !== (pickingFielder === "fielderId" ? wicket.secondFielderId : wicket.fielderId))
            .map((id) => ({ id, tag: id === innings.bowlerId ? "Bowler" : undefined }))}
          nameOf={nameOf}
          selectedId={wicket[pickingFielder]}
          onPick={(id) => {
            setWicket((w) => ({ ...w, [pickingFielder]: id }));
            setPickingFielder(null);
          }}
          onClose={() => setPickingFielder(null)}
        />
      )}

      {pickingIncoming && (
        <PlayerPicker
          title={kind?.key === "timed-out" ? "Who was timed out?" : "Who can't bat?"}
          icon="fa-solid fa-user-clock"
          items={incomingItems}
          nameOf={nameOf}
          selectedId={wicket.dismissedId}
          onPick={(id) => {
            setWicket((w) => ({ ...w, dismissedId: id }));
            setPickingIncoming(false);
          }}
          onClose={() => setPickingIncoming(false)}
        />
      )}

      <BottomSheet
        title="Wicket"
        icon="fa-solid fa-hand-point-up"
        onClose={onClose}
        footer={
          kind && (kind.step === "fielder" || kind.step === "run-out" || kind.step === "delivery" || kind.runs || kind.who === "incoming") ? (
            <button
              type="button"
              className="cricket-sheet-submit is-danger"
              onClick={() => onSubmit(wicket)}
              disabled={busy || wicket.dismissedId === null}
            >
              <i className="fa-solid fa-check" aria-hidden="true"></i> Record {kind.label.toLowerCase()}
            </button>
          ) : undefined
        }
      >
        <p className="cricket-sheet-context">
          <i className="fa-solid fa-baseball" aria-hidden="true"></i>{" "}
          {incomingDue ? "The next batter is due" : `${nameOf(innings.bowlerId)} to ${nameOf(innings.strikerId)}`}
        </p>
        {freeHit && !incomingDue && (
          <p className="cricket-sheet-note">
            <i className="fa-solid fa-bolt" aria-hidden="true"></i> Free hit — only a run-out, obstructing the field, hitting the ball
            twice or a retirement
          </p>
        )}
        <label className="cricket-sheet-label">{wicket.key ? "Out type" : "Select out type"}</label>
        {/* Once one is chosen only it shows; tapping it again brings the
            rest back. */}
        <div className={`cricket-out-grid ${wicket.key ? "is-chosen" : ""}`.trim()} role="radiogroup" aria-label="How out">
          {OUT_KINDS.filter((k) => (wicket.key ? k.key === wicket.key : moreOuts || !k.more)).map((k) => {
            // Timed out / absent hurt only while the next batter is due,
            // and nothing else then.
            const freeHitBlocked = freeHit && !incomingDue && !allowedOnFreeHit(k);
            const unavailable = (k.who === "incoming") !== incomingDue || freeHitBlocked;
            return (
              <button
                key={k.key}
                type="button"
                role="radio"
                aria-checked={wicket.key === k.key}
                className={`cricket-out-tile ${wicket.key === k.key ? "active" : ""}`.trim()}
                disabled={busy || unavailable}
                title={
                  freeHitBlocked
                    ? "Not out on a free hit"
                    : unavailable
                      ? incomingDue
                        ? "Pick the next batter first"
                        : "Only when the next batter is due"
                      : undefined
                }
                onClick={() => (wicket.key === k.key ? setWicket((w) => ({ ...w, key: null })) : chooseOut(k))}
              >
                <span className="cricket-out-icon">
                  <OutArt type={k.key} />
                </span>
                <span className="cricket-out-label">{k.label}</span>
                {wicket.key === k.key && (
                  <span className="cricket-out-change">
                    <i className="fa-solid fa-rotate" aria-hidden="true"></i> Change
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {!wicket.key && (
          <div className="d-flex justify-content-center">
            <button type="button" className="cricket-out-more" onClick={() => setMoreOuts((v) => !v)}>
              {moreOuts ? "Show less" : "Show more"}
            </button>
          </div>
        )}

        {kind?.noDelivery === "choice" && (
          <div className="d-flex justify-content-center mt-2">
            <button
              type="button"
              className="cricket-shot-toggle"
              role="switch"
              aria-checked={wicket.countBall}
              onClick={() => setWicket((w) => ({ ...w, countBall: !w.countBall }))}
            >
              <span className={`cricket-shot-toggle-knob ${wicket.countBall ? "is-on" : ""}`.trim()} aria-hidden="true"></span>
              Count the ball
            </button>
          </div>
        )}

        {kind?.offExtras && (kind.noDelivery !== "choice" || wicket.countBall) && (
          <>
            <label className="cricket-sheet-label">Delivery</label>
            <div className="cricket-chip-choice">
              {/* Neither stumped nor hit wicket is out off a no ball; byes and
                  leg byes only for a run-out. */}
              {DELIVERIES.filter(
                (d) =>
                  (d.value !== "no-ball" || (kind.key !== "stumped" && kind.key !== "hit-wicket")) &&
                  ((d.value !== "bye" && d.value !== "leg-bye") || kind.key === "run-out"),
              ).map((d) => (
                <button
                  key={d.value}
                  type="button"
                  className={wicket.delivery === d.value ? "active" : ""}
                  onClick={() => setWicket((w) => ({ ...w, delivery: d.value }))}
                >
                  <i className={`fa-solid ${d.icon}`} aria-hidden="true"></i> {d.label}
                </button>
              ))}
            </div>
          </>
        )}

        {kind?.who === "either" && (
          <>
            <label className="cricket-sheet-label">Which batter</label>
            <div className="cricket-batter-pick" role="radiogroup" aria-label="Which batter">
              {(lastMan ? [facing] : [innings.strikerId, innings.nonStrikerId]).map((playerId, i) => (
                <button
                  key={playerId}
                  type="button"
                  role="radio"
                  aria-checked={wicket.dismissedId === playerId}
                  className={`cricket-batter-pick-card ${wicket.dismissedId === playerId ? "active" : ""}`.trim()}
                  disabled={busy || playerId === null}
                  onClick={() => {
                    const next = { ...wicket, dismissedId: playerId, outEnd: null };
                    // Picking the batter records it, unless there's more to
                    // pick (a run-out's fielders, an obstruction's runs).
                    if (kind.step === "batter" && !kind.runs) onSubmit(next);
                    else setWicket(next);
                  }}
                >
                  <PlayerAvatar name={nameOf(playerId)} photoUrl={playerId === null ? null : photoOf(playerId)} className="cricket-fielder-avatar" />
                  <span className="cricket-slot-text">
                    <small>{i === 0 ? "Striker" : "Non-striker"}</small>
                    <strong>{nameOf(playerId)}</strong>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {kind?.who === "incoming" && (
          <>
            <label className="cricket-sheet-label">{kind.key === "timed-out" ? "Timed out" : "Can't bat"}</label>
            <button
              type="button"
              className={`cricket-slot cricket-fielder-slot ${wicket.dismissedId !== null ? "is-chosen" : ""}`.trim()}
              disabled={busy}
              onClick={() => setPickingIncoming(true)}
            >
              {wicket.dismissedId !== null ? (
                <PlayerAvatar name={nameOf(wicket.dismissedId)} photoUrl={photoOf(wicket.dismissedId)} className="cricket-fielder-avatar" />
              ) : (
                <span className="cricket-slot-icon">
                  <i className="fa-solid fa-user-clock" aria-hidden="true"></i>
                </span>
              )}
              <span className="cricket-slot-text">
                <small>Next batter</small>
                <strong>{wicket.dismissedId === null ? "Choose the batter" : nameOf(wicket.dismissedId)}</strong>
              </span>
              <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
          </>
        )}

        {(kind?.step === "fielder" || kind?.step === "run-out") && (
          <>
            {/* A run-out: the thrower and the one at the stumps, or one
                fielder alone for a direct hit (switched at the row's end). */}
            <div className="cricket-sheet-label-row">
              <label className="cricket-sheet-label">
                {kind.key === "caught" ? "Caught by" : kind.keeper ? "Wicket-keeper" : "Fielders"}
              </label>
              {kind.step === "run-out" && (
                <button
                  type="button"
                  className="cricket-shot-toggle"
                  role="switch"
                  aria-checked={wicket.directHit}
                  onClick={() => setWicket((w) => ({ ...w, directHit: !w.directHit }))}
                >
                  <span className={`cricket-shot-toggle-knob ${wicket.directHit ? "is-on" : ""}`.trim()} aria-hidden="true"></span>
                  Direct hit
                </button>
              )}
              {(kind.key === "caught" || kind.key === "caught-behind") && (
                <button
                  type="button"
                  className="cricket-shot-toggle"
                  role="switch"
                  aria-checked={wicket.excellentCatch}
                  disabled={wicket.fielderId === null}
                  title={wicket.fielderId === null ? "Choose who took the catch first" : undefined}
                  onClick={() => setWicket((w) => ({ ...w, excellentCatch: !w.excellentCatch }))}
                >
                  <span className={`cricket-shot-toggle-knob ${wicket.excellentCatch ? "is-on" : ""}`.trim()} aria-hidden="true"></span>
                  Excellent catch
                </button>
              )}
            </div>
            <div className="cricket-fielder-slots">
              {fielderSlot("fielderId", kind.step !== "run-out" ? null : wicket.directHit ? "Fielder" : "Fielder 1")}
              {kind.step === "run-out" && !wicket.directHit && fielderSlot("secondFielderId", "Fielder 2")}
            </div>
          </>
        )}

        {kind?.runs && (
          <>
            <label className="cricket-sheet-label">
              Runs completed before the {kind.step === "run-out" ? "run-out" : "obstruction"}
            </label>
            <RunChoice value={wicket.runs} max={5} onChange={(runs) => setWicket((w) => ({ ...w, runs }))} />
          </>
        )}

        {kind?.key === "run-out" && !lastMan && wicket.dismissedId !== null && (
          <>
            {/* The survivor goes to the other end. */}
            <label className="cricket-sheet-label">Where was the wicket broken</label>
            <div className="cricket-chip-choice" role="radiogroup" aria-label="Run-out end">
              {(
                [
                  ["striker", "Striker's end"],
                  ["non-striker", "Non-striker's end"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={outEndOf(wicket, innings.nonStrikerId) === value}
                  className={outEndOf(wicket, innings.nonStrikerId) === value ? "active" : ""}
                  onClick={() => setWicket((w) => ({ ...w, outEnd: value }))}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </BottomSheet>
    </>
  );
}
