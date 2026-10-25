import { useState } from "react";
import { avatarColorFor } from "../avatarColor";
import { ImageViewer, viewerTrigger } from "../ImageViewer";

// A player's photo, or their initial on a colour of their own when there's
// no photo (or it fails to load). Size comes from the `className`.
// `viewable` opens the photo full size when tapped.
export function PlayerAvatar({
  name,
  photoUrl,
  className = "",
  viewable = false,
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
  viewable?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const [viewing, setViewing] = useState(false);
  if (photoUrl && !broken) {
    return (
      <>
        <img
          className={`cricket-avatar-img ${viewable ? "is-viewable" : ""} ${className}`}
          src={photoUrl}
          alt={viewable ? `${name}'s photo` : ""}
          loading="lazy"
          onError={() => setBroken(true)}
          {...(viewable ? viewerTrigger(() => setViewing(true)) : {})}
        />
        {viewing && <ImageViewer src={photoUrl} alt={`${name}'s photo`} round onClose={() => setViewing(false)} />}
      </>
    );
  }
  return (
    <span className={className} style={{ background: avatarColorFor(name) }} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
