import { useCallback } from "react";
import type { CricketMatch, CricketTournament } from "../../../api/types";
import { avatarColorFor } from "../avatarColor";
import { makeResolver, slotMatch, sourceLabel } from "../format/formatEngine";
import { matchStageLabel, teamInitials } from "../matches/matchUtils";
import { AMBER, CARD_TOP, canvasBlob, drawCardFrame, ellipsize, fitFont, FONT, RED, roundRect, ShareCardSheet, W } from "./shareCard";

interface FixtureSide {
  name: string;
  // False for a playoff place not settled yet ("1st, League", "Winner Q1").
  known: boolean;
}

interface FixtureEntry {
  // "Match 12" — its number in the whole tournament's schedule, played ones
  // included — or a playoff's slot code ("Q1"), which later slots refer to.
  tag: string;
  stage: string;
  live: boolean;
  time: string | null;
  teamA: FixtureSide;
  teamB: FixtureSide;
}

interface FixtureDay {
  label: string;
  fixtures: FixtureEntry[];
}

const byDate = (a: CricketMatch, b: CricketMatch) =>
  (a.scheduledAt ?? "￿").localeCompare(b.scheduledAt ?? "￿") || a.id - b.id;

const dayLabel = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

const timeLabel = (value: string) => new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

// The live and upcoming matches in order, grouped by day (undated ones
// last), then each knockout phase's playoffs not scheduled yet, with the
// teams known so far ("1st, League" / "Winner Q1" until then).
export function upcomingFixtures(tournament: CricketTournament, matches: CricketMatch[]): FixtureDay[] {
  const ordered = [...matches].sort(byDate);
  const days: FixtureDay[] = [];
  ordered.forEach((match, i) => {
    if (match.status !== "scheduled" && match.status !== "live") return;
    const label = match.scheduledAt ? dayLabel(match.scheduledAt) : "Date to be announced";
    if (days[days.length - 1]?.label !== label) days.push({ label, fixtures: [] });
    days[days.length - 1].fixtures.push({
      tag: match.slot && !/^M\d+$/.test(match.slot) ? match.slot : `Match ${i + 1}`,
      stage: matchStageLabel(match),
      live: match.status === "live",
      time: match.scheduledAt ? timeLabel(match.scheduledAt) : null,
      teamA: { name: match.teams[0]?.name ?? "TBD", known: true },
      teamB: { name: match.teams[1]?.name ?? "TBD", known: true },
    });
  });

  const format = tournament.format;
  if (!format) return days;
  const resolve = makeResolver(tournament, format, matches);
  const teamName = (index: number) => tournament.teams[index]?.name ?? `Team ${index + 1}`;
  format.phases.forEach((phase) => {
    if (phase.kind !== "knockout") return;
    const fixtures = phase.slots
      .filter((slot) => !slotMatch(slot.code, matches))
      .map((slot) => {
        const side = (source: typeof slot.home): FixtureSide => {
          const index = resolve(source);
          return index === null ? { name: sourceLabel(format, source, teamName), known: false } : { name: teamName(index), known: true };
        };
        return { tag: slot.code, stage: slot.label, live: false, time: null, teamA: side(slot.home), teamB: side(slot.away) };
      });
    if (fixtures.length) days.push({ label: phase.name, fixtures });
  });
  return days;
}

// "Tournament fixtures:", then each day and its matches.
function fixturesText(tournamentName: string, days: FixtureDay[]) {
  const blocks = days.map((day) => {
    const lines = day.fixtures.map((f) => {
      const when = f.live ? "LIVE" : f.time;
      const head = [f.tag, when].filter(Boolean).join(" · ");
      const stage = f.stage === "League" ? "" : ` (${f.stage})`;
      return `${head} — ${f.teamA.name} v ${f.teamB.name}${stage}`;
    });
    return `${day.label}\n${lines.join("\n")}`;
  });
  return `🏏 ${tournamentName} fixtures:\n\n${blocks.join("\n\n")}`;
}

const DAY_H = 60;
const ROW_H = 100;
const ROW_GAP = 12;
const SIDE = 60;

