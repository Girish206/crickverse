import { Fragment, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { apiClient } from "../../../api/client";
import { useSetCricketCurrentPlayers } from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import type { ApiEnvelope, CricketMatch, CricketTeamRoles } from "../../../api/types";
import { avatarColorFor } from "../avatarColor";
import { PlayerAvatar } from "../players/PlayerAvatar";
import type { NameOf } from "../stats";
import { TeamMark } from "../teams/TeamMark";
import { PlayerPicker } from "./PlayerPicker";

type Slot = "strikerId" | "nonStrikerId" | "bowlerId";
type Face = "heads" | "tails";
const SLOTS: { slot: Slot; label: string; icon: string }[] = [
  { slot: "strikerId", label: "Striker", icon: "fa-baseball-bat-ball" },
  { slot: "nonStrikerId", label: "Non-striker", icon: "fa-user" },
  { slot: "bowlerId", label: "Bowler", icon: "fa-baseball" },
];
const SLOT_GROUPS: { title: string; slots: Slot[]; art?: boolean; bowling?: boolean }[] = [
  { title: "Openers", slots: ["strikerId", "nonStrikerId"], art: true },
  { title: "Bowler", slots: ["bowlerId"], bowling: true },
];

export interface TossResult {
  tossWinner: 0 | 1 | null;
  decision: "bat" | "bowl" | null;
  picks: Record<Slot, number | null>;
}

export const NO_TOSS: TossResult = {
  tossWinner: null,
  decision: null,
  picks: { strikerId: null, nonStrikerId: null, bowlerId: null },
};

// What's still missing before the match can start (null = ready).
export function tossProblem({ tossWinner, decision, picks }: TossResult) {
  if (tossWinner === null || decision === null) return "Record the toss first.";
  if (picks.strikerId === null || picks.nonStrikerId === null || picks.bowlerId === null) {
    return "Choose both openers and the opening bowler.";
  }
  return null;
}

// The first start can go through with its answer lost (a dropped
// connection); the retry is then told the match has already started —
// which is a success, not an error.
const alreadyStarted = (error: unknown) =>
  isAxiosError(error) && error.response?.status === 409 && error.response.data?.error?.code === "ALREADY_STARTED";

// Starts a match with its toss, squads and leaders, then sets the openers
// and the opening bowler. `start` resolves false if it couldn't start.
export function useStartWithToss() {
  const queryClient = useQueryClient();
  const startMatch = useMutation({
    // useStartCricketMatch, without the error toast for that retry.
    meta: { skipGlobalErrorFor: alreadyStarted },
    mutationFn: async ({
      id,
      ...input
    }: {
      id: number;
      tossWinner: 0 | 1;
      tossDecision: "bat" | "bowl";
      playerIds: [number[], number[]];
      roles: [CricketTeamRoles, CricketTeamRoles];
    }) => (await apiClient.post<ApiEnvelope<CricketMatch>>(`/admin/cricket/matches/${id}/start`, input)).data.data,
    onSuccess: (match) => {
      queryClient.setQueryData(["cricket-matches", match.id], match);
      queryClient.invalidateQueries({ queryKey: ["cricket-matches", "list"] });
      queryClient.invalidateQueries({ queryKey: ["cricket-me"] });
    },
  });
  const setPlayers = useSetCricketCurrentPlayers();

  async function start(
    id: number,
    { tossWinner, decision, picks }: TossResult,
    xi: [number[], number[]],
    roles: [CricketTeamRoles, CricketTeamRoles],
  ) {
    const { strikerId, nonStrikerId, bowlerId } = picks;
    if (tossWinner === null || decision === null || strikerId === null || nonStrikerId === null || bowlerId === null) {
      return false;
    }
    try {
      await startMatch.mutateAsync({ id, tossWinner, tossDecision: decision, playerIds: xi, roles });
    } catch (err) {
      if (!alreadyStarted(err)) return false;
      // It started the first time: catch up and carry on.
      await queryClient.invalidateQueries({ queryKey: ["cricket-matches", id] });
      queryClient.invalidateQueries({ queryKey: ["cricket-matches", "list"] });
    }
    // Once started, the scorer asks for any player this didn't manage to save.
    await setPlayers.mutateAsync({ id, strikerId, nonStrikerId, bowlerId }).catch(() => undefined);
    return true;
  }

  return { start, busy: startMatch.isPending || setPlayers.isPending };
}

// The two sides' badge colours, kept apart if both names clash.
export function sideColors(names: [string, string]) {
  const colors = [avatarColorFor(names[0]), avatarColorFor(names[1])];
  for (let salt = 1; colors[1] === colors[0] && salt < 12; salt++) {
    colors[1] = avatarColorFor(`${names[1]}#${salt}`);
  }
  return colors;
}

interface TossStepProps {
  teams: [{ name: string; logoUrl?: string | null }, { name: string; logoUrl?: string | null }];
  // Each side's squad.
  xi: [number[], number[]];
  nameOf: NameOf;
  value: TossResult;
  onChange: (next: TossResult) => void;
  error?: string | null;
}

// The toss (a virtual coin, or the winner set by hand), the winner's choice,
// then the openers and the opening bowler.
export function TossStep({ teams, xi, nameOf, value, onChange, error }: TossStepProps) {
  const { tossWinner, decision, picks } = value;
  const [call, setCall] = useState<Face>("heads");
  const [face, setFace] = useState<Face | null>(null);
  const [flipping, setFlipping] = useState(false);
  const flipTimer = useRef<number | undefined>(undefined);
  const [pickerFor, setPickerFor] = useState<Slot | null>(null);

  const { data: players } = useCricketPlayers();
  const playerById = new Map((players ?? []).map((player) => [player.id, player]));
  const photoOf = (playerId: number) => playerById.get(playerId)?.photoUrl;
  const teamColors = sideColors([teams[0].name, teams[1].name]);
  const battingSlot = tossWinner === null || decision === null ? null : decision === "bat" ? tossWinner : 1 - tossWinner;

  // A new toss result changes who bats, so the openers are picked again.
  function recordToss(winner: 0 | 1 | null, choice: "bat" | "bowl" | null) {
    onChange({ tossWinner: winner, decision: choice, picks: NO_TOSS.picks });
  }

  // The coin toss: the second team calls, the coin spins for a moment and
  // whoever called right (or not) wins it. The winner can still be set by
  // hand when the toss happened at the ground.
  function flipCoin() {
    if (flipping) return;
    const landed: Face = Math.random() < 0.5 ? "heads" : "tails";
    setFace(null);
    setFlipping(true);
    // No result while the coin is in the air.
    recordToss(null, null);
    flipTimer.current = window.setTimeout(() => {
      setFlipping(false);
      setFace(landed);
      recordToss(landed === call ? 1 : 0, null);
    }, 1200);
  }
  useEffect(() => () => window.clearTimeout(flipTimer.current), []);

  // After a pick, move straight on to the next empty slot.
  function pick(slot: Slot, id: number) {
    const next = { ...picks, [slot]: id };
    onChange({ ...value, picks: next });
    setPickerFor(SLOTS.find(({ slot: s }) => s !== slot && next[s] === null)?.slot ?? null);
  }

  const pickerItems =
    pickerFor === null || battingSlot === null
      ? []
      : pickerFor === "bowlerId"
        ? [...xi[1 - battingSlot]].sort((a, b) => nameOf(a).localeCompare(nameOf(b))).map((id) => ({ id }))
        : xi[battingSlot]
            .filter((id) => id !== (pickerFor === "strikerId" ? picks.nonStrikerId : picks.strikerId))
            .map((id) => ({ id }));

  return (
    <div className="cricket-setup">
      <section className="cricket-toss-section">
        <h2 className="cricket-toss-heading">
          <span>Toss</span>
          <span className="cricket-toss-badge">
            <i className="fa-solid fa-coins" aria-hidden="true"></i> Virtual Toss
          </span>
        </h2>
        <div className={`cricket-coin-card ${face && !flipping ? "has-result" : ""}`}>
          <div className="cricket-coin-top">
            <div className="cricket-coin-caller-row">
              <TeamMark
                className="cricket-coin-caller-logo"
                name={teams[1].name}
                logoUrl={teams[1].logoUrl}
                color={teamColors[1]}
              />
              <span className="cricket-coin-caller">
                <strong>{teams[1].name}</strong> calls
              </span>
            </div>
            <div className="cricket-coin-call-pills" role="radiogroup" aria-label="Call">
              {(["heads", "tails"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={call === option}
                  className={`cricket-coin-call-pill ${call === option ? "active" : ""}`}
                  disabled={flipping}
                  onClick={() => setCall(option)}
                >
                  <span className="cricket-coin-call-dot">{option === "heads" ? "H" : "T"}</span>
                  {option === "heads" ? "Heads" : "Tails"}
                </button>
              ))}
            </div>
          </div>
          <div className="cricket-coin-bottom">
            <div className="cricket-coin-stage">
              <button
                type="button"
                className={`cricket-coin ${flipping ? "is-flipping" : ""} ${face ? `is-${face}` : ""}`}
                onClick={flipCoin}
                aria-label="Flip the coin"
              >
                <span className="cricket-coin-inner">
                  {flipping ? (
                    <i className="fa-solid fa-rotate cricket-coin-spin-icon" aria-hidden="true"></i>
                  ) : (
                    <>
                      <span className="cricket-coin-letter">{(face ?? call) === "tails" ? "T" : "H"}</span>
                      <small className="cricket-coin-face-label">{(face ?? call) === "tails" ? "TAILS" : "HEADS"}</small>
                    </>
                  )}
                </span>
              </button>
            </div>
            <div className="cricket-coin-status" role="status">
              {flipping ? (
                <>
                  <strong>Flipping coin...</strong>
                  <small>
                    {teams[1].name} called {call === "heads" ? "Heads" : "Tails"}
                  </small>
                </>
              ) : face && tossWinner !== null ? (
                <>
                  <strong>It's {face === "heads" ? "Heads" : "Tails"}!</strong>
                  <small>{teams[tossWinner].name} won the toss</small>
                </>
              ) : (
                <>
                  <strong>Ready to toss</strong>
                  <small>Calling {call === "heads" ? "Heads" : "Tails"} · Tap to flip</small>
                </>
              )}
            </div>
            <button type="button" className="cricket-coin-flip" onClick={flipCoin} disabled={flipping}>
              <i className={`fa-solid ${flipping ? "fa-spinner fa-spin" : "fa-coins"}`} aria-hidden="true"></i>
              <span>{flipping ? "Flipping" : face ? "Retoss" : "Flip Coin"}</span>
            </button>
          </div>
        </div>
        <div className="cricket-toss-divider">
          <span>or select toss winner</span>
        </div>
        <div className="cricket-tile-grid is-compact" role="radiogroup" aria-label="Toss won by">
          {teams.map((team, index) => (
            <button
              key={index}
              type="button"
              role="radio"
              aria-checked={tossWinner === index}
              className={`cricket-pick-tile ${tossWinner === index ? "active" : ""}`}
              disabled={flipping}
              onClick={() => {
                // Set by hand: the coin's result no longer applies.
                setFace(null);
                recordToss(index as 0 | 1, decision);
              }}
            >
              <TeamMark className="cricket-pick-tile-logo" name={team.name} logoUrl={team.logoUrl} color={teamColors[index]} />
              <span className="cricket-pick-tile-text">
                <strong>{team.name}</strong>
                <small>{tossWinner === index ? "Won toss" : "Tap to pick"}</small>
              </span>
              {tossWinner === index && <i className="fa-solid fa-check cricket-pick-tile-check" aria-hidden="true"></i>}
            </button>
          ))}
        </div>
      </section>

      <section className={`cricket-toss-section ${tossWinner === null ? "is-locked" : ""}`}>
        <h2 className="cricket-toss-heading">
          {decision !== null && <i className="fa-solid fa-circle-check cricket-toss-done" aria-label="Done"></i>}
          <span>{tossWinner !== null ? `${teams[tossWinner].name} elected to` : "Elected to"}</span>
        </h2>
        <div className="cricket-tile-grid is-compact" role="radiogroup" aria-label="Elected to">
          {(["bat", "bowl"] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={decision === choice}
              disabled={tossWinner === null}
              className={`cricket-pick-tile ${decision === choice ? "active" : ""}`}
              onClick={() => recordToss(tossWinner, choice)}
            >
              <span className="cricket-pick-tile-icon" aria-hidden="true">
                <i className={`fa-solid ${choice === "bat" ? "fa-baseball-bat-ball" : "fa-baseball"}`}></i>
              </span>
              <span className="cricket-pick-tile-text">
                <strong>{choice === "bat" ? "Bat first" : "Bowl first"}</strong>
                <small>{choice === "bat" ? "Set target" : "Chase target"}</small>
              </span>
              {decision === choice && <i className="fa-solid fa-check cricket-pick-tile-check" aria-hidden="true"></i>}
            </button>
          ))}
        </div>
      </section>

      <section className={`cricket-toss-section ${battingSlot === null ? "is-locked" : ""}`}>
        {battingSlot === null ? (
          <p className="cricket-toss-hint">Record the toss and the decision to choose the openers.</p>
        ) : (
          // The same cards as the start of the second innings: the two
          // openers side by side, then the bowler across the width.
          <div className="cricket-toss-slots">
            {SLOT_GROUPS.map((group) => (
              <Fragment key={group.title}>
                <h3 className={`cricket-section-title${group.art ? " has-bat-art" : ""}`}>
                  {group.title} · {teams[group.bowling ? 1 - battingSlot : battingSlot].name}
                </h3>
                <div className="cricket-slots">
                  {SLOTS.filter(({ slot }) => group.slots.includes(slot)).map(({ slot, label, icon }) => {
                    const chosen = picks[slot];
                    return (
                      <button
                        key={slot}
                        type="button"
                        className={`cricket-slot${chosen !== null ? " is-chosen" : ""}${slot === "bowlerId" ? " is-bowler" : " is-paired"}`}
                        onClick={() => setPickerFor(slot)}
                      >
                        {chosen !== null ? (
                          <PlayerAvatar
                            key={chosen}
                            name={nameOf(chosen)}
                            photoUrl={photoOf(chosen)}
                            className="cricket-slot-photo"
                            viewable={false}
                          />
                        ) : (
                          <span className="cricket-slot-icon">
                            <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
                          </span>
                        )}
                        <span className="cricket-slot-text">
                          <small>{label}</small>
                          <strong>{chosen !== null ? nameOf(chosen) : `Choose ${label.toLowerCase()}`}</strong>
                        </span>
                        <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
                      </button>
                    );
                  })}
                </div>
              </Fragment>
            ))}
          </div>
        )}
      </section>
      {error && <div className="admin-banner admin-banner-error">{error}</div>}

      {pickerFor && (
        <PlayerPicker
          key={pickerFor}
          title={pickerFor === "bowlerId" ? "Choose bowler" : pickerFor === "strikerId" ? "Choose striker" : "Choose non-striker"}
          icon={`fa-solid ${pickerFor === "bowlerId" ? "fa-baseball" : "fa-baseball-bat-ball"}`}
          items={pickerItems}
          nameOf={nameOf}
          selectedId={picks[pickerFor]}
          onPick={(id) => pick(pickerFor, id)}
          onClose={() => setPickerFor(null)}
        />
      )}
    </div>
  );
}
