import type { CricketMatch, CricketTournament } from "../../../api/types";
import { monogram } from "../../../utils/format";
import { avatarColorFor } from "../avatarColor";
import { BALL_TYPES, CATEGORIES, labelOf, MATCH_TYPES, PITCH_TYPES } from "../cricketOptions";
import { shareableStandings } from "../format/formatEngine";
import { BOARDS, TOURNAMENT_HEROES } from "../leaderboard/CricketLeaderboard";
import { battingOrder, teamScore } from "../matches/matchUtils";
import type { StatGroup } from "../StatTiles";
import { playerStats, pointsTable, tournamentStats, type NameOf, type PlayerStats } from "../stats";
import {
  CARD_CONTENT_TOP,
  CARD_GAP,
  CARD_RED,
  drawBadge,
  drawCover,
  drawFitted,
  INNER,
  loadPictures,
  PAD,
  startTournamentCard,
  type CardPalette,
  type Ctx,
  type Picture,
  type StartCard,
} from "./brandedCard";
import { canvasBlob, FONT, roundRect, W } from "./shareCard";
import { fixturesText, upcomingFixtures, type FixtureDay } from "./ShareFixturesSheet";
import { dateText } from "./TournamentInfo";
import { drawPointsTableCard } from "./tournamentShareCard";
import { tournamentStatGroups } from "./TournamentStats";

// What each tab of a tournament shares: its own picture, title and message.

export type TournamentShareTab = "info" | "matches" | "teams" | "points" | "heroes" | "stats" | "totals";

export const TOURNAMENT_SHARE_HEADINGS: Record<TournamentShareTab, string> = {
  info: "Share tournament",
  matches: "Share matches",
  teams: "Share teams",
  points: "Share points table",
  heroes: "Share heroes",
  stats: "Share leaderboard",
  totals: "Share stats",
};

export interface TournamentCardData {
  tournament: CricketTournament;
  matches: CricketMatch[];
  nameOf: NameOf;
  photoOf: (playerId: number) => string | null | undefined;
}

type Draw = () => Promise<Blob | null>;

const CELL_GAP = 20;
const HALF = (INNER - CELL_GAP) / 2;
const SECTION_H = 68;

export const count = (n: number, word: string, plural = `${word}s`) => `${n} ${n === 1 ? word : plural}`;
export const isFinished = (match: CricketMatch) => match.status === "completed" || match.status === "abandoned";
export const wasScored = (matches: CricketMatch[]) => matches.some((match) => match.innings.some((innings) => innings.balls.length > 0));
const startFor = (tournament: CricketTournament): StartCard => (...args) => startTournamentCard(tournament, ...args);

function drawSectionTitle(ctx: Ctx, palette: CardPalette, text: string, top: number) {
  ctx.textAlign = "left";
  ctx.fillStyle = palette.accent;
  ctx.font = `800 32px ${FONT}`;
  ctx.fillText(text, PAD + 8, top + SECTION_H / 2);
}

// ===== Profile =====

function profileRows(t: CricketTournament, matches: CricketMatch[]) {
  const dates = t.startDate ? `${dateText(t.startDate)}${t.endDate && t.endDate !== t.startDate ? ` to ${dateText(t.endDate)}` : ""}` : null;
  const rows: [string, string | null | undefined][] = [
    ["Dates", dates],
    ["Venue", [t.ground, t.city].filter(Boolean).join(", ")],
    ["Category", labelOf(CATEGORIES, t.category)],
    ["Match type", labelOf(MATCH_TYPES, t.matchType)],
    ["Overs", t.overs === null ? null : String(t.overs)],
    ["Ball type", labelOf(BALL_TYPES, t.ballType)],
    ["Pitch type", labelOf(PITCH_TYPES, t.pitchType)],
    ["Teams", t.teams.length ? String(t.teams.length) : null],
    ["Matches", matches.length ? `${matches.length} (${matches.filter((m) => m.status === "completed").length} completed)` : null],
    ["Organiser", t.organiserName],
  ];
  return rows.filter((row): row is [string, string] => Boolean(row[1]));
}

const PROFILE_ROW_H = 76;

function drawProfileCard({ tournament: t, matches }: TournamentCardData) {
  const detail = `${count(t.teams.length, "team")} · ${count(matches.length, "match", "matches")}`;
  return drawFactRows(startFor(t), profileRows(t, matches), "TOURNAMENT", detail);
}

