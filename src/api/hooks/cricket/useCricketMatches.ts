import { useEffect, useState, useSyncExternalStore } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../client";
import { isAxiosError } from "axios";
import { followLive } from "./followLive";
import { toast } from "sonner";
import { messageFor, UserFacingError } from "../../mutationErrors";
import { clearQueue, dequeue, enqueue, isSaved, onNudge, readQueue, useBallQueue, type QueuedItem } from "./ballQueue";
import type {
  ApiEnvelope,
  CricketBall,
  CricketBallType,
  CricketLastLeaders,
  CricketFieldingLapse,
  CricketMatch,
  CricketMatchSquad,
  CricketMatchStage,
  CricketMatchType,
  CricketPitchType,
  CricketPlaces,
  CricketResultMethod,
  CricketTeamRoles,
  CricketWicketType,
  NewTeamPlayer,
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
  // Playing conditions; left out keeps the match's own.
  ballsPerOver?: number | null;
  bowlerOverLimit?: number | null;
  lastManStands?: boolean | null;
  freeHit?: boolean | null;
  powerplayOvers?: number | null;
  isPublic?: boolean | null;
  // A live chase's revised target (rain); null clears it.
  revisedTarget?: number | null;
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

// Matches of multiple tournaments in parallel (e.g. for player's home feed).
export function useTournamentsMatches(tournamentIds: number[], { enabled = true } = {}) {
  return useQueries({
    queries: tournamentIds.map((id) => ({
      queryKey: ["cricket-matches", "list", id],
      enabled,
      refetchOnWindowFocus: true,
      refetchInterval: (query: { state: { data?: CricketMatch[] } }) => {
        const hasLive = query.state.data?.some((m) => m.status === "live");
        return hasLive ? 10_000 : 60_000;
      },
      queryFn: async () => {
        const { data } = await apiClient.get<ApiEnvelope<CricketMatch[]>>("/admin/cricket/matches", {
          params: { tournamentId: id },
        });
        return data.data;
      },
    })),
  });
}

type CricketInningsData = CricketMatch["innings"][number];
// GET /matches/:id/live: the match with only the balls from `fromBall` on.
type LiveMatch = Omit<CricketMatch, "innings"> & { innings: (CricketInningsData & { fromBall: number })[] };

// The match, loaded in full once (and again on coming back to the app).
// While it's live it follows along (followLive): each change arrives within
// about a second as the details plus the balls after the ones it has, added
// to what it holds, so viewers see every ball without re-downloading the
// match.
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
    let held: CricketMatch | undefined;
    return followLive<LiveMatch>({
      url: `/admin/cricket/matches/${id}/live`,
      ask: () => {
        // Not while the scorer is saving a ball (their own save brings the
        // new state).
        held = queryClient.isMutating() > 0 ? undefined : queryClient.getQueryData<CricketMatch>(matchKey);
        return held && { known: held.innings.map((inn) => inn.balls.length).join(","), since: held.updatedAt };
      },
      apply: (data) => {
        // Something newer arrived meanwhile (a save): keep that.
        if (!held || queryClient.getQueryData(matchKey) !== held || queryClient.isMutating() > 0) return;
        const asked = held;
        const next: CricketMatch = {
          ...data,
          innings: data.innings.map(({ fromBall, balls, ...inn }, i) => ({
            ...inn,
            balls: [...(asked.innings[i]?.balls ?? []).slice(0, fromBall), ...balls],
          })),
        };
        queryClient.setQueryData(matchKey, next);
        // It just finished: refresh the lists and Home to show the result.
        if (next.status !== "live") {
          queryClient.invalidateQueries({ queryKey: ["cricket-matches", "list"] });
          queryClient.invalidateQueries({ queryKey: ["cricket-me"] });
        }
      },
    });
  }, [id, live, queryClient]);

  return query;
}

// Every match action returns the updated match: seed its cache entry so the
// scorer sees the new state at once, and refresh the lists.
// Scoring actions (`scoring`) wait while balls scored offline are still to
// be sent: the API would apply them to the score without those balls.
function useMatchMutation<TVars>(
  request: (vars: TVars) => Promise<{ data: ApiEnvelope<CricketMatch> }>,
  { scoring = false } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVars) => {
      if (scoring) {
        const id = typeof vars === "number" ? vars : (vars as { id: number }).id;
        const waiting = readQueue(id).length;
        if (waiting) throw new QueuedBallsError(waiting);
      }
      return (await request(vars)).data.data;
    },
    onSuccess: (match) => {
      queryClient.setQueryData(["cricket-matches", match.id], match);
      queryClient.invalidateQueries({ queryKey: ["cricket-matches", "list"] });
      queryClient.invalidateQueries({ queryKey: ["cricket-me"] });
    },
  });
}

