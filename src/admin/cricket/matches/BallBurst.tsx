import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { CricketBall, CricketMatch } from "../../../api/types";
import { battingCard, dismissalText, isFour, isSix, isWicket, type NameOf } from "../stats";
import { playBurstSound } from "./burstSounds";

type Kind = "four" | "six" | "out";
type Burst = { kind: Kind; ball: CricketBall; key: string; line: string; duck: "duck" | "golden" | null };

// How long each one plays (ms); a duck stays a little longer for the duck.
const DURATION = { boundary: 2400, out: 2400, duck: 3700 };

// How they were out, for the ribbon under "OUT!".
function outLabel(ball: CricketBall) {
  if (ball.wicketType === "caught" && ball.fielderId === ball.bowlerId) return "Caught & bowled";
  if (ball.wicketType === "run-out" && ball.noDelivery) return "Run out (Mankad)";
  const labels: Record<string, string> = {
    bowled: "Bowled",
    caught: "Caught",
    "caught-behind": "Caught behind",
    lbw: "LBW",
    "run-out": "Run out",
    stumped: "Stumped",
    "hit-wicket": "Hit wicket",
    "hit-ball-twice": "Hit the ball twice",
    "obstructing-field": "Obstructing the field",
    "retired-out": "Retired out",
    "timed-out": "Timed out",
  };
  return labels[ball.wicketType ?? ""] ?? "Out";
}

