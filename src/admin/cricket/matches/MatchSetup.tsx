import { Fragment, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCricketMatch, useLastLeaders, useTeamPlayers } from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { useCricketTournament } from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketLastLeaders, CricketMatch, CricketTeamRoles } from "../../../api/types";
import { ListCard } from "../../components/ListCard";
import { PageHeader } from "../../components/PageHeader";
import { BottomSheet } from "../BottomSheet";
import type { NameOf } from "../stats";
import { rolesOf, rolesWithout, withLastLeaders, withReturningLeader } from "../tournaments/TeamRoleChips";
import { CricketMatchForm } from "./CricketMatchForm";
import { teamKeyOf, usePlayerNames } from "./matchUtils";
import { SquadChecklist, squadGroups } from "./SquadChecklist";
import { NO_TOSS, sideColors, TossStep, tossProblem, useStartWithToss } from "./TossStep";
import "../../admin.css";
import "../cricket.css";
import { Loader } from "../../components/Loader";
import { TeamMark } from "../teams/TeamMark";

// /matches/:id/setup — a page of its own rather than a sheet, so a stray tap
// outside can't throw away the squads and toss picked so far.
export function CricketMatchSetupPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data: match, isLoading } = useCricketMatch(id);
  // Waited for, so the squads open with last match's leaders already picked.
  const { data: lastLeaders, isLoading: loadingLeaders } = useLastLeaders(id);
  const nameOf = usePlayerNames();

  if (isLoading || loadingLeaders || !match) {
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
      lastLeaders={lastLeaders}
      nameOf={nameOf}
      onExit={() => navigate(`/matches/${id}`)}
      onStarted={() => {
        navigate(`/matches/${id}/score`, { replace: true });
      }}
    />
  );
}

interface MatchSetupProps {
  match: CricketMatch;
  lastLeaders?: [CricketLastLeaders, CricketLastLeaders];
  nameOf: NameOf;
  onExit: () => void;
  onStarted: () => void;
}

