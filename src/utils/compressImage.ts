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

// Presets matching where each image is displayed (with room for 2x screens).
// Photos also open full screen (ImageViewer) and go on the share cards, so
// they're kept sharp enough for that: a typical one lands around 60–150 KB,
// thousands of which still fit the database comfortably.
export const PLAYER_PHOTO: CompressOptions = { maxSize: 1080, quality: 0.86, maxBytes: 200 * 1024 };
export const TOURNAMENT_LOGO: CompressOptions = { maxSize: 512, quality: 0.88, maxBytes: 80 * 1024 };
export const TOURNAMENT_BANNER: CompressOptions = { maxSize: 1600, quality: 0.84, maxBytes: 250 * 1024 };

// Below these the image looks too poor, so shrink it instead.
const MIN_QUALITY = 0.65;
const MIN_SIZE = 320;

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

// Scales the image down by halves until the last step, so a big phone photo
// keeps its detail instead of the single-jump scaling's jagged, grainy look.
function downscale(img: HTMLImageElement, width: number, height: number) {
  let source: CanvasImageSource = img;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  while (w / 2 > width && h / 2 > height) {
    w = Math.round(w / 2);
    h = Math.round(h / 2);
    const step = document.createElement("canvas");
    step.width = w;
    step.height = h;
    const ctx = step.getContext("2d");
    if (!ctx) break;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, w, h);
    source = step;
  }
  return source;
}

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
  ctx.drawImage(downscale(img, canvas.width, canvas.height), 0, 0, canvas.width, canvas.height);
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
    if (q > MIN_QUALITY) q = Math.max(MIN_QUALITY, q - 0.05);
    else if (longest * scale > MIN_SIZE) {
      scale = Math.max(MIN_SIZE / longest, scale * 0.85);
      q = quality - 0.1;
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
