import type { CricketTournament } from "../../../api/types";
import { ellipsize, fitFont, FONT, loadImage, roundRect, W } from "./shareCard";
import { logoFor } from "./tournamentArt";

// What the share cards with the RunMitra header (a match, a points table)
// have in common: the colours of the viewer's theme, the header and the
// badges.

export type Ctx = CanvasRenderingContext2D;
export type Picture = HTMLImageElement | null;

export const PAD = 32;
export const INNER = W - PAD * 2;
// The RunMitra logo's strip across the top; everything else sits below it.
const BRAND_H = 104;
export const CARD_CONTENT_TOP = BRAND_H + 190;
export const CARD_GAP = 28;
export const CARD_FOOT_H = 32;
export const CARD_RED = "#d7261e";

const BRAND_LOGO_H = 72;
const BRAND_LOGO_W = Math.round((BRAND_LOGO_H * 268.5) / 64);

export interface CardPalette {
  background: string;
  panel: string;
  rule: string;
  text: string;
  muted: string;
  accent: string;
  // Behind a row that stands out.
  highlight: string;
}

const DARK: CardPalette = {
  background: "#1c2028",
  panel: "rgba(255, 255, 255, 0.07)",
  rule: "rgba(255, 255, 255, 0.1)",
  text: "#ffffff",
  muted: "rgba(255, 255, 255, 0.6)",
  accent: "#d9bd74",
  highlight: "rgba(217, 189, 116, 0.12)",
};

const LIGHT: CardPalette = {
  background: "#ffffff",
  panel: "#f2f4f7",
  rule: "rgba(23, 26, 32, 0.1)",
  text: "#171a20",
  muted: "rgba(23, 26, 32, 0.62)",
  accent: "#7d5f1a",
  highlight: "rgba(184, 146, 62, 0.16)",
};

// The site and the app both mark the theme on <body> (useDarkTheme).
export const cardPalette = () => (document.body.classList.contains("dark-theme") ? DARK : LIGHT);

export const loadCardFonts = () =>
  Promise.all([500, 600, 700, 800].map((weight) => document.fonts.load(`${weight} 40px Outfit`))).catch(() => {});

// Each distinct picture loaded once, by its address.
export async function loadPictures(urls: (string | null | undefined)[]) {
  const distinct = [...new Set(urls.filter((url): url is string => Boolean(url)))];
  return new Map(await Promise.all(distinct.map(async (url) => [url, await loadImage(url)] as const)));
}

export interface CardPill {
  label: string;
  fill: string;
  text: string;
  outline?: string;
}

// Scales the picture to fill the box, cut evenly from the sides. `focusY` is
// how much of any spare height comes off the top (0 keeps the top edge). The
// caller clips to the box: cropping by source rectangle misplaces SVG art.
export function drawCover(ctx: Ctx, image: HTMLImageElement, x: number, y: number, w: number, h: number, focusY = 0.5) {
  const scale = Math.max(w / image.width, h / image.height);
  const drawnW = image.width * scale;
  const drawnH = image.height * scale;
  ctx.drawImage(image, x + (w - drawnW) / 2, y + (h - drawnH) * focusY, drawnW, drawnH);
}

