import { ballsPerOverOf, type CricketMatch, type CricketMatchStatus, type CricketTournament } from "../../../api/types";
import { monogram } from "../../../utils/format";
import { avatarColorFor } from "../avatarColor";
import { impactLine, matchAwards, points, type ImpactRow, type NameOf } from "../stats";
import {
  CARD_CONTENT_TOP,
  CARD_FOOT_H,
  CARD_GAP,
  CARD_RED,
  cardPalette,
  drawBadge,
  drawBrandedFrame,
  drawCover,
  drawFitted,
  INNER,
  loadCardFonts,
  PAD,
  type CardPalette,
  type CardPill,
  type Ctx,
  type Picture,
} from "../tournaments/brandedCard";
import { AMBER, canvasBlob, FONT, loadImage, NAVY, roundRect, W } from "../tournaments/shareCard";
import { logoFor } from "../tournaments/tournamentArt";
import { battingOrder, matchHeading, matchStateLine, matchTeamColors, teamScore, withoutRoleMark } from "./matchUtils";

// The picture a match is shared as, and the message sent with it. Both follow
// the match's status: an upcoming match is its face-off and start time, a
// live one the score and state of play, a finished one the result and its
// player of the match. The card takes the colours of the viewer's theme.

export interface MatchCardData {
  match: CricketMatch;
  tournament: Pick<CricketTournament, "id" | "name" | "logoUrl"> | null | undefined;
  nameOf: NameOf;
  photoOf: (playerId: number) => string | null | undefined;
}

const SCORE_ROW_H = 150;
const SCORE_LINE_H = 96;
const FACE_OFF_H = 560;
const FACE_OFF_PLACE_H = 70;
const STRIP_H = 170;
// The award card's proportions on the site (255 tall by 300 wide).
const PHOTO_H = Math.round((INNER * 255) / 300);
const PHOTO_BODY_H = 190;

// The same colours as the app's status badge (.cricket-match-status).
const STATUS_PILLS: Record<CricketMatchStatus, CardPill> = {
  scheduled: { label: "UPCOMING", fill: AMBER, text: NAVY },
  live: { label: "LIVE", fill: CARD_RED, text: "#ffffff" },
  completed: { label: "RESULT", fill: "#ffffff", text: NAVY, outline: "rgba(23, 26, 32, 0.16)" },
  abandoned: { label: "ABANDONED", fill: "#444850", text: "#ffffff" },
};

export function matchShareHeading(match: CricketMatch) {
  if (match.status === "live") return "Share live score";
  if (match.status === "completed") return "Share result";
  return "Share match";
}

function whenText(at: Date) {
  const day = at.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const time = at.toLocaleTimeString(undefined, { hour: "numeric", hour12: true, minute: "2-digit" });
  return { day, time };
}

// "Strikers 160/7 (18.0)", or just the name before they bat.
function sideText(match: CricketMatch, slot: number) {
  const score = teamScore(match, slot);
  return `${match.teams[slot].name}${score ? ` ${score.runs} (${score.overs})` : ""}`;
}

// The message sent with the link or the image.
export function matchShareText(match: CricketMatch, tournamentName?: string | null) {
  const [first, second] = battingOrder(match);
  const fixture = `${match.teams[0].name} vs ${match.teams[1].name}`;
  const scores = `${sideText(match, first)} vs ${sideText(match, second)}`;
  const inTournament = tournamentName ? ` · ${tournamentName}` : "";
  switch (match.status) {
    case "scheduled": {
      const at = match.scheduledAt ? whenText(new Date(match.scheduledAt)) : null;
      const details = [at && `${at.day}, ${at.time}`, match.venue].filter(Boolean).join(" · ");
      return `Upcoming: ${fixture}${inTournament}${details ? `\n${details}` : ""}`;
    }
    case "live": {
      const state = matchStateLine(match);
      return `LIVE: ${scores}${inTournament}${state ? `\n${state}` : ""}`;
    }
    case "completed":
      return `${scores}${inTournament}${match.resultText ? `\n${match.resultText}` : ""}`;
    case "abandoned":
      return `Abandoned: ${fixture}${inTournament}`;
  }
}

