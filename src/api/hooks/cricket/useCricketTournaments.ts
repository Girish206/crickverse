import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../client";
import type {
  ApiEnvelope,
  CricketBallType,
  CricketCategory,
  CricketFormat,
  CricketMatchStage,
  CricketMatchType,
  CricketPitchType,
  CricketPhaseGroup,
  CricketPlayer,
  CricketTeamRoles,
  CricketTournament,
  NewTeamPlayer,
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
  // Default playing conditions for its matches; left out keeps them.
  ballsPerOver?: number | null;
  bowlerOverLimit?: number | null;
  lastManStands?: boolean | null;
  freeHit?: boolean | null;
  // Left out keeps them as they are.
  finished?: boolean;
  isPublic?: boolean;
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
function useTournamentMutation<TVars>(
  request: (vars: TVars) => Promise<{ data: ApiEnvelope<CricketTournament> }>,
  meta?: Record<string, unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    meta,
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

// Players who score every match in the tournament.
export function useSetCricketTournamentScorers() {
  return useTournamentMutation(({ id, playerIds }: { id: number; playerIds: number[] }) =>
    apiClient.put(`/admin/cricket/tournaments/${id}/scorers`, { playerIds }),
  );
}

// Co-organisers: players who manage the tournament like its creator.
export function useSetCricketTournamentOrganisers() {
  return useTournamentMutation(({ id, playerIds }: { id: number; playerIds: number[] }) =>
    apiClient.put(`/admin/cricket/tournaments/${id}/organisers`, { playerIds }),
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
  // Left out = keep the team's current ones.
  captainId?: number | null;
  viceCaptainId?: number | null;
  keeperId?: number | null;
  // Built by hand (left out = generated, or unchanged when editing).
  manual?: boolean;
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

// The player with this mobile (null = a new number), for the team's captain
// or a super admin adding players to it.
export async function lookupCricketTeamPlayer(id: number, index: number, mobile: string) {
  const { data } = await apiClient.get<ApiEnvelope<CricketPlayer | null>>(
    `/admin/cricket/tournaments/${id}/teams/${index}/lookup`,
    { params: { mobile } },
  );
  return data.data;
}

// Adds players to a team by mobile (or a known player by id, from their QR
// code); new numbers (with a name) become new players. Open to the team's
// captain as well as super admins.
export function useAddCricketTeamPlayers() {
  const queryClient = useQueryClient();
  return useTournamentMutation(
    async ({ id, index, players }: { id: number; index: number; players: NewTeamPlayer[] }) => {
      const response = await apiClient.post(`/admin/cricket/tournaments/${id}/teams/${index}/players`, { players });
      queryClient.invalidateQueries({ queryKey: ["cricket-players"] });
      return response;
    },
  );
}

// A team's captain, vice-captain and wicket-keeper (null = none).
export function useSetCricketTeamRoles() {
  return useTournamentMutation(({ id, index, ...roles }: CricketTeamRoles & { id: number; index: number }) =>
    apiClient.put(`/admin/cricket/tournaments/${id}/teams/${index}/roles`, roles),
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

// One match a format schedules: two teams of a group, or a bracket slot.
export interface CricketFixtureInput {
  phaseId: string;
  teamAIndex: number;
  teamBIndex: number;
  scheduledAt: string | null;
  venue: string | null;
  stage: CricketMatchStage;
  group: string | null;
  slot: string | null;
}

// Format changes also create (or clear) matches.
function useFormatMutation<TVars>(
  request: (vars: TVars) => Promise<{ data: ApiEnvelope<CricketTournament> }>,
  meta?: Record<string, unknown>,
) {
  const queryClient = useQueryClient();
  return useTournamentMutation(async (vars: TVars) => {
    const response = await request(vars);
    queryClient.invalidateQueries({ queryKey: ["cricket-matches"] });
    return response;
  }, meta);
}

// Sets the format with its first fixtures, replacing the old format's
// unplayed ones.
export function useSetCricketFormat() {
  return useFormatMutation(({ id, format, fixtures }: { id: number; format: CricketFormat; fixtures: CricketFixtureInput[] }) =>
    apiClient.put(`/admin/cricket/tournaments/${id}/format`, { format, fixtures }),
  );
}

// Starts a later phase (its groups, once the qualifiers are known) or
// schedules the next bracket match. `quiet`: done in the background, so a
// failure (say another device scheduled it first) isn't toasted.
export function useAddCricketFixtures({ quiet = false } = {}) {
  return useFormatMutation(
    ({ id, ...input }: { id: number; phaseId: string; groups?: CricketPhaseGroup[]; fixtures: CricketFixtureInput[] }) =>
      apiClient.post(`/admin/cricket/tournaments/${id}/fixtures`, input),
    quiet ? { skipGlobalError: true } : undefined,
  );
}

export function useClearCricketFormat() {
  return useFormatMutation((id: number) => apiClient.delete(`/admin/cricket/tournaments/${id}/format`));
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
