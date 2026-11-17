import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAddCricketFixtures } from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketBracketSlot, CricketFormat, CricketMatch, CricketPhase, CricketTournament } from "../../../api/types";
import { BottomSheet } from "../BottomSheet";
import { PointsTable, StandingsTable } from "../leaderboard/CricketLeaderboard";
import { BracketChart } from "./BracketChart";
import {
  championOf,
  expectedMatches,
  groupFixtures,
  groupMatches,
  groupTable,
  groupTableMatches,
  isGroupDone,
  makeResolver,
  phaseState,
  laterRoundDays,
  planSchedule,
  seriesScore,
  slotFixture,
  sourceLabel,
  type Fixture,
  type PhaseState,
  type Resolver,
  type ScheduleOptions,
} from "./formatEngine";
import { defaultSchedule, ScheduleFields } from "./ScheduleFields";
import { SlotTeamsPicker } from "./SlotTeamsPicker";
import { TeamMark } from "../teams/TeamMark";
import "./format.css";

const STATE_LABEL: Record<PhaseState, string> = {
  waiting: "Waiting",
  ready: "Ready to schedule",
  playing: "In progress",
  done: "Completed",
};

const STATE_ICON: Record<PhaseState, string> = {
  waiting: "fa-regular fa-clock",
  ready: "fa-solid fa-calendar-plus",
  playing: "fa-solid fa-circle",
  done: "fa-solid fa-check",
};

// Each phase's heading icon: a league table, a bracket or a series.
const KIND_ICON: Record<CricketPhase["kind"], string> = {
  "round-robin": "fa-solid fa-table-list",
  knockout: "fa-solid fa-sitemap",
  series: "fa-solid fa-handshake",
};

// Under a group's table: how far through its matches it is, and how many
// go through.
function GroupProgress({ played, total, qualify, carryPoints }: { played: number; total: number; qualify: number; carryPoints: boolean }) {
  const percent = total > 0 ? Math.min(100, Math.round((played / total) * 100)) : 0;
  return (
    <div className="cricket-group-progress">
      <div className="cricket-group-progress-row">
        <span>
          <strong>{played}</strong> of {total} matches played
        </span>
        {qualify > 0 && (
          <span className="cricket-group-chip">
            <i className="fa-solid fa-arrow-turn-up" aria-hidden="true"></i> Top {qualify} go through
          </span>
        )}
      </div>
      <div
        className="cricket-group-progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={played}
        aria-label="Matches played"
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      {carryPoints && <small>Includes results against each other from the earlier round.</small>}
    </div>
  );
}

