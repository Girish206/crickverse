import type { CSSProperties } from "react";
import "./AuthBackdrop.css";

// Behind the sign-in and sign-up forms: a stadium seen from above, with the
// crowd in the stands and shots running out to the boundary, a batter and a
// bowler facing each other across the form, and cricket kit around them. Only
// decoration, so it's hidden from screen readers. All the movement is in the
// CSS.

type ShotKind = "six" | "four" | "run";

// Clockwise from straight up the pitch; 380 is the boundary.
const SHOTS: { angle: number; reach: number; kind: ShotKind }[] = [
  { angle: 18, reach: 380, kind: "six" },
  { angle: 205, reach: 210, kind: "run" },
  { angle: 72, reach: 380, kind: "four" },
  { angle: 322, reach: 380, kind: "four" },
  { angle: 128, reach: 250, kind: "run" },
  { angle: 262, reach: 380, kind: "six" },
  { angle: 165, reach: 380, kind: "four" },
  { angle: 296, reach: 180, kind: "run" },
];

// Standing round the ground, as [angle, distance].
const FIELDERS = [
  [40, 330],
  [95, 175],
  [140, 335],
  [190, 160],
  [235, 340],
  [285, 170],
  [335, 300],
  [5, 170],
];

function pointAt(angle: number, distance: number) {
  const radians = (angle * Math.PI) / 180;
  return { x: Math.round(Math.sin(radians) * distance), y: Math.round(-Math.cos(radians) * distance) };
}

// A stagger for the CSS animations. Shots are given negative delays so the
// ground is already part-played on arrival, rather than empty.
const delayed = (seconds: number) => ({ "--delay": `${seconds}s` }) as CSSProperties;

function Ground() {
  return (
    <svg className="auth-bg-ground" viewBox="-400 -400 800 800">
      <defs>
        <pattern id="auth-bg-mowing" width="76" height="76" patternUnits="userSpaceOnUse">
          <rect className="auth-bg-mow" width="38" height="76" />
        </pattern>
      </defs>
      <circle className="auth-bg-boards" r="391" pathLength={48} />
      <circle className="auth-bg-turf" r="380" />
      <circle r="380" fill="url(#auth-bg-mowing)" />
      <circle className="auth-bg-infield" r="190" />
      <circle className="auth-bg-line auth-bg-rope" r="380" />
      <circle className="auth-bg-line auth-bg-line-dashed" r="190" />
      {[0, 45, 90, 135].map((angle) => (
        <path key={angle} className="auth-bg-zone" d="M0 -380V380" transform={`rotate(${angle})`} />
      ))}
      <rect className="auth-bg-pitch" x="-17" y="-62" width="34" height="124" rx="3" />
      <path className="auth-bg-line" d="M-17 -44H17M-17 44H17" />
      {FIELDERS.map(([angle, distance], i) => {
        const { x, y } = pointAt(angle, distance);
        return <circle key={i} className="auth-bg-fielder" cx={x} cy={y} r="6" style={delayed(i * -0.6)} />;
      })}
      {SHOTS.map(({ angle, reach, kind }, i) => {
        const { x, y } = pointAt(angle, reach);
        const path = `M0 0L${x} ${y}`;
        return (
          <g key={i} className={`auth-bg-shot auth-bg-shot-${kind}`} style={delayed(i * -1.75)}>
            <path className="auth-bg-shot-line" d={path} pathLength={100} />
            <path className="auth-bg-shot-ball" d={path} pathLength={100} />
          </g>
        );
      })}
    </svg>
  );
}

// Facing right, drawn at the moment of impact: the arms turn at the shoulder
// and the bat at the wrists, up to the backlift and through to the finish.
function Batter() {
  return (
    <svg className="auth-art auth-art-batter" viewBox="0 0 260 320">
      <ellipse className="art-shadow" cx="104" cy="306" rx="104" ry="9" />
      <polyline className="art-leg" points="96,176 66,236" />
      <path className="art-pad" d="M66 240L42 288" />
      <path className="art-shoe" d="M34 301H62" />
      <polyline className="art-leg" points="102,176 150,214" />
      <path className="art-pad" d="M152 220L160 284" />
      <path className="art-shoe" d="M154 301H190" />
      <path className="art-torso" d="M114 106L100 166" />
      <circle className="art-skin" cx="128" cy="74" r="16" />
      <path className="art-helmet" d="M94 66c0-22 13-35 31-35 17 0 29 12 31 30l13 4c3 1 3 6 0 6H94z" />
      <path className="art-grille" d="M142 72v21M152 72v17M134 92h20M136 82h24" />
      <g className="art-batter-arms">
        <path className="art-arm" d="M116 108L170 150" />
        <path className="art-arm" d="M106 114L164 156" />
        <g className="art-batter-bat">
          <path className="art-bat-handle" d="M168 152L184 194" />
          <path className="art-bat-blade" d="M188 204L212 270" />
          <circle className="art-glove" cx="168" cy="152" r="14" />
        </g>
      </g>
      <circle className="art-ball art-batter-ball" cx="232" cy="262" r="11" />
    </svg>
  );
}