// A four, a six or a wicket plays over the screen for a moment, on a
// see-through background: the number (a four or six), or the stumps going
// (bowled), the word, and who. Out for nought, a duck walks in.
// Only for a ball just added (scored here, or arriving on the live view),
// not on load or after an undo. Animated with SMIL, so each one plays from
// the start as it's mounted. Mounted once on the match page (so the last
// ball of the match still plays as the page turns to the result) and drawn
// over everything, above the next-bowler / next-batter sheets.
export function BallBurst({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  // The innings the newest ball is in: after an innings' last ball the next
  // one has started empty, so it's the latest one with balls.
  const innings = match.innings.findLast((inn) => inn.balls.length > 0);
  const count = match.innings.reduce((n, inn) => n + inn.balls.length, 0);
  const seen = useRef(count);
  const [burst, setBurst] = useState<Burst | null>(null);

  useEffect(() => {
    const added = count > seen.current;
    seen.current = count;
    const ball = innings?.balls.at(-1);
    if (!added || !innings || !ball) return;
    // An all-run four or six is no boundary: no burst.
    const kind: Kind | null = isWicket(ball) ? "out" : isSix(ball) ? "six" : isFour(ball) ? "four" : null;
    if (!kind) return;
    const who = kind === "out" ? ball.dismissedId : ball.batterId;
    const row = battingCard(innings).find((r) => r.playerId === who);
    const score = row ? ` · ${row.runs}${kind === "out" ? "" : "*"} (${row.balls})` : "";
    const duck = kind === "out" && row && row.runs === 0 ? (row.balls <= 1 ? "golden" : "duck") : null;
    setBurst({ kind, ball, key: `${match.innings.length}-${count}`, line: `${nameOf(who)}${score}`, duck });
    playBurstSound(duck ? "duck" : kind);
  }, [count, innings, match.innings.length, nameOf]);

  const duration = !burst ? 0 : burst.duck ? DURATION.duck : burst.kind === "out" ? DURATION.out : DURATION.boundary;
  useEffect(() => {
    if (!burst) return;
    const timer = setTimeout(() => setBurst(null), duration);
    return () => clearTimeout(timer);
  }, [burst, duration]);

  if (!burst) return null;
  const { kind, ball, duck } = burst;
  return createPortal(
    <div
      key={burst.key}
      className={`cricket-burst is-${kind}`}
      style={{ "--burst-dur": `${duration}ms` } as CSSProperties}
      role="status"
      aria-live="polite"
    >
      <div className="cricket-burst-inner">
        {kind === "out" ? (
          <>
            {/* Bowled gets the stumps going; any other out, just the stamp. */}
            {ball.wicketType === "bowled" && <OutScene />}
            <strong className="cricket-burst-word">OUT!</strong>
            <strong className="cricket-burst-ribbon">{outLabel(ball)}</strong>
            <span className="cricket-burst-how">{dismissalText(ball, nameOf)}</span>
          </>
        ) : (
          <>
            <BigNumber six={kind === "six"} />
            <strong className="cricket-burst-ribbon">{kind === "six" ? "SIX!" : "FOUR!"}</strong>
          </>
        )}
        <span className="cricket-burst-who">{burst.line}</span>
        {duck && <Duck golden={duck === "golden"} />}
      </div>
    </div>,
    document.body,
  );
}

// Shared paints: grass, pitch, wood, the ball's leather. One burst shows at
// a time, so fixed ids don't clash.
function Defs() {
  return (
    <defs>
      <radialGradient id="cb-grass" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stopColor="#4ade80" />
        <stop offset="100%" stopColor="#15803d" />
      </radialGradient>
      <linearGradient id="cb-pitch" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f3e3b5" />
        <stop offset="100%" stopColor="#d6bc7f" />
      </linearGradient>
      <linearGradient id="cb-wood" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#f8dfa6" />
        <stop offset="55%" stopColor="#e7b86a" />
        <stop offset="100%" stopColor="#c48a3a" />
      </linearGradient>
      <radialGradient id="cb-leather" cx="35%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#fb7185" />
        <stop offset="60%" stopColor="#dc2626" />
        <stop offset="100%" stopColor="#7f1d1d" />
      </radialGradient>
      <radialGradient id="cb-flash" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#fff" />
        <stop offset="45%" stopColor="#fde047" />
        <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

// The ground: a patch of grass with the pitch across it.
function Ground() {
  return (
    <g>
      <ellipse cx={100} cy={107} rx={98} ry={10} fill="url(#cb-grass)" />
      <path d="M24 102 H176 L184 110 H16 Z" fill="url(#cb-pitch)" />
      <line x1={78} y1={102} x2={76} y2={110} stroke="#fff" strokeWidth={1.2} opacity={0.9} />
    </g>
  );
}

// A cricket ball: red leather, a white seam.
function Ball({ r = 4.5 }: { r?: number }) {
  return (
    <g>
      <circle r={r} fill="url(#cb-leather)" stroke="#7f1d1d" strokeWidth={0.6} />
      <path d={`M${-r * 0.75} ${-r * 0.55} Q0 ${r * 0.25} ${r * 0.75} ${-r * 0.55}`} fill="none" stroke="#fff" strokeWidth={0.8} strokeDasharray="1 0.8" />
    </g>
  );
}

// Confetti for a six: where each piece flies to (px from the middle), its
// turn and colour.
const CONFETTI = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2 + (i % 3) * 0.2;
  const d = 120 + (i % 4) * 30;
  return {
    x: Math.round(Math.cos(a) * d),
    y: Math.round(Math.sin(a) * d * 0.8),
    r: (i * 67) % 360,
    // A six's colours (the score card's maroon and gold), and white.
    color: ["var(--brand-amber)", "#8c262c", "#fff", "var(--brand-amber-bright)", "#541418", "var(--brand-amber-deep)"][i % 6],
  };
});

// A four or a six: the number, huge and glossy with a raised edge, a shine
// sweeping over it, rays turning and a ring going out behind; confetti
// bursting out for a six.
function BigNumber({ six }: { six: boolean }) {
  const n = six ? "6" : "4";
  return (
    <div className="cricket-burst-number">
      <span className="cricket-burst-rays" aria-hidden="true"></span>
      <span className="cricket-burst-ring" aria-hidden="true"></span>
      {six &&
        CONFETTI.map((c, i) => (
          <span
            key={i}
            className="cricket-burst-confetti"
            aria-hidden="true"
            style={{ "--x": `${c.x}px`, "--y": `${c.y}px`, "--r": `${c.r}deg`, background: c.color } as CSSProperties}
          ></span>
        ))}
      <span className="cricket-burst-digit" data-n={n}>
        {n}
      </span>
    </div>
  );
}
// Bowled: the stumps knocked back, bails spinning off; then the stamp.
function OutScene() {
  return (
    <svg className="cricket-burst-scene" viewBox="0 0 200 120" aria-hidden="true">
      <Defs />
      <Ground />
      <ellipse cx={100} cy={104} rx={14} ry={2.2} fill="#000" opacity={0.2} />
      {[92, 100, 108].map((x, i) => (
        <g key={x}>
          <rect x={x - 2.2} y={64} width={4.4} height={40} rx={2} fill="url(#cb-wood)" stroke="#92400e" strokeWidth={0.7} />
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 ${x} 104; ${[-16, 10, 24][i]} ${x} 104`}
            begin="0.4s"
            dur="0.22s"
            fill="freeze"
          />
        </g>
      ))}
      {[
        { x: 91, to: "-40 -48", spin: -300 },
        { x: 100.5, to: "42 -54", spin: 340 },
      ].map((bail) => (
        <g key={bail.x}>
          <rect x={bail.x - 0.5} y={61} width={9} height={3} rx={1.5} fill="url(#cb-wood)" stroke="#92400e" strokeWidth={0.6} />
          <animateTransform attributeName="transform" type="translate" values={`0 0; ${bail.to}`} begin="0.4s" dur="0.6s" fill="freeze" />
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 ${bail.x + 4} 62.5; ${bail.spin} ${bail.x + 4} 62.5`}
            additive="sum"
            begin="0.4s"
            dur="0.6s"
            fill="freeze"
          />
          <animate attributeName="opacity" values="1; 0" begin="0.85s" dur="0.3s" fill="freeze" />
        </g>
      ))}
      {/* Splinters of light as it hits. */}
      <circle cx={100} cy={86} r={0} fill="url(#cb-flash)">
        <animate attributeName="r" values="0; 26" begin="0.38s" dur="0.35s" fill="freeze" />
        <animate attributeName="opacity" values="1; 0" begin="0.38s" dur="0.35s" fill="freeze" />
      </circle>
      <g>
        <Ball r={5} />
        <animateMotion path="M-10 72 Q55 62 98 88" dur="0.4s" fill="freeze" rotate="auto" />
        <animateMotion path="M98 88 Q120 94 142 103" begin="0.4s" dur="0.35s" fill="freeze" rotate="auto" />
      </g>
    </svg>
  );
}

