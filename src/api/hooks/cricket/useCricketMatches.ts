import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../client";
import type {
  ApiEnvelope,
  CricketBall,
  CricketBallType,
  CricketMatch,
  CricketMatchStage,
  CricketMatchType,
  CricketPitchType,
  CricketPlaces,
  CricketTeamRoles,
} from "../../types";

export interface CricketMatchInput {
  // Two of the tournament's teams, or a standalone match's own team names.
  teamAIndex?: number;
  teamBIndex?: number;
  teamNames?: [string, string];
  // Which existing team each one-off side is (teamKeyOf); null for a new one.
  teamKeys?: [string | null, string | null];
  overs: number;
  scheduledAt: string | null;
  venue: string | null;
  stage: CricketMatchStage | null;
  city: string | null;
  matchType: CricketMatchType | null;
  ballType: CricketBallType | null;
  pitchType: CricketPitchType | null;
}

export type CricketBallInput = Omit<CricketBall, "batterId" | "nonStrikerId" | "bowlerId">;

// All matches, or one tournament's.
// "none" lists the standalone matches. Only super admins may list without a
// tournament, so pass `enabled: false` for players.
export function useCricketMatches(tournamentId?: number | "none", { enabled = true } = {}) {
  return useQuery({
    queryKey: ["cricket-matches", "list", tournamentId ?? "all"],
    enabled,
    // Back in the app, catch up at once.
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CricketMatch[]>>("/admin/cricket/matches", {
        params: tournamentId ? { tournamentId } : undefined,
      });
      return data.data;
    },
  });
}

// How often an open live match checks for new balls.
const LIVE_REFRESH = 3_000;

type CricketInningsData = CricketMatch["innings"][number];
// GET /matches/:id/live: the match with only the balls from `fromBall` on.
type LiveMatch = Omit<CricketMatch, "innings"> & { innings: (CricketInningsData & { fromBall: number })[] };

// The match, loaded in full once (and again on coming back to the app).
// While it's live, every 3s it asks only for what's new — the details plus
// the balls after the ones it has — and adds them to what it holds, so
// viewers follow along ball by ball without re-downloading the match.
export function useCricketMatch(id: number) {
  const queryClient = useQueryClient();
  const key = ["cricket-matches", id];
  const query = useQuery({
    queryKey: key,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CricketMatch>>(`/admin/cricket/matches/${id}`);
      return data.data;
    },
  });
  const live = query.data?.status === "live";

  useEffect(() => {
    if (!live) return;
    const matchKey = ["cricket-matches", id];
    let busy = false;
    const timer = window.setInterval(async () => {
      // Skip while hidden, still waiting on the last ask, or while the scorer
      // is saving a ball (their own save brings the new state).
      if (busy || document.hidden || queryClient.isMutating() > 0) return;
      const held = queryClient.getQueryData<CricketMatch>(matchKey);
      if (!held) return;
      busy = true;
      try {
        const { data } = await apiClient.get<ApiEnvelope<LiveMatch>>(`/admin/cricket/matches/${id}/live`, {
          params: { known: held.innings.map((inn) => inn.balls.length).join(",") },
        });
        // Something newer arrived meanwhile (a save): keep that.
        if (queryClient.getQueryData(matchKey) !== held || queryClient.isMutating() > 0) return;
        const next: CricketMatch = {
          ...data.data,
          innings: data.data.innings.map(({ fromBall, balls, ...inn }, i) => ({
            ...inn,
            balls: [...(held.innings[i]?.balls ?? []).slice(0, fromBall), ...balls],
          })),
        };
        queryClient.setQueryData(matchKey, next);
        // It just finished: refresh the lists and Home to show the result.
        if (next.status !== "live") {
          queryClient.invalidateQueries({ queryKey: ["cricket-matches", "list"] });
          queryClient.invalidateQueries({ queryKey: ["cricket-me"] });
        }
      } catch {
        // Try again on the next tick.
      } finally {
        busy = false;
      }
    }, LIVE_REFRESH);
    return () => window.clearInterval(timer);
  }, [id, live, queryClient]);

  return query;
}

// Every match action returns the updated match: seed its cache entry so the
// scorer sees the new state at once, and refresh the lists.
function useMatchMutation<TVars>(request: (vars: TVars) => Promise<{ data: ApiEnvelope<CricketMatch> }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVars) => (await request(vars)).data.data,
    onSuccess: (match) => {
      queryClient.setQueryData(["cricket-matches", match.id], match);
      queryClient.invalidateQueries({ queryKey: ["cricket-matches", "list"] });
      queryClient.invalidateQueries({ queryKey: ["cricket-me"] });
    },
  });
}

const url = (id: number, path = "") => `/admin/cricket/matches/${id}${path}`;

export function useCreateCricketMatch() {
  return useMatchMutation((
    input: CricketMatchInput & {
      tournamentId: number | null;
      // A standalone match's captains (who join their side's squad).
      captainIds?: [number | null, number | null];
    },
  ) =>
    apiClient.post("/admin/cricket/matches", input),
  );
}

export function useUpdateCricketMatch() {
  return useMatchMutation(({ id, ...input }: CricketMatchInput & { id: number }) => apiClient.put(url(id), input));
}

