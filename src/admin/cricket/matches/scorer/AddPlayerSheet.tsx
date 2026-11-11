import { useState } from "react";
import { useChangeCricketSquad, useTeamPlayers } from "../../../../api/hooks/cricket/useCricketMatches";
import { useCricketPlayers } from "../../../../api/hooks/cricket/useCricketPlayers";
import type { CricketMatch } from "../../../../api/types";
import { BottomSheet } from "../../BottomSheet";
import { AddPlayerByMobile } from "../../players/AddPlayerByMobile";
import { PlayerCard } from "../../players/PlayerCard";
import type { NameOf } from "../../stats";
import { hasPlayed, teamKeyOf } from "../matchUtils";

// A late arrival joins a side mid-match — or comes in for someone who
// hasn't played yet.
export function AddPlayerSheet({
  match,
  nameOf,
  initialTeam,
  onClose,
}: {
  match: CricketMatch;
  nameOf: NameOf;
  initialTeam: 0 | 1;
  onClose: () => void;
}) {
  const changeSquad = useChangeCricketSquad();
  const { data: players } = useCricketPlayers();
  const playerById = new Map((players ?? []).map((player) => [player.id, player]));
  const [team, setTeam] = useState<0 | 1>(initialTeam);
  const [addId, setAddId] = useState<number | null>(null);
  const [replaceId, setReplaceId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // The side's whole team (its roster, and anyone who has played for it),
  // less anyone already playing in this match.
  const { data: roster } = useTeamPlayers(teamKeyOf(match, team));
  const playing = new Set(match.teams.flatMap((side) => side.playerIds));
  const candidates = [...new Set([...(roster ?? []), ...(addId !== null ? [addId] : [])])].filter((id) => !playing.has(id));
  const term = search.trim().toLowerCase();
  const shown = candidates.filter((id) => nameOf(id).toLowerCase().includes(term));
  const replaceable = match.teams[team].playerIds.filter((id) => !hasPlayed(match, id));

  function chooseTeam(next: 0 | 1) {
    setTeam(next);
    setAddId(null);
    setReplaceId(null);
  }

  function save() {
    if (addId === null) return;
    changeSquad.mutate({ id: match.id, team, addId, replaceId }, { onSuccess: onClose });
  }

  return (
    <BottomSheet
      title="Add a player"
      icon="fa-solid fa-user-plus"
      onClose={onClose}
      fullScreen
      footer={
        <button type="button" className="cricket-sheet-submit" onClick={save} disabled={addId === null || changeSquad.isPending}>
          <i className="fa-solid fa-check" aria-hidden="true"></i>{" "}
          {addId === null
            ? "Choose a player"
            : replaceId !== null
              ? `${nameOf(addId)} in for ${nameOf(replaceId)}`
              : `Add ${nameOf(addId)} to ${match.teams[team].name}`}
        </button>
      }
    >
      <p className="cricket-sheet-context">A late arrival, or a substitute for someone who hasn't played yet.</p>

      <div className="cricket-manage-sides" role="radiogroup" aria-label="Side">
        {match.teams.map((side, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={team === i}
            className={team === i ? "active" : ""}
            onClick={() => chooseTeam(i as 0 | 1)}
          >
            <span>{side.name}</span> <small>{side.playerIds.length}</small>
          </button>
        ))}
      </div>

      <label className="cricket-sheet-label">Player</label>
      <AddPlayerByMobile
        blockedReason={(playerId) => (playing.has(playerId) ? "Already playing in this match" : null)}
        onAdded={(player) => setAddId(player.id)}
      />
      {candidates.length > 6 && (
        <input
          type="search"
          className="cricket-picker-search"
          placeholder="Search players"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      {shown.length === 0 ? (
        <p className="cricket-manage-empty">
          {candidates.length === 0 ? `Everyone in ${match.teams[team].name} is already playing.` : `No one matches "${search}".`}
        </p>
      ) : (
        <div className="cricket-player-card-list">
          {shown.map((id) => (
            <PlayerCard
              key={id}
              player={playerById.get(id)}
              fallbackName={nameOf(id)}
              selected={addId === id}
              onClick={() => setAddId(addId === id ? null : id)}
            />
          ))}
        </div>
      )}

      <label className="cricket-sheet-label">Replacing (optional)</label>
      {replaceable.length === 0 ? (
        <p className="admin-hint">Everyone on {match.teams[team].name} has played — the player joins as an extra.</p>
      ) : (
        <div className="cricket-chip-choice cricket-manage-replace" role="radiogroup" aria-label="Replacing">
          <button type="button" role="radio" aria-checked={replaceId === null} className={replaceId === null ? "active" : ""} onClick={() => setReplaceId(null)}>
            No one
          </button>
          {replaceable.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={replaceId === id}
              className={replaceId === id ? "active" : ""}
              onClick={() => setReplaceId(id)}
            >
              {nameOf(id)}
            </button>
          ))}
        </div>
      )}
      {replaceable.length > 0 && <p className="cricket-manage-replace-hint">
        <i className="fa-solid fa-circle-info" aria-hidden="true"></i>{" "}
        {replaceId === null
          ? `The player joins as an extra, so ${match.teams[team].name} go up to ${match.teams[team].playerIds.length + 1} players. Pick someone above to swap them out instead.`
          : `${nameOf(replaceId)} leaves ${match.teams[team].name} and the new player takes their place, so the side stays at ${match.teams[team].playerIds.length}.`}{" "}
        Only players who haven't batted, bowled or fielded can be replaced.
      </p>}
    </BottomSheet>
  );
}
