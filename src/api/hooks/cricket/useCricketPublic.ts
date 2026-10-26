import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { apiClient } from "../../client";
import type { ApiEnvelope, CricketMatch, CricketPlayer, CricketTournament } from "../../types";

// Shared links, signed out: a match or tournament its organiser made public.
// These endpoints need no sign-in, and answer 404 for anything not public
// (the same as a missing one), so a 404 never sends anyone to sign in.

export type PublicPlayer = Pick<CricketPlayer, "id" | "name" | "role" | "photoUrl">;

export interface PublicTournamentCard {
  id: number;
  name: string;
  logoUrl: string | null;
  isPublic: boolean;
}

export interface PublicMatchData {
  match: CricketMatch;
  tournament: PublicTournamentCard | null;
  players: PublicPlayer[];
}

export interface PublicTournamentData {
  tournament: CricketTournament;
  matches: CricketMatch[];
  players: PublicPlayer[];
}

// Not public (or not there): show the "private" screen.
export const isNotPublic = (error: unknown) => isAxiosError(error) && error.response?.status === 404;

// Live watchers check for new balls this often (paused while the tab is hidden).
const PUBLIC_LIVE_REFRESH = 5_000;

type CricketInningsData = CricketMatch["innings"][number];
type LiveMatch = Omit<CricketMatch, "innings"> & { innings: (CricketInningsData & { fromBall: number })[] };

// The match in full once; while it's live, every 5s only the new balls (and
// the latest details), added onto what's held — like useCricketMatch.
export function usePublicMatch(id: number) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["cricket-public", "match", id],
    enabled: Number.isFinite(id) && id > 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<PublicMatchData>>(`/admin/cricket/public/matches/${id}`);
      return data.data;
    },
  });
  const live = query.data?.match.status === "live";

  useEffect(() => {
    if (!live) return;
    const key = ["cricket-public", "match", id];
    let busy = false;
    const timer = window.setInterval(async () => {
      if (busy || document.hidden) return;
      const held = queryClient.getQueryData<PublicMatchData>(key);
      if (!held) return;
      busy = true;
      try {
        const { data } = await apiClient.get<ApiEnvelope<LiveMatch>>(`/admin/cricket/public/matches/${id}/live`, {
          params: { known: held.match.innings.map((inn) => inn.balls.length).join(",") },
        });
        // A full reload landed meanwhile: keep that.
        if (queryClient.getQueryData(key) !== held) return;
        const match: CricketMatch = {
          ...data.data,
          innings: data.data.innings.map(({ fromBall, balls, ...inn }, i) => ({
            ...inn,
            balls: [...(held.match.innings[i]?.balls ?? []).slice(0, fromBall), ...balls],
          })),
        };
        queryClient.setQueryData<PublicMatchData>(key, { ...held, match });
      } catch {
        // Try again on the next tick.
      } finally {
        busy = false;
      }
    }, PUBLIC_LIVE_REFRESH);
    return () => window.clearInterval(timer);
  }, [id, live, queryClient]);

  return query;
}

export function usePublicTournament(id: number) {
  return useQuery({
    queryKey: ["cricket-public", "tournament", id],
    enabled: Number.isFinite(id) && id > 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<PublicTournamentData>>(`/admin/cricket/public/tournaments/${id}`);
      return data.data;
    },
  });
}
