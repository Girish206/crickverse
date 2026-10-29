import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getAdminToken } from "../../client";
import type {
  ApiEnvelope,
  CricketMatch,
  CricketMe,
  CricketPlayer,
  CricketPlayerRole,
  CricketBattingStyle,
  CricketBowlingStyle,
  CricketTournament,
} from "../../types";

export interface CricketPlayerInput {
  name: string;
  role: CricketPlayerRole | null;
  mobile: string;
  battingStyle?: CricketBattingStyle | null;
  bowlingStyle?: CricketBowlingStyle | null;
}

// The signed-in user's player record, tournaments and matches.
// Home, My Matches and My Teams read their matches from here; back in the
// app, it catches up at once.
export function useCricketMe() {
  return useQuery({
    queryKey: ["cricket-me"],
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CricketMe>>("/admin/cricket/me");
      return data.data;
    },
  });
}

export function useCricketPlayers() {
  return useQuery({
    queryKey: ["cricket-players"],
    // Signed out (a shared public match) it would answer 401 and send them
    // to sign in; the public page puts the match's own players here instead.
    enabled: getAdminToken() !== null,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CricketPlayer[]>>("/admin/cricket/players");
      return data.data;
    },
  });
}

// Any player's matches and tournaments, for their profile.
export function useCricketPlayerCareer(id: number) {
  return useQuery({
    // Under "cricket-matches" so scoring a match refreshes it.
    queryKey: ["cricket-matches", "player-career", id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<{ matches: CricketMatch[]; tournaments: CricketTournament[] }>>(
        `/admin/cricket/players/${id}/career`,
      );
      return data.data;
    },
  });
}

// The player with this mobile (null = a new number), e.g. a one-off match's
// captain.
export async function lookupCricketPlayer(mobile: string) {
  const { data } = await apiClient.get<ApiEnvelope<CricketPlayer | null>>("/admin/cricket/players/lookup", {
    params: { mobile },
  });
  return data.data;
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["cricket-players"] });
  queryClient.invalidateQueries({ queryKey: ["cricket-me"] });
}

export function useCreateCricketPlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CricketPlayerInput) => {
      const { data } = await apiClient.post<ApiEnvelope<CricketPlayer>>("/admin/cricket/players", input);
      return data.data;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

// Adds many players from a pasted list; anyone whose name or mobile is
// already taken is skipped.
export function useCreateCricketPlayersBulk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (players: { name: string; mobile: string }[]) => {
      const { data } = await apiClient.post<
        ApiEnvelope<{ added: number; skipped: number; skippedNames: string[] }>
      >("/admin/cricket/players/bulk", { players });
      return data.data;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useUpdateCricketPlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: CricketPlayerInput & { id: number }) => {
      const { data } = await apiClient.put<ApiEnvelope<CricketPlayer>>(`/admin/cricket/players/${id}`, input);
      return data.data;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

// A file replaces the photo; null removes it.
export function useSetCricketPlayerPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, photo }: { id: number; photo: File | null }) => {
      const form = new FormData();
      if (photo) form.append("photo", photo);
      else form.append("removePhoto", "true");
      const { data } = await apiClient.put<ApiEnvelope<CricketPlayer>>(`/admin/cricket/players/${id}/photo`, form);
      return data.data;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteCricketPlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/cricket/players/${id}`);
    },
    onSuccess: () => invalidate(queryClient),
  });
}

// Lets the player sign in with their mobile number (password required the
// first time; leave it out to keep the current one).
export function useGrantCricketPlayerLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, password }: { id: number; password?: string }) => {
      await apiClient.put(`/admin/cricket/players/${id}/login`, { password });
    },
    onSuccess: () => {
      invalidate(queryClient);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

// One person added twice (super admins): everything of `id` moves to
// `intoId`, and `id` is deleted.
export function useMergeCricketPlayers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, intoId }: { id: number; intoId: number }) =>
      (await apiClient.post<ApiEnvelope<CricketPlayer>>(`/admin/cricket/players/${id}/merge`, { intoId })).data.data,
    onSuccess: () => {
      invalidate(queryClient);
      queryClient.invalidateQueries({ queryKey: ["cricket-matches"] });
      queryClient.invalidateQueries({ queryKey: ["cricket-tournaments"] });
    },
  });
}

// The six digits a player enters to claim the record someone added for
// them (made on the first ask). Only whoever added them may get it.
export interface PlayerInviteCode {
  playerId: number;
  name: string;
  code: string;
}

export function usePlayerInvite() {
  return useMutation({
    mutationFn: async (id: number) =>
      (await apiClient.get<ApiEnvelope<PlayerInviteCode>>(`/admin/cricket/players/${id}/invite`)).data.data,
  });
}

// Forgot password (super admins): clears it and returns a fresh invite code.
export function useResetPlayerLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (await apiClient.post<ApiEnvelope<PlayerInviteCode>>(`/admin/cricket/players/${id}/login/reset`)).data.data,
    onSuccess: () => invalidate(queryClient),
  });
}

export function useRevokeCricketPlayerLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/cricket/players/${id}/login`);
    },
    onSuccess: () => {
      invalidate(queryClient);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

export interface CricketProfileInput {
  name: string;
  mobile: string;
  role: CricketPlayerRole | null;
  // Both, to change the password.
  currentPassword?: string;
  newPassword?: string;
}

// The signed-in user's own name, mobile, role and password. Returns a fresh
// token (the name and mobile ride in it) for AdminAuthContext.applyToken.
export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CricketProfileInput) => {
      const { data } = await apiClient.put<ApiEnvelope<{ token: string }>>("/admin/cricket/me/profile", input);
      return data.data.token;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

// The signed-in player's own photo; null removes it.
export function useSetMyPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (photo: File | null) => {
      const form = new FormData();
      if (photo) form.append("photo", photo);
      else form.append("removePhoto", "true");
      const { data } = await apiClient.put<ApiEnvelope<CricketPlayer>>("/admin/cricket/me/photo", form);
      return data.data;
    },
    onSuccess: () => invalidate(queryClient),
  });
}