// Labels and their values, down one panel.
export async function drawFactRows(start: StartCard, rows: [string, string][], pillLabel: string, detail: string) {
  const { canvas, ctx, palette } = await start(rows.length * PROFILE_ROW_H + 16, pillLabel, detail);

  const top = CARD_CONTENT_TOP;
  ctx.fillStyle = palette.panel;
  roundRect(ctx, PAD, top, INNER, rows.length * PROFILE_ROW_H + 16, 24);
  rows.forEach(([label, value], i) => {
    const cy = top + 8 + PROFILE_ROW_H * (i + 0.5);
    if (i > 0) {
      ctx.fillStyle = palette.rule;
      ctx.fillRect(PAD + 24, top + 8 + PROFILE_ROW_H * i - 1, INNER - 48, 2);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = palette.muted;
    ctx.font = `600 28px ${FONT}`;
    ctx.fillText(label, PAD + 32, cy);
    ctx.textAlign = "right";
    ctx.fillStyle = palette.text;
    drawFitted(ctx, value, 700, 30, 20, 700, W - PAD - 32, cy);
  });
  return canvasBlob(canvas);
}

// ===== Matches =====

const DAY_H = 64;
const FIXTURE_H = 116;
const FIXTURE_GAP = 12;
const META_W = 170;

const drawFixturesTabCard = ({ tournament, matches }: TournamentCardData) => drawFixtureDays(startFor(tournament), upcomingFixtures(tournament, matches));

export async function drawFixtureDays(start: StartCard, days: FixtureDay[]) {
  const fixtures = days.reduce((sum, day) => sum + day.fixtures.length, 0);
  const contentH = days.reduce((sum, day) => sum + DAY_H + day.fixtures.length * (FIXTURE_H + FIXTURE_GAP), 0) - FIXTURE_GAP;
  const logos = await loadPictures(days.flatMap((day) => day.fixtures.flatMap((f) => [f.teamA.logoUrl, f.teamB.logoUrl])));
  const { canvas, ctx, palette } = await start(contentH, "FIXTURES", `${count(fixtures, "match", "matches")} to play`);

  const r = 26;
  let top = CARD_CONTENT_TOP;
  days.forEach((day) => {
    drawSectionTitle(ctx, palette, day.label, top);
    top += DAY_H;
    day.fixtures.forEach((f) => {
      const cy = top + FIXTURE_H / 2;
      ctx.fillStyle = palette.panel;
      roundRect(ctx, PAD, top, INNER, FIXTURE_H, 20);

      ctx.textAlign = "left";
      ctx.fillStyle = palette.text;
      drawFitted(ctx, f.tag, 700, 26, 18, META_W - 14, PAD + 22, cy - 18);
      ctx.fillStyle = f.live ? CARD_RED : palette.muted;
      drawFitted(ctx, f.live ? "LIVE" : (f.time ?? f.stage), f.live ? 800 : 500, 24, 16, META_W - 14, PAD + 22, cy + 20);

      const left = PAD + 22 + META_W;
      const right = W - PAD - 22;
      const mid = (left + right) / 2;
      const nameW = mid - 32 - (left + r * 2 + 12);
      const badge = (side: typeof f.teamA, cx: number) => {
        const logo = side.known && side.logoUrl ? (logos.get(side.logoUrl) ?? null) : null;
        drawBadge(ctx, logo, side.known ? monogram(side.name) : "?", side.known ? avatarColorFor(side.name) : "#8a909c", cx, cy, r);
      };
      badge(f.teamA, left + r);
      badge(f.teamB, right - r);
      ctx.fillStyle = f.teamA.known ? palette.text : palette.muted;
      ctx.textAlign = "left";
      drawFitted(ctx, f.teamA.name, 700, 28, 18, nameW, left + r * 2 + 12, cy);
      ctx.fillStyle = f.teamB.known ? palette.text : palette.muted;
      ctx.textAlign = "right";
      drawFitted(ctx, f.teamB.name, 700, 28, 18, nameW, right - r * 2 - 12, cy);
      ctx.fillStyle = palette.accent;
      ctx.textAlign = "center";
      ctx.font = `800 24px ${FONT}`;
      ctx.fillText("VS", mid, cy);
      top += FIXTURE_H + FIXTURE_GAP;
    });
  });
  return canvasBlob(canvas);
}

const RESULT_H = 196;
const RESULTS_SHOWN = 8;

export const latestResults = (matches: CricketMatch[]) =>
  matches
    .filter((match) => isFinished(match) && match.resultText)
    .sort((a, b) => (b.completedAt ?? b.scheduledAt ?? "").localeCompare(a.completedAt ?? a.scheduledAt ?? ""))
    .slice(0, RESULTS_SHOWN);

const drawResultsCard = ({ tournament, matches }: TournamentCardData) => drawResults(startFor(tournament), matches);

export async function drawResults(start: StartCard, matches: CricketMatch[]) {
  const results = latestResults(matches);
  const logos = await loadPictures(results.flatMap((match) => match.teams.map((team) => team.logoUrl)));
  const detail = `${count(matches.filter(isFinished).length, "match", "matches")} played`;
  const contentH = results.length * (RESULT_H + FIXTURE_GAP) - FIXTURE_GAP;
  const { canvas, ctx, palette } = await start(contentH, "RESULTS", detail);

  let top = CARD_CONTENT_TOP;
  results.forEach((match) => {
    ctx.fillStyle = palette.panel;
    roundRect(ctx, PAD, top, INNER, RESULT_H, 20);
    const right = W - PAD - 28;
    battingOrder(match).forEach((slot, i) => {
      const cy = top + 42 + i * 58;
      const team = match.teams[slot];
      drawBadge(ctx, team.logoUrl ? (logos.get(team.logoUrl) ?? null) : null, monogram(team.name), avatarColorFor(team.name), PAD + 54, cy, 24);
      const score = teamScore(match, slot);
      let nameRight = right;
      if (score) {
        ctx.textAlign = "right";
        ctx.fillStyle = palette.text;
        ctx.font = `800 36px ${FONT}`;
        const text = `${score.runs} (${score.overs})`;
        ctx.fillText(text, right, cy);
        nameRight -= ctx.measureText(text).width + 20;
      }
      ctx.textAlign = "left";
      ctx.fillStyle = match.winner !== null && match.winner !== slot ? palette.muted : palette.text;
      drawFitted(ctx, team.name, 700, 30, 20, nameRight - (PAD + 92), PAD + 92, cy);
    });
    ctx.fillStyle = palette.rule;
    ctx.fillRect(PAD + 26, top + 140, INNER - 52, 2);
    ctx.textAlign = "left";
    ctx.fillStyle = palette.accent;
    drawFitted(ctx, match.resultText ?? "", 700, 28, 20, INNER - 56, PAD + 28, top + 169);
    top += RESULT_H + FIXTURE_GAP;
  });
  return canvasBlob(canvas);
}

// ===== Teams =====

const TEAM_H = 128;

async function drawTeamsCard({ tournament, matches }: TournamentCardData) {
  const record = new Map(pointsTable(tournament, matches).map((row) => [row.teamIndex, row]));
  const teams = tournament.teams;
  const rows = Math.ceil(teams.length / 2);
  const logos = await loadPictures(teams.map((team) => team.logoUrl));
  const players = teams.reduce((sum, team) => sum + team.playerIds.length, 0);
  const contentH = rows * TEAM_H + (rows - 1) * CELL_GAP;
  const { canvas, ctx, palette } = await startTournamentCard(tournament, contentH, "TEAMS", `${count(teams.length, "team")} · ${count(players, "player")}`);

  teams.forEach((team, i) => {
    const x = PAD + (i % 2) * (HALF + CELL_GAP);
    const y = CARD_CONTENT_TOP + Math.floor(i / 2) * (TEAM_H + CELL_GAP);
    const cy = y + TEAM_H / 2;
    ctx.fillStyle = palette.panel;
    roundRect(ctx, x, y, HALF, TEAM_H, 20);
    drawBadge(ctx, team.logoUrl ? (logos.get(team.logoUrl) ?? null) : null, monogram(team.name), avatarColorFor(team.name), x + 62, cy, 42);
    const row = record.get(i);
    const sub = `${count(team.playerIds.length, "player")}${row && row.played > 0 ? ` · W${row.won} L${row.lost}` : ""}`;
    const textX = x + 120;
    const width = HALF - 120 - 18;
    ctx.textAlign = "left";
    ctx.fillStyle = palette.text;
    drawFitted(ctx, team.name, 700, 32, 20, width, textX, cy - 18);
    ctx.fillStyle = palette.muted;
    drawFitted(ctx, sub, 500, 24, 18, width, textX, cy + 22);
  });
  return canvasBlob(canvas);
}

// ===== Heroes =====

interface Hero {
  title: string;
  label: string;
  player: PlayerStats;
  value: string;
  detail: string;
}

function tournamentHeroes(matches: CricketMatch[]) {
  const rows = [...playerStats(matches).values()];
  return TOURNAMENT_HEROES.flatMap((hero): Hero[] => {
    const board = BOARDS.find((b) => b.title === hero.board)!;
    const player = board.rank(rows)[0];
    return player ? [{ title: hero.title, label: hero.label, player, value: String(board.value(player)), detail: board.detail(player) }] : [];
  });
}

const HERO_PHOTO_H = 640;
const HERO_BODY_H = 170;
const HERO_TILE_H = 176;

// The first hero across the card, with the photo when they have one.
function drawLeadHero(ctx: Ctx, palette: CardPalette, hero: Hero, name: string, photo: Picture, top: number) {
  const bodyTop = photo ? top + HERO_PHOTO_H : top;
  ctx.fillStyle = palette.panel;
  roundRect(ctx, PAD, top, INNER, (photo ? HERO_PHOTO_H : 0) + HERO_BODY_H, 24);
  if (photo) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(PAD, top, INNER, HERO_PHOTO_H, [24, 24, 0, 0]);
    ctx.clip();
    drawCover(ctx, photo, PAD, top, INNER, HERO_PHOTO_H, 0);
    ctx.restore();
    ctx.font = `800 30px ${FONT}`;
    ctx.fillStyle = CARD_RED;
    ctx.beginPath();
    ctx.roundRect(PAD, top, ctx.measureText(hero.title).width + 56, 68, [24, 0, 24, 0]);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(hero.title, PAD + 28, top + 35);
  }

  const cy = bodyTop + HERO_BODY_H / 2;
  const right = W - PAD - 36;
  ctx.textAlign = "right";
  ctx.fillStyle = palette.muted;
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText(hero.label, right, cy - 38);
  ctx.fillStyle = palette.accent;
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText(hero.value, right, cy + 12);
  const valueW = ctx.measureText(hero.value).width;

  let x = PAD + 36;
  if (!photo) {
    drawBadge(ctx, null, monogram(name), avatarColorFor(name), PAD + 32 + 56, cy, 56);
    x = PAD + 32 + 112 + 28;
  }
  const width = right - valueW - 28 - x;
  ctx.textAlign = "left";
  if (!photo) {
    ctx.fillStyle = palette.accent;
    drawFitted(ctx, hero.title.toUpperCase(), 800, 24, 18, width, x, cy - 52);
  }
  ctx.fillStyle = palette.text;
  drawFitted(ctx, name, 800, 48, 28, width, x, photo ? cy - 26 : cy - 8);
  ctx.fillStyle = palette.muted;
  drawFitted(ctx, hero.detail, 500, 28, 20, width, x, photo ? cy + 30 : cy + 42);
}

