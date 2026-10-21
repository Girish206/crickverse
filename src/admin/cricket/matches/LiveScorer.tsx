import { useState } from "react";
import {
  useAbandonCricketMatch,
  useAddCricketBall,
  useEndCricketInnings,
  useSetCricketCurrentPlayers,
  useUndoCricketBall,
  type CricketBallInput,
} from "../../../api/hooks/cricket/useCricketMatches";
import type { CricketExtraType, CricketMatch, CricketWicketType } from "../../../api/types";
import { Button } from "../../components/Button";
import { confirmAction } from "../../components/confirmDelete";
import { BottomSheet } from "../BottomSheet";
import { PlayerPicker, type PickItem } from "./PlayerPicker";
import {
  ballLabel,
  battingCard,
  bowlingCard,
  chaseInfo,
  inningsSummary,
  isLegal,
  isWicket,
  oversOf,
  oversText,
  rate,
  type NameOf,
} from "../stats";

const EXTRA_LABELS: Record<CricketExtraType, string> = {
  wide: "Wide",
  "no-ball": "No ball",
  bye: "Bye",
  "leg-bye": "Leg bye",
};

const EXTRA_ICONS: Record<CricketExtraType, string> = {
  wide: "fa-arrows-left-right",
  "no-ball": "fa-ban",
  bye: "fa-person-running",
  "leg-bye": "fa-shoe-prints",
};

const WICKETS: { value: CricketWicketType; label: string; icon: string }[] = [
  { value: "bowled", label: "Bowled", icon: "fa-baseball" },
  { value: "caught", label: "Caught", icon: "fa-hand" },
  { value: "lbw", label: "LBW", icon: "fa-user-shield" },
  { value: "run-out", label: "Run out", icon: "fa-person-running" },
  { value: "stumped", label: "Stumped", icon: "fa-mitten" },
  { value: "hit-wicket", label: "Hit wicket", icon: "fa-house-crack" },
  { value: "retired-hurt", label: "Retired hurt", icon: "fa-kit-medical" },
];

const DELIVERIES = [
  { value: "normal", label: "Legal ball", icon: "fa-circle-check" },
  { value: "wide", label: "Wide", icon: "fa-arrows-left-right" },
  { value: "no-ball", label: "No ball", icon: "fa-ban" },
] as const;

const NEEDS_FIELDER: CricketWicketType[] = ["caught", "run-out", "stumped"];
// Who can be out: either batter for these, otherwise the striker.
const EITHER_BATTER: CricketWicketType[] = ["run-out", "retired-hurt"];

const blankBall: CricketBallInput = {
  runs: 0,
  extraType: null,
  extras: 0,
  wicketType: null,
  dismissedId: null,
  fielderId: null,
};

