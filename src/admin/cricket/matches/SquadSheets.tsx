import { useState } from "react";
import { useTeamPlayers } from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import type { CricketMatchSquad } from "../../../api/types";
import { BottomSheet } from "../BottomSheet";
import type { NameOf } from "../stats";
import { rolesWithout, withCaptain } from "../tournaments/TeamRoleChips";
import { PlayerPicker } from "./PlayerPicker";
import { SquadChecklist, squadGroups } from "./SquadChecklist";

export type SquadStep = "players" | "captain";

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
  nameOf: NameOf;
  onSave: (squad: CricketMatchSquad) => void;
  onClose: () => void;
}

// A new match's side: its players, then its captain. Closing the players
// sheet drops what was ticked there; moving on saves it, so closing the
// captain sheet keeps the squad.
export function SquadSheets({
  teamName,
  squad,
  roster,
  teamKey,
  tournamentPlayerIds,
  other,
  startAt,
  askCaptain,
  nameOf,
  onSave,
  onClose,
}: SquadSheetsProps) {
  const { data: players } = useCricketPlayers();
  const { data: teamPlayers } = useTeamPlayers(teamKey);
  const [draft, setDraft] = useState(squad);
  // There's no one to make captain until the squad has players.
  const [step, setStep] = useState<SquadStep>(squad.playerIds.length ? startAt : "players");

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
          onSave({ ...draft, ...withCaptain(draft, playerId) });
          onClose();
        }}
        onClose={onClose}
      />
    );
  }

  function toggle(playerId: number) {
    setDraft((current) =>
      current.playerIds.includes(playerId)
        ? { ...rolesWithout(current, playerId), playerIds: current.playerIds.filter((id) => id !== playerId) }
        : { ...current, playerIds: [...current.playerIds, playerId] },
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