// The Points Table tab: the format phase by phase — group tables with their
// qualification line, the knockout bracket, a series' scoreline — and the
// champion once it's decided. Without a format, the one points table (and,
// for organisers, a way to set one up).
export function FormatView({
  tournament,
  matches,
  canManage,
}: {
  tournament: CricketTournament;
  matches: CricketMatch[];
  canManage: boolean;
}) {
  const format = tournament.format;
  const [starting, setStarting] = useState<CricketPhase | null>(null);
  const [slotToSchedule, setSlotToSchedule] = useState<{ phase: CricketPhase; slot: CricketBracketSlot } | null>(null);

  if (!format) {
    return (
      <>
        {canManage && (
          <div className="cricket-format-cta">
            <i className="fa-solid fa-sitemap" aria-hidden="true"></i>
            <div>
              <strong>Set up the tournament format</strong>
              <span>League + IPL playoffs, groups and a super league, knockouts, a series — with the fixtures made for you.</span>
            </div>
            <Link to={`/tournaments/${tournament.id}/format`} className="btn btn-primary">
              Set up
            </Link>
          </div>
        )}
        <PointsTable tournament={tournament} matches={matches} />
      </>
    );
  }

  const resolve = makeResolver(tournament, format, matches);
  const teamName = (index: number) => tournament.teams[index]?.name ?? "Removed team";
  const states = format.phases.map((phase) => phaseState(phase, matches, resolve));
  const champion = championOf(format, matches, resolve);

  return (
    <div className="cricket-format">
      {champion !== null && (
        <ChampionCard
          tournament={tournament}
          format={format}
          matches={matches}
          champion={champion}
          teamName={teamName}
        />
      )}

      {format.phases.length > 1 && (
        <ol className="cricket-phase-steps" aria-label="Phases">
          {format.phases.map((phase, index) => (
            <li key={phase.id} className={`is-${states[index]}`}>
              <span className="cricket-phase-dot" aria-hidden="true">
                {states[index] === "done" ? <i className="fa-solid fa-check"></i> : index + 1}
              </span>
              <span className="cricket-phase-name">{phase.name}</span>
              {states[index] !== "done" && <span className="cricket-phase-sub">{STATE_LABEL[states[index]]}</span>}
            </li>
          ))}
        </ol>
      )}

      {format.phases.map((phase, index) => (
        <section key={phase.id} className="cricket-format-phase">
          <header className="cricket-format-phase-head">
            <h3>
              <span className="cricket-format-phase-icon" aria-hidden="true">
                <i className={KIND_ICON[phase.kind]}></i>
              </span>
              {phase.name}
            </h3>
            <span className={`cricket-phase-state is-${states[index]}`}>
              <i className={STATE_ICON[states[index]]} aria-hidden="true"></i>
              {STATE_LABEL[states[index]]}
            </span>
          </header>
          {phase.kind === "knockout" ? (
            <BracketChart
              format={format}
              phase={phase}
              matches={matches}
              resolve={resolve}
              teamName={teamName}
              logoOf={(index) => tournament.teams[index]?.logoUrl}
              onSchedule={canManage ? (slot) => setSlotToSchedule({ phase, slot }) : undefined}
            />
          ) : phase.kind === "series" ? (
            <SeriesBoard tournament={tournament} phase={phase} matches={matches} />
          ) : (
            <GroupTables format={format} tournament={tournament} phase={phase} matches={matches} resolve={resolve} teamName={teamName} />
          )}
          {canManage && phase.kind !== "knockout" && states[index] === "ready" && (
            <button type="button" className="btn btn-primary mt-3" onClick={() => setStarting(phase)}>
              <i className="fa-solid fa-calendar-plus" aria-hidden="true"></i> Schedule {phase.name}
            </button>
          )}
        </section>
      ))}

      {canManage && (
        <Link to={`/tournaments/${tournament.id}/format`} className="cricket-format-change">
          <i className="fa-solid fa-sliders" aria-hidden="true"></i>
          <span>
            <strong>Change the format</strong>
            <small>
              {matches.some((match) => match.phaseId && match.status !== "scheduled")
                ? "Only the rounds still to come can change"
                : "Teams, groups, fixtures and all"}
            </small>
          </span>
          <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </Link>
      )}

      {starting && (
        <StartPhaseSheet
          tournament={tournament}
          matches={matches}
          format={format}
          phase={starting}
          resolve={resolve}
          onClose={() => setStarting(null)}
        />
      )}
      {slotToSchedule && (
        <ScheduleSlotSheet
          tournament={tournament}
          matches={matches}
          {...slotToSchedule}
          resolve={resolve}
          teamName={teamName}
          onClose={() => setSlotToSchedule(null)}
        />
      )}
    </div>
  );
}

// The match that decided the title: the final of a knockout, the last
// result of a series; a league has none.
function decidingMatch(format: CricketFormat, matches: CricketMatch[]): CricketMatch | null {
  const last = format.phases[format.phases.length - 1];
  const own = matches.filter((match) => match.phaseId === last.id && match.status === "completed");
  if (last.kind === "knockout") {
    const final = last.slots.find((slot) => slot.stage === "final") ?? last.slots[last.slots.length - 1];
    return own.find((match) => match.slot === final?.code) ?? null;
  }
  if (last.kind === "series") {
    return own.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0] ?? null;
  }
  return null;
}

// The champion, celebrated: brand gradient, gold medal, the team's badge,
// who they beat and how (with the final one tap away).
function ChampionCard({
  tournament,
  format,
  matches,
  champion,
  teamName,
}: {
  tournament: CricketTournament;
  format: CricketFormat;
  matches: CricketMatch[];
  champion: number;
  teamName: (index: number) => string;
}) {
  const last = format.phases[format.phases.length - 1];
  const final = decidingMatch(format, matches);
  const runnerUp = final?.teams.find((team) => team.teamIndex !== champion)?.teamIndex ?? null;
  const line =
    runnerUp !== null
      ? `Beat ${teamName(runnerUp)} in the ${last.kind === "series" ? "series" : "final"}`
      : last.kind === "round-robin"
        ? `Top of the ${last.name} table`
        : null;
  const body = (
    <>
      <div className="cricket-champion-badge">
        <TeamMark
          className="cricket-champion-logo"
          name={teamName(champion)}
          logoUrl={tournament.teams[champion]?.logoUrl}
        />
        <span className="cricket-champion-medal" aria-hidden="true">
          <i className="fa-solid fa-trophy"></i>
        </span>
      </div>
      <div className="cricket-champion-text">
        <small>Champions</small>
        <strong>{teamName(champion)}</strong>
        {line && <span>{line}</span>}
      </div>
      {final && <i className="fa-solid fa-chevron-right cricket-champion-go" aria-hidden="true"></i>}
    </>
  );
  // With a final to show, the whole card opens it; its result is the tooltip.
  return final ? (
    <Link
      to={`/matches/${final.id}`}
      className="cricket-champion"
      title={final.resultText ?? undefined}
      aria-label={`Champions: ${teamName(champion)}. ${line ?? ""} Open the ${last.kind === "series" ? "last match" : "final"}.`}
    >
      {body}
    </Link>
  ) : (
    <div className="cricket-champion">{body}</div>
  );
}

