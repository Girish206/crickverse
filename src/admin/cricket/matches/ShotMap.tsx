import { useState, type MouseEvent } from "react";
import type { CricketMatch } from "../../../api/types";
import { PillSelect } from "../PillSelect";
import type { NameOf } from "../stats";

// The shot map: a ground seen from behind the striker, the bowler's end up
// and (for a right-hander) the off side to the right. Shots are stored as
// x / y from -1 to 1 with the pitch at the centre (see CricketBall).

export interface Shot {
  x: number;
  y: number;
  runs: number;
}

// The inner (30-yard) circle, as a share of the boundary's radius.
const INNER = 0.55;

// Fielding zones by angle from straight down the ground (0) round to
// straight behind the striker (180), each with its inner and deep name.
const OFF_ZONES = [
  { to: 20, inner: "Mid off", deep: "Long off" },
  { to: 50, inner: "Extra cover", deep: "Deep extra cover" },
  { to: 80, inner: "Cover", deep: "Deep cover" },
  { to: 110, inner: "Point", deep: "Deep point" },
  { to: 145, inner: "Gully", deep: "Third man" },
  { to: 180, inner: "Slip", deep: "Third man" },
];
const LEG_ZONES = [
  { to: 20, inner: "Mid on", deep: "Long on" },
  { to: 60, inner: "Mid wicket", deep: "Deep mid wicket" },
  { to: 100, inner: "Square leg", deep: "Deep square leg" },
  { to: 145, inner: "Short fine leg", deep: "Fine leg" },
  { to: 180, inner: "Leg slip", deep: "Fine leg" },
];

// Clockwise degrees from straight (0) to the right; negative = leg side.
const angleOf = (x: number, y: number) => (Math.atan2(x, -y) * 180) / Math.PI;

export function shotZoneAt(x: number, y: number) {
  const angle = angleOf(x, y);
  const zones = angle >= 0 ? OFF_ZONES : LEG_ZONES;
  const zone = zones.find((z) => Math.abs(angle) <= z.to) ?? zones[zones.length - 1];
  return Math.hypot(x, y) < INNER ? zone.inner : zone.deep;
}

// Labels drawn on the ground: [name, angle, distance].
const LABELS: [string, number, number][] = [
  ["Long off", 12, 0.82],
  ["Long on", -12, 0.82],
  ["Deep cover", 62, 0.8],
  ["Deep point", 95, 0.8],
  ["Third man", 150, 0.8],
  ["Fine leg", -150, 0.8],
  ["Deep sq. leg", -82, 0.8],
  ["Deep mid wkt", -42, 0.8],
  ["Cover", 65, 0.38],
  ["Point", 95, 0.38],
  ["Mid off", 15, 0.4],
  ["Mid on", -15, 0.4],
  ["Mid wkt", -42, 0.38],
  ["Sq. leg", -82, 0.38],
];

const R = 100;
const toSvg = (angle: number, distance: number) => {
  const rad = (angle * Math.PI) / 180;
  return { x: Math.sin(rad) * distance * R, y: -Math.cos(rad) * distance * R };
};

const shotClass = (runs: number) => (runs >= 6 ? "is-six" : runs === 4 ? "is-four" : "is-run");

interface ShotGroundProps {
  shots?: Shot[];
  // The spot just tapped, while picking.
  marker?: { x: number; y: number } | null;
  // Makes the ground tappable; gets the spot as -1..1 x / y.
  onPick?: (x: number, y: number) => void;
  label?: string;
}

