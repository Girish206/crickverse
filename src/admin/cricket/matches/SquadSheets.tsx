import { useState } from "react";
import { useTeamPlayers } from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import type { CricketLastLeaders, CricketMatchSquad } from "../../../api/types";
import { BottomSheet } from "../BottomSheet";
import type { NameOf } from "../stats";
import { rolesOf, rolesWithout, withCaptain, withReturningLeader } from "../tournaments/TeamRoleChips";
import { PlayerPicker } from "./PlayerPicker";
import { SquadChecklist, squadGroups } from "./SquadChecklist";

export type SquadStep = "players" | "captain" | "keeper";

interface SquadSheetsProps {
  teamName: string;
  squad: CricketMatchSquad;
  // A tournament side's roster, or the one-off team whose players to list.
  roster: number[];
  teamKey: string | null;
  tournamentPlayerIds: number[];
  other: { name: string; roster: number[]; playerIds: number[] };
  startAt: SquadStep;
  // Go on to the captain even if the side has one (a team just picked).
  askCaptain: boolean;
  // Who captained and kept wicket in the side's last match: ticked into the
  // squad, they get that role back (unless someone else has it).
  lastLeaders?: CricketLastLeaders;
  nameOf: NameOf;
  onSave: (squad: CricketMatchSquad) => void;
  onClose: () => void;
}

// A new match's side: its players, then its captain, then (skippable) its
// wicketkeeper. Closing the players sheet drops what was ticked there;
// moving on saves it, so closing a later sheet keeps what came before.
export function SquadSheets({
  teamName,
  squad,
  roster,
  teamKey,
  tournamentPlayerIds,
  other,
  startAt,
  askCaptain,
  lastLeaders,
  nameOf,
  onSave,
  onClose,
}: SquadSheetsProps) {
  const { data: players } = useCricketPlayers();
  const { data: teamPlayers } = useTeamPlayers(teamKey);
  // Follows `squad` until something is changed here, so last match's
  // captain and keeper, fetched after the sheet opens, still come in.
  const [edited, setEdited] = useState<CricketMatchSquad | null>(null);
  const draft = edited ?? squad;
  const setDraft = (update: CricketMatchSquad | ((current: CricketMatchSquad) => CricketMatchSquad)) =>
    setEdited((current) => (typeof update === "function" ? update(current ?? squad) : update));
  // There's no one to make captain until the squad has players.
  const [step, setStep] = useState<SquadStep>(squad.playerIds.length ? startAt : "players");

  if (step === "keeper") {
    return (
      <PlayerPicker
        title={`${teamName} — Wicketkeeper`}
        icon="fa-solid fa-mitten"
        hint="Tap the player keeping wicket, or skip for now."
        items={draft.playerIds.map((id) => ({ id }))}
        nameOf={nameOf}
        selectedId={draft.keeperId}
        onPick={(playerId) => {
          onSave({ ...draft, keeperId: playerId });
          onClose();
        }}
        onClose={onClose}
        footer={
          <button type="button" className="cricket-sheet-submit" onClick={onClose}>
            {draft.keeperId !== null ? "Done" : "Skip"}
          </button>
        }
      />
    );
  }

  if (step === "captain") {
    return (
      <PlayerPicker
        title={`${teamName} — Captain`}
        icon="fa-solid fa-user-tie"
        hint="Tap the player who leads this side."
        items={draft.playerIds.map((id) => ({ id }))}
        nameOf={nameOf}
        selectedId={draft.captainId}
        onPick={(playerId) => {
          const next = { ...draft, ...withCaptain(draft, playerId) };
          onSave(next);
          setDraft(next);
          setStep("keeper");
        }}
        onClose={onClose}
        // Tapping a player moves on; this keeps the one already picked
        // (e.g. last match's captain).
        footer={
          <button
            type="button"
            className="cricket-sheet-submit"
            disabled={draft.captainId === null}
            onClick={() => {
              onSave(draft);
              setStep("keeper");
            }}
          >
            Next: Choose Wicketkeeper
          </button>
        }
      />
    );
  }

  function toggle(playerId: number) {
    setDraft((current) =>
      current.playerIds.includes(playerId)
        ? { ...rolesWithout(current, playerId), playerIds: current.playerIds.filter((id) => id !== playerId) }
        : { ...withReturningLeader(rolesOf(current), lastLeaders, playerId), playerIds: [...current.playerIds, playerId] },
    );
  }

  function setMany(playerIds: number[], selected: boolean) {
    setDraft((current) =>
      selected
        ? {
            ...playerIds
              .filter((id) => !current.playerIds.includes(id))
              .reduce((roles, id) => withReturningLeader(roles, lastLeaders, id), rolesOf(current)),
            playerIds: [...new Set([...current.playerIds, ...playerIds])],
          }
        : playerIds.reduce(
            (next, playerId) => ({ ...rolesWithout(next, playerId), playerIds: next.playerIds.filter((id) => id !== playerId) }),
            current,
          ),
    );
  }

  const needsCaptain = askCaptain || draft.captainId === null;
  function next() {
    onSave(draft);
    if (needsCaptain) setStep("captain");
    else onClose();
  }

  return (
    <BottomSheet
      title={`${teamName} — Squad`}
      icon="fa-solid fa-users"
      onClose={onClose}
      fullScreen
      footer={
        <button type="button" className="cricket-sheet-submit" disabled={draft.playerIds.length === 0} onClick={next}>
          {needsCaptain ? "Next: Choose Captain" : "Done"} ({draft.playerIds.length} selected)
        </button>
      }
    >
      <SquadChecklist
        groups={squadGroups({
          name: teamName,
          roster: [...new Set([...roster, ...(teamPlayers ?? [])])],
          otherRoster: other.roster,
          tournamentPlayerIds,
          selected: draft.playerIds,
          otherSelected: other.playerIds,
        })}
        selected={draft.playerIds}
        roles={draft}
        playerById={new Map((players ?? []).map((player) => [player.id, player]))}
        nameOf={nameOf}
        onToggle={toggle}
        onSetMany={setMany}
        // The captain and keeper are asked for next, each on its own.
        showRoles={false}
        onRoles={(roles) => setDraft((current) => ({ ...current, ...roles }))}
        blockedReason={(playerId) => {
          if (draft.playerIds.includes(playerId)) return "Already in this squad";
          return other.playerIds.includes(playerId) ? `Playing for ${other.name}` : null;
        }}
        onAdded={toggle}
      />
    </BottomSheet>
  );
}
