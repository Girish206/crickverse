import { useState } from "react";
import type { CricketMatch, CricketMe, CricketTournament } from "../../../api/types";
import { useAppText } from "../appText";
import { HomeRail, HomeSection } from "../HomeSection";
import { CreateSheets, type CreateStep } from "../QuickCreate";
import { PlayerQrSheet } from "../qr/ShowQrSheets";
import { bestBowling, playerStats } from "../stats";
import { TournamentCard, tournamentPhase } from "../tournaments/TournamentCard";
import "./me.css";

// ---------- Quick actions ----------

type Action =
  | { kind: "create"; step: CreateStep; icon: string; label: string }
  | { kind: "qr"; icon: string; label: string };

const ACTIONS: Action[] = [
  { kind: "create", step: "match", icon: "fa-baseball-bat-ball", label: "New match" },
  { kind: "create", step: "tournament", icon: "fa-trophy", label: "Tournament" },
  { kind: "create", step: "team", icon: "fa-people-group", label: "Create team" },
  { kind: "create", step: "scan", icon: "fa-camera", label: "Scan QR" },
  { kind: "qr", icon: "fa-qrcode", label: "My QR" },
];

// A row of shortcut tiles under the hero: the "+" menu's forms and my QR
// code, one tap away.
export function QuickActions({ me }: { me: CricketMe }) {
  const tr = useAppText();
  const [step, setStep] = useState<CreateStep | null>(null);
  const [showQr, setShowQr] = useState(false);
  return (
    <nav className="cv-home-actions" aria-label={tr("Quick actions")}>
      {ACTIONS.map((action) => {
        const body = (
          <>
            <span className="cv-home-action-icon" aria-hidden="true">
              <i className={`fa-solid ${action.icon}`}></i>
            </span>
            <span className="cv-home-action-label">{tr(action.label)}</span>
          </>
        );
        return (
          <button
            key={action.label}
            type="button"
            className="cv-home-action"
            onClick={() => (action.kind === "qr" ? setShowQr(true) : setStep(action.step))}
          >
            {body}
          </button>
        );
      })}
      <CreateSheets step={step} onClose={() => setStep(null)} />
      {showQr && me.player && <PlayerQrSheet player={me.player} onClose={() => setShowQr(false)} />}
    </nav>
  );
}

// ---------- Milestones & bests ----------

const RUN_MARKS = [50, 100, 250, 500, 1000, 1500, 2000, 3000, 5000, 7500, 10000];
const WICKET_MARKS = [5, 10, 25, 50, 75, 100, 150, 200, 300, 500];
const MATCH_MARKS = [5, 10, 25, 50, 75, 100, 150, 200, 300, 500];

// The next round number past `value`, and how far along the way from the
// last one I am.
function nextMark(value: number, marks: number[]) {
  const next = marks.find((m) => m > value) ?? Math.ceil((value + 1) / 1000) * 1000;
  const prev = [...marks].reverse().find((m) => m <= value) ?? 0;
  return { next, left: next - value, progress: Math.min(1, (value - prev) / (next - prev)) };
}

function MilestoneBar({ label, icon, value, marks }: { label: string; icon: string; value: number; marks: number[] }) {
  const tr = useAppText();
  const { next, left, progress } = nextMark(value, marks);
  return (
    <div className="cv-milestone">
      <div className="cv-milestone-head">
        <span>
          <i className={`fa-solid ${icon}`} aria-hidden="true"></i> {tr(label)}
        </span>
        <small>
          <strong>{left}</strong> {tr("to")} {next}
        </small>
      </div>
      <div
        className="cv-milestone-track"
        role="progressbar"
        aria-label={`${label}: ${value} of ${next}`}
        aria-valuemin={0}
        aria-valuemax={next}
        aria-valuenow={value}
      >
        <span style={{ width: `${Math.round(progress * 100)}%` }}></span>
      </div>
    </div>
  );
}

// My best innings and spell, 50s / 100s, boundaries and catches, then how
// close the next round numbers of runs, wickets and matches are.
export function MilestonesSection({ me }: { me: CricketMe }) {
  const tr = useAppText();
  const stats = playerStats(me.matches).get(me.player!.id);
  if (!stats || stats.matches === 0) return null;
  const bests = [
    { label: "Best score", value: stats.innings ? `${stats.highest}${stats.highestNotOut ? "*" : ""}` : "–" },
    { label: "Best bowling", value: bestBowling(stats) },
    { label: "50s / 100s", value: `${stats.fifties} / ${stats.hundreds}` },
    { label: "4s / 6s", value: `${stats.fours} / ${stats.sixes}` },
    { label: "Catches", value: stats.catches + stats.stumpings },
    { label: "3+ wkt hauls", value: stats.threeWickets },
  ];
  return (
    <HomeSection title="Milestones & bests" icon="fa-solid fa-award" tone="milestones" link={{ to: "/me", label: "Full stats" }}>
      <div className="cv-milestones">
        <dl className="cv-bests">
          {bests.map((b) => (
            <div key={b.label}>
              <dt>{tr(b.label)}</dt>
              <dd>{b.value}</dd>
            </div>
          ))}
        </dl>
        <div className="cv-milestone-bars">
          <MilestoneBar label="Runs" icon="fa-baseball-bat-ball" value={stats.runs} marks={RUN_MARKS} />
          <MilestoneBar label="Wickets" icon="fa-bowling-ball" value={stats.wickets} marks={WICKET_MARKS} />
          <MilestoneBar label="Matches" icon="fa-calendar-check" value={stats.matches} marks={MATCH_MARKS} />
        </div>
      </div>
    </HomeSection>
  );
}

// ---------- Open tournaments ----------

// Upcoming and running tournaments I'm not in, don't follow and don't run:
// something new to look at (and follow from its page).
export function OpenTournamentsSection({
  me,
  tournaments,
  matches,
}: {
  me: CricketMe;
  tournaments: CricketTournament[];
  matches: CricketMatch[];
}) {
  const playerId = me.player!.id;
  const known = new Set(
    [...me.tournaments, ...me.followedTournaments, ...me.createdTournaments, ...me.scoringTournaments].map((t) => t.id),
  );
  const open = tournaments
    .filter((t) => !known.has(t.id) && !t.teams.some((team) => team.playerIds.includes(playerId)))
    .map((t) => ({ t, phase: tournamentPhase(t, matches) }))
    .filter(({ phase }) => phase === "ongoing" || phase === "upcoming")
    // Running ones first, then the soonest to start.
    .sort(
      (a, b) =>
        (a.phase === "ongoing" ? 0 : 1) - (b.phase === "ongoing" ? 0 : 1) ||
        (a.t.startDate ?? a.t.createdAt).localeCompare(b.t.startDate ?? b.t.createdAt),
    )
    .slice(0, 4)
    .map(({ t }) => t);
  if (open.length === 0) return null;
  return (
    <HomeSection title="Discover tournaments" icon="fa-solid fa-compass" tone="discover">
      <HomeRail>
        {open.map((t) => (
          <TournamentCard key={t.id} tournament={t} matches={matches} />
        ))}
      </HomeRail>
    </HomeSection>
  );
}
