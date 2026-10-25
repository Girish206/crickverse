import { useCallback } from "react";
import type { CricketPlayer, CricketTeam, CricketTournament } from "../../../api/types";
import { avatarColorFor } from "../avatarColor";
import { roleOf } from "../playerRoles";
import { roleTagsFor } from "./TeamRoleChips";
import { AMBER, CARD_TOP, canvasBlob, drawCardFrame, ellipsize, fitFont, FONT, loadImage, NAVY, RED, roundRect, ShareCardSheet, W } from "./shareCard";

interface SquadEntry {
  name: string;
  photoUrl: string | null;
  role: string | null;
  tags: string[];
}

// Announced the way boards do: captain, vice-captain, then batters,
// keepers, all-rounders and bowlers (players without a role last).
const ROLE_ORDER: Record<string, number> = { batter: 0, "wicket-keeper": 1, "all-rounder": 2, bowler: 3 };

function squadOrder(team: CricketTeam, playerById: Map<number, CricketPlayer>): SquadEntry[] {
  const rank = (id: number) => {
    if (id === team.captainId) return -2;
    if (id === team.viceCaptainId) return -1;
    if (id === team.keeperId) return ROLE_ORDER["wicket-keeper"];
    return ROLE_ORDER[playerById.get(id)?.role ?? ""] ?? 4;
  };
  return [...team.playerIds]
    .sort((a, b) => rank(a) - rank(b))
    .map((id) => {
      const player = playerById.get(id);
      return {
        name: player?.name ?? "Removed player",
        photoUrl: player?.photoUrl ?? null,
        role: roleOf(player?.role ?? null)?.label ?? null, tags: roleTagsFor(team, id),
      };
    });
}

// "Team squad for Tournament: A (c), B (vc), C, D (wk)".
function squadText(teamName: string, tournamentName: string, squad: SquadEntry[]) {
  const names = squad.map((p) => (p.tags.length ? `${p.name} (${p.tags.map((t) => t.toLowerCase()).join(", ")})` : p.name));
  return `🏏 ${teamName} squad for ${tournamentName}:\n\n${names.join(", ")}`;
}

const H = 1080;

