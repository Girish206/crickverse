import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketMe } from "../../../api/hooks/cricket/useCricketPlayers";
import { useAddCricketFixtures, useCricketTournament } from "../../../api/hooks/cricket/useCricketTournaments";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { Button } from "../../components/Button";
import { canManageTournament } from "../canManage";
import { makeResolver, nextPlayingDate, nextRounds, planSchedule } from "./formatEngine";
import { defaultSchedule } from "./ScheduleFields";
import "./format.css";

// Rounds already pointed out this session (the match page's note), so it
// isn't repeated on every refresh.
const noted = new Set<string>();

const localDate = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const dayText = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : null;

// Proposes the next round as soon as its teams are known — the playoffs (or
// super league) when the league or groups finish, the next bracket match
// when a knockout result comes in — and schedules it when the organiser
// taps Schedule, so a table that's wrong (a result entered for the wrong
// side, say) isn't locked in without anyone looking. They go on the next
// playing day after the last scheduled match, as the format's saved
// schedule says (days, start time, gap, matches a day); the organiser can
// reschedule any of them.
// `card`: the tournament page shows the proposal as a card; elsewhere (the
// match page) a note points the organiser to it.
export function AutoNextRounds({ tournamentId, card = false }: { tournamentId: number; card?: boolean }) {
  const { admin } = useAdminAuth();
  const navigate = useNavigate();
  const { data: me } = useCricketMe();
  const { data: tournament } = useCricketTournament(tournamentId, tournamentId > 0);
  const canManage = canManageTournament(admin, tournament, me?.player?.id);
  const format = tournament?.format;
  const { data: matches } = useCricketMatches(tournamentId, { enabled: canManage && Boolean(format) });
  const addFixtures = useAddCricketFixtures();
  const [busy, setBusy] = useState(false);

  const rounds = useMemo(
    () =>
      tournament && format && matches && canManage ? nextRounds(format, matches, makeResolver(tournament, format, matches)) : [],
    [tournament, format, matches, canManage],
  );
  const teamName = (index: number) => tournament?.teams[index]?.name ?? "TBD";
  // "Qualifier 1 — A vs B" per bracket match; a super league's teams.
  const lines = rounds.flatMap((round) =>
    round.phase.kind === "knockout"
      ? round.fixtures.map((f) => {
          const label = round.phase.slots.find((slot) => slot.code === f.slot)?.label ?? f.slot ?? "Match";
          return `${label} — ${teamName(f.teamAIndex)} vs ${teamName(f.teamBIndex)}`;
        })
      : [`${round.phase.name} — ${(round.groups ?? []).flatMap((group) => group.teamIndexes).map(teamName).join(", ")}`],
  );
  // "Playoffs are ready", "Final is ready".
  const names = [...new Set(rounds.map((round) => round.phase.name))];
  const heading =
    names.length === 1
      ? `${names[0]} ${names[0].endsWith("s") ? "are" : "is"} ready`
      : "The next rounds are ready";
  const key = `${tournamentId}|${rounds.map((round) => `${round.phase.id}:${round.fixtures.map((f) => f.slot ?? "").join()}`).join("|")}`;

  // Away from the tournament page, a note (once) leads to the card there.
  useEffect(() => {
    if (card || rounds.length === 0 || noted.has(key)) return;
    noted.add(key);
    toast.info(heading, {
      description: "Check the table, then schedule it from the tournament page.",
      action: { label: "Review", onClick: () => navigate(`/tournaments/${tournamentId}?tab=points`) },
    });
  }, [card, rounds.length, key, heading, navigate, tournamentId]);

  async function schedule() {
    if (!tournament || rounds.length === 0) return;
    // One plan for everything that's ready, so nothing clashes; open-ended,
    // and never in the past.
    const options = { ...defaultSchedule(tournament, matches ?? []), endDate: "", reserveDays: 0 };
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

    setBusy(true);
    let at = 0;
    const done: string[] = [];
    for (const round of rounds) {
      const fixtures = planned.slice(at, at + round.fixtures.length);
      at += round.fixtures.length;
      try {
        await addFixtures.mutateAsync({ id: tournament.id, phaseId: round.phase.id, groups: round.groups, fixtures });
      } catch {
        continue; // Shown as a toast.
      }
      done.push(
        ...(round.phase.kind === "knockout"
          ? round.fixtures.map((f) => round.phase.slots.find((slot) => slot.code === f.slot)?.label ?? f.slot ?? "")
          : [round.phase.name]),
      );
    }
    setBusy(false);
    if (done.length === 0) return;
    const when = dayText(planned[0]?.scheduledAt ?? null);
    toast.success(`${done.join(", ")} scheduled${when ? ` from ${when}` : ""}`, {
      description: "Reschedule any of them from the match page.",
    });
  }

  if (!card || rounds.length === 0) return null;
  return (
    <div className="cricket-format-cta cricket-next-rounds" role="status">
      <i className="fa-solid fa-flag-checkered" aria-hidden="true"></i>
      <div>
        <strong>{heading}</strong>
        <ul className="cricket-next-rounds-list">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <span>Teams come from the table. Check it first — fix a result and this updates.</span>
      </div>
      <Button variant="primary" disabled={busy} onClick={schedule}>
        <i className="fa-solid fa-calendar-plus" aria-hidden="true"></i> Schedule
      </Button>
    </div>
  );
}
