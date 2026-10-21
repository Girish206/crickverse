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
  CricketTeamRoles,
} from "../../types";

export interface CricketMatchInput {
  // Two of the tournament's teams, or a standalone match's own team names.
  teamAIndex?: number;
  teamBIndex?: number;
  teamNames?: [string, string];
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
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CricketMatch[]>>("/admin/cricket/matches", {
        params: tournamentId ? { tournamentId } : undefined,
      });
      return data.data;
    },
  });
}

// A live match refreshes itself so people following along see new balls.
export function useCricketMatch(id: number) {
  return useQuery({
    queryKey: ["cricket-matches", id],
    refetchInterval: (query) => (query.state.data?.status === "live" ? 10000 : false),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CricketMatch>>(`/admin/cricket/matches/${id}`);
      return data.data;
    },
  });
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

export function useSetCricketPlayerOfMatch() {
  return useMatchMutation(({ id, playerId }: { id: number; playerId: number | null }) =>
    apiClient.put(url(id, "/player-of-match"), { playerId }),
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
