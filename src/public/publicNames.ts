import { useMemo } from "react";
import type { PublicPlayer } from "../api/hooks/cricket/useCricketPublic";
import type { NameOf } from "../admin/cricket/stats";

// id → name over the players a public response brought (signed out, there's
// no shared player list to look names up in).
export function useNameOf(players: PublicPlayer[]): NameOf {
  return useMemo(() => {
    const names = new Map(players.map((player) => [player.id, player.name]));
    return (playerId: number | null) => (playerId === null ? "" : (names.get(playerId) ?? "Player"));
  }, [players]);
}