export function useStartCricketMatch() {
  return useMatchMutation(
    ({
      id,
      ...input
    }: {
      id: number;
      tossWinner: number;
      tossDecision: "bat" | "bowl";
      playerIds: [number[], number[]];
      // Each side's captain / vice-captain / keeper for this match.
      roles?: [CricketTeamRoles, CricketTeamRoles];
    }) => apiClient.post(url(id, "/start"), input),
  );
}

export function useSetCricketCurrentPlayers() {
  return useMatchMutation(
    ({ id, ...input }: { id: number; strikerId?: number | null; nonStrikerId?: number | null; bowlerId?: number | null }) =>
      apiClient.put(url(id, "/current"), input),
  );
}

export function useAddCricketBall() {
  return useMatchMutation(({ id, ...ball }: CricketBallInput & { id: number }) => apiClient.post(url(id, "/balls"), ball));
}

export function useUndoCricketBall() {
  return useMatchMutation((id: number) => apiClient.delete(url(id, "/balls/last")));
}

export function useEndCricketInnings() {
  return useMatchMutation((id: number) => apiClient.post(url(id, "/end-innings")));
}

export function useAbandonCricketMatch() {
  return useMatchMutation((id: number) => apiClient.post(url(id, "/abandon")));
}

// Only one person scores a match at a time, and the seat stays theirs —
// leaving or closing the app doesn't free it — until they hand it over or
// stop scoring. Opening the Live tab takes it when it's free; the match
// itself (refreshed every 10s while live) says who has it.
export function useScoringSeat(match: CricketMatch | undefined, enabled: boolean, myAccountId: string | undefined) {
  const queryClient = useQueryClient();
  const id = match?.id ?? 0;
  const holderId = match?.scoringById ?? null;
  const mine = holderId !== null && String(holderId) === myAccountId;
  const free = holderId === null;

  const onSeat = {
    onSuccess: (updated: CricketMatch) => queryClient.setQueryData(["cricket-matches", updated.id], updated),
    // Someone else got there first: show who.
    onError: () => queryClient.invalidateQueries({ queryKey: ["cricket-matches", id] }),
  };
  const claim = useMutation({
    meta: { skipGlobalError: true },
    mutationFn: async (takeOver: boolean) =>
      (await apiClient.post<ApiEnvelope<CricketMatch>>(url(id, "/scoring"), { takeOver })).data.data,
    ...onSeat,
  });
  const handOver = useMutation({
    mutationFn: async (playerId: number) =>
      (await apiClient.post<ApiEnvelope<CricketMatch>>(url(id, "/scoring/hand-over"), { playerId })).data.data,
    ...onSeat,
  });
  const release = useMutation({
    mutationFn: async () => (await apiClient.delete<ApiEnvelope<CricketMatch>>(url(id, "/scoring"))).data.data,
    ...onSeat,
  });

  const { mutate } = claim;
  const take = enabled && free && match?.status === "live";
  useEffect(() => {
    if (take) mutate(false);
  }, [take, mutate]);

  return {
    // This viewer is the one scoring.
    mine,
    // Someone else is: their name.
    holder: !free && !mine ? (match?.scoringByName ?? "Someone else") : null,
    takeOver: () => claim.mutateAsync(true),
    handOver: (playerId: number) => handOver.mutateAsync(playerId),
    release: () => release.mutateAsync(),
    busy: claim.isPending || handOver.isPending || release.isPending,
  };
}

export function useSetCricketPlayerOfMatch() {
  return useMatchMutation(({ id, playerId }: { id: number; playerId: number | null }) =>
    apiClient.put(url(id, "/player-of-match"), { playerId }),
  );
}

// Organisers and captains choose who else scores the match.
export function useSetCricketMatchScorers() {
  return useMatchMutation(({ id, playerIds }: { id: number; playerIds: number[] }) =>
    apiClient.put(url(id, "/scorers"), { playerIds }),
  );
}

export function useDeleteCricketMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(url(id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cricket-matches", "list"] }),
  });
}

// A friendly team's captain adds players (by mobile; new numbers with a
// name) to the team's side in all its upcoming matches.
export function useAddFriendlyTeamPlayers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { teamName: string; players: { mobile: string; name?: string }[] }) => {
      const { data } = await apiClient.post<ApiEnvelope<{ matches: number; playerIds: number[] }>>(
        "/admin/cricket/friendly-teams/players",
        input,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cricket-matches"] });
      queryClient.invalidateQueries({ queryKey: ["cricket-me"] });
      queryClient.invalidateQueries({ queryKey: ["cricket-players"] });
    },
  });
}

// Everyone in a team, by its key (teamKeyOf): the tournament team's roster
// and everyone who has played for it in any match.
export function useTeamPlayers(teamKey: string | null, enabled = true) {
  return useQuery({
    enabled: enabled && teamKey !== null,
    // Under "cricket-matches" so saving a match or adding players refreshes it.
    queryKey: ["cricket-matches", "team-players", teamKey],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<{ playerIds: number[] }>>("/admin/cricket/teams/players", {
        params: { key: teamKey },
      });
      return data.data.playerIds;
    },
  });
}

// Grounds and cities from every match and tournament, for the type-ahead on
// the match and tournament forms (refetched each time a form opens).
export function useCricketPlaces() {
  return useQuery({
    queryKey: ["cricket-places"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CricketPlaces>>("/admin/cricket/places");
      return data.data;
    },
  });
}