// A name on one line if it fits (shrinking a little), else split over two,
// the second truncated if still too long. Leaves ctx.font set for drawing.
function nameLines(ctx: CanvasRenderingContext2D, name: string, size: number, width: number) {
  const min = Math.round(size * 0.8);
  if (fitFont(ctx, name, 700, size, min, width) > min || ctx.measureText(name).width <= width) return [name];
  // Break at a space, or before a bracketed nickname: "Anand(Takki)".
  const breaks = [...name.matchAll(/ |(?=\()/g)].map((m) => m.index).filter((at) => at > 0);
  if (!breaks.length) return [ellipsize(ctx, name, width)];
  const fitting = breaks.filter((at) => ctx.measureText(name.slice(0, at).trim()).width <= width);
  const at = fitting.length ? fitting[fitting.length - 1] : breaks[0];
  return [ellipsize(ctx, name.slice(0, at).trim(), width), ellipsize(ctx, name.slice(at).trim(), width)];
}

const TAG_COLORS: Record<string, [string, string]> = {
  C: [AMBER, NAVY],
  VC: ["#ffffff", NAVY],
  WK: [RED, "#ffffff"],
};

// The squad card: tournament up top, the team name, then a portrait card
// per player (photo, name and role), in the brand's flag colours.
async function drawSquadCard(tournament: CricketTournament, teamName: string, squad: SquadEntry[]) {
  const { canvas, ctx } = await drawCardFrame(tournament, H, teamName, "SQUAD", `${squad.length} PLAYERS`);
  const mid = W / 2;

  // The players as portrait cards, laid out with however many columns gives
  // the biggest cards, the grid centred in the space.
  const top = CARD_TOP;
  const bottom = 1000;
  const gridPad = 60;
  const gridW = W - gridPad * 2;
  const gap = 18;
  const aspect = 0.7;
  let layout = { cols: 1, rows: 1, tileW: 0, tileH: 0 };
  for (let cols = 1; cols <= 6; cols++) {
    const rows = Math.max(1, Math.ceil(squad.length / cols));
    const tileH = Math.min((gridW - gap * (cols - 1)) / cols / aspect, (bottom - top - gap * (rows - 1)) / rows, 420);
    if (tileH * aspect * tileH > layout.tileW * layout.tileH) layout = { cols, rows, tileW: tileH * aspect, tileH };
  }
  const { cols, rows, tileW, tileH } = layout;
  const gridTop = top + (bottom - top - (tileH * rows + gap * (rows - 1))) / 2;
  const photos = await Promise.all(squad.map((p) => (p.photoUrl ? loadImage(p.photoUrl) : Promise.resolve(null))));
  const nameSize = Math.round(Math.min(34, Math.max(18, tileW * 0.115)));
  const roleSize = Math.round(nameSize * 0.6);
  const lastRowStart = squad.length - (squad.length % cols || cols);
  squad.forEach((p, i) => {
    const inRow = i >= lastRowStart ? squad.length - lastRowStart : cols;
    const x = mid - (inRow * tileW + (inRow - 1) * gap) / 2 + (i % cols) * (tileW + gap);
    const y = gridTop + Math.floor(i / cols) * (tileH + gap);
    const radius = Math.round(tileW * 0.08);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, tileW, tileH, radius);
    ctx.clip();
    const img = photos[i];
    if (img) {
      // Cover the card, keeping the top of the photo (where the face is).
      const scale = Math.max(tileW / img.width, tileH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, x + (tileW - w) / 2, y + (tileH - h) * 0.2, w, h);
    } else {
      const color = avatarColorFor(p.name);
      const fill = ctx.createLinearGradient(x, y, x + tileW, y + tileH);
      fill.addColorStop(0, color);
      fill.addColorStop(1, NAVY);
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, tileW, tileH);
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = `800 ${Math.round(tileH * 0.36)}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(p.name.charAt(0).toUpperCase(), x + tileW / 2, y + tileH * 0.38);
    }
    // Dark fade at the bottom for the name.
    const fade = ctx.createLinearGradient(0, y + tileH * 0.45, 0, y + tileH);
    fade.addColorStop(0, "rgba(20, 6, 7, 0)");
    fade.addColorStop(1, "rgba(20, 6, 7, 0.95)");
    ctx.fillStyle = fade;
    ctx.fillRect(x, y, tileW, tileH);
    ctx.restore();

    ctx.beginPath();
    ctx.roundRect(x, y, tileW, tileH, radius);
    ctx.lineWidth = p.tags.includes("C") ? 5 : 2;
    ctx.strokeStyle = p.tags.includes("C") ? AMBER : "rgba(255, 255, 255, 0.14)";
    ctx.stroke();

    // C / VC / WK badges in the top-right corner.
    const tagSize = Math.round(Math.max(16, tileW * 0.085));
    ctx.font = `800 ${tagSize}px ${FONT}`;
    ctx.textAlign = "center";
    let tagRight = x + tileW - 10;
    [...p.tags].reverse().forEach((tag) => {
      const [fill, ink] = TAG_COLORS[tag] ?? [AMBER, NAVY];
      const w = ctx.measureText(tag).width + tagSize;
      ctx.fillStyle = fill;
      roundRect(ctx, tagRight - w, y + 10, w, tagSize * 1.6, 7);
      ctx.fillStyle = ink;
      ctx.fillText(tag, tagRight - w / 2, y + 10 + tagSize * 0.82);
      tagRight -= w + 6;
    });

    // Name (one or two lines) over the role, at the bottom.
    const cx = x + tileW / 2;
    let lineY = y + tileH - 14 - (p.role ? roleSize * 1.5 : 0) - nameSize * 0.55;
    if (p.role) {
      ctx.fillStyle = AMBER;
      ctx.font = `700 ${roleSize}px ${FONT}`;
      ctx.fillText(p.role.toUpperCase(), cx, y + tileH - 14 - roleSize * 0.6);
    }
    ctx.fillStyle = "#ffffff";
    const lines = nameLines(ctx, p.name, nameSize, tileW - 16);
    [...lines].reverse().forEach((line) => {
      ctx.fillText(line, cx, lineY);
      lineY -= nameSize * 1.08;
    });
    ctx.textAlign = "left";
  });

  return canvasBlob(canvas);
}

export function ShareSquadSheet({
  tournament,
  team,
  playerById,
  onClose,
}: {
  tournament: CricketTournament;
  team: CricketTeam;
  playerById: Map<number, CricketPlayer>;
  onClose: () => void;
}) {
  const squad = squadOrder(team, playerById);
  const draw = useCallback(
    () => drawSquadCard(tournament, team.name, squadOrder(team, playerById)),
    [tournament, team, playerById],
  );
  return (
    <ShareCardSheet
      title="Share squad"
      shareTitle={`${team.name} squad`}
      what="squad"
      fileName={`${team.name.replace(/[^\w]+/g, "-").toLowerCase()}-squad.png`}
      text={squadText(team.name, tournament.name, squad)}
      draw={draw}
      onClose={onClose}
    />
  );
}