function RunChoice({
  value,
  onChange,
  min = 0,
  max = 6,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="cricket-run-choice" role="radiogroup" style={{ ["--choices" as string]: max - min + 1 }}>
      {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className={value === n ? "active" : ""}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function LiveScorer({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  const innings = match.innings[match.innings.length - 1];
  const battingXi = match.teams[innings.battingTeam].playerIds;
  const bowlingXi = match.teams[1 - innings.battingTeam].playerIds;
  const summary = inningsSummary(innings);
  const chase = innings === match.innings[1] ? chaseInfo(match) : null;

  const setPlayers = useSetCricketCurrentPlayers();
  const addBall = useAddCricketBall();
  const undoBall = useUndoCricketBall();
  const endInnings = useEndCricketInnings();
  const abandon = useAbandonCricketMatch();
  const busy = setPlayers.isPending || addBall.isPending || undoBall.isPending || endInnings.isPending;

  const [picks, setPicks] = useState<{ strikerId: number | null; nonStrikerId: number | null; bowlerId: number | null }>({
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
  });
  const [extraModal, setExtraModal] = useState<CricketExtraType | null>(null);
  const [extraRuns, setExtraRuns] = useState(0);
  const [wicketModal, setWicketModal] = useState(false);
  const [wicket, setWicket] = useState<{
    type: CricketWicketType;
    dismissedId: number | null;
    fielderId: number | null;
    runs: number;
    delivery: "normal" | "wide" | "no-ball";
  }>({ type: "bowled", dismissedId: null, fielderId: null, runs: 0, delivery: "normal" });

  const out = new Set(innings.balls.filter(isWicket).map((ball) => ball.dismissedId));
  const atCrease = [innings.strikerId, innings.nonStrikerId];
  const availableBatters = battingXi.filter((id) => !out.has(id) && !atCrease.includes(id));
  const legal = innings.balls.filter(isLegal);
  const overJustEnded = legal.length > 0 && legal.length % 6 === 0;
  const lastBowler = overJustEnded ? legal[legal.length - 1].bowlerId : null;
  const needsPlayers = innings.strikerId === null || innings.nonStrikerId === null || innings.bowlerId === null;
  // Retired-hurt batters can come back in; show what they'd scored.
  const retired = new Set(
    innings.balls.filter((ball) => ball.wicketType === "retired-hurt").map((ball) => ball.dismissedId),
  );

  const batting = battingCard(innings);
  const bowling = bowlingCard(innings);

  type Slot = "strikerId" | "nonStrikerId" | "bowlerId";
  const [pickerFor, setPickerFor] = useState<Slot | null>(null);
  const batterItems = (exclude: number | null): PickItem[] =>
    availableBatters
      .filter((id) => id !== exclude)
      .map((id) => {
        const row = batting.find((r) => r.playerId === id);
        return retired.has(id)
          ? { id, tag: "Retired hurt", note: `${row?.runs ?? 0} (${row?.balls ?? 0}) so far` }
          : { id, note: "Yet to bat" };
      });
  const bowlerItems: PickItem[] = bowlingXi.map((id) => {
    const row = bowling.find((r) => r.playerId === id);
    return {
      id,
      note: row ? `${oversText(row.legalBalls)}-${row.maidens}-${row.runs}-${row.wickets}` : "Yet to bowl",
      disabled: id === lastBowler,
      tag: id === lastBowler ? "Bowled last over" : undefined,
    };
  });
  const emptySlots: Slot[] = (["strikerId", "nonStrikerId", "bowlerId"] as const).filter((slot) => innings[slot] === null);

  // After a pick, move straight on to the next empty slot; the last one
  // saves them all — no confirm step.
  function pick(slot: Slot, id: number) {
    const next = { ...picks, [slot]: id };
    setPicks(next);
    const nextSlot = emptySlots.find((s) => s !== slot && next[s] === null) ?? null;
    setPickerFor(nextSlot);
    if (!nextSlot) savePlayers(next);
  }
  const thisOver = oversOf(innings).at(-1);
  const overEndPending = overJustEnded && innings.bowlerId === null;

  // When an over finishes, pop up a summary asking to start the next one.
  // Keyed by innings + ball count so it shows once per over.
  const overKey = `${match.innings.length}-${legal.length}`;
  const [overPromptSeen, setOverPromptSeen] = useState<string | null>(null);
  const showOverPrompt = overEndPending && overPromptSeen !== overKey && pickerFor === null && !busy;
  // Once the prompt is closed, the strip keeps showing the finished over;
  // once the next bowler is in, it starts empty for the new over.
  const showOver = !overJustEnded || (overEndPending && overPromptSeen === overKey) ? thisOver : undefined;
  function startNextOver() {
    setOverPromptSeen(overKey);
    setPickerFor(emptySlots[0] ?? null);
  }
  // The pad stays live between overs — tapping it brings the prompt back.
  const padDisabled = busy || (needsPlayers && !overEndPending);
  const scoreOr = (action: () => void) => () => (overEndPending ? setOverPromptSeen(null) : action());

  // Saves the picks for the empty slots (called once the last one is chosen).
  function savePlayers(chosen: typeof picks) {
    const input: { strikerId?: number; nonStrikerId?: number; bowlerId?: number } = {};
    if (innings.strikerId === null && chosen.strikerId !== null) input.strikerId = chosen.strikerId;
    if (innings.nonStrikerId === null && chosen.nonStrikerId !== null) input.nonStrikerId = chosen.nonStrikerId;
    if (innings.bowlerId === null && chosen.bowlerId !== null) input.bowlerId = chosen.bowlerId;
    setPlayers.mutate(
      { id: match.id, ...input },
      { onSettled: () => setPicks({ strikerId: null, nonStrikerId: null, bowlerId: null }) },
    );
  }

  // Undo is offered right where the next player is chosen too — e.g. to
  // take back the last ball of an over before picking the new bowler.
  const canUndo = innings.balls.length + (match.innings.length - 1) > 0;
  function undo() {
    setPickerFor(null);
    setOverPromptSeen(null);
    setPicks({ strikerId: null, nonStrikerId: null, bowlerId: null });
    undoBall.mutate(match.id);
  }

  const record = (ball: Partial<CricketBallInput>) => addBall.mutate({ id: match.id, ...blankBall, ...ball });

  function submitExtra() {
    if (!extraModal) return;
    if (extraModal === "wide") record({ extraType: "wide", extras: 1 + extraRuns });
    if (extraModal === "no-ball") record({ extraType: "no-ball", extras: 1, runs: extraRuns });
    if (extraModal === "bye" || extraModal === "leg-bye") record({ extraType: extraModal, extras: Math.max(extraRuns, 1) });
    setExtraModal(null);
  }

  function openWicket() {
    setWicket({ type: "bowled", dismissedId: innings.strikerId, fielderId: null, runs: 0, delivery: "normal" });
    setWicketModal(true);
  }

  function submitWicket() {
    const either = EITHER_BATTER.includes(wicket.type);
    const runOut = wicket.type === "run-out";
    const delivery = runOut || wicket.type === "stumped" || wicket.type === "retired-hurt" ? wicket.delivery : "normal";
    const completed = runOut ? wicket.runs : 0;
    record({
      wicketType: wicket.type,
      dismissedId: either ? wicket.dismissedId : innings.strikerId,
      fielderId: NEEDS_FIELDER.includes(wicket.type) ? wicket.fielderId : null,
      runs: delivery === "wide" ? 0 : completed,
      extraType: delivery === "normal" ? null : delivery,
      extras: delivery === "wide" ? 1 + completed : delivery === "no-ball" ? 1 : 0,
    });
    setWicketModal(false);
  }

  async function handleEndInnings() {
    const last = match.innings.length === 2;
    if (
      await confirmAction(
        last ? "End the match?" : "End this innings?",
        last ? "The second innings closes and the result is worked out from the scores." : "The other side bats next.",
        last ? "End match" : "End innings",
      )
    ) {
      endInnings.mutate(match.id);
    }
  }

  async function handleAbandon() {
    if (await confirmAction("Abandon this match?", "It's recorded as a no result.", "Abandon")) abandon.mutate(match.id);
  }

  const bowlerRow = bowling.find((row) => row.playerId === innings.bowlerId);

  return (
    <div className="cricket-scorer">
      <div className="cricket-scorer-head">
        <div>
          <span className="cricket-scorer-team">{match.teams[innings.battingTeam].name} batting</span>
          <strong className="cricket-scorer-score">
            {summary.runs}/{summary.wickets} <small>({summary.overs} / {match.overs} ov)</small>
          </strong>
        </div>
        <div className="cricket-scorer-rates">
          <span>CRR {rate(summary.runs, summary.legalBalls)}</span>
          {chase && (
            <>
              <span>Target {chase.target}</span>
              <span>RRR {chase.requiredRate}</span>
            </>
          )}
        </div>
      </div>
      {chase && (
        <div className="cricket-chase-line">
          Need <strong>{Math.max(chase.need, 0)}</strong> run{chase.need === 1 ? "" : "s"} from{" "}
          <strong>{chase.ballsLeft}</strong> ball{chase.ballsLeft === 1 ? "" : "s"}
        </div>
      )}
      {innings.balls.length === 0 && match.innings.length === 2 && (
        <div className="admin-banner admin-banner-success">
          Innings break — {match.teams[innings.battingTeam].name} need {chase?.target} to win.
        </div>
      )}

      {needsPlayers ? (
        <section className="cricket-panel cricket-pickers">
          <h2 className="cricket-section-title">
            {innings.balls.length === 0
              ? "Openers and opening bowler"
              : innings.bowlerId === null && innings.strikerId !== null && innings.nonStrikerId !== null
                ? `End of over ${oversText(legal.length)} — choose the next bowler`
                : "Next batter in"}
          </h2>
          <div className="cricket-slots">
            {emptySlots.map((slot) => {
              const chosen = picks[slot];
              const label = slot === "strikerId" ? "Striker" : slot === "nonStrikerId" ? "Non-striker" : "Bowler";
              const icon = slot === "bowlerId" ? "fa-baseball" : slot === "strikerId" ? "fa-baseball-bat-ball" : "fa-user";
              return (
                <button
                  key={slot}
                  type="button"
                  className={`cricket-slot ${chosen !== null ? "is-chosen" : ""}`}
                  onClick={() => setPickerFor(slot)}
                >
                  <span className="cricket-slot-icon">
                    <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
                  </span>
                  <span className="cricket-slot-text">
                    <small>{label}</small>
                    <strong>{chosen !== null ? nameOf(chosen) : `Choose ${label.toLowerCase()}`}</strong>
                  </span>
                  <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
                </button>
              );
            })}
          </div>
          {innings.strikerId === null && innings.nonStrikerId !== null && availableBatters.length === 0 && (
            <p className="admin-hint">No batters left — end the innings.</p>
          )}
          {canUndo && (
            <button type="button" className="cricket-undo-link" onClick={undo} disabled={busy}>
              <i className="fa-solid fa-rotate-left" aria-hidden="true"></i> Undo last ball
            </button>
          )}
        </section>
      ) : null}

      <div className="cricket-crease">
        {[innings.strikerId, innings.nonStrikerId].map((playerId, i) => {
          const row = batting.find((r) => r.playerId === playerId);
          return (
            <div key={i} className={`cricket-crease-batter ${i === 0 ? "is-striker" : ""}`}>
              <span>
                {playerId === null ? "—" : nameOf(playerId)}
                {i === 0 && playerId !== null && " *"}
              </span>
              <strong>
                {row?.runs ?? 0} <small>({row?.balls ?? 0})</small>
              </strong>
            </div>
          );
        })}
        <div className="cricket-crease-batter is-bowler">
          <span>
            <i className="fa-solid fa-baseball" aria-hidden="true"></i> {innings.bowlerId === null ? "—" : nameOf(innings.bowlerId)}
          </span>
          <strong>
            {bowlerRow ? `${oversText(bowlerRow.legalBalls)}-${bowlerRow.maidens}-${bowlerRow.runs}-${bowlerRow.wickets}` : "0-0-0-0"}
          </strong>
        </div>
        {innings.strikerId !== null && innings.nonStrikerId !== null && (
          <button
            type="button"
            className="admin-link-btn"
            disabled={busy}
            onClick={() =>
              setPlayers.mutate({ id: match.id, strikerId: innings.nonStrikerId, nonStrikerId: innings.strikerId })
            }
          >
            <i className="fa-solid fa-right-left" aria-hidden="true"></i> Swap strike
          </button>
        )}
      </div>

      {/* Sticks to the bottom of the screen on phones while scrolling. */}
      <div className="cricket-scorer-dock">
      <div className="cricket-this-over">
        <span>{overEndPending ? "Last over" : "This over"}</span>
        {showOver?.balls.map((ball, i) => (
          <span key={i} className={`cricket-ball-chip is-${ballLabel(ball)}`}>
            {ballLabel(ball)}
          </span>
        ))}
      </div>

      <div className="cricket-pad">
        {[0, 1, 2, 3, 4, 6].map((runs) => (
          <button
            key={runs}
            type="button"
            className={`cricket-pad-btn ${runs === 4 || runs === 6 ? "is-boundary" : ""}`}
            disabled={padDisabled}
            onClick={scoreOr(() => record({ runs }))}
          >
            {runs}
          </button>
        ))}
        {(Object.keys(EXTRA_LABELS) as CricketExtraType[]).map((type) => (
          <button
            key={type}
            type="button"
            className="cricket-pad-btn is-extra"
            disabled={padDisabled}
            onClick={scoreOr(() => {
              setExtraRuns(type === "bye" || type === "leg-bye" ? 1 : 0);
              setExtraModal(type);
            })}
          >
            <i className={`fa-solid ${EXTRA_ICONS[type]}`} aria-hidden="true"></i>
            <span>{EXTRA_LABELS[type]}</span>
          </button>
        ))}
        <button type="button" className="cricket-pad-btn is-wicket" disabled={padDisabled} onClick={scoreOr(openWicket)}>
          <i className="fa-solid fa-hand-point-up" aria-hidden="true"></i>
          <span>Wicket</span>
        </button>
      </div>

      <div className="cricket-scorer-actions">
        <Button variant="outline" onClick={undo} disabled={busy || !canUndo}>
          <i className="fa-solid fa-rotate-left" aria-hidden="true"></i> Undo last ball
        </Button>
        <Button variant="outline" onClick={handleEndInnings} disabled={busy}>
          <i className="fa-solid fa-flag-checkered" aria-hidden="true"></i> {match.innings.length === 2 ? "End match" : "End innings"}
        </Button>
        <Button variant="danger-text" onClick={handleAbandon} disabled={busy}>
          <i className="fa-solid fa-cloud-rain" aria-hidden="true"></i> Abandon
        </Button>
      </div>
      </div>

      {showOverPrompt && thisOver && (
        <BottomSheet
          title={`Over ${thisOver.number + 1} complete`}
          icon="fa-solid fa-flag-checkered"
          onClose={() => setOverPromptSeen(overKey)}
          footer={
            <div className="cricket-sheet-actions">
              <button type="button" className="cricket-sheet-undo" onClick={() => setOverPromptSeen(overKey)}>
                Cancel
              </button>
              <button type="button" className="cricket-sheet-submit" onClick={startNextOver}>
                <i className="fa-solid fa-play" aria-hidden="true"></i> Start next over
              </button>
            </div>
          }
        >
          <p className="cricket-sheet-context">
            <i className="fa-solid fa-baseball" aria-hidden="true"></i> {nameOf(thisOver.bowlerId)} ·{" "}
            {thisOver.runs} run{thisOver.runs === 1 ? "" : "s"} off the over
          </p>
          <div className="cricket-this-over">
            {thisOver.balls.map((ball, i) => (
              <span key={i} className={`cricket-ball-chip is-${ballLabel(ball)}`}>
                {ballLabel(ball)}
              </span>
            ))}
          </div>
          <p className="cricket-over-score">
            {match.teams[innings.battingTeam].name} <strong>{summary.runs}/{summary.wickets}</strong> after {summary.overs} ov
          </p>
          {canUndo && (
            <button type="button" className="cricket-undo-link" onClick={undo} disabled={busy}>
              <i className="fa-solid fa-rotate-left" aria-hidden="true"></i> Undo last ball
            </button>
          )}
        </BottomSheet>
      )}

      {pickerFor && (
        <PlayerPicker
          key={pickerFor}
          title={pickerFor === "bowlerId" ? "Choose bowler" : pickerFor === "strikerId" ? "Choose striker" : "Choose non-striker"}
          icon={`fa-solid ${pickerFor === "bowlerId" ? "fa-baseball" : "fa-baseball-bat-ball"}`}
          items={
            pickerFor === "bowlerId"
              ? bowlerItems
              : batterItems(pickerFor === "strikerId" ? picks.nonStrikerId : picks.strikerId)
          }
          nameOf={nameOf}
          selectedId={picks[pickerFor]}
          onPick={(id) => pick(pickerFor, id)}
          onClose={() => setPickerFor(null)}
          footer={
            canUndo ? (
              <button type="button" className="cricket-sheet-undo" onClick={undo} disabled={busy}>
                <i className="fa-solid fa-rotate-left" aria-hidden="true"></i> Undo last ball
              </button>
            ) : undefined
          }
        />
      )}

      {extraModal && (
        <BottomSheet
          title={EXTRA_LABELS[extraModal]}
          icon={`fa-solid ${EXTRA_ICONS[extraModal]}`}
          onClose={() => setExtraModal(null)}
          footer={
            <button type="button" className="cricket-sheet-submit" onClick={submitExtra} disabled={busy}>
              <i className="fa-solid fa-check" aria-hidden="true"></i> Record {EXTRA_LABELS[extraModal].toLowerCase()}
              {extraModal === "wide" || extraModal === "no-ball" ? ` + ${extraRuns}` : ` ${Math.max(extraRuns, 1)}`}
            </button>
          }
        >
          <p className="cricket-sheet-context">
            <i className="fa-solid fa-baseball" aria-hidden="true"></i> {nameOf(innings.bowlerId)} to {nameOf(innings.strikerId)}
          </p>
          <label className="cricket-sheet-label">
            {extraModal === "no-ball"
              ? "Runs off the bat (1-run penalty added)"
              : extraModal === "wide"
                ? "Runs run as well (1-run penalty added)"
                : "Runs run"}
          </label>
          <RunChoice
            value={extraRuns}
            onChange={setExtraRuns}
            min={extraModal === "bye" || extraModal === "leg-bye" ? 1 : 0}
          />
        </BottomSheet>
      )}

      {wicketModal && (
        <BottomSheet
          title="Wicket"
          icon="fa-solid fa-hand-point-up"
          onClose={() => setWicketModal(false)}
          footer={
            <button
              type="button"
              className="cricket-sheet-submit is-danger"
              onClick={submitWicket}
              disabled={busy || (EITHER_BATTER.includes(wicket.type) && wicket.dismissedId === null)}
            >
              <i className="fa-solid fa-check" aria-hidden="true"></i> Record wicket
            </button>
          }
        >
          <p className="cricket-sheet-context">
            <i className="fa-solid fa-baseball" aria-hidden="true"></i> {nameOf(innings.bowlerId)} to {nameOf(innings.strikerId)}
          </p>
          <label className="cricket-sheet-label">How out</label>
          <div className="cricket-tile-grid" role="radiogroup">
            {WICKETS.map((w) => (
              <button
                key={w.value}
                type="button"
                role="radio"
                aria-checked={wicket.type === w.value}
                className={`cricket-tile ${wicket.type === w.value ? "active" : ""}`}
                onClick={() =>
                  setWicket((current) => ({
                    ...current,
                    type: w.value,
                    dismissedId: EITHER_BATTER.includes(w.value) ? current.dismissedId : innings.strikerId,
                    delivery: w.value === "stumped" && current.delivery === "no-ball" ? "normal" : current.delivery,
                  }))
                }
              >
                <i className={`fa-solid ${w.icon}`} aria-hidden="true"></i>
                <span>{w.label}</span>
              </button>
            ))}
          </div>

          {EITHER_BATTER.includes(wicket.type) && (
            <>
              <label className="cricket-sheet-label">Which batter</label>
              <div className="cricket-chip-choice">
                {[innings.strikerId, innings.nonStrikerId].map((playerId, i) => (
                  <button
                    key={playerId}
                    type="button"
                    className={wicket.dismissedId === playerId ? "active" : ""}
                    onClick={() => setWicket((w) => ({ ...w, dismissedId: playerId }))}
                  >
                    <i className={`fa-solid ${i === 0 ? "fa-baseball-bat-ball" : "fa-user"}`} aria-hidden="true"></i>{" "}
                    {nameOf(playerId)}
                    {i === 0 ? " *" : ""}
                  </button>
                ))}
              </div>
            </>
          )}

          {NEEDS_FIELDER.includes(wicket.type) && (
            <>
              <label className="cricket-sheet-label">
                {wicket.type === "caught" ? "Caught by" : wicket.type === "stumped" ? "Wicket-keeper" : "Fielder"}
              </label>
              <div className="cricket-chip-choice">
                {bowlingXi.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={wicket.fielderId === id ? "active" : ""}
                    onClick={() => setWicket((w) => ({ ...w, fielderId: w.fielderId === id ? null : id }))}
                  >
                    {nameOf(id)}
                    {id === innings.bowlerId ? " (bowler)" : ""}
                  </button>
                ))}
              </div>
            </>
          )}

          {(wicket.type === "run-out" || wicket.type === "stumped" || wicket.type === "retired-hurt") && (
            <>
              <label className="cricket-sheet-label">Delivery</label>
              <div className="cricket-chip-choice">
                {DELIVERIES.filter((d) => d.value !== "no-ball" || wicket.type !== "stumped").map((d) => (
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

          {wicket.type === "run-out" && (
            <>
              <label className="cricket-sheet-label">Runs completed before the run-out</label>
              <RunChoice value={wicket.runs} max={3} onChange={(runs) => setWicket((w) => ({ ...w, runs }))} />
            </>
          )}
        </BottomSheet>
      )}
    </div>
  );
}