// The line under the scores: the result, or where the game is.
function scoreboardLine(match: CricketMatch) {
  if (match.resultText) return match.resultText;
  if (match.status === "abandoned") return "Match abandoned";
  const state = matchStateLine(match);
  if (state) return state;
  if (match.tossWinner !== null && match.tossDecision) {
    return `${match.teams[match.tossWinner].name} won the toss and chose to ${match.tossDecision}`;
  }
  return null;
}

const scoreboardHeight = (match: CricketMatch) => SCORE_ROW_H * 2 + (scoreboardLine(match) ? SCORE_LINE_H : 0);

// Both sides with their scores, batting first on top, then the result.
function drawScoreboard(ctx: Ctx, palette: CardPalette, match: CricketMatch, logos: Picture[], top: number) {
  const height = scoreboardHeight(match);
  const colors = matchTeamColors(match);
  const current = match.innings[match.innings.length - 1];
  const battingNow = match.status === "live" && current ? current.battingTeam : null;
  ctx.fillStyle = palette.panel;
  roundRect(ctx, PAD, top, INNER, height, 24);

  const right = W - PAD - 36;
  battingOrder(match).forEach((slot, i) => {
    const cy = top + SCORE_ROW_H * (i + 0.5);
    const badgeX = PAD + 36 + 48;
    drawBadge(ctx, logos[slot], monogram(match.teams[slot].name), colors[slot], badgeX, cy, 48);
    if (battingNow === slot) {
      ctx.fillStyle = CARD_RED;
      ctx.beginPath();
      ctx.arc(badgeX + 36, cy - 36, 13, 0, Math.PI * 2);
      ctx.fill();
    }

    const score = teamScore(match, slot);
    let scoreLeft = right;
    ctx.textAlign = "right";
    if (score) {
      ctx.fillStyle = palette.text;
      ctx.font = `800 68px ${FONT}`;
      ctx.fillText(score.runs, right, cy);
      scoreLeft -= ctx.measureText(score.runs).width + 14;
      ctx.fillStyle = palette.muted;
      ctx.font = `500 28px ${FONT}`;
      const overs = `(${score.overs})`;
      ctx.fillText(overs, scoreLeft, cy + 10);
      scoreLeft -= ctx.measureText(overs).width;
    } else if (match.status === "live") {
      ctx.fillStyle = palette.muted;
      ctx.font = `500 30px ${FONT}`;
      ctx.fillText("Yet to bat", right, cy);
      scoreLeft -= ctx.measureText("Yet to bat").width;
    }

    const lost = match.status === "completed" && match.winner !== null && match.winner !== slot;
    const nameX = badgeX + 48 + 24;
    ctx.textAlign = "left";
    ctx.fillStyle = lost ? palette.muted : palette.text;
    drawFitted(ctx, match.teams[slot].name, 700, 40, 26, scoreLeft - 24 - nameX, nameX, cy);
  });

  const line = scoreboardLine(match);
  if (line) {
    ctx.fillStyle = palette.rule;
    ctx.fillRect(PAD + 36, top + SCORE_ROW_H * 2, INNER - 72, 2);
    ctx.textAlign = "center";
    ctx.fillStyle = match.resultText ? palette.accent : palette.text;
    drawFitted(ctx, line, 700, 38, 24, INNER - 72, W / 2, top + SCORE_ROW_H * 2 + SCORE_LINE_H / 2);
  }
}

const faceOffHeight = (match: CricketMatch) => FACE_OFF_H + (match.venue || match.city ? FACE_OFF_PLACE_H : 0);

