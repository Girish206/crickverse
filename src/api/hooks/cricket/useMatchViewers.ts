import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../client";
import type { ApiEnvelope, CricketMatchViewers } from "../../types";

const VIEWER_ID_KEY = "cricdesk_viewer_id";
// A page open on a live match checks in this often (the API counts someone as
// watching for a little over two of these; see cricket-viewers.ts).
const CHECK_IN_MS = 30_000;

const newViewerId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

let sessionViewerId: string | null = null;

// A signed-out visitor's random id for this device, kept so they count once.
function viewerId() {
  try {
    const kept = localStorage.getItem(VIEWER_ID_KEY);
    if (kept) return kept;
    const made = sessionViewerId ?? newViewerId();
    localStorage.setItem(VIEWER_ID_KEY, made);
    return made;
  } catch {
    sessionViewerId ??= newViewerId();
    return sessionViewerId;
  }
}

// Counts this viewer on the match they have open, and brings back its viewer
// counts. A query rather than a mutation: it repeats on its own, stops while
// the page is hidden, and doesn't hold up the live score (useCricketMatch
// waits while any mutation is running).
export function useMatchViewers(id: number, { live, isPublic = false }: { live: boolean; isPublic?: boolean }) {
  return useQuery({
    queryKey: ["cricket-match-viewers", id],
    enabled: Number.isFinite(id) && id > 0,
    refetchOnWindowFocus: true,
    refetchInterval: live ? CHECK_IN_MS : false,
    retry: false,
    queryFn: async () => {
      const { data } = isPublic
        ? await apiClient.post<ApiEnvelope<CricketMatchViewers>>(`/admin/cricket/public/matches/${id}/view`, { viewerId: viewerId() })
        : await apiClient.post<ApiEnvelope<CricketMatchViewers>>(`/admin/cricket/matches/${id}/view`);
      return data.data;
    },
  });
}
