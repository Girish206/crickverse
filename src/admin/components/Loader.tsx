import "./Loader.css";

// A cricket ball with its seam, for drawing inside an SVG at (0, 0).
export function CricketBall({ r }: { r: number }) {
  const s = r * 0.42;
  return (
    <g className="cv-ball">
      <circle r={r} className="cv-ball-leather" />
      <path d={`M ${-s} ${-r * 0.9} Q ${-s * 1.6} 0 ${-s} ${r * 0.9}`} className="cv-ball-seam" />
      <path d={`M ${s} ${-r * 0.9} Q ${s * 1.6} 0 ${s} ${r * 0.9}`} className="cv-ball-seam" />
      <circle r={r} className="cv-ball-edge" />
    </g>
  );
}

// The in-page loading state: a cricket ball bouncing, squashing as it lands,
// with a short label below, centred in the space the content will fill.
// `page` gives it a taller area, for a whole screen under its PageHeader.
export function Loader({ label = "Loading", page }: { label?: string; page?: boolean }) {
  return (
    <div className={`cv-loader ${page ? "is-page" : ""}`.trim()} role="status" aria-live="polite">
      <svg className="cv-loader-art" viewBox="0 0 96 56" aria-hidden="true">
        <ellipse className="cv-bounce-shadow" cx="48" cy="51" rx="8" ry="1.8" />
        <g transform="translate(48 0)">
          <g className="cv-bounce-y">
            <g className="cv-bounce-squash">
              <g className="cv-ball-spin">
                <CricketBall r={6} />
              </g>
            </g>
          </g>
        </g>
      </svg>
      <span className="cv-loader-label">{label}…</span>
    </div>
  );
}

// A small spinning cricket ball, for inline busy states (buttons, fields).
export function BallSpinner({ className = "", label }: { className?: string; label?: string }) {
  return (
    <svg
      className={`cv-ball-spinner ${className}`.trim()}
      viewBox="-6 -6 12 12"
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <g className="cv-ball-spin">
        <CricketBall r={5.4} />
      </g>
    </svg>
  );
}