// Facing left, drawn at the moment of release: the arm turns over at the
// shoulder and lets go at the top.
function Bowler() {
  return (
    <svg className="auth-art auth-art-bowler" viewBox="0 0 260 320">
      <ellipse className="art-shadow" cx="130" cy="306" rx="104" ry="9" />
      <polyline className="art-leg" points="152,178 198,226 234,258" />
      <path className="art-shoe" d="M238 260L254 274" />
      <polyline className="art-leg" points="144,178 98,232 76,292" />
      <path className="art-shoe" d="M50 301H88" />
      <path className="art-torso art-torso-away" d="M136 106L148 168" />
      <circle className="art-skin" cx="126" cy="66" r="20" />
      <path className="art-cap" d="M104 60c1-18 11-27 24-27 14 0 24 10 24 27z" />
      <path className="art-cap-brim" d="M110 59H86" />
      <path className="art-arm" d="M130 110L78 92" />
      <g className="art-bowler-arm">
        <path className="art-arm" d="M136 108L127 18" />
        <circle className="art-ball art-bowler-held" cx="126" cy="6" r="11" />
      </g>
      <circle className="art-ball art-bowler-flight" cx="126" cy="6" r="11" />
    </svg>
  );
}

function Stumps() {
  return (
    <svg className="auth-art auth-art-stumps" viewBox="0 0 120 140" style={delayed(-1)}>
      <path className="art-shadow-line" d="M16 136H104" />
      {[30, 55, 80].map((x) => (
        <rect key={x} className="art-wood" x={x} y="36" width="11" height="100" rx="3" />
      ))}
      <rect className="art-wood-dark art-bail-left" x="28" y="27" width="31" height="7" rx="3" />
      <rect className="art-wood-dark art-bail-right" x="62" y="27" width="31" height="7" rx="3" />
    </svg>
  );
}

function Bats() {
  return (
    <svg className="auth-art auth-art-bats" viewBox="0 0 140 150" style={delayed(-4)}>
      {[32, -32].map((angle) => (
        <g key={angle} transform={`rotate(${angle} 70 76)`}>
          <rect className="art-grip" x="64" y="4" width="12" height="46" rx="5" />
          <path className="art-wood art-bat-outlined" d="M62 48h16l7 12v73q0 8-8 8H63q-8 0-8-8V60z" />
        </g>
      ))}
      <circle className="art-ball" cx="70" cy="26" r="15" />
    </svg>
  );
}

function Helmet() {
  return (
    <svg className="auth-art auth-art-helmet" viewBox="0 0 140 120" style={delayed(-2.5)}>
      <path className="art-helmet" d="M8 76C8 34 34 8 70 8c33 0 58 24 62 60l-44 10-8 6z" />
      <path className="art-helmet-band" d="M12 58c20-6 44-8 70-4" />
      <path className="art-grille-thick" d="M86 72v36M104 70v36M122 68v32M78 92h54M84 110c14 4 32 2 46-8" />
    </svg>
  );
}

function Trophy() {
  return (
    <svg className="auth-art auth-art-trophy" viewBox="0 0 120 140" style={delayed(-5.5)}>
      <path className="art-trophy-handle" d="M34 22H14c0 26 10 38 28 42M86 22h20c0 26-10 38-28 42" />
      <path className="art-gold" d="M32 10h56v38c0 22-13 36-28 36S32 70 32 48z" />
      <rect className="art-gold" x="54" y="82" width="12" height="22" />
      <rect className="art-gold" x="38" y="102" width="44" height="12" rx="3" />
      <rect className="art-grip" x="28" y="114" width="64" height="16" rx="3" />
    </svg>
  );
}

function SpinningBall() {
  return (
    <svg className="auth-art auth-art-spin" viewBox="0 0 80 80">
      <circle className="art-ball" cx="40" cy="40" r="36" />
      <path className="art-seam" d="M16 13c15 17 33 36 49 55M10 20c15 17 33 36 49 55" />
      <path className="art-stitch" d="M18 7l-11 15M28 18l-11 15M38 29l-11 15M48 40l-11 15M58 51l-11 15M68 62l-11 15" />
    </svg>
  );
}

export function AuthBackdrop({ quiet }: { quiet: boolean }) {
  return (
    <div className={`auth-bg ${quiet ? "auth-bg-quiet" : ""}`.trim()} aria-hidden="true">
      <div className="auth-bg-crowd" />
      <Ground />
      <Bats />
      <Trophy />
      <Stumps />
      <Helmet />
      <SpinningBall />
      <Batter />
      <Bowler />
    </div>
  );
}
