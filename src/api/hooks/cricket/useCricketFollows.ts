import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../client";
import type { ApiEnvelope, CricketFollowCounts, CricketFollowTarget, CricketMyFollows } from "../../types";

const targetParams = (target: CricketFollowTarget) => ({
  kind: target.kind,
  targetId: target.targetId,
  ...(target.teamIndex !== null ? { teamIndex: target.teamIndex } : {}),
});

export const sameTarget = (a: CricketFollowTarget, b: CricketFollowTarget) =>
  a.kind === b.kind && a.targetId === b.targetId && a.teamIndex === b.teamIndex;

// The signed-in player's follows.
export function useMyFollows() {
  return useQuery({
    queryKey: ["cricket-follows"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CricketMyFollows>>("/admin/cricket/follows");
      return data.data;
    },
  });
}

export function useFollowCounts(target: CricketFollowTarget, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["cricket-follow-counts", target.kind, target.targetId, target.teamIndex],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<CricketFollowCounts>>("/admin/cricket/follows/counts", {
        params: targetParams(target),
      });
      return data.data;
    },
  });
}

// Follows (follow: true) or unfollows the target.
export function useSetFollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ target, follow }: { target: CricketFollowTarget; follow: boolean }) => {
      const { data } = follow
        ? await apiClient.post<ApiEnvelope<CricketMyFollows>>("/admin/cricket/follows", targetParams(target))
        : await apiClient.delete<ApiEnvelope<CricketMyFollows>>("/admin/cricket/follows", {
            params: targetParams(target),
          });
      return data.data;
    },
    onSuccess: (follows) => {
      queryClient.setQueryData(["cricket-follows"], follows);
      queryClient.invalidateQueries({ queryKey: ["cricket-follow-counts"] });
      queryClient.invalidateQueries({ queryKey: ["cricket-me"] });
    },
  });
}
