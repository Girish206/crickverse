import type { CricketTournament } from "../../../api/types";
import { monogram } from "../../../utils/format";
import { avatarColorFor } from "../avatarColor";
import type { ShareableStandings } from "../format/formatEngine";
import type { LeagueTable, PointsRow } from "../stats";
import {
  CARD_CONTENT_TOP,
  CARD_GAP,
  CARD_RED,
  drawBadge,
  drawFitted,
  INNER,
  loadPictures,
  PAD,
  startTournamentCard,
  type CardPalette,
  type Ctx,
  type Picture,
} from "./brandedCard";
import { canvasBlob, FONT, roundRect, W } from "./shareCard";

// A tournament's points table as a picture: one panel per group, in the
// viewer's theme, as tall as the table needs.

const TITLE_H = 72;
const HEAD_H = 60;
const ROW_H = 84;
const PANEL_FOOT_H = 12;
const SIDE = 20;
const TAG_R = 16;

const signedNrr = (nrr: number) => `${nrr >= 0 ? "+" : ""}${nrr.toFixed(3)}`;

const COLUMNS: { label: string; width: number; value: (row: PointsRow) => string; strong?: boolean }[] = [
  { label: "P", width: 58, value: (row) => String(row.played) },
  { label: "W", width: 58, value: (row) => String(row.won) },
  { label: "L", width: 58, value: (row) => String(row.lost) },
  { label: "T/NR", width: 86, value: (row) => String(row.tied + row.noResult) },
  { label: "NRR", width: 130, value: (row) => signedNrr(row.nrr) },
  { label: "PTS", width: 80, value: (row) => String(row.points), strong: true },
];

const COLUMNS_W = COLUMNS.reduce((sum, column) => sum + column.width, 0);

const tableHeight = (table: LeagueTable, titled: boolean) => (titled ? TITLE_H : 0) + HEAD_H + table.rows.length * ROW_H + PANEL_FOOT_H;

function drawTable(ctx: Ctx, palette: CardPalette, table: LeagueTable, titled: boolean, logoOf: (row: PointsRow) => Picture, panelTop: number) {
  const right = W - PAD - SIDE;
  ctx.fillStyle = palette.panel;
  roundRect(ctx, PAD, panelTop, INNER, tableHeight(table, titled), 24);

  let top = panelTop;
  if (titled) {
    ctx.textAlign = "left";
    ctx.fillStyle = palette.accent;
    ctx.font = `800 32px ${FONT}`;
    ctx.fillText(table.title.toUpperCase(), PAD + SIDE + 8, top + TITLE_H / 2 + 4);
    top += TITLE_H;
  }

  // Each column's values centred under its heading, from the right edge in.
  const columnsLeft = right - COLUMNS_W;
  const centres = COLUMNS.map((_, i) => columnsLeft + COLUMNS.slice(0, i).reduce((sum, column) => sum + column.width, 0) + COLUMNS[i].width / 2);

  const headY = top + HEAD_H / 2;
  ctx.fillStyle = palette.muted;
  ctx.font = `700 24px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("TEAM", PAD + SIDE + 8, headY);
  ctx.textAlign = "center";
  COLUMNS.forEach((column, i) => ctx.fillText(column.label, centres[i], headY));
  ctx.fillStyle = palette.rule;
  ctx.fillRect(PAD + SIDE, top + HEAD_H - 1, INNER - SIDE * 2, 2);
  top += HEAD_H;

  // The dashed line goes under the last team through, as in the app's table.
  const { qualify = 0, settled = false } = table;
  const cut = qualify > 0 && qualify < table.rows.length ? qualify : 0;

  table.rows.forEach((row, i) => {
    const cy = top + ROW_H * (i + 0.5);
    if (i === 0 && row.played > 0) {
      ctx.fillStyle = palette.highlight;
      roundRect(ctx, PAD + 8, top + 4, INNER - 16, ROW_H - 8, 16);
    } else if (i > 0 && i !== cut) {
      ctx.fillStyle = palette.rule;
      ctx.fillRect(PAD + SIDE, top + ROW_H * i - 1, INNER - SIDE * 2, 2);
    }

    const rankX = PAD + SIDE + 22;
    ctx.textAlign = "center";
    ctx.fillStyle = palette.muted;
    ctx.font = `700 28px ${FONT}`;
    ctx.fillText(String(i + 1), rankX, cy);

    const badgeX = rankX + 26 + 32;
    drawBadge(ctx, logoOf(row), monogram(row.name), avatarColorFor(row.name), badgeX, cy, 30);

    const nameX = badgeX + 30 + 14;
    ctx.textAlign = "left";
    ctx.fillStyle = palette.text;
    // Once the places are final: Q through, E out.
    const tag = settled && qualify > 0 ? (i < qualify ? { label: "Q", fill: CARD_RED } : { label: "E", fill: "#6b7280" }) : null;
    const nameW = columnsLeft - 10 - nameX - (tag ? TAG_R * 2 + 10 : 0);
    drawFitted(ctx, row.name, 700, 32, 20, nameW, nameX, cy);
    if (tag) {
      const tagX = nameX + Math.min(ctx.measureText(row.name).width, nameW) + 10 + TAG_R;
      ctx.fillStyle = tag.fill;
      ctx.beginPath();
      ctx.arc(tagX, cy, TAG_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = `800 20px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(tag.label, tagX, cy + 1);
    }

    ctx.textAlign = "center";
    COLUMNS.forEach((column, c) => {
      ctx.fillStyle = column.strong ? palette.accent : palette.text;
      ctx.font = column.strong ? `800 36px ${FONT}` : `500 28px ${FONT}`;
      ctx.fillText(column.value(row), centres[c], cy);
    });
  });

  if (cut) {
    const y = top + ROW_H * cut;
    ctx.strokeStyle = CARD_RED;
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(PAD + SIDE, y);
    ctx.lineTo(W - PAD - SIDE, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

export async function drawPointsTableCard(tournament: CricketTournament, { tables, played, total }: ShareableStandings) {
  const titled = tables.length > 1;
  const logos = await loadPictures(tournament.teams.map((team) => team.logoUrl));
  const logoOf = (row: PointsRow) => {
    const url = tournament.teams[row.teamIndex]?.logoUrl;
    return url ? (logos.get(url) ?? null) : null;
  };

  const contentH = tables.reduce((sum, table, i) => sum + (i ? CARD_GAP : 0) + tableHeight(table, titled), 0);
  const detail = `${played} of ${total} match${total === 1 ? "" : "es"} played`;
  const { canvas, ctx, palette } = await startTournamentCard(tournament, contentH, "POINTS TABLE", detail);

  let top = CARD_CONTENT_TOP;
  tables.forEach((table) => {
    drawTable(ctx, palette, table, titled, logoOf, top);
    top += tableHeight(table, titled) + CARD_GAP;
  });
  return canvasBlob(canvas);
}