// A round team or player badge: the picture, else initials on a colour.
export function drawBadge(ctx: Ctx, picture: Picture, initials: string, color: string, cx: number, cy: number, r: number) {
  ctx.fillStyle = picture ? "#ffffff" : color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  if (picture) {
    ctx.save();
    ctx.clip();
    drawCover(ctx, picture, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    return;
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${Math.round(r * 0.72)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(initials, cx, cy + 2);
}

// The largest size that fits, and "…" if even the smallest doesn't.
export function drawFitted(ctx: Ctx, text: string, weight: number, max: number, min: number, width: number, x: number, y: number) {
  fitFont(ctx, text, weight, max, min, width);
  ctx.fillText(ellipsize(ctx, text, width), x, y);
}

// The backdrop, the RunMitra logo, then a line with the tournament's logo, a
// title over a detail, and a pill on the right.
export function drawBrandedFrame(
  ctx: Ctx,
  height: number,
  palette: CardPalette,
  {
    brand,
    logo,
    badge,
    title,
    detail,
    pill,
  }: { brand: Picture; logo: Picture; badge?: CardHead["badge"]; title: string; detail: string; pill: CardPill },
) {
  ctx.textBaseline = "middle";
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, W, height);
  ctx.fillStyle = CARD_RED;
  ctx.fillRect(0, 0, W, 12);

  // The file sets only a viewBox, so its size is given here.
  if (brand) {
    ctx.drawImage(brand, (W - BRAND_LOGO_W) / 2, 28, BRAND_LOGO_W, BRAND_LOGO_H);
  } else {
    ctx.textAlign = "center";
    ctx.fillStyle = palette.text;
    ctx.font = `800 48px ${FONT}`;
    ctx.fillText("RunMitra", W / 2, 64);
  }
  ctx.fillStyle = palette.rule;
  ctx.fillRect(PAD, BRAND_H + 16, INNER, 2);

  ctx.font = `800 28px ${FONT}`;
  const pillW = ctx.measureText(pill.label).width + 48;
  const pillX = W - PAD - pillW;
  const pillY = BRAND_H + 72;
  ctx.fillStyle = pill.fill;
  roundRect(ctx, pillX, pillY, pillW, 56, 28);
  if (pill.outline) {
    ctx.strokeStyle = pill.outline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(pillX + 1, pillY + 1, pillW - 2, 54, 27);
    ctx.stroke();
  }
  ctx.fillStyle = pill.text;
  ctx.textAlign = "center";
  ctx.fillText(pill.label, pillX + pillW / 2, BRAND_H + 101);

  let x = PAD;
  if (logo || badge) {
    drawBadge(ctx, logo, badge?.initials ?? "", badge?.color ?? "#ffffff", PAD + 48, BRAND_H + 100, 48);
    x += 120;
  }
  const width = pillX - 28 - x;
  ctx.textAlign = "left";
  ctx.fillStyle = palette.accent;
  drawFitted(ctx, title, 800, 40, 28, width, x, BRAND_H + 80);
  ctx.fillStyle = palette.muted;
  drawFitted(ctx, detail, 500, 28, 22, width, x, BRAND_H + 126);
}

// Whose card it is: the name and logo on its header line, and the initials
// to show where there's no logo to draw.
export interface CardHead {
  title: string;
  logoUrl?: string | null;
  badge?: { initials: string; color: string };
}

// A card's canvas with its frame drawn, as tall as `contentH` needs; the
// caller draws from CARD_CONTENT_TOP down.
export async function startBrandedCard(head: CardHead, contentH: number, pillLabel: string, detail: string) {
  await loadCardFonts();
  const [brand, logo] = await Promise.all([loadImage("/logo.svg"), head.logoUrl ? loadImage(head.logoUrl) : null]);
  const height = CARD_CONTENT_TOP + contentH + CARD_FOOT_H;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const palette = cardPalette();
  drawBrandedFrame(ctx, height, palette, {
    brand,
    logo,
    badge: head.badge,
    title: head.title,
    detail,
    pill: { label: pillLabel, fill: CARD_RED, text: "#ffffff" },
  });
  return { canvas, ctx, palette };
}

// Starts a card whose header is already settled (a tournament's, a team's).
export type StartCard = (contentH: number, pillLabel: string, detail: string) => ReturnType<typeof startBrandedCard>;

export const startTournamentCard = (
  tournament: Pick<CricketTournament, "id" | "name" | "logoUrl">,
  contentH: number,
  pillLabel: string,
  detail: string,
) => startBrandedCard({ title: tournament.name, logoUrl: logoFor(tournament) }, contentH, pillLabel, detail);
