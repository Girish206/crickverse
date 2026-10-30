import { useState, type CSSProperties, type ReactNode } from "react";
import { avatarColorFor } from "../avatarColor";
import { ImageViewer, viewerTrigger } from "../ImageViewer";

// A team's round badge: its logo when it has one, else its initial (or the
// given text) on its colour. Each place keeps its own class for the size.
// `viewable` lets a tap open the logo full size (team pages' headers).
export function TeamMark({
  name,
  logoUrl,
  className,
  text,
  color,
  viewable = false,
  children,
}: {
  name: string;
  logoUrl?: string | null;
  className: string;
  text?: ReactNode;
  // Instead of the name's own colour (e.g. nudged apart from the other side).
  color?: string;
  viewable?: boolean;
  // Extra marks on the badge, shown with a logo too.
  children?: ReactNode;
}) {
  const [viewing, setViewing] = useState(false);
  const style: CSSProperties = logoUrl
    ? { background: `#fff url("${logoUrl}") center / cover no-repeat` }
    : { background: color ?? avatarColorFor(name) };
  if (logoUrl && viewable) {
    return (
      <>
        <span
          className={`${className} has-team-logo is-viewable`}
          style={style}
          aria-label={`${name} logo`}
          {...viewerTrigger(() => setViewing(true))}
        >
          {children}
        </span>
        {viewing && (
          <ImageViewer
            src={logoUrl}
            alt={`${name} logo`}
            title={name}
            subtitle="Team logo"
            round
            onClose={() => setViewing(false)}
          />
        )}
      </>
    );
  }
  return (
    <span className={logoUrl ? `${className} has-team-logo` : className} style={style} aria-hidden="true">
      {!logoUrl && (text ?? name.charAt(0).toUpperCase())}
      {children}
    </span>
  );
}
