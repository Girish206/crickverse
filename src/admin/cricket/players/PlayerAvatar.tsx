import { useState } from "react";
import { avatarColorFor } from "../avatarColor";
import { ImageViewer, viewerTrigger } from "../ImageViewer";

// A player's photo, or their initial on a colour of their own when there's
// no photo (or it fails to load). Size comes from the `className`.
// Tapping a photo opens it full size (the tap doesn't reach a card or button
// it sits in); `viewable={false}` turns that off.
export function PlayerAvatar({
  name,
  photoUrl,
  className = "",
  viewable = true,
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
        {viewing && (
          <ImageViewer
            src={photoUrl}
            alt={`${name}'s photo`}
            title={name}
            subtitle="Profile photo"
            round
            onClose={() => setViewing(false)}
          />
        )}
      </>
    );
  }
  return (
    <span className={className} style={{ background: avatarColorFor(name) }} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
