import { useState, type ChangeEvent } from "react";
import { compressImage, MAX_UPLOAD_BYTES, TOURNAMENT_LOGO } from "../../../utils/compressImage";
import type { useImagePick } from "../tournaments/CricketTournamentForm";
import { TeamMark } from "./TeamMark";

// The team forms' logo picker, like the tournament form's: a round badge to
// tap, with "Remove logo" once there's one. Saved separately after the team.
export function TeamLogoField({ pick }: { pick: ReturnType<typeof useImagePick> }) {
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (!picked.type.startsWith("image/")) return setError("Choose an image file.");
    try {
      const file = await compressImage(picked, TOURNAMENT_LOGO);
      if (file.size > MAX_UPLOAD_BYTES) return setError("This image is too large. Try a smaller one.");
      setError(null);
      pick.setFile(file);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <div className="cricket-logo-wrap is-inline">
        <label className="cricket-logo-pick" style={pick.shown ? { backgroundImage: `url(${pick.shown})` } : undefined}>
          <input type="file" accept="image/*" hidden onChange={onChange} />
          {!pick.shown && <i className="fa-solid fa-shield-halved" aria-hidden="true"></i>}
          <span className="cricket-media-cam">
            <i className="fa-solid fa-camera" aria-hidden="true"></i>
          </span>
        </label>
        <span className="cricket-logo-caption">
          {pick.shown ? (
            <button type="button" className="cricket-media-remove" onClick={() => pick.setFile(null)}>
              Remove logo
            </button>
          ) : (
            "Add logo"
          )}
        </span>
      </div>
      {error && <div className="admin-banner admin-banner-error mb-2">{error}</div>}
    </>
  );
}

// A team page's round badge: its logo, or its initial on its colour.
export function TeamBadge({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  return <TeamMark className="cricket-tour-logo" name={name} logoUrl={logoUrl} />;
}