export function ShotGround({ shots = [], marker, onPick, label = "Cricket ground" }: ShotGroundProps) {
  function handleClick(e: MouseEvent<SVGSVGElement>) {
    if (!onPick) return;
    const box = e.currentTarget.getBoundingClientRect();
    let x = (((e.clientX - box.left) / box.width) * 220 - 110) / R;
    let y = (((e.clientY - box.top) / box.height) * 220 - 110) / R;
    // A tap past the rope counts as on it.
    const distance = Math.hypot(x, y);
    if (distance > 1) [x, y] = [x / distance, y / distance];
    onPick(Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000);
  }

  return (
    <svg
      className={`cricket-shot-ground ${onPick ? "is-pickable" : ""}`.trim()}
      viewBox="-110 -110 220 220"
      role="img"
      aria-label={label}
      onClick={handleClick}
    >
      <circle className="cricket-shot-field" r={R} />
      <circle className="cricket-shot-inner" r={INNER * R} />
      <line className="cricket-shot-axis" x1={0} y1={-R} x2={0} y2={R} />
      <rect className="cricket-shot-pitch" x={-4} y={-13} width={8} height={26} rx={1.5} />
      <text className="cricket-shot-side" x={-R + 4} y={-R + 10}>
        Leg
      </text>
      <text className="cricket-shot-side" x={R - 4} y={-R + 10} textAnchor="end">
        Off
      </text>
      {LABELS.map(([name, angle, distance]) => {
        const at = toSvg(angle, distance);
        return (
          <text key={name} className="cricket-shot-label" x={at.x} y={at.y} textAnchor="middle">
            {name}
          </text>
        );
      })}
      {shots.map((shot, i) => (
        <g key={i} className={`cricket-shot ${shotClass(shot.runs)}`}>
          <line x1={0} y1={0} x2={shot.x * R} y2={shot.y * R} />
          <circle cx={shot.x * R} cy={shot.y * R} r={2.6} />
        </g>
      ))}
      {marker && (
        <g className="cricket-shot is-marker">
          <line x1={0} y1={0} x2={marker.x * R} y2={marker.y * R} />
          <circle cx={marker.x * R} cy={marker.y * R} r={4} />
        </g>
      )}
    </svg>
  );
}

export function ShotLegend() {
  return (
    <div className="cricket-shot-legend">
      <span className="is-run">1–3</span>
      <span className="is-four">Four</span>
      <span className="is-six">Six</span>
    </div>
  );
}

// Insights: each innings' marked shots, for the whole side or one batter,
// plus where most of the runs went. Hidden when nothing was marked.
export function MatchShotMap({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  const marked = match.innings.map((innings) =>
    innings.balls.flatMap((ball) =>
      ball.shotX != null && ball.shotY != null
        ? [{ x: ball.shotX, y: ball.shotY, runs: ball.runs, zone: ball.shotZone ?? "", batterId: ball.batterId }]
        : [],
    ),
  );
  const [inningsIndex, setInningsIndex] = useState(() => Math.max(0, marked.findLastIndex((shots) => shots.length)));
  const [batter, setBatter] = useState("all");
  if (!marked.some((shots) => shots.length)) return null;

  const all = marked[inningsIndex] ?? [];
  const batterIds = [...new Set(all.map((shot) => shot.batterId))];
  const shots = batter === "all" ? all : all.filter((shot) => String(shot.batterId) === batter);
  const runsByZone = new Map<string, number>();
  for (const shot of shots) runsByZone.set(shot.zone, (runsByZone.get(shot.zone) ?? 0) + shot.runs);
  const topZones = [...runsByZone.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <section className="cricket-awards">
      <h2 className="cricket-section-title">
        <i className="fa-solid fa-bullseye" aria-hidden="true"></i> Shot map
      </h2>
      <div className="cricket-shot-filters">
        {match.innings.length > 1 && (
          <PillSelect
            label="Innings"
            value={String(inningsIndex)}
            options={match.innings.map((innings, index) => ({
              value: String(index),
              label: match.teams[innings.battingTeam].name,
            }))}
            onChange={(value) => {
              setInningsIndex(Number(value));
              setBatter("all");
            }}
          />
        )}
        <PillSelect
          label="Batter"
          value={batter}
          options={[
            { value: "all", label: "All batters" },
            ...batterIds.map((id) => ({ value: String(id), label: nameOf(id) })),
          ]}
          onChange={setBatter}
        />
      </div>
      <div className="cricket-shot-view">
        <ShotGround shots={shots} label={`Shot map: ${shots.length} shots`} />
        <ShotLegend />
        {topZones.length > 0 && (
          <ul className="cricket-shot-zones">
            {topZones.map(([zone, runs]) => (
              <li key={zone}>
                <span>{zone}</span>
                <strong>
                  {runs} run{runs === 1 ? "" : "s"}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
