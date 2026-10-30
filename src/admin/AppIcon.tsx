import type { ReactNode } from "react";
import "./AppIcon.css";

// RunMitra's own icons for the main navigation (bottom bar and sidebar):
// line drawings on a 24px grid that pick up the text colour. Shapes marked
// `f` also fill in softly when their tab or menu item is the current one.

const f = "ai-fill";

const ICONS = {
  home: (
    <>
      <path className={f} d="M5.5 9.4 12 4.5l6.5 4.9v10.1h-13z" />
      <path d="M3.5 10.6 12 4l8.5 6.6" />
      <path d="M5.5 9.4v10.1h13V9.4" />
      <path d="M10 19.5v-4.2a2 2 0 0 1 4 0v4.2" />
    </>
  ),
  // Crossed bat and ball: a match.
  matches: (
    <>
      <path className={f} d="M15.8 2.8 18.2 5.2 8.2 15.2 5.8 12.8z" />
      <path d="M15.8 2.8 18.2 5.2 8.2 15.2 5.8 12.8z" />
      <path d="M7 14 3.6 17.4" />
      <circle className={f} cx="17.5" cy="17.5" r="2.6" />
      <circle cx="17.5" cy="17.5" r="2.6" />
    </>
  ),
  tournaments: (
    <>
      <path className={f} d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4.5v1a3.5 3.5 0 0 0 3.2 3.5M17 6h2.5v1a3.5 3.5 0 0 1-3.2 3.5" />
      <path d="M12 14v3.5M8.5 20.5h7M9.5 17.5h5l.6 3H8.9z" />
    </>
  ),
  // A team crest.
  teams: (
    <>
      <path className={f} d="M12 3.2 19.5 5.8v5.7c0 4.5-3.1 7.9-7.5 9.4-4.4-1.5-7.5-4.9-7.5-9.4V5.8z" />
      <path d="M12 3.2 19.5 5.8v5.7c0 4.5-3.1 7.9-7.5 9.4-4.4-1.5-7.5-4.9-7.5-9.4V5.8z" />
      <path d="m8.2 10.2 3.8 2.8 3.8-2.8M8.2 14.2l3.8 2.8 3.8-2.8" />
    </>
  ),
  stats: (
    <>
      <path d="M4 4v16h16" />
      <rect className={f} x="7" y="11.5" width="3" height="5.5" rx="1" />
      <rect className={f} x="11.5" y="7" width="3" height="10" rx="1" />
      <rect className={f} x="16" y="9.5" width="3" height="7.5" rx="1" />
      <rect x="7" y="11.5" width="3" height="5.5" rx="1" />
      <rect x="11.5" y="7" width="3" height="10" rx="1" />
      <rect x="16" y="9.5" width="3" height="7.5" rx="1" />
    </>
  ),
  // A playing shirt: the players.
  players: (
    <>
      <path
        className={f}
        d="M8.6 3.6 4 6.1l1.6 4.4 2-.9v10.9h8.8V9.6l2 .9L20 6.1l-4.6-2.5c-.6 1.5-1.9 2.4-3.4 2.4s-2.8-.9-3.4-2.4z"
      />
      <path d="M8.6 3.6 4 6.1l1.6 4.4 2-.9v10.9h8.8V9.6l2 .9L20 6.1l-4.6-2.5c-.6 1.5-1.9 2.4-3.4 2.4s-2.8-.9-3.4-2.4z" />
      <path d="M10.4 11.5h3.2l-2 5" />
    </>
  ),
  following: (
    <>
      <path className={f} d="m12 3.6 2.6 5.2 5.8.9-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.9z" />
      <path d="m12 3.6 2.6 5.2 5.8.9-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.9z" />
    </>
  ),
  dashboard: (
    <>
      <rect className={f} x="4" y="4" width="7" height="8" rx="1.8" />
      <rect className={f} x="13" y="12" width="7" height="8" rx="1.8" />
      <rect x="4" y="4" width="7" height="8" rx="1.8" />
      <rect x="13" y="4" width="7" height="5" rx="1.8" />
      <rect x="13" y="12" width="7" height="8" rx="1.8" />
      <rect x="4" y="15" width="7" height="5" rx="1.8" />
    </>
  ),
  // A fixtures calendar with a ball on match day.
  fixtures: (
    <>
      <rect className={f} x="4" y="5.5" width="16" height="14.5" rx="2.5" />
      <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
      <path d="M8 3.5v4M16 3.5v4M4 10h16" />
      <circle cx="12" cy="15" r="2.2" />
    </>
  ),
  leaderboard: (
    <>
      <path className={f} d="M9 11h6v9H9z" />
      <path d="M9 11h6v9H9zM3.5 14.5H9V20H3.5zM15 13h5.5v7H15z" />
      <path d="m12 3.8.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z" />
    </>
  ),
  database: (
    <>
      <ellipse className={f} cx="12" cy="6" rx="7" ry="2.6" />
      <ellipse cx="12" cy="6" rx="7" ry="2.6" />
      <path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6" />
    </>
  ),
  more: <path d="M4 7h16M4 12h16M4 17h11" />,
  share: (
    <>
      <circle className={f} cx="17.5" cy="5.5" r="2.5" />
      <circle className={f} cx="6.5" cy="12" r="2.5" />
      <circle className={f} cx="17.5" cy="18.5" r="2.5" />
      <circle cx="17.5" cy="5.5" r="2.5" />
      <circle cx="6.5" cy="12" r="2.5" />
      <circle cx="17.5" cy="18.5" r="2.5" />
      <path d="m8.7 10.8 6.6-4M8.7 13.2l6.6 4" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H6.5A2 2 0 0 0 4.5 6v12a2 2 0 0 0 2 2H10" />
      <path d="m14.5 8 4 4-4 4M18.5 12H9.5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type AppIconName = keyof typeof ICONS;

export function AppIcon({ name, className = "" }: { name: AppIconName; className?: string }) {
  return (
    <svg
      className={`app-icon ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}