// The fixtures card: the frame's header, then each day with a row per
// match — number, stage and time on the left, the two teams facing off.
// As tall as the list needs (at least square).
async function drawFixturesCard(tournament: CricketTournament, days: FixtureDay[]) {
  const count = days.reduce((sum, day) => sum + day.fixtures.length, 0);
  const contentH = days.reduce((sum, day) => sum + DAY_H + day.fixtures.length * (ROW_H + ROW_GAP), 0);
  const height = Math.max(1080, CARD_TOP + contentH + 100);
  const { canvas, ctx } = await drawCardFrame(
    tournament,
    height,
    "Fixtures",
    "UPCOMING",
    `${count} MATCH${count === 1 ? "" : "ES"}`,
  );

  const rowW = W - SIDE * 2;
  const infoW = 200;
  const vsX = SIDE + infoW + (rowW - infoW) / 2;
  const badgeR = 28;
  const nameW = vsX - 40 - (SIDE + infoW + badgeR * 2 + 34);

  // A team's initials, or "?" for a place not settled yet.
  const drawBadge = (side: FixtureSide, cx: number, cy: number) => {
    ctx.fillStyle = side.known ? avatarColorFor(side.name) : "rgba(255, 255, 255, 0.14)";
    ctx.beginPath();
    ctx.arc(cx, cy, badgeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 22px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(side.known ? teamInitials(side.name) : "?", cx, cy + 1);
  };
  const drawName = (side: FixtureSide, x: number, cy: number) => {
    ctx.fillStyle = side.known ? "#ffffff" : "rgba(255, 255, 255, 0.65)";
    fitFont(ctx, side.name, side.known ? 700 : 600, 30, 20, nameW);
    ctx.fillText(ellipsize(ctx, side.name, nameW), x, cy);
  };

  let y = CARD_TOP;
  days.forEach((day) => {
    // Day heading with a rule after it.
    ctx.textAlign = "left";
    ctx.fillStyle = AMBER;
    ctx.font = `800 26px ${FONT}`;
    const label = day.label.toUpperCase();
    ctx.fillText(label, SIDE, y + DAY_H / 2);
    const ruleX = SIDE + ctx.measureText(label).width + 20;
    ctx.fillStyle = "rgba(255, 205, 0, 0.3)";
    ctx.fillRect(ruleX, y + DAY_H / 2, W - SIDE - ruleX, 2);
    y += DAY_H;

    day.fixtures.forEach((f) => {
      const cy = y + ROW_H / 2;
      ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
      roundRect(ctx, SIDE, y, rowW, ROW_H, 18);
      ctx.fillStyle = f.live ? RED : AMBER;
      roundRect(ctx, SIDE, y, 8, ROW_H, 4);

      // Number and stage over the time.
      ctx.textAlign = "left";
      const info = [f.tag.toUpperCase(), f.stage === "League" ? null : f.stage.toUpperCase()].filter(Boolean).join(" · ");
      ctx.fillStyle = AMBER;
      fitFont(ctx, info, 700, 18, 14, infoW - 40);
      ctx.fillText(ellipsize(ctx, info, infoW - 40), SIDE + 30, cy - 18);
      ctx.fillStyle = f.live ? RED : "#ffffff";
      ctx.font = `800 28px ${FONT}`;
      ctx.fillText(f.live ? "LIVE" : (f.time ?? "TBC"), SIDE + 30, cy + 16);

      // Team A (badge, name) — VS — (name, badge) Team B.
      const aBadge = SIDE + infoW + badgeR;
      const bBadge = W - SIDE - 20 - badgeR;
      drawBadge(f.teamA, aBadge, cy);
      drawBadge(f.teamB, bBadge, cy);
      ctx.textAlign = "left";
      drawName(f.teamA, aBadge + badgeR + 14, cy);
      ctx.textAlign = "right";
      drawName(f.teamB, bBadge - badgeR - 14, cy);

      ctx.fillStyle = RED;
      ctx.beginPath();
      ctx.arc(vsX, cy, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = `800 18px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText("VS", vsX, cy + 1);

      y += ROW_H + ROW_GAP;
    });
  });

  return canvasBlob(canvas);
}

export function ShareFixturesSheet({
  tournament,
  matches,
  onClose,
}: {
  tournament: CricketTournament;
  matches: CricketMatch[];
  onClose: () => void;
}) {
  const days = upcomingFixtures(tournament, matches);
  const draw = useCallback(() => drawFixturesCard(tournament, upcomingFixtures(tournament, matches)), [tournament, matches]);
  return (
    <ShareCardSheet
      title="Share fixtures"
      shareTitle={`${tournament.name} fixtures`}
      what="fixtures"
      fileName={`${tournament.name.replace(/[^\w]+/g, "-").toLowerCase()}-fixtures.png`}
      text={fixturesText(tournament.name, days)}
      draw={draw}
      onClose={onClose}
    />
  );
}
