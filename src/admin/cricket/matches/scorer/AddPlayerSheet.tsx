import { useState } from "react";
import { useChangeCricketSquad, useTeamPlayers } from "../../../../api/hooks/cricket/useCricketMatches";
import { useCricketPlayers } from "../../../../api/hooks/cricket/useCricketPlayers";
import type { CricketMatch } from "../../../../api/types";
import { BottomSheet } from "../../BottomSheet";
import { AddPlayerByMobile } from "../../players/AddPlayerByMobile";
import { PlayerCard } from "../../players/PlayerCard";
import type { NameOf } from "../../stats";
import { teamKeyOf } from "../matchUtils";

// Who on a side hasn't batted or bowled yet (in either innings): only they
// can be swapped out for a substitute.
function untouched(match: CricketMatch, team: number) {
  const involved = new Set<number | null>();
  for (const innings of match.innings) {
    for (const ball of innings.balls) [ball.batterId, ball.nonStrikerId, ball.bowlerId, ball.dismissedId].forEach((id) => involved.add(id));
    [innings.strikerId, innings.nonStrikerId, innings.bowlerId].forEach((id) => involved.add(id));
  }
  return match.teams[team].playerIds.filter((id) => !involved.has(id));
}

// A late arrival joins a side mid-match — or comes in for someone who
// hasn't batted or bowled yet.
export function AddPlayerSheet({ match, nameOf, onClose }: { match: CricketMatch; nameOf: NameOf; onClose: () => void }) {
  const changeSquad = useChangeCricketSquad();
  const { data: players } = useCricketPlayers();
  const playerById = new Map((players ?? []).map((player) => [player.id, player]));
  const [team, setTeam] = useState<0 | 1>(match.teams[0].playerIds.length <= match.teams[1].playerIds.length ? 0 : 1);
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
  const replaceable = untouched(match, team);

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
      <p className="cricket-sheet-context">
        <i className="fa-solid fa-user-clock" aria-hidden="true"></i> A late arrival, or a substitute for someone who
        hasn't batted or bowled
      </p>

      <label className="cricket-sheet-label">Side</label>
      <div className="cricket-chip-choice" role="radiogroup" aria-label="Side">
        {match.teams.map((side, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={team === i}
            className={team === i ? "active" : ""}
            onClick={() => chooseTeam(i as 0 | 1)}
          >
            {side.name} <small>({side.playerIds.length})</small>
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
        <div className="admin-empty-state">
          {candidates.length === 0 ? "No one else in this team — add them by mobile number above." : `No one matches "${search}".`}
        </div>
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
        <p className="admin-hint">Everyone on {match.teams[team].name} has batted or bowled — the player joins as an extra.</p>
      ) : (
        <div className="cricket-chip-choice" role="radiogroup" aria-label="Replacing">
          <button type="button" role="radio" aria-checked={replaceId === null} className={replaceId === null ? "active" : ""} onClick={() => setReplaceId(null)}>
            No one — add them
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
    </BottomSheet>
  );
}