async function drawHeroesCard({ tournament, matches, nameOf, photoOf }: TournamentCardData) {
  const [lead, ...others] = tournamentHeroes(matches);
  const photos = await loadPictures([lead, ...others].map((hero) => photoOf(hero.player.playerId)));
  const pictureOf = (hero: Hero) => {
    const url = photoOf(hero.player.playerId);
    return url ? (photos.get(url) ?? null) : null;
  };
  const leadPhoto = pictureOf(lead);
  const leadH = (leadPhoto ? HERO_PHOTO_H : 0) + HERO_BODY_H;
  const rows = Math.ceil(others.length / 2);
  const contentH = leadH + (rows ? CARD_GAP + rows * HERO_TILE_H + (rows - 1) * CELL_GAP : 0);
  const { canvas, ctx, palette } = await startTournamentCard(tournament, contentH, "HEROES", `${count(matches.filter(isFinished).length, "match", "matches")} played`);

  drawLeadHero(ctx, palette, lead, nameOf(lead.player.playerId), leadPhoto, CARD_CONTENT_TOP);
  const gridTop = CARD_CONTENT_TOP + leadH + CARD_GAP;
  others.forEach((hero, i) => {
    const name = nameOf(hero.player.playerId);
    const x = PAD + (i % 2) * (HALF + CELL_GAP);
    const y = gridTop + Math.floor(i / 2) * (HERO_TILE_H + CELL_GAP);
    const cy = y + HERO_TILE_H / 2;
    ctx.fillStyle = palette.panel;
    roundRect(ctx, x, y, HALF, HERO_TILE_H, 20);
    drawBadge(ctx, pictureOf(hero), monogram(name), avatarColorFor(name), x + 66, cy, 46);
    const textX = x + 128;
    const width = HALF - 128 - 16;
    ctx.textAlign = "left";
    ctx.fillStyle = palette.accent;
    drawFitted(ctx, hero.title.toUpperCase(), 800, 21, 15, width, textX, cy - 46);
    ctx.fillStyle = palette.text;
    drawFitted(ctx, name, 700, 32, 20, width, textX, cy - 6);
    ctx.fillStyle = palette.muted;
    drawFitted(ctx, `${hero.value} ${hero.label}`, 600, 26, 18, width, textX, cy + 40);
  });
  return canvasBlob(canvas);
}

