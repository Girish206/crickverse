import { Fragment, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  useCricketMatch,
  useSetCricketCurrentPlayers,
  useStartCricketMatch,
  useTeamPlayers,
} from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { useCricketTournament } from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketMatch, CricketPlayer, CricketTeamRoles } from "../../../api/types";
import { ListCard } from "../../components/ListCard";
import { PageHeader } from "../../components/PageHeader";
import { avatarColorFor } from "../avatarColor";
import { BottomSheet } from "../BottomSheet";
import { AddPlayerByMobile } from "../players/AddPlayerByMobile";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { PlayerCard } from "../players/PlayerCard";
import type { NameOf } from "../stats";
import { rolesOf, rolesWithout, TeamRoleChips } from "../tournaments/TeamRoleChips";
import { CricketMatchForm } from "./CricketMatchForm";
import { teamKeyOf, usePlayerNames } from "./matchUtils";
import { PlayerPicker } from "./PlayerPicker";
import "../../admin.css";
import "../cricket.css";
import { Loader } from "../../components/Loader";

type Slot = "strikerId" | "nonStrikerId" | "bowlerId";
type Face = "heads" | "tails";
const NO_PICKS: Record<Slot, number | null> = { strikerId: null, nonStrikerId: null, bowlerId: null };
const SLOTS: { slot: Slot; label: string; icon: string }[] = [
  { slot: "strikerId", label: "Striker", icon: "fa-baseball-bat-ball" },
  { slot: "nonStrikerId", label: "Non-striker", icon: "fa-user" },
  { slot: "bowlerId", label: "Bowler", icon: "fa-baseball" },
];

// /matches/:id/setup — a page of its own rather than a sheet, so a stray tap
// outside can't throw away the squads and toss picked so far.
export function CricketMatchSetupPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data: match, isLoading } = useCricketMatch(id);
  const nameOf = usePlayerNames();

  if (isLoading || !match) {
    return (
      <>
        <PageHeader title="Start Match" back={`/matches/${id}`} />
        <ListCard title="Start Match">
          {isLoading ? <Loader /> : <p>Match not found.</p>}
        </ListCard>
      </>
    );
  }
  // Only an upcoming match is set up; once started it's scored from its page.
  if (match.status !== "scheduled") return <Navigate to={`/matches/${id}`} replace />;

  return (
    <MatchSetup
      match={match}
      nameOf={nameOf}
      onExit={() => navigate(`/matches/${id}`)}
      onStarted={() => navigate(`/matches/${id}?tab=live`, { replace: true })}
    />
  );
}

interface MatchSetupProps {
  match: CricketMatch;
  nameOf: NameOf;
  onExit: () => void;
  onStarted: () => void;
}

