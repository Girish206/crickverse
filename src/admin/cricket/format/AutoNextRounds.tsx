import { useEffect } from "react";
import { toast } from "sonner";
import { useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import { useAddCricketFixtures, useCricketTournament } from "../../../api/hooks/cricket/useCricketTournaments";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { canManageTournament } from "../canManage";
import { makeResolver, nextPlayingDate, nextRounds, planSchedule } from "./formatEngine";
import { defaultSchedule } from "./ScheduleFields";

// Rounds already sent this session, so a failure (another device got there
// first, say) isn't retried on every refresh.
const attempted = new Set<string>();

const localDate = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const dayText = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : null;

// Schedules the next round by itself as soon as its teams are known: the
// playoffs (or super league) when the league or groups finish, the next
// bracket match when a knockout result comes in. They go on the next
// playing day after the last scheduled match, as the format's saved
// schedule says (days, start time, gap, matches a day); the organiser can
// reschedule any of them. Runs for whoever manages the tournament on the
// tournament and match pages; renders nothing.
export function AutoNextRounds({ tournamentId }: { tournamentId: number }) {
  const { admin } = useAdminAuth();
  const { data: tournament } = useCricketTournament(tournamentId, tournamentId > 0);
  const canManage = canManageTournament(admin, tournament);
  const format = tournament?.format;
  const { data: matches } = useCricketMatches(tournamentId, { enabled: canManage && Boolean(format) });
  const addFixtures = useAddCricketFixtures({ quiet: true });

  useEffect(() => {
    if (!tournament || !format || !matches || !canManage) return;
    const rounds = nextRounds(format, matches, makeResolver(tournament, format, matches));
    if (rounds.length === 0) return;
    const key = `${tournament.id}|${rounds.map((round) => `${round.phase.id}:${round.fixtures.map((f) => f.slot ?? "").join()}`).join("|")}`;
    if (attempted.has(key)) return;
    attempted.add(key);

    // One plan for everything that's ready, so nothing clashes; open-ended,
    // and never in the past.
    const options = { ...defaultSchedule(tournament, matches), endDate: "", reserveDays: 0 };
    const today = localDate(new Date());
    if (options.startDate < today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      options.startDate = localDate(nextPlayingDate(yesterday, options.days));
    }
    const planned = planSchedule(
      rounds.flatMap((round) => round.fixtures),
      options,
    ).fixtures;

    (async () => {
      let at = 0;
      const done: string[] = [];
      for (const round of rounds) {
        const fixtures = planned.slice(at, at + round.fixtures.length);
        at += round.fixtures.length;
        try {
          await addFixtures.mutateAsync({ id: tournament.id, phaseId: round.phase.id, groups: round.groups, fixtures });
        } catch {
          continue;
        }
        done.push(
          ...(round.phase.kind === "knockout"
            ? round.fixtures.map((f) => round.phase.slots.find((slot) => slot.code === f.slot)?.label ?? f.slot ?? "")
            : [round.phase.name]),
        );
      }
      if (done.length === 0) return;
      const when = dayText(planned[0]?.scheduledAt ?? null);
      toast.success(`${done.join(", ")} scheduled${when ? ` from ${when}` : ""}`, {
        description: "Teams are set from the results. Reschedule any of them from the match page.",
      });
    })();
    // addFixtures is a fresh object each render; the effect follows the data.
  }, [tournament, format, matches, canManage]);

  return null;
}