// Two steps: the details and each side's squad, then "Start Scoring" moves
// on to the toss, openers and opening bowler. Each squad defaults to the
// team's tournament roster; other tournament players can be brought in. A
// standalone match picks both squads from every player. (A match created
// with "Start Match" does its toss in the new-match sheet instead.)
function MatchSetup({ match, lastLeaders, nameOf, onExit, onStarted }: MatchSetupProps) {
  const { data: tournament } = useCricketTournament(match.tournamentId ?? 0, match.tournamentId !== null);
  const { start: startWithToss, busy } = useStartWithToss();

  const [step, setStep] = useState<"edit" | "toss">("edit");
  const [xi, setXi] = useState<[number[], number[]]>([match.teams[0].playerIds, match.teams[1].playerIds]);
  // This match's captain / vice-captain / keeper per side: the teams', with
  // whoever captained and kept wicket in the side's last match taking over.
  const [roles, setRoles] = useState<[CricketTeamRoles, CricketTeamRoles]>(() => [
    withLastLeaders(rolesOf(match.teams[0]), lastLeaders?.[0], match.teams[0].playerIds),
    withLastLeaders(rolesOf(match.teams[1]), lastLeaders?.[1], match.teams[1].playerIds),
  ]);
  const [squadFor, setSquadFor] = useState<0 | 1 | null>(null);
  const [toss, setToss] = useState(NO_TOSS);
  const [error, setInlineError] = useState<string | null>(null);
  // Errors show inline and as a toast, so they're seen when scrolled away.
  const setError = (message: string | null) => {
    setInlineError(message);
    if (message) toast.error(message, { duration: 5000 });
  };
  const detailsForm = useRef<HTMLFormElement>(null);

  const { data: players } = useCricketPlayers();
  const playerById = new Map((players ?? []).map((player) => [player.id, player]));
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
  // Same badge colours as the match hero, kept apart if both names clash.
  const teamColors = sideColors([match.teams[0].name, match.teams[1].name]);

  function setSideRoles(slot: 0 | 1, next: CricketTeamRoles) {
    setRoles((current) => (slot === 0 ? [next, current[1]] : [current[0], next]));
  }

  function toggle(slot: 0 | 1, playerId: number) {
    // Leaving the XI gives up any role in it; last match's captain or keeper
    // coming in takes theirs back.
    setSideRoles(
      slot,
      xi[slot].includes(playerId)
        ? rolesWithout(roles[slot], playerId)
        : withReturningLeader(roles[slot], lastLeaders?.[slot], playerId),
    );
    setXi((current) => {
      const next: [number[], number[]] = [[...current[0]], [...current[1]]];
      next[slot] = next[slot].includes(playerId)
        ? next[slot].filter((id) => id !== playerId)
        : [...next[slot], playerId];
      return next;
    });
  }

  // A group's "Select all" / "Clear", with roles as toggle() gives them.
  function setMany(slot: 0 | 1, playerIds: number[], selected: boolean) {
    const changed = playerIds.filter((id) => xi[slot].includes(id) !== selected);
    setSideRoles(
      slot,
      changed.reduce(
        (next, playerId) =>
          selected ? withReturningLeader(next, lastLeaders?.[slot], playerId) : rolesWithout(next, playerId),
        roles[slot],
      ),
    );
    setXi((current) => {
      const next: [number[], number[]] = [[...current[0]], [...current[1]]];
      next[slot] = selected
        ? [...new Set([...next[slot], ...changed])]
        : next[slot].filter((id) => !changed.includes(id));
      return next;
    });
  }

  // Squads first, then the details form saves any changes and moves on to
  // the toss once it's done (see onSaved below).
  function toToss() {
    if (xi[0].length < 2 || xi[1].length < 2) return setError("Each side needs at least 2 players in its squad.");
    const noCaptain = ([0, 1] as const).find((slot) => roles[slot].captainId === null);
    if (noCaptain !== undefined) {
      setSquadFor(noCaptain);
      return setError(`Choose ${match.teams[noCaptain].name}'s captain — tap C on a player.`);
    }
    setError(null);
    detailsForm.current?.requestSubmit();
  }

  async function start() {
    const problem = tossProblem(toss);
    if (problem) return setError(problem);
    setError(null);
    if (!(await startWithToss(match.id, toss, xi, roles))) return setInlineError("Couldn't start the match — try again.");
    onStarted();
  }

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
                      <TeamMark className="cricket-setup-logo" name={team.name} logoUrl={team.logoUrl} color={teamColors[slot]} />
                      <strong className="cricket-setup-team-name">{team.name}</strong>
                      <small className="cricket-setup-captain">
                        {roles[slot].captainId ? (
                          <>
                            <span className="cricket-role-tag">C</span> {nameOf(roles[slot].captainId)}
                          </>
                        ) : (
                          "Choose a captain"
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
        <TossStep
          teams={[match.teams[0], match.teams[1]]}
          xi={xi}
          nameOf={nameOf}
          value={toss}
          onChange={setToss}
          error={error}
        />
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
            groups={squadGroups({
              name: match.teams[squadFor].name,
              roster: teamRoster(squadFor),
              otherRoster: teamRoster(squadFor === 0 ? 1 : 0),
              tournamentPlayerIds: standalone ? [] : (tournament?.playerIds ?? []),
              selected: xi[squadFor],
              otherSelected: xi[1 - squadFor],
            })}
            selected={xi[squadFor]}
            roles={roles[squadFor]}
            playerById={playerById}
            nameOf={nameOf}
            onToggle={(playerId) => toggle(squadFor, playerId)}
            onSetMany={(playerIds, selected) => setMany(squadFor, playerIds, selected)}
            onRoles={(next) => setSideRoles(squadFor, next)}
            blockedReason={(playerId) => {
              if (xi[squadFor].includes(playerId)) return "Already in this squad";
              return xi[1 - squadFor].includes(playerId) ? `Playing for ${match.teams[1 - squadFor].name}` : null;
            }}
            onAdded={(playerId) => toggle(squadFor, playerId)}
          />
        </BottomSheet>
      )}

      <div className="cricket-action-bar">
        {step === "edit" ? (
          <button type="button" className="cricket-sheet-submit" onClick={toToss}>
            <i className="fa-solid fa-play" aria-hidden="true"></i> Start Scoring
          </button>
        ) : (
          <button type="button" className="cricket-sheet-submit" onClick={start} disabled={busy}>
            <i className="fa-solid fa-play" aria-hidden="true"></i> {busy ? "Starting..." : "Start Match"}
          </button>
        )}
      </div>
    </div>
  );
}