// ===== Leaderboard =====

const SHARED_BOARDS = ["MVP", "Most Runs", "Most Wickets"];
const BOARD_ROWS = 5;
const BOARD_TITLE_H = 72;
const BOARD_ROW_H = 96;

// With `playerIds`, only those players' places (a team's).
export function leaderboards(matches: CricketMatch[], playerIds?: number[]) {
  const rows = [...playerStats(matches).values()].filter((row) => !playerIds || playerIds.includes(row.playerId));
  return SHARED_BOARDS.map((title) => BOARDS.find((board) => board.title === title)!)
    .map((board) => ({ board, top: board.rank(rows).slice(0, BOARD_ROWS) }))
    .filter(({ top }) => top.length > 0);
}

const drawLeaderboardCard = ({ tournament, matches, nameOf, photoOf }: TournamentCardData) =>
  drawLeaderboards(startFor(tournament), leaderboards(matches), matches, nameOf, photoOf);

export async function drawLeaderboards(
  start: StartCard,
  boards: ReturnType<typeof leaderboards>,
  matches: CricketMatch[],
  nameOf: NameOf,
  photoOf: TournamentCardData["photoOf"],
) {
  const height = (top: unknown[]) => BOARD_TITLE_H + top.length * BOARD_ROW_H + 12;
  const contentH = boards.reduce((sum, { top }, i) => sum + (i ? CARD_GAP : 0) + height(top), 0);
  const photos = await loadPictures(boards.flatMap(({ top }) => top.map((player) => photoOf(player.playerId))));
  const { canvas, ctx, palette } = await start(contentH, "LEADERBOARD", `${count(matches.filter(isFinished).length, "match", "matches")} played`);

  let panelTop = CARD_CONTENT_TOP;
  boards.forEach(({ board, top }) => {
    ctx.fillStyle = palette.panel;
    roundRect(ctx, PAD, panelTop, INNER, height(top), 24);
    ctx.textAlign = "left";
    ctx.fillStyle = palette.accent;
    ctx.font = `800 32px ${FONT}`;
    ctx.fillText(board.title.toUpperCase(), PAD + 28, panelTop + BOARD_TITLE_H / 2 + 4);
    const rowsTop = panelTop + BOARD_TITLE_H;
    const right = W - PAD - 28;
    top.forEach((player, i) => {
      const cy = rowsTop + BOARD_ROW_H * (i + 0.5);
      ctx.fillStyle = palette.rule;
      ctx.fillRect(PAD + 20, rowsTop + BOARD_ROW_H * i - 1, INNER - 40, 2);
      ctx.textAlign = "center";
      ctx.fillStyle = palette.muted;
      ctx.font = `700 28px ${FONT}`;
      ctx.fillText(String(i + 1), PAD + 44, cy);
      const name = nameOf(player.playerId);
      const url = photoOf(player.playerId);
      drawBadge(ctx, url ? (photos.get(url) ?? null) : null, monogram(name), avatarColorFor(name), PAD + 106, cy, 34);

      const value = String(board.value(player));
      ctx.textAlign = "right";
      ctx.fillStyle = palette.accent;
      ctx.font = `800 40px ${FONT}`;
      ctx.fillText(value, right, cy);
      const textX = PAD + 156;
      const width = right - ctx.measureText(value).width - 24 - textX;
      ctx.textAlign = "left";
      ctx.fillStyle = palette.text;
      drawFitted(ctx, name, 700, 30, 20, width, textX, cy - 17);
      ctx.fillStyle = palette.muted;
      drawFitted(ctx, board.detail(player), 500, 23, 16, width, textX, cy + 21);
    });
    panelTop += height(top) + CARD_GAP;
  });
  return canvasBlob(canvas);
}

