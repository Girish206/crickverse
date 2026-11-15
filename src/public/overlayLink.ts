import { toast } from "sonner";
import { siteOrigin } from "../app-shell/platform";

// The live-stream scorebug for a public match (OverlayPage), as a full link
// to paste into OBS / Streamlabs as a browser source.
export const overlayUrl = (matchId: number) => new URL(`/overlay/${matchId}`, siteOrigin()).toString();

export async function copyOverlayLink(matchId: number) {
  const url = overlayUrl(matchId);
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Overlay link copied — add it as a Browser source (1920×1080) in OBS");
  } catch {
    toast(url, { description: "Copy this link into OBS as a Browser source", duration: 15000 });
  }
}
