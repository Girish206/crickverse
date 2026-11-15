import { useState } from "react";
import { avatarColorFor } from "../avatarColor";
import { ImageViewer, viewerTrigger } from "../ImageViewer";
import { withoutRoleMark } from "../matches/matchUtils";

// A player's photo, or their initial on a colour of their own when there's
// no photo (or it fails to load). Size comes from the `className`.
// Tapping a photo opens it full size (the tap doesn't reach a card or button
// it sits in); `viewable={false}` turns that off.
export function PlayerAvatar({
  name,
  photoUrl,
  className = "",
  viewable = true,
  eager = false,
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
  viewable?: boolean;
  // Load straight away (a sheet that has just opened), not when scrolled to.
  eager?: boolean;
}) {
  // A match's "(c)" / "(wk)" isn't part of who they are.
  const plainName = withoutRoleMark(name);
  // A failed load is tried once more (a dropped request, a busy server)
  // before falling back to the initial.
  const [failures, setFailures] = useState(0);
  const broken = failures >= 2;
  const [viewing, setViewing] = useState(false);
  if (photoUrl && !broken) {
    return (
      <>
        <img
          className={`cricket-avatar-img ${viewable ? "is-viewable" : ""} ${className}`}
          key={failures}
          src={failures === 0 || /^(data|blob):/.test(photoUrl) ? photoUrl : `${photoUrl}${photoUrl.includes("?") ? "&" : "?"}retry=1`}
          alt={viewable ? `${plainName}'s photo` : ""}
          loading={eager ? "eager" : "lazy"}
          onError={() => setFailures((n) => n + 1)}
          {...(viewable ? viewerTrigger(() => setViewing(true)) : {})}
        />
        {viewing && (
          <ImageViewer
            src={photoUrl}
            alt={`${plainName}'s photo`}
            title={plainName}
            subtitle="Profile photo"
            round
            onClose={() => setViewing(false)}
          />
        )}
      </>
    );
  }
  return (
    <span className={className} style={{ background: avatarColorFor(plainName) }} aria-hidden="true">
      {plainName.charAt(0).toUpperCase()}
    </span>
  );
}