// An upcoming match: the two sides facing each other, then when and where.
function drawFaceOff(ctx: Ctx, palette: CardPalette, match: CricketMatch, logos: Picture[], top: number) {
  const colors = matchTeamColors(match);
  ctx.fillStyle = palette.panel;
  roundRect(ctx, PAD, top, INNER, faceOffHeight(match), 24);

  const badgeY = top + 150;
  const side = (slot: number, cx: number) => {
    drawBadge(ctx, logos[slot], monogram(match.teams[slot].name), colors[slot], cx, badgeY, 110);
    ctx.textAlign = "center";
    ctx.fillStyle = palette.text;
    drawFitted(ctx, match.teams[slot].name, 700, 44, 26, 380, cx, badgeY + 160);
  };
  side(0, W * 0.27);
  side(1, W * 0.73);
  ctx.textAlign = "center";
  ctx.fillStyle = palette.accent;
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText("VS", W / 2, badgeY);

  ctx.fillStyle = palette.rule;
  ctx.fillRect(PAD + 36, top + 372, INNER - 72, 2);
  const at = match.scheduledAt ? whenText(new Date(match.scheduledAt)) : null;
  ctx.fillStyle = palette.text;
  if (at) {
    ctx.font = `800 72px ${FONT}`;
    ctx.fillText(at.time, W / 2, top + 442);
    ctx.fillStyle = palette.muted;
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText(at.day, W / 2, top + 508);
  } else {
    ctx.font = `700 44px ${FONT}`;
    ctx.fillText("Time to be announced", W / 2, top + 464);
  }
  const place = [match.venue, match.city].filter(Boolean).join(", ");
  if (place) {
    ctx.fillStyle = palette.muted;
    drawFitted(ctx, place, 500, 32, 22, INNER - 72, W / 2, top + 578);
  }
}

// The points on the right of a player's panel, under a small label.
function drawPoints(ctx: Ctx, palette: CardPalette, row: ImpactRow, right: number, cy: number) {
  ctx.textAlign = "right";
  ctx.fillStyle = palette.muted;
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText("MVP", right, cy - 38);
  ctx.fillStyle = palette.accent;
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText(points(row.total), right, cy + 12);
  return ctx.measureText(points(row.total)).width;
}

// A compact player panel: "MVP so far", or a player of the match with no photo.
function drawPlayerStrip(ctx: Ctx, palette: CardPalette, data: MatchCardData, title: string, row: ImpactRow, photo: Picture, top: number) {
  const name = data.nameOf(row.playerId);
  const cy = top + STRIP_H / 2;
  ctx.fillStyle = palette.panel;
  roundRect(ctx, PAD, top, INNER, STRIP_H, 24);
  drawBadge(ctx, photo, monogram(withoutRoleMark(name)), avatarColorFor(withoutRoleMark(name)), PAD + 32 + 56, cy, 56);
  const right = W - PAD - 36;
  const pointsW = drawPoints(ctx, palette, row, right, cy);

  const x = PAD + 32 + 112 + 28;
  const width = right - pointsW - 28 - x;
  ctx.textAlign = "left";
  ctx.fillStyle = palette.accent;
  drawFitted(ctx, title.toUpperCase(), 800, 24, 20, width, x, cy - 50);
  ctx.fillStyle = palette.text;
  drawFitted(ctx, name, 700, 40, 26, width, x, cy - 6);
  ctx.fillStyle = palette.muted;
  drawFitted(ctx, impactLine(row, ballsPerOverOf(data.match)), 500, 28, 22, width, x, cy + 42);
}

