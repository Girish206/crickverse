import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCricketMatches } from "../../../api/hooks/cricket/useCricketMatches";
import { useCricketMe } from "../../../api/hooks/cricket/useCricketPlayers";
import { useClearCricketFormat, useCricketTournament, useSetCricketFormat } from "../../../api/hooks/cricket/useCricketTournaments";
import type { CricketTournament } from "../../../api/types";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { canManageTournament } from "../canManage";
import { ListCard } from "../../components/ListCard";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/Button";
import { Loader } from "../../components/Loader";
import { confirmAction } from "../../components/confirmDelete";
import { BracketChart } from "./BracketChart";
import {
  expectedMatches,
  formatMatchCount,
  laterRoundDays,
  makeResolver,
  matchesPerTeamChoices,
  openingFixtures,
  planSchedule,
  type ScheduleOptions,
} from "./formatEngine";
import { buildFormat, GROUP_NAMES, knockoutDraw, PRESETS, presetOf, snakeGroups, type PresetId, type PresetOptions } from "./formatPresets";
import { defaultSchedule, prefsOf, ScheduleFields } from "./ScheduleFields";
import "./format.css";
import "../../dms/css/adminDisplays.css";
import "../../admin.css";
import "../cricket.css";

const fixtureDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", hour12: true, minute: "2-digit" })
    : "Date to be set";

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// The first phase's line-up for a preset: one league, groups split in snake
// order, or the knockout draw in team order.
function lineUpFor(id: PresetId, options: PresetOptions, teamIndexes: number[]) {
  return presetOf(id)?.usesGroups ? snakeGroups(teamIndexes, options.groupCount) : [teamIndexes];
}