// The duck: a little duck cricketer walking off — helmet, a jersey with
// "0" on it, pads — head down, wiping its eyes with one wing and dragging
// its bat with the other. Faces left, walking in from the right.
function Duck({ golden }: { golden: boolean }) {
  const leg = (x: number, cls: string) => (
    <g className={cls}>
      <path d={`M${x} 86 L${x - 1} 112`} stroke="#f97316" strokeWidth={3.4} strokeLinecap="round" />
      <rect x={x - 6} y={94} width={10} height={17} rx={3.5} fill="#f8fafc" stroke="#94a3b8" strokeWidth={0.9} />
      <path d={`M${x - 5} 99 H${x + 3} M${x - 5} 104 H${x + 3}`} stroke="#cbd5e1" strokeWidth={0.8} />
      <path d={`M${x - 1} 112 L${x - 11} 116 Q${x - 4} 118 ${x + 3} 116 Z`} fill="#f97316" stroke="#c2410c" strokeWidth={1} strokeLinejoin="round" />
    </g>
  );
  return (
    <div className={`cricket-burst-duck ${golden ? "is-golden" : ""}`.trim()}>
      <svg viewBox="0 0 100 128" aria-hidden="true">
        <defs>
          <radialGradient id="cb-duck" cx="40%" cy="30%" r="75%">
            <stop offset="0%" stopColor={golden ? "#fef3c7" : "#fef08a"} />
            <stop offset="65%" stopColor={golden ? "#fbbf24" : "#facc15"} />
            <stop offset="100%" stopColor={golden ? "#d97706" : "#ca8a04"} />
          </radialGradient>
          <linearGradient id="cb-duck-bat" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f8dfa6" />
            <stop offset="100%" stopColor="#c48a3a" />
          </linearGradient>
        </defs>
        <ellipse cx={52} cy={118} rx={30} ry={3.2} fill="#000" opacity={0.2} />
        <g className="cricket-burst-duck-body">
          {leg(46, "cricket-burst-duck-leg is-back")}
          {/* The bat, dragged along behind. */}
          <g className="cricket-burst-duck-bat">
            <line x1={66} y1={84} x2={70.5} y2={91} stroke="#111827" strokeWidth={3.2} strokeLinecap="round" />
            <path d="M71.9 88.1 L91 118.1 Q89 122 85 121.9 L66 91.9 Z" fill="url(#cb-duck-bat)" stroke="#a16207" strokeWidth={0.9} />
          </g>
          {leg(56, "cricket-burst-duck-leg")}
          {/* Body, then the jersey (the brand's colour, a nought on it). */}
          <ellipse cx={51} cy={72} rx={20} ry={23} fill="url(#cb-duck)" stroke="#a16207" strokeWidth={1.3} />
          <path d="M32 64 Q51 50 70 64 L69 83 Q51 91 33 83 Z" className="cb-duck-jersey" />
          <text x={53} y={81} textAnchor="middle" className="cb-duck-number">
            0
          </text>
          {/* Head bowed: closed, crying eye; beak turned down. */}
          <g transform="rotate(-10 46 40)">
            <circle cx={46} cy={36} r={15.5} fill="url(#cb-duck)" stroke="#a16207" strokeWidth={1.3} />
            <path d="M32 38 Q20 37 16 42 Q21 46 32 45 Z" fill="#f97316" stroke="#c2410c" strokeWidth={1.1} strokeLinejoin="round" />
            <path d="M19 43.5 Q25 45 31 43" fill="none" stroke="#c2410c" strokeWidth={0.9} />
            <circle cx={42} cy={44} r={3.2} fill="#fb7185" opacity={0.45} />
            <path d="M34 38 Q38 41.5 42 38" fill="none" stroke="#111" strokeWidth={1.6} strokeLinecap="round" />
            <path d="M33 34.5 Q37 35.5 41 34" fill="none" stroke="#111" strokeWidth={1.3} strokeLinecap="round" />
            <path className="cricket-burst-duck-tear" d="M36 41 q-2.4 4 0 5.8 q2.4 -1.8 0 -5.8 Z" />
            <path className="cricket-burst-duck-tear is-late" d="M40 41.5 q-2 3.4 0 5 q2 -1.6 0 -5 Z" />
            {/* Helmet, peak forward. */}
            <path d="M30 33 A16.5 16.5 0 0 1 62.5 32 L62 36 Q46 31 30 33 Z" className="cb-duck-helmet" />
            <path d="M31 31 L17 33.5 L31 34.5 Z" className="cb-duck-helmet" />
          </g>
          {/* The wing wiping its eyes; the other holding the bat. */}
          <path className="cricket-burst-duck-wipe" d="M44 60 Q31 55 33 44 Q41 45 47 56 Z" fill="url(#cb-duck)" stroke="#a16207" strokeWidth={1.2} />
          <path d="M60 62 Q71 72 68 88 Q62 85 56 70 Z" fill="url(#cb-duck)" stroke="#a16207" strokeWidth={1.2} />
        </g>
      </svg>
      <span>{golden ? "GOLDEN DUCK!" : "DUCK!"}</span>
    </div>
  );
}
