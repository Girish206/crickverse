import type { CSSProperties, ReactNode } from "react";
import { avatarColorFor } from "../avatarColor";

// A team's round badge: its logo when it has one, else its initial (or the
// given text) on its colour. Each place keeps its own class for the size.
export function TeamMark({
  name,
  logoUrl,
  className,
  text,
  color,
  children,
}: {
  name: string;
  logoUrl?: string | null;
  className: string;
  text?: ReactNode;
  // Instead of the name's own colour (e.g. nudged apart from the other side).
  color?: string;
  // Extra marks on the badge, shown with a logo too.
  children?: ReactNode;
}) {
  const style: CSSProperties = logoUrl
    ? { background: `#fff url("${logoUrl}") center / cover no-repeat` }
    : { background: color ?? avatarColorFor(name) };
  return (
    <span className={logoUrl ? `${className} has-team-logo` : className} style={style} aria-hidden="true">
      {!logoUrl && (text ?? name.charAt(0).toUpperCase())}
      {children}
    </span>
  );
}
