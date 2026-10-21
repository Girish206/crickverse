import { useState } from "react";
import { avatarColorFor } from "../avatarColor";

// A player's photo, or their initial on a colour of their own when there's
// no photo (or it fails to load). Size comes from the `className`.
export function PlayerAvatar({
  name,
  photoUrl,
  className = "",
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (photoUrl && !broken) {
    return <img className={`cricket-avatar-img ${className}`} src={photoUrl} alt="" loading="lazy" onError={() => setBroken(true)} />;
  }
  return (
    <span className={className} style={{ background: avatarColorFor(name) }} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
