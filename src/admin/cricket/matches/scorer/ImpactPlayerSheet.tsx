import { useState } from "react";
import { toast } from "sonner";
import { useImpactSub, useTeamPlayers } from "../../../../api/hooks/cricket/useCricketMatches";
import { useCricketPlayers } from "../../../../api/hooks/cricket/useCricketPlayers";
import type { CricketMatch } from "../../../../api/types";
import { BottomSheet } from "../../BottomSheet";
import { AddPlayerByMobile } from "../../players/AddPlayerByMobile";
import { PlayerCard } from "../../players/PlayerCard";
import type { NameOf } from "../../stats";
import { teamKeyOf } from "../matchUtils";
import { cantGoOut } from "./impact";
import { SearchField } from "../../SearchField";

// The Impact Player rule: a side swaps one player for a substitute, once.
// Unlike a squad change, the player going out may have batted or bowled
// already (that stays theirs); the substitute can then bat and bowl in full.
export function ImpactPlayerSheet({ match, nameOf, team, onClose }: { match: CricketMatch; nameOf: NameOf; team: 0 | 1; onClose: () => void }) {
  const impactSub = useImpactSub();
  const { data: players } = useCricketPlayers();
  const playerById = new Map((players ?? []).map((player) => [player.id, player]));
  const side = match.teams[team];
  const [outId, setOutId] = useState<number | null>(null);
  const [inId, setInId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // The side's whole team, less anyone already playing in this match.
  const { data: roster } = useTeamPlayers(teamKeyOf(match, team));
  const playing = new Set(match.teams.flatMap((s) => s.playerIds));
  const candidates = [...new Set([...(roster ?? []), ...(inId !== null ? [inId] : [])])].filter((id) => !playing.has(id));
  const term = search.trim().toLowerCase();
  const shown = candidates.filter((id) => nameOf(id).toLowerCase().includes(term));

  function save() {
    if (outId === null || inId === null) return;
    impactSub.mutate(
      { id: match.id, team, outId, inId },
      {
        onSuccess: () => {
          toast.success(`${nameOf(inId)} comes in for ${nameOf(outId)}`);
          onClose();
        },
      },
    );
  }

  return (
    <BottomSheet
      title={`Impact Player · ${side.name}`}
      icon="fa-solid fa-right-left"
      onClose={onClose}
      fullScreen
      footer={
        <button type="button" className="cricket-sheet-submit" onClick={save} disabled={outId === null || inId === null || impactSub.isPending}>
          <i className="fa-solid fa-check" aria-hidden="true"></i>{" "}
          {outId === null ? "Choose who goes out" : inId === null ? "Choose who comes in" : `${nameOf(inId)} in for ${nameOf(outId)}`}
        </button>
      }
    >
      <p className="cricket-sheet-context">
        One swap for the whole match. The player going out keeps what they've done but takes no further part; the
        Impact Player can bat and bowl.
      </p>

      <label className="cricket-sheet-label">Going out</label>
      <div className="cricket-chip-choice cricket-manage-replace" role="radiogroup" aria-label="Going out">
        {side.playerIds.map((id) => {
          const reason = cantGoOut(match, team, id);
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={outId === id}
              className={outId === id ? "active" : ""}
              disabled={reason !== null}
              title={reason ?? undefined}
              onClick={() => setOutId(id)}
            >
              {nameOf(id)}
              {reason && <small> · {reason}</small>}
            </button>
          );
        })}
      </div>

      <label className="cricket-sheet-label">Coming in</label>
      <AddPlayerByMobile
        blockedReason={(playerId) => (playing.has(playerId) ? "Already playing in this match" : null)}
        onAdded={(player) => setInId(player.id)}
      />
      {candidates.length > 6 && (
        <SearchField label="Search players" value={search} onChange={setSearch} />
      )}
      {shown.length === 0 ? (
        <p className="cricket-manage-empty">
          {candidates.length === 0 ? `Everyone in ${side.name} is already playing — add someone by mobile number.` : `No one matches "${search}".`}
        </p>
      ) : (
        <div className="cricket-player-card-list">
          {shown.map((id) => (
            <PlayerCard
              key={id}
              player={playerById.get(id)}
              fallbackName={nameOf(id)}
              selected={inId === id}
              onClick={() => setInId(inId === id ? null : id)}
            />
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
