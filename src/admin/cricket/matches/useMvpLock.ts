import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../api/client";
import type { ApiEnvelope, CricketMatch } from "../../../api/types";
import { buildMvpLock, isFinished, wasPlayed } from "../stats";

// Saves the MVP points of any finished match here that hasn't got them yet, so
// changing the rules later leaves it alone. Only the rules in this app can work
// them out, so it's done by someone who can manage the match when they open it.
// A failure is left for the next visit: the points are worked out as usual
// until then. Scoring changes clear the lock on the server, and it's saved again.
export function useMvpLock(matches: CricketMatch[] | undefined, canManage: boolean) {
  const queryClient = useQueryClient();
  // Each copy of a match is tried once.
  const tried = useRef(new Set<string>());

  useEffect(() => {
    if (!canManage || !matches) return;
    const due = matches.filter((match) => {
      const key = `${match.id}:${match.version ?? 0}`;
      if (!isFinished(match) || !wasPlayed(match) || match.mvpLock || tried.current.has(key)) return false;
      tried.current.add(key);
      return true;
    });
    if (due.length === 0) return;
    void (async () => {
      let locked = 0;
      for (const match of due) {
        try {
          const { data } = await apiClient.put<ApiEnvelope<CricketMatch>>(`/admin/cricket/matches/${match.id}/mvp-lock`, {
            version: match.version ?? 0,
            lock: buildMvpLock(match),
          });
          queryClient.setQueryData(["cricket-matches", match.id], data.data);
          locked += 1;
        } catch {
          // Tried again on the next visit.
        }
      }
      if (locked > 0) queryClient.invalidateQueries({ queryKey: ["cricket-matches", "list"] });
    })();
  }, [matches, canManage, queryClient]);
}
