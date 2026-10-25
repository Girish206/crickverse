import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { CricketTournament } from "../../../api/types";
import { BottomSheet } from "../BottomSheet";
import { logoFor } from "./tournamentArt";

// Shared by the share cards (squad, fixtures): the canvas helpers, the
// branded frame every card is drawn in, and the sheet that shows a card
// with Share / Download / Copy as text.

export const W = 1080;
export const NAVY = "#2a0f12";
export const RED = "#d7261e";
export const AMBER = "#ffcd00";
export const FONT = "Outfit, system-ui, sans-serif";

export const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

// Largest size (down to `min`) at which the text fits, else `min`.
export function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, max: number, min: number, width: number) {
  let size = max;
  ctx.font = `${weight} ${size}px ${FONT}`;
  while (size > min && ctx.measureText(text).width > width) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${FONT}`;
  }
  return size;
}

export function ellipsize(ctx: CanvasRenderingContext2D, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

// Where a card's own content starts, below the frame's header.
export const CARD_TOP = 350;

// A W × height canvas with the backdrop, flag band, centred header (logo,
// tournament, place, heading, then a pill with a count beside it) and the
// footer drawn; the caller draws its content from CARD_TOP down to
// height - 80.
export async function drawCardFrame(
  tournament: CricketTournament,
  height: number,
  heading: string,
  pillLabel: string,
  count: string,
) {
  await Promise.all([document.fonts.load(`800 80px Outfit`), document.fonts.load(`600 30px Outfit`)]).catch(() => {});
  const logo = await loadImage(logoFor(tournament));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, W, height);
  bg.addColorStop(0, "#3a1216");
  bg.addColorStop(1, "#140607");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, height);
  // A soft red glow behind the header.
  const glow = ctx.createRadialGradient(W, 0, 0, W, 0, 700);
  glow.addColorStop(0, "rgba(215, 38, 30, 0.45)");
  glow.addColorStop(1, "rgba(215, 38, 30, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, height);
  // Flag band.
  ctx.fillStyle = AMBER;
  ctx.fillRect(0, 0, W, 10);
  ctx.fillStyle = RED;
  ctx.fillRect(0, 10, W, 10);

  const pad = 80;
  const mid = W / 2;
  if (logo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(mid, 76, 38, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.clip();
    ctx.drawImage(logo, mid - 38, 38, 76, 76);
    ctx.restore();
  }
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = AMBER;
  fitFont(ctx, tournament.name.toUpperCase(), 800, 42, 26, W - pad * 2);
  ctx.fillText(ellipsize(ctx, tournament.name.toUpperCase(), W - pad * 2), mid, 148);
  const place = [tournament.city, tournament.ground].filter(Boolean).join(" · ");
  if (place) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = `500 20px ${FONT}`;
    ctx.fillText(ellipsize(ctx, place, W - pad * 2), mid, 184);
  }

  ctx.fillStyle = "#ffffff";
  fitFont(ctx, heading.toUpperCase(), 800, 80, 48, W - pad * 2);
  ctx.fillText(ellipsize(ctx, heading.toUpperCase(), W - pad * 2), mid, 238);

  // The pill with the count beside it, centred together.
  ctx.font = `800 28px ${FONT}`;
  const pillW = ctx.measureText(pillLabel).width + 44;
  ctx.font = `600 24px ${FONT}`;
  const countW = ctx.measureText(count).width;
  const pillX = mid - (pillW + 16 + countW) / 2;
  const pill = ctx.createLinearGradient(pillX, 0, pillX + pillW, 0);
  pill.addColorStop(0, RED);
  pill.addColorStop(1, "#e8501f");
  ctx.fillStyle = pill;
  roundRect(ctx, pillX, 282, pillW, 46, 23);
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 28px ${FONT}`;
  ctx.fillText(pillLabel, pillX + 22, 306);
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText(count, pillX + pillW + 16, 306);

  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.font = `600 24px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("CRICDESK", mid, height - 38);
  ctx.textAlign = "left";

  return { canvas, ctx };
}

export const canvasBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));

// The sheet showing a drawn card: Share (the image where the device can
// share files — phones — else the text), Download image and Copy as text.
// `draw` should be stable (useCallback) — the card is redrawn when it changes.
export function ShareCardSheet({
  title,
  shareTitle,
  what,
  fileName,
  text,
  draw,
  onClose,
}: {
  title: string;
  // The share target's title, e.g. "Strikers squad".
  shareTitle: string;
  // For the toasts, e.g. "squad" → "Squad copied".
  what: string;
  fileName: string;
  text: string;
  draw: () => Promise<Blob | null>;
  onClose: () => void;
}) {
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    draw().then((blob) => {
      if (cancelled || !blob) return;
      url = URL.createObjectURL(blob);
      setImage({ blob, url });
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [draw]);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what.charAt(0).toUpperCase()}${what.slice(1)} copied`);
    } catch {
      toast.error(`Couldn't copy the ${what}`);
    }
  }

  function download() {
    if (!image) return;
    const link = document.createElement("a");
    link.href = image.url;
    link.download = fileName;
    link.click();
  }

  async function share() {
    const file = image && new File([image.blob], fileName, { type: "image/png" });
    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: shareTitle, text });
      } else if (navigator.share) {
        await navigator.share({ title: shareTitle, text });
      } else {
        await copyText();
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.error(`Couldn't share the ${what}`);
    }
  }

  return (
    <BottomSheet
      title={title}
      icon="fa-solid fa-share-nodes"
      onClose={onClose}
      footer={
        <button type="button" className="cricket-sheet-submit" onClick={share}>
          <i className="fa-solid fa-share-nodes" aria-hidden="true"></i> Share
        </button>
      }
    >
      <div className="cricket-squad-share">
        {image ? (
          <img src={image.url} alt={`${shareTitle} card`} />
        ) : (
          <div className="cricket-squad-share-loading" aria-hidden="true" />
        )}
        <div className="cricket-squad-share-actions">
          <button type="button" className="cricket-roster-action" onClick={download} disabled={!image}>
            <i className="fa-solid fa-download" aria-hidden="true"></i> Download image
          </button>
          <button type="button" className="cricket-roster-action" onClick={copyText}>
            <i className="fa-solid fa-copy" aria-hidden="true"></i> Copy as text
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
