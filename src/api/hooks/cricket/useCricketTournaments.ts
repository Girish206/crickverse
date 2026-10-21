import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../client";
import type {
  ApiEnvelope,
  CricketBallType,
  CricketCategory,
  CricketMatchType,
  CricketPitchType,
  CricketTournament,
} from "../../types";

export interface CricketTournamentInput {
  name: string;
  city: string | null;
  ground: string | null;
  organiserName: string | null;
  organiserMobile: string | null;
  organiserEmail: string | null;
  startDate: string | null;
  endDate: string | null;
  category: CricketCategory | null;
  ballType: CricketBallType | null;
  pitchType: CricketPitchType | null;
  matchType: CricketMatchType | null;
  overs: number | null;
}

export interface CricketTournamentImages {
  id: number;
  // A file replaces the current image; null removes it; undefined leaves it.
  logo?: File | null;
  banner?: File | null;
}

export function useCricketTournaments() {
  return useQuery({
    queryKey: ["cricket-tournaments"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CricketTournament[]>>("/admin/cricket/tournaments");
      return data.data;
    },
  });
}

export function useCricketTournament(id: number, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["cricket-tournaments", id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CricketTournament>>(`/admin/cricket/tournaments/${id}`);
      return data.data;
    },
  });
}

// Every tournament action returns the updated tournament: seed the detail
// cache with it so the page updates at once, and refresh the list.
function useTournamentMutation<TVars>(request: (vars: TVars) => Promise<{ data: ApiEnvelope<CricketTournament> }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVars) => (await request(vars)).data.data,
    onSuccess: (tournament) => {
      queryClient.setQueryData(["cricket-tournaments", tournament.id], tournament);
      queryClient.invalidateQueries({ queryKey: ["cricket-tournaments"], exact: true });
    },
  });
}

export function useCreateCricketTournament() {
  return useTournamentMutation((input: CricketTournamentInput) =>
    apiClient.post("/admin/cricket/tournaments", input),
  );
}

export function useUpdateCricketTournament() {
  return useTournamentMutation(({ id, ...input }: CricketTournamentInput & { id: number }) =>
    apiClient.put(`/admin/cricket/tournaments/${id}`, input),
  );
}

export function useSetCricketTournamentImages() {
  return useTournamentMutation(({ id, logo, banner }: CricketTournamentImages) => {
    const form = new FormData();
    if (logo) form.append("logo", logo);
    else if (logo === null) form.append("removeLogo", "true");
    if (banner) form.append("banner", banner);
    else if (banner === null) form.append("removeBanner", "true");
    return apiClient.put(`/admin/cricket/tournaments/${id}/images`, form);
  });
}

// Replaces the squad; players dropped from it also leave their matched set.
export function useSetCricketSquad() {
  return useTournamentMutation(({ id, playerIds }: { id: number; playerIds: number[] }) =>
    apiClient.put(`/admin/cricket/tournaments/${id}/players`, { playerIds }),
  );
}

export function useSetCricketMatchSets() {
  return useTournamentMutation(({ id, sets }: { id: number; sets: number[][] }) =>
    apiClient.put(`/admin/cricket/tournaments/${id}/match-sets`, { sets }),
  );
}

export function useGenerateCricketTeams() {
  return useTournamentMutation((id: number) => apiClient.post(`/admin/cricket/tournaments/${id}/generate`));
}

export function useSwapCricketPlayers() {
  return useTournamentMutation(({ id, playerA, playerB }: { id: number; playerA: number; playerB: number }) =>
    apiClient.post(`/admin/cricket/tournaments/${id}/swap`, { playerA, playerB }),
  );
}

export function useMoveCricketPlayer() {
  return useTournamentMutation(({ id, playerId, toTeamIndex }: { id: number; playerId: number; toTeamIndex: number }) =>
    apiClient.post(`/admin/cricket/tournaments/${id}/move`, { playerId, toTeamIndex }),
  );
}

export interface CricketTeamInput {
  name: string;
  playerIds: number[];
}

// Appends teams: blank ones to generate into, a hand-built one, or a copy of
// another tournament's. Their players join the squad.
export function useAddCricketTeams() {
  return useTournamentMutation(({ id, teams }: { id: number; teams: CricketTeamInput[] }) =>
    apiClient.post(`/admin/cricket/tournaments/${id}/teams`, { teams }),
  );
}

export function useUpdateCricketTeam() {
  return useTournamentMutation(({ id, index, ...team }: CricketTeamInput & { id: number; index: number }) =>
    apiClient.put(`/admin/cricket/tournaments/${id}/teams/${index}`, team),
  );
}

export function useRemoveCricketTeam() {
  const queryClient = useQueryClient();
  return useTournamentMutation(async ({ id, index }: { id: number; index: number }) => {
    const response = await apiClient.delete(`/admin/cricket/tournaments/${id}/teams/${index}`);
    // Later teams' matches have moved up an index.
    queryClient.invalidateQueries({ queryKey: ["cricket-matches"] });
    return response;
  });
}

export function useDeleteCricketTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/cricket/tournaments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cricket-tournaments"] });
      // Its matches are deleted with it.
      queryClient.invalidateQueries({ queryKey: ["cricket-matches"] });
    },
  });
}