// Two steps: the details and each side's squad, then "Start Scoring" moves
// on to the toss, openers and opening bowler. Each squad defaults to the
// team's tournament roster; other tournament players can be brought in. A
// standalone match picks both squads from every player.
function MatchSetup({ match, nameOf, onExit, onStarted }: MatchSetupProps) {
  const { data: tournament } = useCricketTournament(match.tournamentId ?? 0, match.tournamentId !== null);
  const startMatch = useStartCricketMatch();
  const setPlayers = useSetCricketCurrentPlayers();
  const busy = startMatch.isPending || setPlayers.isPending;

  const [step, setStep] = useState<"edit" | "toss">("edit");
  const [xi, setXi] = useState<[number[], number[]]>([match.teams[0].playerIds, match.teams[1].playerIds]);
  // This match's captain / vice-captain / keeper per side, from the teams'.
  const [roles, setRoles] = useState<[CricketTeamRoles, CricketTeamRoles]>([
    rolesOf(match.teams[0]),
    rolesOf(match.teams[1]),
  ]);
  const [squadFor, setSquadFor] = useState<0 | 1 | null>(null);
  const [tossWinner, setTossWinner] = useState<0 | 1 | null>(null);
  const [decision, setDecision] = useState<"bat" | "bowl" | null>(null);
  const [picks, setPicks] = useState(NO_PICKS);
  const [pickerFor, setPickerFor] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const detailsForm = useRef<HTMLFormElement>(null);
  const [call, setCall] = useState<Face>("heads");
  const [face, setFace] = useState<Face | null>(null);
  const [flipping, setFlipping] = useState(false);
  const flipTimer = useRef<number | undefined>(undefined);

  const { data: players } = useCricketPlayers();
  const playerById = new Map((players ?? []).map((player) => [player.id, player]));
  const photoOf = (playerId: number) => playerById.get(playerId)?.photoUrl;
  // Each side's whole team, not just who's in this match yet: the tournament
  // team's current roster, or everyone who has played for that one-off team
  // (the same team, not just the same name).
  const standalone = match.tournamentId === null;
  const { data: friendlyA } = useTeamPlayers(teamKeyOf(match, 0), standalone);
  const { data: friendlyB } = useTeamPlayers(teamKeyOf(match, 1), standalone);
  const teamRoster = (slot: 0 | 1) => [
    ...new Set([
      ...match.teams[slot].playerIds,
      ...(standalone
        ? ((slot === 0 ? friendlyA : friendlyB) ?? [])
        : (tournament?.teams[match.teams[slot].teamIndex]?.playerIds ?? [])),
    ]),
  ];
  const rostered = new Set([...teamRoster(0), ...teamRoster(1)]);
  const inTournament = new Set(standalone ? [] : (tournament?.playerIds ?? []));
  // Same badge colours as the match hero, kept apart if both names clash.
  const teamColors = [avatarColorFor(match.teams[0].name), avatarColorFor(match.teams[1].name)];
  for (let salt = 1; teamColors[1] === teamColors[0] && salt < 12; salt++) {
    teamColors[1] = avatarColorFor(`${match.teams[1].name}#${salt}`);
  }
  const battingSlot = tossWinner === null || decision === null ? null : decision === "bat" ? tossWinner : 1 - tossWinner;

  // Who a side can pick from: its roster (plus anyone brought in by mobile
  // number), then the rest of the tournament's squad. The whole player list
  // is too long to show. Anyone already picked by the other side is left out.
  function squadGroups(slot: 0 | 1) {
    const free = (ids: number[]) => ids.filter((id) => !xi[1 - slot].includes(id));
    const roster = teamRoster(slot);
    const squad = [...inTournament].filter((id) => !rostered.has(id));
    const brought = xi[slot].filter((id) => !roster.includes(id) && !squad.includes(id));
    return [
      { label: match.teams[slot].name, playerIds: free([...roster, ...brought]) },
      { label: "Tournament squad", playerIds: free(squad), tag: "Squad" },
    ];
  }

  function setSideRoles(slot: 0 | 1, next: CricketTeamRoles) {
    setRoles((current) => (slot === 0 ? [next, current[1]] : [current[0], next]));
  }

  function toggle(slot: 0 | 1, playerId: number) {
    // Leaving the XI gives up any role in it.
    if (xi[slot].includes(playerId)) setSideRoles(slot, rolesWithout(roles[slot], playerId));
    setXi((current) => {
      const next: [number[], number[]] = [[...current[0]], [...current[1]]];
      next[slot] = next[slot].includes(playerId)
        ? next[slot].filter((id) => id !== playerId)
        : [...next[slot], playerId];
      return next;
    });
  }

  // Squads first, then the details form saves any changes and moves on to
  // the toss once it's done (see onSaved below).
  function toToss() {
    if (xi[0].length < 2 || xi[1].length < 2) return setError("Each side needs at least 2 players in its squad.");
    setError(null);
    detailsForm.current?.requestSubmit();
  }

  // A new toss result changes who bats, so the openers are picked again.
  function recordToss(winner: 0 | 1 | null, choice: "bat" | "bowl" | null) {
    setTossWinner(winner);
    setDecision(choice);
    setPicks(NO_PICKS);
  }

  // The coin toss: the second team calls, the coin spins for a moment and
  // whoever called right (or not) wins it. The winner can still be set by
  // hand when the toss happened at the ground.
  function flipCoin() {
    if (flipping) return;
    const landed: Face = Math.random() < 0.5 ? "heads" : "tails";
    setFace(null);
    setFlipping(true);
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
    setPicks(next);
    setPickerFor(SLOTS.find(({ slot: s }) => s !== slot && next[s] === null)?.slot ?? null);
  }

  async function start() {
    const { strikerId, nonStrikerId, bowlerId } = picks;
    if (tossWinner === null || decision === null) return setError("Record the toss first.");
    if (strikerId === null || nonStrikerId === null || bowlerId === null) {
      return setError("Choose both openers and the opening bowler.");
    }
    setError(null);
    try {
      await startMatch.mutateAsync({ id: match.id, tossWinner, tossDecision: decision, playerIds: xi, roles });
    } catch {
      return setError("Couldn't start the match — try again.");
    }
    // Once started, the scorer asks for any player this didn't manage to save.
    await setPlayers.mutateAsync({ id: match.id, strikerId, nonStrikerId, bowlerId }).catch(() => undefined);
    onStarted();
  }

  const pickerItems =
    pickerFor === null || battingSlot === null
      ? []
      : pickerFor === "bowlerId"
        ? xi[1 - battingSlot].map((id) => ({ id }))
        : xi[battingSlot]
            .filter((id) => id !== (pickerFor === "strikerId" ? picks.nonStrikerId : picks.strikerId))
            .map((id) => ({ id }));

  return (
    <div className="cricket-page cricket-setup-page has-action-bar">
      <PageHeader
        title={step === "edit" ? "Start Match" : "Toss & Openers"}
        subtitle={`Step ${step === "edit" ? 1 : 2} of 2 · ${match.teams[0].name} vs ${match.teams[1].name}`}
        back={step === "toss" ? () => setStep("edit") : onExit}
        backLabel={step === "toss" ? "Back to match details" : "Back to match"}
      />
      <div className="cricket-setup-steps" aria-hidden="true">
        <span className="is-done"></span>
        <span className={step === "toss" ? "is-done" : ""}></span>
      </div>

      {step === "edit" ? (
        <div className="cricket-setup">
          <section>
            <div className="cricket-setup-teams">
              {match.teams.map((team, index) => {
                const slot = index as 0 | 1;
                return (
                  <Fragment key={slot}>
                    {slot === 1 && <span className="cricket-setup-vs">vs</span>}
                    <div className="cricket-setup-team">
                      <span className="cricket-setup-logo" style={{ background: teamColors[slot] }} aria-hidden="true">
                        {team.name.charAt(0).toUpperCase()}
                      </span>
                      <strong className="cricket-setup-team-name">{team.name}</strong>
                      <small className="cricket-setup-captain">
                        {roles[slot].captainId ? (
                          <>
                            <span className="cricket-role-tag">C</span> {nameOf(roles[slot].captainId)}
                          </>
                        ) : (
                          "No captain yet"
                        )}
                      </small>
                      <button
                        type="button"
                        className="cricket-setup-squad-btn"
                        onClick={() => setSquadFor(slot)}
                        aria-label={`Select ${team.name} squad`}
                      >
                        <i className="fa-solid fa-users" aria-hidden="true"></i> Select Squad
                        <span className="cricket-setup-count">{xi[slot].length}</span>
                      </button>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </section>
          {error && <div className="admin-banner admin-banner-error">{error}</div>}

          <CricketMatchForm
            existing={match}
            formRef={detailsForm}
            onSaved={() => setStep("toss")}
          />
        </div>
      ) : (
        <div className="cricket-setup">
          <section className="cricket-coin-card">
            <button
              type="button"
              className={`cricket-coin ${flipping ? "is-flipping" : ""}`}
              onClick={flipCoin}
              aria-label="Flip the coin"
            >
              {flipping ? "" : face === "tails" ? "T" : "H"}
            </button>
            <div className="cricket-coin-body">
              <span className="cricket-coin-caller">{match.teams[1].name} calls</span>
              <div className="admin-segmented cricket-coin-call" role="radiogroup" aria-label="Call">
                {(["heads", "tails"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={call === option}
                    className={call === option ? "active" : ""}
                    disabled={flipping}
                    onClick={() => setCall(option)}
                  >
                    {option === "heads" ? "Heads" : "Tails"}
                  </button>
                ))}
              </div>
              <button type="button" className="cricket-coin-flip" onClick={flipCoin} disabled={flipping}>
                <i className="fa-solid fa-coins" aria-hidden="true"></i> {flipping ? "Flipping..." : "Flip Coin"}
              </button>
            </div>
            {face && !flipping && tossWinner !== null && (
              <p className="cricket-coin-result" role="status">
                It's <strong>{face === "heads" ? "Heads" : "Tails"}</strong> — {match.teams[tossWinner].name} won the
                toss
              </p>
            )}
          </section>

          <section>
            <h2 className="cricket-section-title">Toss won by</h2>
            <div className="cricket-tile-grid" role="radiogroup" aria-label="Toss won by">
              {match.teams.map((team, index) => (
                <button
                  key={index}
                  type="button"
                  role="radio"
                  aria-checked={tossWinner === index}
                  className={`cricket-pick-tile ${tossWinner === index ? "active" : ""}`}
                  onClick={() => {
                    // Set by hand: the coin's result no longer applies.
                    setFace(null);
                    recordToss(index as 0 | 1, decision);
                  }}
                >
                  <span className="cricket-pick-tile-logo" style={{ background: teamColors[index] }} aria-hidden="true">
                    {team.name.charAt(0).toUpperCase()}
                  </span>
                  <strong>{team.name}</strong>
                  {tossWinner === index && (
                    <i className="fa-solid fa-check cricket-pick-tile-check" aria-hidden="true"></i>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="cricket-section-title">Elected to</h2>
            <div className="cricket-tile-grid" role="radiogroup" aria-label="Elected to">
              {(["bat", "bowl"] as const).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  aria-checked={decision === choice}
                  className={`cricket-pick-tile ${decision === choice ? "active" : ""}`}
                  onClick={() => recordToss(tossWinner, choice)}
                >
                  <span className="cricket-pick-tile-icon" aria-hidden="true">
                    <i className={`fa-solid ${choice === "bat" ? "fa-baseball-bat-ball" : "fa-baseball"}`}></i>
                  </span>
                  <strong>{choice === "bat" ? "Bat" : "Bowl"}</strong>
                  {decision === choice && (
                    <i className="fa-solid fa-check cricket-pick-tile-check" aria-hidden="true"></i>
                  )}
                </button>
              ))}
            </div>
          </section>

          {battingSlot !== null && (
            <section>
              <h2 className="cricket-section-title">
                Openers ({match.teams[battingSlot].name}) and opening bowler ({match.teams[1 - battingSlot].name})
              </h2>
              <div className="cricket-tile-grid is-three">
                {SLOTS.map(({ slot, label, icon }) => {
                  const chosen = picks[slot];
                  return (
                    <button
                      key={slot}
                      type="button"
                      className={`cricket-pick-tile ${chosen !== null ? "is-chosen" : "is-empty"}`}
                      onClick={() => setPickerFor(slot)}
                    >
                      <small>{label}</small>
                      {chosen !== null ? (
                        <PlayerAvatar name={nameOf(chosen)} photoUrl={photoOf(chosen)} className="cricket-pick-tile-photo" />
                      ) : (
                        <span className="cricket-pick-tile-icon" aria-hidden="true">
                          <i className={`fa-solid ${icon}`}></i>
                        </span>
                      )}
                      <strong>{chosen !== null ? nameOf(chosen) : "Choose"}</strong>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
          {error && <div className="admin-banner admin-banner-error">{error}</div>}
        </div>
      )}

      {squadFor !== null && (
        <BottomSheet
          title={`${match.teams[squadFor].name} — Squad`}
          icon="fa-solid fa-users"
          onClose={() => setSquadFor(null)}
          fullScreen
          footer={
            <button type="button" className="cricket-sheet-submit" onClick={() => setSquadFor(null)}>
              Done ({xi[squadFor].length} selected)
            </button>
          }
        >
          <SquadChecklist
            groups={squadGroups(squadFor)}
            selected={xi[squadFor]}
            roles={roles[squadFor]}
            playerById={playerById}
            nameOf={nameOf}
            onToggle={(playerId) => toggle(squadFor, playerId)}
            onRoles={(next) => setSideRoles(squadFor, next)}
            blockedReason={(playerId) => {
              if (xi[squadFor].includes(playerId)) return "Already in this squad";
              return xi[1 - squadFor].includes(playerId) ? `Playing for ${match.teams[1 - squadFor].name}` : null;
            }}
            onAdded={(playerId) => toggle(squadFor, playerId)}
          />
        </BottomSheet>
      )}

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

      <div className="cricket-action-bar">
        {step === "edit" ? (
          <button type="button" className="cricket-sheet-submit" onClick={toToss}>
            <i className="fa-solid fa-play" aria-hidden="true"></i> Start Scoring
          </button>
        ) : (
          <button type="button" className="cricket-sheet-submit" onClick={start} disabled={busy || flipping}>
            <i className="fa-solid fa-play" aria-hidden="true"></i> {busy ? "Starting..." : "Start Match"}
          </button>
        )}
      </div>
    </div>
  );
}

interface SquadGroup {
  label: string;
  playerIds: number[];
  // A label on each card, e.g. where they're brought in from.
  tag?: string;
}

interface SquadChecklistProps {
  groups: SquadGroup[];
  selected: number[];
  roles: CricketTeamRoles;
  playerById: Map<number, CricketPlayer>;
  nameOf: NameOf;
  onToggle: (playerId: number) => void;
  onRoles: (roles: CricketTeamRoles) => void;
  blockedReason: (playerId: number) => string | null;
  // Someone brought in by mobile number (found, or just created).
  onAdded: (playerId: number) => void;
}

// Anyone else is brought in by mobile number at the top; below, the side's
// own roster and the tournament squad. Picked players get C / VC / WK
// toggles for this match.
function SquadChecklist({
  groups,
  selected,
  roles,
  playerById,
  nameOf,
  onToggle,
  onRoles,
  blockedReason,
  onAdded,
}: SquadChecklistProps) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const total = groups.reduce((sum, group) => sum + group.playerIds.length, 0);
  const shown = groups
    .map((group) => ({ ...group, playerIds: group.playerIds.filter((id) => nameOf(id).toLowerCase().includes(term)) }))
    .filter((group) => group.playerIds.length > 0);

  return (
    <>
      <AddPlayerByMobile blockedReason={blockedReason} onAdded={(player) => onAdded(player.id)} />
      {total > 6 && (
        <input
          type="search"
          className="cricket-picker-search"
          placeholder="Search players"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      {shown.length === 0 ? (
        <div className="admin-empty-state">
          {total === 0 ? "No players yet — add them by mobile number above." : `No one matches "${search}".`}
        </div>
      ) : (
        shown.map((group) => (
          <section key={group.label} className="cricket-player-card-group">
            <h3 className="cricket-player-card-group-title">
              {group.label} <span>{group.playerIds.length}</span>
            </h3>
            <div className="cricket-player-card-list">
              {group.playerIds.map((playerId) => (
                <PlayerCard
                  key={playerId}
                  player={playerById.get(playerId)}
                  fallbackName={nameOf(playerId)}
                  selected={selected.includes(playerId)}
                  tag={group.tag}
                  onClick={() => onToggle(playerId)}
                >
                  <TeamRoleChips roles={roles} playerId={playerId} playerName={nameOf(playerId)} onChange={onRoles} />
                </PlayerCard>
              ))}
            </div>
          </section>
        ))
      )}

    </>
  );
}
