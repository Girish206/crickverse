// Uploads are stored inline in the database (see the server's upload
// middleware), so shrink every picked image before it's sent: scale it down
// to the size it's actually shown at and re-encode it as WebP (JPEG where the
// browser can't encode WebP). Returns the original file if that's smaller.

export interface CompressOptions {
  // Longest side in pixels; smaller images are left at their size.
  maxSize: number;
  // 0–1 encoder quality to start from.
  quality?: number;
  // Byte budget: quality, then size, is stepped down until the image fits.
  maxBytes?: number;
}

// The server's upload cap; a compressed image above it is rejected.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

// Every stored image is kept under this.
const TARGET_BYTES = 20 * 1024;

// Presets matching where each image is displayed (with room for 2x screens).
export const PLAYER_PHOTO: CompressOptions = { maxSize: 400, quality: 0.8, maxBytes: TARGET_BYTES };
export const TOURNAMENT_LOGO: CompressOptions = { maxSize: 400, quality: 0.8, maxBytes: TARGET_BYTES };
export const TOURNAMENT_BANNER: CompressOptions = { maxSize: 1200, quality: 0.7, maxBytes: TARGET_BYTES };

// Below these the image looks too poor, so shrink it instead.
const MIN_QUALITY = 0.4;
const MIN_SIZE = 96;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This image can't be read. Try a JPG or PNG."));
    };
    img.src = url;
  });
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

// One encode at the given size: WebP, or JPEG on white where the browser
// can't encode WebP (it hands back a PNG instead).
async function encode(img: HTMLImageElement, scale: number, quality: number, webp: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  if (!webp) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await toBlob(canvas, webp ? "image/webp" : "image/jpeg", quality);
  return blob && blob.type === (webp ? "image/webp" : "image/jpeg") ? blob : null;
}

export async function compressImage(
  file: File,
  { maxSize, quality = 0.8, maxBytes = Infinity }: CompressOptions,
): Promise<File> {
  // Animated / vector images would lose their animation or crispness.
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

  const img = await loadImage(file);
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  let scale = Math.min(1, maxSize / longest);
  let q = quality;
  let webp = true;
  let blob = await encode(img, scale, q, webp);
  if (!blob) {
    webp = false;
    blob = await encode(img, scale, q, webp);
  }
  if (!blob) return file;

  // Over budget: lower the quality first, then the size, until it fits
  // (or the image can't get any smaller).
  while (blob.size > maxBytes) {
    if (q > MIN_QUALITY) q = Math.max(MIN_QUALITY, q - 0.1);
    else if (longest * scale > MIN_SIZE) {
      scale = Math.max(MIN_SIZE / longest, scale * 0.8);
      q = quality - 0.2;
    } else break;
    const next = await encode(img, scale, q, webp);
    if (!next) break;
    blob = next;
  }
  if (blob.size >= file.size && file.size <= maxBytes) return file;

  const ext = webp ? "webp" : "jpg";
  const name = file.name.replace(/\.[^.]*$/, "") + "." + ext;
  return new File([blob], name, { type: blob.type, lastModified: Date.now() });
}