// ===== Stats =====

const TILE_COLS = 3;
const TILE_GAP = 14;
const TILE_W = (INNER - TILE_GAP * (TILE_COLS - 1)) / TILE_COLS;
const TILE_H = 132;

function drawStatsCard({ tournament, matches }: TournamentCardData) {
  const stats = tournamentStats(matches);
  return drawStatGroups(startFor(tournament), tournamentStatGroups(stats), `${count(stats.completed, "match", "matches")} completed`);
}

export async function drawStatGroups(start: StartCard, groups: StatGroup[], detail: string) {
  const groupH = (tiles: number) => {
    const rows = Math.ceil(tiles / TILE_COLS);
    return SECTION_H + rows * TILE_H + (rows - 1) * TILE_GAP;
  };
  const contentH = groups.reduce((sum, group, i) => sum + (i ? CARD_GAP : 0) + groupH(group.tiles.length), 0);
  const { canvas, ctx, palette } = await start(contentH, "STATS", detail);

  let top = CARD_CONTENT_TOP;
  groups.forEach((group) => {
    drawSectionTitle(ctx, palette, group.title, top);
    group.tiles.forEach(([label, value, share, owner], i) => {
      const x = PAD + (i % TILE_COLS) * (TILE_W + TILE_GAP);
      const y = top + SECTION_H + Math.floor(i / TILE_COLS) * (TILE_H + TILE_GAP);
      ctx.fillStyle = palette.panel;
      roundRect(ctx, x, y, TILE_W, TILE_H, 18);
      const textX = x + 20;
      const width = TILE_W - 40;
      ctx.textAlign = "left";
      ctx.fillStyle = palette.text;
      ctx.font = `800 44px ${FONT}`;
      ctx.fillText(String(value), textX, y + 50);
      const note = share ?? owner;
      if (note) {
        const valueW = ctx.measureText(String(value)).width;
        ctx.textAlign = "right";
        ctx.fillStyle = palette.accent;
        drawFitted(ctx, String(note), 700, 22, 15, Math.max(40, width - valueW - 12), x + TILE_W - 20, y + 52);
      }
      ctx.textAlign = "left";
      ctx.fillStyle = palette.muted;
      drawFitted(ctx, String(label), 500, 24, 16, width, textX, y + 100);
    });
    top += groupH(group.tiles.length) + CARD_GAP;
  });
  return canvasBlob(canvas);
}

