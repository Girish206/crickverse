import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../client";
import type { ApiEnvelope, CricketSavedTeam, CricketTeamRoles, NewTeamPlayer } from "../../types";

// Teams made outside any tournament (CricketSavedTeam). The signed-in
// player's own come with /me (savedTeams); one opened by link loads here.

const url = (id?: number, path = "") => `/admin/cricket/saved-teams${id === undefined ? "" : `/${id}`}${path}`;

export function useCricketSavedTeam(id: number) {
  return useQuery({
    queryKey: ["cricket-saved-team", id],
    refetchOnWindowFocus: true,
    queryFn: async () => (await apiClient.get<ApiEnvelope<CricketSavedTeam>>(url(id))).data.data,
  });
}

// Every change returns the team: seed its page and refresh My Teams.
function useSavedTeamMutation<TVars>(request: (vars: TVars) => Promise<{ data: ApiEnvelope<CricketSavedTeam> }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVars) => (await request(vars)).data.data,
    onSuccess: (team) => {
      queryClient.setQueryData(["cricket-saved-team", team.id], team);
      queryClient.invalidateQueries({ queryKey: ["cricket-me"] });
    },
  });
}

export function useCreateCricketSavedTeam() {
  return useSavedTeamMutation((name: string) => apiClient.post(url(), { name }));
}

export function useUpdateCricketSavedTeam() {
  return useSavedTeamMutation(({ id, ...input }: { id: number; name?: string; playerIds?: number[] }) =>
    apiClient.put(url(id), input),
  );
}

export function useSetCricketSavedTeamRoles() {
  return useSavedTeamMutation(({ id, ...roles }: CricketTeamRoles & { id: number }) => apiClient.put(url(id, "/roles"), roles));
}

// New numbers (with a name) become new players; a player picked from their
// QR code comes by id.
export function useAddCricketSavedTeamPlayers() {
  const queryClient = useQueryClient();
  return useSavedTeamMutation(async ({ id, players }: { id: number; players: NewTeamPlayer[] }) => {
    const response = await apiClient.post(url(id, "/players"), { players });
    queryClient.invalidateQueries({ queryKey: ["cricket-players"] });
    return response;
  });
}

export function useDeleteCricketSavedTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(url(id));
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: ["cricket-saved-team", id] });
      queryClient.invalidateQueries({ queryKey: ["cricket-me"] });
    },
  });
}
