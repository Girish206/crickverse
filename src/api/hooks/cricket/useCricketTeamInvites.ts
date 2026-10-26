import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../client";
import type { ApiEnvelope, CricketTeamInvite } from "../../types";

// Team join links: a team's managers share /join/<code> (or its QR code),
// and whoever opens it signed in joins the team.

// Which team: a saved team, or one of a tournament's.
export type InviteTeam = { savedTeamId: number } | { tournamentId: number; teamIndex: number };

const inviteUrl = (team: InviteTeam) =>
  "savedTeamId" in team
    ? `/admin/cricket/saved-teams/${team.savedTeamId}/invite`
    : `/admin/cricket/tournaments/${team.tournamentId}/teams/${team.teamIndex}/invite`;

const inviteKey = (team: InviteTeam) => ["cricket-team-invite", inviteUrl(team)];

// A link works for a week (expiresAt); null on ones made before that.
export type InviteCode = { code: string; expiresAt: string | null };

// The team's code, made the first time a manager asks for it (or once the
// last one expired).
export function useTeamInviteCode(team: InviteTeam) {
  return useQuery({
    queryKey: inviteKey(team),
    queryFn: async () => (await apiClient.get<ApiEnvelope<InviteCode>>(inviteUrl(team))).data.data,
  });
}

// A new code: the old link (and QR code) stops working.
export function useResetTeamInviteCode(team: InviteTeam) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await apiClient.post<ApiEnvelope<InviteCode>>(inviteUrl(team))).data.data,
    onSuccess: (code) => queryClient.setQueryData(inviteKey(team), code),
  });
}

// The signed-in player's QR code token. It lasts 15 minutes, so it's
// fetched afresh every 10 while My QR code is open.
export function useMyQr() {
  return useQuery({
    queryKey: ["cricket-my-qr"],
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 10 * 60_000,
    queryFn: async () =>
      (await apiClient.get<ApiEnvelope<{ playerId: number; token: string; expiresAt: string }>>("/admin/cricket/me/qr")).data
        .data,
  });
}

export async function fetchTeamInvite(code: string) {
  return (await apiClient.get<ApiEnvelope<CricketTeamInvite>>(`/admin/cricket/join/${encodeURIComponent(code)}`)).data
    .data;
}

export function useTeamInvite(code: string) {
  return useQuery({
    queryKey: ["cricket-join", code],
    retry: false,
    queryFn: () => fetchTeamInvite(code),
  });
}

// Joins the link's team; the team's page and My Teams pick them up.
export function useJoinTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) =>
      (await apiClient.post<ApiEnvelope<CricketTeamInvite>>(`/admin/cricket/join/${encodeURIComponent(code)}`)).data.data,
    onSuccess: (invite) => {
      queryClient.setQueryData(["cricket-join", invite.code], invite);
      queryClient.invalidateQueries({ queryKey: ["cricket-me"] });
      if (invite.kind === "saved") queryClient.invalidateQueries({ queryKey: ["cricket-saved-team", invite.savedTeamId] });
      else queryClient.invalidateQueries({ queryKey: ["cricket-tournaments", invite.tournamentId] });
    },
  });
}
