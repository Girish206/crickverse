import { apiClient } from "../../../api/client";
import type { ApiEnvelope } from "../../../api/types";
import { drawCover } from "./brandedCard";
import { loadImage } from "./shareCard";

// The picture a shared link previews in chat apps: the top of the card, at
// the wide shape they show large. It's a JPEG, as they drop heavy images.
const WIDTH = 1200;
const HEIGHT = 630;

export const linkCanHavePicture = (path: string) => /^\/tournaments\/\d+/.test(path);

function linkPicture(cardUrl: string) {
  return loadImage(cardUrl).then(
    (card) =>
      new Promise<Blob | null>((resolve) => {
        const canvas = document.createElement("canvas");
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        const ctx = canvas.getContext("2d");
        if (!card || !ctx) return resolve(null);
        drawCover(ctx, card, 0, 0, WIDTH, HEIGHT, 0);
        canvas.toBlob(resolve, "image/jpeg", 0.82);
      }),
  );
}

// Saves the picture for this page's link, and returns what to put in the
// link to show it (null if there's no picture to save).
export async function uploadLinkPicture(path: string, cardUrl: string) {
  const picture = await linkPicture(cardUrl);
  if (!picture) return null;
  const form = new FormData();
  form.append("path", path);
  form.append("image", picture, "card.jpg");
  const { data } = await apiClient.post<ApiEnvelope<{ token: string }>>("/admin/cricket/share-cards", form, { timeout: 20_000 });
  return data.data.token;
}