function GroupTables({
  format,
  tournament,
  phase,
  matches,
  resolve,
  teamName,
}: {
  format: CricketFormat;
  tournament: CricketTournament;
  phase: CricketPhase;
  matches: CricketMatch[];
  resolve: Resolver;
  teamName: (index: number) => string;
}) {
  return (
    <div className={`cricket-group-tables ${phase.groups.length > 1 ? "is-multi" : ""}`}>
      {phase.groups.map((group) => {
        // A later phase before its teams are known: where they'll come from.
        if (group.teamIndexes.length === 0) {
          return (
            <div key={group.name} className="cricket-group">
              {phase.groups.length > 1 && <h4>Group {group.name}</h4>}
              <ul className="cricket-seed-list">
                {group.seeds.map((seed, i) => {
                  const index = resolve(seed);
                  return (
                    <li key={i} className={index === null ? "is-tbd" : undefined}>
                      <span>{sourceLabel(format, seed, teamName)}</span>
                      {index !== null && <strong>{teamName(index)}</strong>}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        }
        const own = groupMatches(phase, group, matches);
        const played = own.filter((match) => match.status === "completed" || match.status === "abandoned").length;
        return (
          <div key={group.name} className="cricket-group cricket-standings">
            {phase.groups.length > 1 && <h4>Group {group.name}</h4>}
            <StandingsTable
              rows={groupTable(tournament, format, phase, group, matches)}
              teams={tournament.teams}
              qualify={phase.qualify}
              settled={isGroupDone(phase, group, matches)}
              matches={groupTableMatches(format, phase, group, matches)}
              nrrHelp={false}
              note={
                <GroupProgress
                  played={played}
                  total={expectedMatches(phase, group)}
                  qualify={phase.qualify}
                  carryPoints={Boolean(phase.carryPoints)}
                />
              }
            />
          </div>
        );
      })}
    </div>
  );
}

function SeriesBoard({ tournament, phase, matches }: { tournament: CricketTournament; phase: CricketPhase; matches: CricketMatch[] }) {
  const group = phase.groups[0];
  const [a, b] = group.teamIndexes;
  const score = seriesScore(phase, group, matches);
  const name = (index: number) => tournament.teams[index]?.name ?? "Removed team";
  const own = groupMatches(phase, group, matches).sort((x, y) => (x.slot ?? "").localeCompare(y.slot ?? "", undefined, { numeric: true }));
  const verdict = score.decided
    ? score.leader === null
      ? `Series drawn ${score.wins[0]}–${score.wins[1]}`
      : `${name(score.leader)} win the series ${Math.max(...score.wins)}–${Math.min(...score.wins)}`
    : score.leader === null
      ? score.played === 0
        ? `${phase.legs}-match series`
        : `Series level ${score.wins[0]}–${score.wins[1]}`
      : `${name(score.leader)} lead ${Math.max(...score.wins)}–${Math.min(...score.wins)}`;
  return (
    <div className="cricket-series">
      <div className="cricket-series-score">
        <span className="cricket-series-team">{name(a)}</span>
        <strong>
          {score.wins[0]}
          <span aria-hidden="true">–</span>
          {score.wins[1]}
        </strong>
        <span className="cricket-series-team">{name(b)}</span>
      </div>
      <p className="cricket-series-verdict">{verdict}</p>
      <ol className="cricket-series-strip">
        {own.map((match, i) => {
          const winner = match.status === "completed" && match.winner !== null ? match.teams[match.winner].teamIndex : null;
          return (
            <li key={match.id}>
              <Link
                to={`/matches/${match.id}`}
                className={`${winner === a ? "is-a" : winner === b ? "is-b" : ""} is-${match.status}`}
                title={match.resultText ?? undefined}
              >
                <small>M{i + 1}</small>
                <span>
                  {match.status === "completed"
                    ? winner === null
                      ? "Tie"
                      : (tournament.teams[winner]?.name ?? "").slice(0, 3).toUpperCase()
                    : match.status === "abandoned"
                      ? "NR"
                      : match.status === "live"
                        ? "Live"
                        : "–"}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Starts a later round-robin phase (a super league) once its qualifiers are
// known: fills its groups and schedules its matches.
function StartPhaseSheet({
  tournament,
  matches,
  format,
  phase,
  resolve,
  onClose,
}: {
  tournament: CricketTournament;
  matches: CricketMatch[];
  format: CricketFormat;
  phase: CricketPhase;
  resolve: Resolver;
  onClose: () => void;
}) {
  const addFixtures = useAddCricketFixtures();
  // The rounds after this one keep their days free.
  const [options, setOptions] = useState<ScheduleOptions>(() =>
    defaultSchedule(tournament, matches, laterRoundDays(format, format.phases.indexOf(phase))),
  );
  const filled = phase.groups.every((group) => group.teamIndexes.length > 0);
  const groups = filled
    ? phase.groups
    : phase.groups.map((group) => ({ ...group, teamIndexes: group.seeds.map((seed) => resolve(seed)!) }));
  const fixtures: Fixture[] = groupFixtures(format, phase, groups);
  const plan = planSchedule(fixtures, options);
  const scheduled = plan.fixtures;

  async function save() {
    try {
      await addFixtures.mutateAsync({
        id: tournament.id,
        phaseId: phase.id,
        groups: filled ? undefined : groups,
        fixtures: scheduled,
      });
    } catch {
      return; // Shown as a toast.
    }
    toast.success(`${fixtures.length} ${phase.name} matches scheduled`);
    onClose();
  }

  return (
    <BottomSheet
      title={`Schedule ${phase.name}`}
      icon="fa-solid fa-calendar-plus"
      onClose={onClose}
      footer={
        <button type="button" className="cricket-sheet-submit" disabled={Boolean(plan.problem) || addFixtures.isPending} onClick={save}>
          <i className="fa-solid fa-check" aria-hidden="true"></i> Create {fixtures.length} matches
        </button>
      }
    >
      <p className="cricket-sheet-context">
        {groups
          .flatMap((group) => group.teamIndexes)
          .map((index) => tournament.teams[index]?.name)
          .join(", ")}
      </p>
      <ScheduleFields value={options} onChange={setOptions} plan={plan} laterRounds={format.phases.indexOf(phase) < format.phases.length - 1} />
    </BottomSheet>
  );
}

// Schedules one bracket match whose teams are now known: those by default,
// or whichever teams the organiser picks instead.
function ScheduleSlotSheet({
  tournament,
  matches,
  phase,
  slot,
  resolve,
  teamName,
  onClose,
}: {
  tournament: CricketTournament;
  matches: CricketMatch[];
  phase: CricketPhase;
  slot: CricketBracketSlot;
  resolve: Resolver;
  teamName: (index: number) => string;
  onClose: () => void;
}) {
  const addFixtures = useAddCricketFixtures();
  const [options, setOptions] = useState<ScheduleOptions>(() => defaultSchedule(tournament, matches));
  const fixture = slotFixture(phase, slot, resolve);
  const suggested: [number, number] | null = fixture ? [fixture.teamAIndex, fixture.teamBIndex] : null;
  const [teams, setTeams] = useState<[number, number]>(suggested ?? [0, 1]);

  async function save() {
    if (!fixture) return;
    try {
      // Just this match, on the date and at the time picked.
      const { fixtures } = planSchedule([{ ...fixture, teamAIndex: teams[0], teamBIndex: teams[1] }], {
        ...options,
        oneDay: true,
        pitches: 1,
      });
      await addFixtures.mutateAsync({ id: tournament.id, phaseId: phase.id, fixtures });
    } catch {
      return; // Shown as a toast.
    }
    toast.success(`${slot.label} scheduled`);
    onClose();
  }

  return (
    <BottomSheet
      title={`Schedule ${slot.label}`}
      icon="fa-solid fa-calendar-plus"
      onClose={onClose}
      footer={
        <button
          type="button"
          className="cricket-sheet-submit"
          disabled={!fixture || teams[0] === teams[1] || addFixtures.isPending}
          onClick={save}
        >
          <i className="fa-solid fa-check" aria-hidden="true"></i> Schedule
        </button>
      }
    >
      {fixture && (
        <>
          <p className="cricket-sheet-context">
            {teamName(teams[0])} v {teamName(teams[1])}
          </p>
          <SlotTeamsPicker teams={tournament.teams} value={teams} onChange={setTeams} suggested={suggested} />
        </>
      )}
      <ScheduleFields value={options} onChange={setOptions} single />
    </BottomSheet>
  );
}