const url = (id: number, path = "") => `/admin/cricket/matches/${id}${path}`;

// A scoring action tried while balls are waiting to be sent (see ballQueue).
export class QueuedBallsError extends UserFacingError {
  constructor(waiting: number) {
    super(
      `${waiting} ${waiting === 1 ? "ball is" : "balls are"} still waiting to send — this can be done once ${waiting === 1 ? "it's" : "they're"} saved`,
    );
  }
}

export function useCreateCricketMatch() {
  return useMatchMutation((
    input: CricketMatchInput & {
      tournamentId: number | null;
      // A standalone match's captains (who join their side's squad).
      captainIds?: [number | null, number | null];
      // Each side's squad and leaders, if picked here; null leaves a side
      // with what its team starts with.
      squads?: [CricketMatchSquad | null, CricketMatchSquad | null];
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

// Each side's captain and keeper from its last match, for setting this one up.
export function useLastLeaders(id: number) {
  return useQuery({
    queryKey: ["cricket-matches", "last-leaders", id],
    queryFn: async () =>
      (await apiClient.get<ApiEnvelope<[CricketLastLeaders, CricketLastLeaders]>>(url(id, "/last-leaders"))).data.data,
  });
}

export function useSetCricketCurrentPlayers() {
  return useMatchMutation(
    ({
      id,
      ...input
    }: {
      id: number;
      strikerId?: number | null;
      nonStrikerId?: number | null;
      bowlerId?: number | null;
      // The batter being changed was a wrong pick: their balls move to the new one.
      wrongBatter?: boolean;
    }) =>
      apiClient.put(url(id, "/current"), input),
    { scoring: true },
  );
}

// "The bowler is running in": live pages show it until the ball is scored.
export function useMarkCricketBowling() {
  return useMatchMutation(({ id }: { id: number }) => apiClient.post(url(id, "/bowling")), { scoring: true });
}

// The API refused a score change made on an older copy of the match.
export const isStaleScore = (error: unknown) =>
  isAxiosError(error) && error.response?.status === 409 && error.response.data?.error?.code === "STALE_SCORE";

// No answer at all (offline, timed out), or one worth asking again (the
// server busy or failing): a waiting ball keeps waiting.
const isTransient = (error: unknown) =>
  isAxiosError(error) && (!error.response || error.response.status >= 500 || error.response.status === 429);

// Sends a ball, online with nothing waiting (LiveScorer queues it
// otherwise; see ballQueue). The innings and ball count it was scored at go
// with it, so the API records it at most once — a ball it already has
// comes back as a 409. If it doesn't get through it waits in the queue, to
// go again once the connection's back.
export function useAddCricketBall() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: "always",
    // A stale score refreshes itself; one that didn't get through waits in
    // the queue, which the scorer's banner shows.
    meta: { skipGlobalErrorFor: (error: unknown) => isStaleScore(error) || isTransient(error) },
    mutationFn: async ({ id, ...ball }: CricketBallInput & { id: number }) => {
      const waiting = readQueue(id).length;
      if (waiting) throw new QueuedBallsError(waiting);
      const held = queryClient.getQueryData<CricketMatch>(["cricket-matches", id]);
      const send: QueuedItem = {
        kind: "ball",
        ball,
        inningsIndex: Math.max(0, (held?.innings.length ?? 1) - 1),
        expectedBalls: held?.innings[held.innings.length - 1]?.balls.length ?? 0,
      };
      try {
        const { data } = await apiClient.post<ApiEnvelope<CricketMatch>>(url(id, "/balls"), {
          ...send.ball,
          inningsIndex: send.inningsIndex,
          expectedBalls: send.expectedBalls,
        });
        return data.data;
      } catch (error) {
        if (isTransient(error)) enqueue(id, send);
        throw error;
      }
    },
    onSuccess: (match) => {
      queryClient.setQueryData(["cricket-matches", match.id], match);
      queryClient.invalidateQueries({ queryKey: ["cricket-matches", "list"] });
      queryClient.invalidateQueries({ queryKey: ["cricket-me"] });
    },
    onError: (error, vars) => {
      if (isStaleScore(error)) queryClient.invalidateQueries({ queryKey: ["cricket-matches", vars.id] });
    },
  });
}

// Sends the waiting balls (and bowlers) for a live match, one at a time in
// order, whenever there's a connection: on opening, on coming back online,
// every few seconds after a failure, or on the scorer's Retry
// (nudgeBallQueue). Ones the server already has are dropped. If the API
// turns one down (the score moved on, on another device), the rest were
// scored on top of it, so they're dropped too and the scorer is told.
const QUEUE_RETRY_MS = 5_000;

const subscribeOnline = (fn: () => void) => {
  window.addEventListener("online", fn);
  window.addEventListener("offline", fn);
  return () => {
    window.removeEventListener("online", fn);
    window.removeEventListener("offline", fn);
  };
};

export function useSendBallQueue(match: CricketMatch | undefined, enabled: boolean) {
  const queryClient = useQueryClient();
  const id = match?.id ?? 0;
  const items = useBallQueue(id);
  const [paused, setPaused] = useState(false);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const { isPending, mutate } = useMutation({
    networkMode: "always",
    meta: { skipGlobalError: true },
    mutationFn: async (item: QueuedItem) => {
      if (item.kind === "bowler") {
        // /current has no stale check of its own: make sure the server's
        // copy is where the bowler was picked (end of that over, no bowler).
        const held = queryClient.getQueryData<CricketMatch>(["cricket-matches", id]);
        const innings = held?.innings[item.inningsIndex];
        if (
          !held ||
          held.innings.length - 1 !== item.inningsIndex ||
          innings?.balls.length !== item.expectedBalls ||
          innings.bowlerId !== null
        ) {
          throw new Error("the score changed on another device");
        }
      }
      const { data } =
        item.kind === "ball"
          ? await apiClient.post<ApiEnvelope<CricketMatch>>(url(id, "/balls"), {
              ...item.ball,
              inningsIndex: item.inningsIndex,
              expectedBalls: item.expectedBalls,
            })
          : await apiClient.put<ApiEnvelope<CricketMatch>>(url(id, "/current"), { bowlerId: item.bowlerId });
      // The saved match first, then off the queue, so the page never shows
      // the ball missing in between.
      queryClient.setQueryData(["cricket-matches", id], data.data);
      dequeue(id, item);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cricket-matches", "list"] });
      queryClient.invalidateQueries({ queryKey: ["cricket-me"] });
    },
    onError: (error) => {
      if (isTransient(error)) {
        setPaused(true);
        return;
      }
      const lost = readQueue(id).length;
      clearQueue(id);
      queryClient.invalidateQueries({ queryKey: ["cricket-matches", id] });
      const why = isAxiosError(error) ? messageFor(error) : error instanceof Error ? error.message : messageFor(error);
      toast.error(`${lost} ${lost === 1 ? "ball" : "balls"} couldn't be saved: ${why}`, { duration: 10_000 });
    },
  });

  // After a failure: try again shortly, at once when back online or on Retry.
  useEffect(() => {
    if (!paused) return;
    const resume = () => setPaused(false);
    const timer = setTimeout(resume, QUEUE_RETRY_MS);
    const stopNudge = onNudge(resume);
    return () => {
      clearTimeout(timer);
      stopNudge();
    };
  }, [paused]);

  useEffect(() => {
    if (!enabled || !match || items.length === 0) return;
    // The match was finished (or abandoned) elsewhere: these can't go now.
    if (match.status !== "live" && match.status !== "scheduled") {
      clearQueue(id);
      toast.error(`${items.length} ${items.length === 1 ? "ball wasn't" : "balls weren't"} saved: the match has ended`, { duration: 10_000 });
      return;
    }
    if (!online || match.status !== "live" || isPending || paused) return;
    const saved = items.filter((item) => isSaved(match, item));
    if (saved.length) {
      saved.forEach((item) => dequeue(id, item));
      return;
    }
    mutate(items[0]);
  }, [enabled, online, match, isPending, paused, items, id, mutate]);

  return { sending: isPending, paused };
}

export function useUndoCricketBall() {
  return useMatchMutation((id: number) => apiClient.delete(url(id, "/balls/last")), { scoring: true });
}

export function useEndCricketInnings() {
  return useMatchMutation((id: number) => apiClient.post(url(id, "/end-innings")), { scoring: true });
}

// Rain: the batting side's overs from now on, or null for no more play in
// this innings (see recordInterruption on the API).
export function useCricketInterruption() {
  return useMatchMutation(({ id, overs }: { id: number; overs: number | null }) =>
    apiClient.post(url(id, "/interruption"), { overs }),
    { scoring: true },
  );
}

export function useAbandonCricketMatch() {
  return useMatchMutation((id: number) => apiClient.post(url(id, "/abandon")), { scoring: true });
}

// A result the organiser enters by hand: a super over, walkover or forfeit,
// rain (DLS, or no result). `margin` is e.g. "by 12 runs".
export interface CricketResultInput {
  outcome: "win" | "tie" | "no-result";
  winner: number | null;
  method: CricketResultMethod;
  margin?: string | null;
}

export function useDeclareCricketResult() {
  return useMatchMutation(
    ({ id, ...input }: CricketResultInput & { id: number }) => apiClient.post(url(id, "/result"), input),
    { scoring: true },
  );
}

// Organisers: a finished or abandoned match goes back to live (or not
// started, if nothing was bowled).
export function useReopenCricketMatch() {
  return useMatchMutation((id: number) => apiClient.post(url(id, "/reopen")));
}

// Corrects an earlier ball: its fielders, the kind of a bowler's
// dismissal, its runs, boundary or not, or the over's bowler.
export interface CricketBallEdit {
  runs?: number;
  fielderId?: number | null;
  secondFielderId?: number | null;
  wicketType?: CricketWicketType;
  boundary?: boolean | null;
  bowlerId?: number;
  excellentCatch?: boolean;
  // A dropped catch or misfield on this ball; null takes it off.
  fieldingLapse?: { type: CricketFieldingLapse; fielderId: number } | null;
  // The other batter faced this ball.
  swapStrike?: boolean;
  // Whether the balls after it move to the other batter to match ("auto"),
  // or stay as recorded for the scorer to fix one by one ("manual").
  strikeAfter?: "auto" | "manual";
}

export function useEditCricketBall() {
  return useMatchMutation(
    ({ id, inningsIndex, ballIndex, ...edit }: CricketBallEdit & { id: number; inningsIndex: number; ballIndex: number }) =>
      apiClient.put(url(id, `/balls/${inningsIndex}/${ballIndex}`), edit),
    { scoring: true },
  );
}

// A late arrival joins a side mid-match, or a substitute replaces someone
// who hasn't batted or bowled.
export function useChangeCricketSquad() {
  return useMatchMutation(
    ({ id, ...input }: { id: number; team: number; addId: number; replaceId: number | null }) =>
      apiClient.post(url(id, "/squad"), input),
    { scoring: true },
  );
}

// Takes someone who hasn't played out of a live match's side.
export function useRemoveCricketPlayer() {
  return useMatchMutation(
    ({ id, playerId }: { id: number; playerId: number }) => apiClient.delete(url(id, `/squad/${playerId}`)),
    { scoring: true },
  );
}

// Sends someone who hasn't played to the other side of a live match.
export function useMoveCricketPlayer() {
  return useMatchMutation(
    ({ id, playerId }: { id: number; playerId: number }) => apiClient.post(url(id, `/squad/${playerId}/move`)),
    { scoring: true },
  );
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

// A friendly team's captain adds players (by mobile, new numbers with a
// name; or scanned, by id) to the team's side in all its upcoming matches.
export function useAddFriendlyTeamPlayers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { teamName: string; teamKey?: string; players: NewTeamPlayer[] }) => {
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

// A team's captain and keeper from its last match, by its key (teamKeyOf),
// to start a new match's squad with.
export function useTeamLastLeaders(teamKey: string | null) {
  return useQuery({
    enabled: teamKey !== null,
    queryKey: ["cricket-matches", "team-last-leaders", teamKey],
    queryFn: async () =>
      (
        await apiClient.get<ApiEnvelope<CricketLastLeaders>>("/admin/cricket/teams/last-leaders", {
          params: { key: teamKey },
        })
      ).data.data,
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

// Who made a match, for its officials (signed in only).
export function useMatchCreator(id: number, enabled: boolean) {
  return useQuery({
    queryKey: ["cricket-matches", id, "creator"],
    enabled,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<{ name: string | null }>>(`/admin/cricket/matches/${id}/creator`);
      return data.data;
    },
  });
}