// The player of the match with their photo, as tall as the card's main event.
function drawPlayerPhoto(ctx: Ctx, palette: CardPalette, data: MatchCardData, row: ImpactRow, photo: HTMLImageElement, top: number) {
  const name = data.nameOf(row.playerId);
  ctx.fillStyle = palette.panel;
  roundRect(ctx, PAD, top, INNER, PHOTO_H + PHOTO_BODY_H, 24);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(PAD, top, INNER, PHOTO_H, [24, 24, 0, 0]);
  ctx.clip();
  // Kept to its top edge, as on the site: faces sit high in a portrait.
  drawCover(ctx, photo, PAD, top, INNER, PHOTO_H, 0);
  ctx.restore();

  const ribbon = "Player of the match";
  ctx.font = `800 30px ${FONT}`;
  const ribbonW = ctx.measureText(ribbon).width + 56;
  ctx.fillStyle = CARD_RED;
  ctx.beginPath();
  ctx.roundRect(PAD, top, ribbonW, 68, [24, 0, 24, 0]);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(ribbon, PAD + 28, top + 35);

  const bodyTop = top + PHOTO_H;
  const right = W - PAD - 36;
  const pointsW = drawPoints(ctx, palette, row, right, bodyTop + PHOTO_BODY_H / 2);
  const x = PAD + 36;
  const width = right - pointsW - 28 - x;
  ctx.textAlign = "left";
  ctx.fillStyle = palette.text;
  drawFitted(ctx, name, 800, 52, 30, width, x, bodyTop + 52);
  ctx.fillStyle = palette.muted;
  drawFitted(ctx, data.match.teams[row.team]?.name ?? "", 500, 30, 22, width, x, bodyTop + 102);
  ctx.fillStyle = palette.text;
  drawFitted(ctx, impactLine(row, ballsPerOverOf(data.match)), 600, 32, 22, width, x, bodyTop + 148);
}

// Which player the card features, if any.
function featuredPlayer(match: CricketMatch) {
  if (match.status === "live") {
    const leader = matchAwards(match).rows[0];
    return leader ? { title: "MVP so far", row: leader } : null;
  }
  if (match.status === "completed") {
    const best = matchAwards(match).playerOfMatch;
    return best ? { title: "Player of the match", row: best } : null;
  }
  return null;
}

export async function drawMatchCard(data: MatchCardData) {
  const { match, tournament, photoOf } = data;
  await loadCardFonts();

  const featured = featuredPlayer(match);
  const photoUrl = featured ? photoOf(featured.row.playerId) : null;
  const [brand, logo, teamLogos, photo] = await Promise.all([
    loadImage("/logo.svg"),
    tournament ? loadImage(logoFor(tournament)) : Promise.resolve(null),
    Promise.all(match.teams.map((team) => (team.logoUrl ? loadImage(team.logoUrl) : Promise.resolve(null)))),
    photoUrl ? loadImage(photoUrl) : Promise.resolve(null),
  ]);
  // Only a finished match leads with the photo; the live card stays compact.
  const bigPhoto = match.status === "completed" && photo ? photo : null;

  let contentH = match.status === "scheduled" ? faceOffHeight(match) : scoreboardHeight(match);
  if (featured) contentH += CARD_GAP + (bigPhoto ? PHOTO_H + PHOTO_BODY_H : STRIP_H);
  const height = CARD_CONTENT_TOP + contentH + CARD_FOOT_H;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const palette = cardPalette();
  const overs = `${match.overs} over${match.overs === 1 ? "" : "s"}`;
  drawBrandedFrame(ctx, height, palette, {
    brand,
    logo,
    title: tournament?.name ?? `${match.teams[0].name} vs ${match.teams[1].name}`,
    detail: `${matchHeading(match)} · ${overs}`,
    pill: STATUS_PILLS[match.status],
  });

  if (match.status === "scheduled") {
    drawFaceOff(ctx, palette, match, teamLogos, CARD_CONTENT_TOP);
  } else {
    drawScoreboard(ctx, palette, match, teamLogos, CARD_CONTENT_TOP);
    if (featured) {
      const top = CARD_CONTENT_TOP + scoreboardHeight(match) + CARD_GAP;
      if (bigPhoto) drawPlayerPhoto(ctx, palette, data, featured.row, bigPhoto, top);
      else drawPlayerStrip(ctx, palette, data, featured.title, featured.row, photo, top);
    }
  }
  return canvasBlob(canvas);
}