// A pill row for one option.
function OptionRow<T extends number | boolean>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="cricket-field">
      <span className="cricket-field-label">{label}</span>
      <div className="cricket-chip-choice" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={value === option.value ? "active" : ""}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Picks how the tournament is played — a preset (league + IPL playoffs,
// groups + super league, knockout, series...), its options, the groups or
// the draw — and when the opening matches are, then makes them. Opened from
// the Standings tab.
export function CricketFormatPage() {
  const id = Number(useParams().id);
  const { data: tournament, isLoading } = useCricketTournament(id);
  const { data: matches, isLoading: loadingMatches } = useCricketMatches(id);
  const { admin } = useAdminAuth();
  const { data: me } = useCricketMe();
  const canManage = canManageTournament(admin, tournament, me?.player?.id);
  const backTo = `/tournaments/${id}?tab=points`;

  const played = (matches ?? []).some((match) => match.phaseId && match.status !== "scheduled");
  const problem = !tournament
    ? "Tournament not found."
    : !canManage
      ? "Only the tournament's organiser can set its format."
      : tournament.teams.length < 2
        ? "Add at least two teams on the Teams tab first."
        : played
          ? "Format matches have already been played, so the format can't be changed now."
          : null;

  if (isLoading || loadingMatches || problem) {
    return (
      <>
        <PageHeader title="Tournament Format" back={backTo} backLabel="Back to standings" />
        {isLoading || loadingMatches ? (
          <Loader page />
        ) : (
          <ListCard title="Tournament Format">
            <p>{problem}</p>
          </ListCard>
        )}
      </>
    );
  }
  return <FormatBuilder tournament={tournament!} backTo={backTo} />;
}

function FormatBuilder({ tournament, backTo }: { tournament: CricketTournament; backTo: string }) {
  const navigate = useNavigate();
  const setFormat = useSetCricketFormat();
  const clearFormat = useClearCricketFormat();
  const teamCount = tournament.teams.length;
  const teamIndexes = useMemo(() => tournament.teams.map((_, index) => index), [tournament.teams]);
  const teamName = (index: number) => tournament.teams[index]?.name ?? "Removed team";

  const firstFit = (PRESETS.find((p) => p.id === tournament.format?.preset && !p.unfit(teamCount)) ??
    PRESETS.find((p) => !p.unfit(teamCount)))!;
  const [presetId, setPresetId] = useState<PresetId>(firstFit.id);
  const [options, setOptions] = useState<PresetOptions>(() => firstFit.defaults(teamCount));
  // An existing format's first phase keeps its line-up when it's reopened.
  const [lineUp, setLineUp] = useState<number[][]>(() => {
    const existing = tournament.format?.preset === firstFit.id ? tournament.format.phases[0] : null;
    if (existing?.kind === "knockout") {
      // Back in seed order (byes included), as long as it's still every team.
      const draw = knockoutDraw(existing);
      if (draw.length === teamCount && teamIndexes.every((index) => draw.includes(index))) return [draw];
      return [teamIndexes];
    }
    if (existing && existing.groups.every((g) => g.teamIndexes.length > 0)) return existing.groups.map((g) => g.teamIndexes);
    return lineUpFor(firstFit.id, firstFit.defaults(teamCount), teamIndexes);
  });
  const [when, setWhen] = useState<ScheduleOptions>(() => defaultSchedule(tournament));
  const [reserveEdited, setReserveEdited] = useState(false);
  // Most matches the whole tournament may come to (null = no limit).
  const [maxTotal, setMaxTotal] = useState<number | null>(null);
  const preset = presetOf(presetId)!;

  function pickPreset(next: PresetId) {
    const nextOptions = presetOf(next)!.defaults(teamCount);
    setPresetId(next);
    setOptions(nextOptions);
    setLineUp(lineUpFor(next, nextOptions, teamIndexes));
  }

  function setOption<K extends keyof PresetOptions>(key: K, value: PresetOptions[K]) {
    const next = { ...options, [key]: value };
    setOptions(next);
    if (key === "groupCount") setLineUp(lineUpFor(presetId, next, teamIndexes));
  }

  // New fixtures from the same settings: who plays whom (and when) follows
  // each group's team order, so reshuffle it; nobody changes group.
  function regenerate() {
    setLineUp((groups) => groups.map((group) => shuffled(group)));
  }

  function moveTeam(teamIndex: number, toGroup: number) {
    setLineUp((groups) => groups.map((group, g) => (g === toGroup ? [...group.filter((t) => t !== teamIndex), teamIndex] : group.filter((t) => t !== teamIndex))));
  }

  // What's wrong with the line-up, if anything.
  const smallest = Math.min(...lineUp.map((group) => group.length));
  const lineUpError = preset.usesGroups
    ? smallest < 2
      ? "Every group needs at least 2 teams."
      : smallest <= options.qualify
        ? `Every group needs more than ${options.qualify} teams, as ${options.qualify} go through.`
        : null
    : null;

  // How the league / groups are played: everyone once or twice, or each team
  // a set number of matches (the counts this line-up allows).
  const roundRobinFirst = presetId !== "series" && presetId !== "knockout";
  const perTeamChoices = roundRobinFirst ? matchesPerTeamChoices(lineUp) : [];
  const oddGroup = lineUp.some((group) => group.length % 2 === 1);
  const plays: Pick<PresetOptions, "legs" | "matchesPerTeam">[] = [
    { legs: 2, matchesPerTeam: null },
    { legs: 1, matchesPerTeam: null },
    ...[...perTeamChoices].reverse().map((count) => ({ legs: 1, matchesPerTeam: count })),
  ];
  const formatWith = (play: Pick<PresetOptions, "legs" | "matchesPerTeam">) => buildFormat(presetId, { ...options, ...play }, lineUp);
  // Under a limit, the most matches that fit; otherwise the organiser's
  // choice, a set count that no longer fits the line-up dropping to the
  // nearest one below.
  const limited = roundRobinFirst && maxTotal !== null;
  const underLimit = limited ? plays.find((play) => formatMatchCount(formatWith(play)) <= maxTotal) : undefined;
  const play = limited
    ? (underLimit ?? plays[plays.length - 1])
    : {
        legs: options.legs,
        matchesPerTeam:
          options.matchesPerTeam === null ? null : ([...perTeamChoices].reverse().find((count) => count <= options.matchesPerTeam!) ?? null),
      };
  const format = formatWith(play);
  const totalMatches = formatMatchCount(format);
  const openingMatches = format.phases[0].groups.reduce((sum, group) => sum + expectedMatches(format.phases[0], group), 0);
  const limitError =
    limited && !underLimit ? `Even the fewest matches this format allows come to ${totalMatches}, over the limit of ${maxTotal}.` : null;

  function choosePlay(next: Pick<PresetOptions, "legs" | "matchesPerTeam">) {
    setMaxTotal(null);
    setOptions({ ...options, ...next });
  }

  // "7 matches each", or a full round's count (a range when groups differ).
  const perTeamLabel = (() => {
    if (format.phases[0].kind !== "round-robin") return null;
    if (play.matchesPerTeam) return `${play.matchesPerTeam} matches each`;
    const counts = [...new Set(lineUp.map((group) => (group.length - 1) * play.legs))].sort((a, b) => a - b);
    return `${counts.join(" or ")} matches each`;
  })();
  // Days kept free for the later rounds follow the format until the
  // organiser sets them.
  const laterDays = laterRoundDays(format, 0);
  const schedule = reserveEdited ? when : { ...when, reserveDays: laterDays };
  const plan = planSchedule(lineUpError ? [] : openingFixtures(format, tournament), schedule);
  const fixtures = plan.fixtures;
  const resolve = makeResolver(tournament, format, []);

  function changeSchedule(next: ScheduleOptions) {
    if (next.reserveDays !== schedule.reserveDays) setReserveEdited(true);
    setWhen(next);
  }

  // Which options this preset takes.
  const perGroup = Math.floor(teamCount / options.groupCount);
  const groupCounts = [2, 3, 4].filter((g) => teamCount / g >= (presetId === "groups-super" ? 3 : 2) && (presetId !== "groups-knockout" || g !== 3));
  const hasSemis = format.phases.some((phase) => phase.slots.some((slot) => slot.stage === "semi-final"));

  async function save() {
    if (tournament.format) {
      const ok = await confirmAction(
        "Replace the format?",
        "The current format's unplayed fixtures will be deleted and the new ones created.",
        "Replace",
      );
      if (!ok) return;
    }
    try {
      await setFormat.mutateAsync({ id: tournament.id, format: { ...format, schedule: prefsOf(schedule) }, fixtures });
    } catch {
      return; // Shown as a toast.
    }
    toast.success(fixtures.length ? `Format saved — ${fixtures.length} matches scheduled` : "Format saved");
    navigate(backTo);
  }

  async function remove() {
    const ok = await confirmAction(
      "Remove the format?",
      "Its unplayed fixtures are deleted. Matches you scheduled by hand stay.",
      "Remove",
    );
    if (!ok) return;
    try {
      await clearFormat.mutateAsync(tournament.id);
    } catch {
      return;
    }
    navigate(backTo);
  }

  return (
    <div className="cricket-page cricket-format-page">
      <PageHeader title="Tournament Format" subtitle={tournament.name} back={backTo} backLabel="Back to standings" />

      <ListCard title="1. Format" subtitle={`${teamCount} teams`}>
        <div className="cricket-preset-grid" role="radiogroup" aria-label="Format">
          {PRESETS.map((p) => {
            const unfit = p.unfit(teamCount);
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={presetId === p.id}
                disabled={unfit !== null}
                className={`cricket-preset ${presetId === p.id ? "active" : ""}`}
                onClick={() => pickPreset(p.id)}
              >
                <i className={`fa-solid ${p.icon}`} aria-hidden="true"></i>
                <strong>{p.name}</strong>
                <small>{unfit ?? p.note}</small>
              </button>
            );
          })}
        </div>
      </ListCard>

      <ListCard title="2. Options">
        {presetId === "series" ? (
          <OptionRow
            label="Matches in the series"
            value={options.seriesLength}
            options={[1, 2, 3, 4, 5, 7].map((n) => ({ value: n, label: String(n) }))}
            onChange={(n) => setOption("seriesLength", n)}
          />
        ) : (
          presetId !== "knockout" && (
            <>
              <OptionRow
                label={preset.usesGroups ? "In the groups, teams play" : "In the league, teams play"}
                value={play.matchesPerTeam ? 0 : play.legs}
                options={[
                  { value: 1, label: "Everyone once" },
                  { value: 2, label: "Everyone twice" },
                  ...(perTeamChoices.length ? [{ value: 0, label: "Set number of matches" }] : []),
                ]}
                onChange={(n) =>
                  choosePlay(n ? { legs: n, matchesPerTeam: null } : { legs: 1, matchesPerTeam: perTeamChoices[perTeamChoices.length - 1] })
                }
              />
              {play.matchesPerTeam && (
                <>
                  <OptionRow
                    label="Matches per team"
                    value={play.matchesPerTeam}
                    options={perTeamChoices.map((count) => ({ value: count, label: String(count) }))}
                    onChange={(count) => choosePlay({ legs: 1, matchesPerTeam: count })}
                  />
                  <small className="admin-hint d-block mx-1">
                    No team meets the same opponent twice.
                    {oddGroup && " With an odd number of teams, only even numbers let every team play the same."}
                  </small>
                </>
              )}
            </>
          )
        )}
        {preset.usesGroups && (
          <>
            <OptionRow
              label="Groups"
              value={options.groupCount}
              options={groupCounts.map((g) => ({ value: g, label: `${g} groups` }))}
              onChange={(g) => setOption("groupCount", g)}
            />
            <OptionRow
              label="Go through from each group"
              value={options.qualify}
              options={(presetId === "groups-knockout" ? [1, 2] : [2, 3])
                .filter((q) => q < perGroup)
                .map((q) => ({ value: q, label: `Top ${q}` }))}
              onChange={(q) => setOption("qualify", q)}
            />
          </>
        )}
        {hasSemis && (
          <OptionRow
            label="3rd place play-off"
            value={options.thirdPlace}
            options={[
              { value: false, label: "No" },
              { value: true, label: "Yes" },
            ]}
            onChange={(v) => setOption("thirdPlace", v)}
          />
        )}
        {roundRobinFirst && (
          <div className="cricket-app-group mt-3">
            <label className="cricket-app-row">
              <span className="cricket-app-row-label">
                <i className="fa-solid fa-gauge-high" aria-hidden="true"></i> Most matches in all
              </span>
              <input
                type="number"
                min={1}
                max={300}
                placeholder="No limit"
                value={maxTotal ?? ""}
                onChange={(e) => setMaxTotal(e.target.value ? Math.min(300, Math.max(1, Math.floor(Number(e.target.value)) || 1)) : null)}
              />
            </label>
          </div>
        )}
        <p className="admin-hint mt-2 mb-0 mx-1">
          {perTeamLabel && `${format.phases[0].name}: ${perTeamLabel}, ${openingMatches} matches. `}
          <strong>{totalMatches} matches in all</strong>
          {totalMatches > openingMatches && ` including ${totalMatches - openingMatches} in the later rounds`}
          {limited && underLimit && ` — the most that fit under ${maxTotal}`}.
        </p>
        {limitError && <div className="admin-banner admin-banner-error mt-2">{limitError}</div>}
      </ListCard>

      {preset.usesGroups && (
        <ListCard
          title="3. Groups"
          action={
            <Button variant="outline" onClick={() => setLineUp(snakeGroups(shuffled(teamIndexes), options.groupCount))}>
              <i className="fa-solid fa-shuffle" aria-hidden="true"></i> Shuffle
            </Button>
          }
        >
          <ul className="cricket-group-assign">
            {teamIndexes.map((teamIndex) => {
              const at = lineUp.findIndex((group) => group.includes(teamIndex));
              return (
                <li key={teamIndex}>
                  <span className="cricket-standings-name">{teamName(teamIndex)}</span>
                  <div className="admin-segmented" role="radiogroup" aria-label={`${teamName(teamIndex)}'s group`}>
                    {lineUp.map((_, g) => (
                      <button
                        key={g}
                        type="button"
                        role="radio"
                        aria-checked={at === g}
                        className={at === g ? "active" : ""}
                        onClick={() => moveTeam(teamIndex, g)}
                      >
                        {GROUP_NAMES[g]}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
          {lineUpError && <div className="admin-banner admin-banner-error mt-2">{lineUpError}</div>}
        </ListCard>
      )}

      {presetId === "knockout" && (
        <ListCard
          title="3. Draw"
          subtitle={
            Number.isInteger(Math.log2(teamCount))
              ? "Seed 1 and seed 2 can only meet in the final"
              : `Seed 1 and seed 2 can only meet in the final. The top ${2 ** Math.ceil(Math.log2(teamCount)) - teamCount} seed${2 ** Math.ceil(Math.log2(teamCount)) - teamCount === 1 ? "" : "s"} get a bye into the next round.`
          }
          action={
            <Button variant="outline" onClick={() => setLineUp([shuffled(teamIndexes)])}>
              <i className="fa-solid fa-shuffle" aria-hidden="true"></i> Random draw
            </Button>
          }
        >
          <ol className="cricket-draw-list">
            {lineUp[0].map((teamIndex, seed) => (
              <li key={teamIndex}>
                <span className="cricket-draw-seed">{seed + 1}</span>
                <span className="cricket-standings-name">{teamName(teamIndex)}</span>
                {seed > 0 && (
                  <button
                    type="button"
                    className="cricket-draw-up"
                    aria-label={`Move ${teamName(teamIndex)} up`}
                    onClick={() =>
                      setLineUp(([draw]) => {
                        const next = [...draw];
                        [next[seed - 1], next[seed]] = [next[seed], next[seed - 1]];
                        return [next];
                      })
                    }
                  >
                    <i className="fa-solid fa-arrow-up" aria-hidden="true"></i>
                  </button>
                )}
              </li>
            ))}
          </ol>
        </ListCard>
      )}

      <ListCard title={`${preset.usesGroups || presetId === "knockout" ? 4 : 3}. Schedule`} subtitle="For the opening phase; later rounds are scheduled once their teams are known">
        <ScheduleFields value={schedule} onChange={changeSchedule} plan={plan} laterRounds={format.phases.length > 1} />
      </ListCard>

      <ListCard title="Preview">
        <ol className="cricket-phase-steps" aria-label="Phases">
          {format.phases.map((phase, index) => (
            <li key={phase.id}>
              <span className="cricket-phase-dot" aria-hidden="true">
                {index + 1}
              </span>
              <span className="cricket-phase-name">{phase.name}</span>
            </li>
          ))}
        </ol>
        {format.phases
          .filter((phase) => phase.kind === "knockout")
          .map((phase) => (
            <section key={phase.id} className="cricket-format-phase">
              <header className="cricket-format-phase-head">
                <h3>{phase.name}</h3>
              </header>
              <BracketChart format={format} phase={phase} matches={[]} resolve={resolve} teamName={teamName} />
            </section>
          ))}
        <section className="cricket-format-phase">
          <header className="cricket-format-phase-head">
            <h3>Opening fixtures</h3>
            <span className="cricket-fixture-head-end">
              {roundRobinFirst && fixtures.length > 1 && (
                <button
                  type="button"
                  className="cricket-fixture-regenerate"
                  title="New pairings and match order, same settings. Nothing is saved until you save."
                  onClick={regenerate}
                >
                  <i className="fa-solid fa-rotate" aria-hidden="true"></i> Regenerate
                </button>
              )}
              <span className="cricket-phase-state">{fixtures.length} matches</span>
            </span>
          </header>
          <ol className="cricket-fixture-preview">
            {fixtures.map((fixture, i) => (
              <li key={i}>
                <span className="cricket-fixture-no">Match {i + 1}</span>
                <span className="cricket-fixture-when">{fixtureDate(fixture.scheduledAt)}</span>
                <span className="cricket-fixture-teams">
                  {teamName(fixture.teamAIndex)} <small>v</small> {teamName(fixture.teamBIndex)}
                </span>
                {format.phases[0].groups.length > 1 && fixture.group && <span className="cricket-role-tag">{fixture.group}</span>}
              </li>
            ))}
          </ol>
        </section>
      </ListCard>

      <div className="cricket-format-actions">
        {tournament.format && (
          <Button variant="danger-text" disabled={clearFormat.isPending} onClick={remove}>
            Remove format
          </Button>
        )}
        <Button variant="primary" disabled={Boolean(lineUpError || limitError || plan.problem) || setFormat.isPending} onClick={save}>
          <i className="fa-solid fa-check" aria-hidden="true"></i>{" "}
          {fixtures.length ? `Save & create ${fixtures.length} matches` : "Save format"}
        </Button>
      </div>
    </div>
  );
}
