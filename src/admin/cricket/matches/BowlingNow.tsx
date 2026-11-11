import { useEffect, useState } from "react";
import type { CricketMatch } from "../../../api/types";
import { CricketBall } from "../../components/Loader";
import type { NameOf } from "../stats";
import "./BowlingNow.css";

// How long a "Bowling" tap shows if no ball follows it (ms).
const SHOW_MS = 20_000;

// A little bowler running in and bowling, the ball bouncing on to the
// stumps, on a loop. Drawn in currentColor.
export function BowlerArt({ className = "" }: { className?: string }) {
  return (
    <svg className={`cv-bowler-art ${className}`.trim()} viewBox="0 0 120 48" aria-hidden="true">
      <line className="cv-bowler-pitch" x1="2" y1="44.5" x2="118" y2="44.5" />
      <ellipse className="cv-bowler-mark" cx="77" cy="44.5" rx="4" ry="1" />
      <g className="cv-bowler-stumps">
        <rect x="107.5" y="27" width="1.8" height="17" rx="0.6" />
        <rect x="111" y="27" width="1.8" height="17" rx="0.6" />
        <rect x="114.5" y="27" width="1.8" height="17" rx="0.6" />
        <rect x="107.5" y="25.8" width="8.8" height="1.2" rx="0.6" />
      </g>
      <g className="cv-bowler-x">
        <g className="cv-bowler-figure">
          <g className="cv-bowler-leg">
            <line x1="0" y1="32" x2="0" y2="43.5" />
          </g>
          <g className="cv-bowler-leg is-other">
            <line x1="0" y1="32" x2="0" y2="43.5" />
          </g>
          <line x1="0" y1="21" x2="0" y2="32" />
          <g className="cv-bowler-off-arm">
            <line x1="0" y1="23" x2="0" y2="31" />
          </g>
          <g className="cv-bowler-arm">
            <line x1="0" y1="23" x2="0" y2="32" />
          </g>
          <circle className="cv-bowler-head" cx="0" cy="17" r="3.4" />
        </g>
      </g>
      <g className="cv-bowler-ball-x">
        <g className="cv-bowler-ball-y">
          <g className="cv-ball-spin">
            <CricketBall r={2.3} />
          </g>
        </g>
      </g>
    </svg>
  );
}

// On a live page: the scorer has tapped "Bowling", so the bowler is running
// in. Shows until the ball is scored (the API clears match.bowlingAt), or
// for SHOW_MS if none comes.
export function BowlingNow({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  const at = match.bowlingAt ?? null;
  const [ended, setEnded] = useState<string | null>(null);

  useEffect(() => {
    if (!at) return;
    const age = Math.max(0, Date.now() - Date.parse(at));
    const timer = setTimeout(() => setEnded(at), Math.max(0, SHOW_MS - age));
    return () => clearTimeout(timer);
  }, [at]);

  const innings = match.innings[match.innings.length - 1];
  if (!at || ended === at || match.status !== "live" || !innings?.bowlerId) return null;
  return (
    <div className="cricket-bowling-now" role="status" aria-live="polite">
      <BowlerArt />
      <span className="cricket-bowling-now-text">
        <strong>{nameOf(innings.bowlerId)}</strong> is running in
        {innings.strikerId ? (
          <>
            {" "}
            to <strong>{nameOf(innings.strikerId)}</strong>
          </>
        ) : null}
      </span>
    </div>
  );
}