// ===== Which is shared =====

// The tab's message, and its picture when the tab has something to show.
export function tournamentTabShare(tab: TournamentShareTab, data: TournamentCardData): { text: string; subject: string; draw?: Draw } {
  const { tournament, matches } = data;
  const name = tournament.name;
  switch (tab) {
    case "info":
      return { subject: "tournament", text: `${name} on RunMitra`, draw: () => drawProfileCard(data) };
    case "matches": {
      const days = upcomingFixtures(tournament, matches);
      if (days.length > 0) return { subject: "fixtures", text: fixturesText(`${name} fixtures`, days), draw: () => drawFixturesTabCard(data) };
      if (latestResults(matches).length > 0) return { subject: "results", text: `${name} results on RunMitra`, draw: () => drawResultsCard(data) };
      return { subject: "matches", text: `${name} on RunMitra` };
    }
    case "teams":
      return { subject: "teams", text: `The teams in ${name} on RunMitra`, draw: tournament.teams.length > 0 ? () => drawTeamsCard(data) : undefined };
    case "points": {
      const standings = shareableStandings(tournament, matches);
      return {
        subject: "points-table",
        text: `${name} points table on RunMitra`,
        draw: standings.tables.length > 0 ? () => drawPointsTableCard(tournament, standings) : undefined,
      };
    }
    case "heroes":
      return {
        subject: "heroes",
        text: `The heroes of ${name} on RunMitra`,
        draw: wasScored(matches) && tournamentHeroes(matches).length > 0 ? () => drawHeroesCard(data) : undefined,
      };
    case "stats":
      return {
        subject: "leaderboard",
        text: `${name} leaderboard on RunMitra`,
        draw: wasScored(matches) && leaderboards(matches).length > 0 ? () => drawLeaderboardCard(data) : undefined,
      };
    case "totals":
      return { subject: "stats", text: `${name} stats on RunMitra`, draw: tournamentStats(matches).matches > 0 ? () => drawStatsCard(data) : undefined };
  }
}
