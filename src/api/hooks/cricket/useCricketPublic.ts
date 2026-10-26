import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { apiClient } from "../../client";
import { followLive } from "./followLive";
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

type CricketInningsData = CricketMatch["innings"][number];
type LiveMatch = Omit<CricketMatch, "innings"> & { innings: (CricketInningsData & { fromBall: number })[] };

// The match in full once; while it's live, each change as it happens: only
// the new balls (and the latest details), added onto what's held — like
// useCricketMatch (see followLive).
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
    let held: PublicMatchData | undefined;
    return followLive<LiveMatch>({
      url: `/admin/cricket/public/matches/${id}/live`,
      ask: () => {
        held = queryClient.getQueryData<PublicMatchData>(key);
        return held && { known: held.match.innings.map((inn) => inn.balls.length).join(","), since: held.match.updatedAt };
      },
      apply: (data) => {
        // A full reload landed meanwhile: keep that.
        if (!held || queryClient.getQueryData(key) !== held) return;
        const asked = held;
        const match: CricketMatch = {
          ...data,
          innings: data.innings.map(({ fromBall, balls, ...inn }, i) => ({
            ...inn,
            balls: [...(asked.match.innings[i]?.balls ?? []).slice(0, fromBall), ...balls],
          })),
        };
        queryClient.setQueryData<PublicMatchData>(key, { ...asked, match });
      },
    });
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
