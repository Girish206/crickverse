import { useState, type MouseEvent } from "react";
import type { CricketMatch } from "../../../api/types";
import { useCricketPlayers } from "../../../api/hooks/cricket/useCricketPlayers";
import { PillSelect } from "../PillSelect";
import { isWicket, type NameOf } from "../stats";

// The shot map. Shots are stored as x / y from -1 to 1 with the pitch at
// the centre, the bowler's end up and (for a right-hander) the off side to
// the right (see CricketBall). The ground is drawn the TV way round, from
// behind the bowler: the keeper and fine leg at the top, long on / long off
// at the bottom, the off side on the left — the stored spot turned half way.
// A left-hander's off side is on the other side of the ground, so for them
// the whole drawing is mirrored; stored spots stay off-side-positive either
// way, so zones and saved shots mean the same for both hands.

export interface Shot {
  x: number;
  y: number;
  runs: number;
  // Caught there, or run out from there.
  wicket?: boolean;
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

// The lines between the zones: at each zone's edge (straight down and
// straight behind are the axis), out to the rope — or only to the inner
// circle where the deep fielder is the same either side (third man, fine leg).
const DIVISIONS = [
  ...[OFF_ZONES, LEG_ZONES].flatMap((zones, side) =>
    zones.slice(0, -1).map((zone, i) => ({
      angle: side === 0 ? zone.to : -zone.to,
      to: zone.deep === zones[i + 1].deep ? INNER : 1,
    })),
  ),
];
// Where the lines start, clear of the pitch.
const DIVISION_FROM = 0.16;

// Labels drawn on the ground, in the middle of their zones: [name, angle, distance].
const LABELS: [string, number, number][] = [
  ["Long off", 10, 0.82],
  ["Deep ex. cov", 35, 0.82],
  ["Deep cover", 65, 0.8],
  ["Deep point", 95, 0.8],
  ["Third man", 145, 0.8],
  ["Long on", -10, 0.82],
  ["Deep mid wkt", -40, 0.82],
  ["Deep sq. leg", -80, 0.8],
  ["Fine leg", -140, 0.8],
  ["Mid off", 10, 0.42],
  ["Ex. cover", 35, 0.4],
  ["Cover", 65, 0.38],
  ["Point", 95, 0.36],
  ["Gully", 127, 0.38],
  ["Mid on", -10, 0.42],
  ["Mid wkt", -40, 0.4],
  ["Sq. leg", -80, 0.36],
  ["Short fine", -122, 0.38],
];

const R = 100;
// A stored spot (or one at an angle and distance, as stored) on the drawing;
// mirror is -1 for a left-hander.
const onScreen = (x: number, y: number, mirror = 1) => ({ x: -x * R * mirror, y: -y * R });
const toSvg = (angle: number, distance: number, mirror = 1) => {
  const rad = (angle * Math.PI) / 180;
  return onScreen(Math.sin(rad) * distance, -Math.cos(rad) * distance, mirror);
};

const shotClass = (shot: Shot) => (shot.wicket ? "is-wicket" : shot.runs >= 6 ? "is-six" : shot.runs === 4 ? "is-four" : "is-run");

interface ShotGroundProps {
  shots?: Shot[];
  // The spot just tapped, while picking.
  marker?: { x: number; y: number } | null;
  // Makes the ground tappable; gets the spot as -1..1 x / y.
  onPick?: (x: number, y: number) => void;
  label?: string;
  // Draws the ground the way round it is for a left-handed batter.
  leftHanded?: boolean;
}

export function ShotGround({ shots = [], marker, onPick, label = "Cricket ground", leftHanded = false }: ShotGroundProps) {
  const mirror = leftHanded ? -1 : 1;
  function handleClick(e: MouseEvent<SVGSVGElement>) {
    if (!onPick) return;
    const box = e.currentTarget.getBoundingClientRect();
    // Turned back from the drawing to the stored way round.
    let x = (-mirror * (((e.clientX - box.left) / box.width) * 220 - 110)) / R;
    let y = -(((e.clientY - box.top) / box.height) * 220 - 110) / R;
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
      {DIVISIONS.map(({ angle, to }) => {
        const from = toSvg(angle, DIVISION_FROM, mirror);
        const end = toSvg(angle, to, mirror);
        return <line key={angle} className="cricket-shot-division" x1={from.x} y1={from.y} x2={end.x} y2={end.y} />;
      })}
      <line className="cricket-shot-axis" x1={0} y1={-R} x2={0} y2={R} />
      <rect className="cricket-shot-pitch" x={-4} y={-13} width={8} height={26} rx={1.5} />
      <text className="cricket-shot-side" x={-R + 4} y={-R + 10}>
        {leftHanded ? "Leg" : "Off"}
      </text>
      <text className="cricket-shot-side" x={R - 4} y={-R + 10} textAnchor="end">
        {leftHanded ? "Off" : "Leg"}
      </text>
      {LABELS.map(([name, angle, distance]) => {
        const at = toSvg(angle, distance, mirror);
        return (
          <text key={name} className="cricket-shot-label" x={at.x} y={at.y} textAnchor="middle">
            {name}
          </text>
        );
      })}
      {shots.map((shot, i) => {
        const at = onScreen(shot.x, shot.y, mirror);
        return (
          <g key={i} className={`cricket-shot ${shotClass(shot)}`}>
            <line x1={0} y1={0} x2={at.x} y2={at.y} />
            <circle cx={at.x} cy={at.y} r={2.6} />
          </g>
        );
      })}
      {marker && (
        <g className="cricket-shot is-marker">
          <line x1={0} y1={0} x2={onScreen(marker.x, marker.y, mirror).x} y2={onScreen(marker.x, marker.y, mirror).y} />
          <circle cx={onScreen(marker.x, marker.y, mirror).x} cy={onScreen(marker.x, marker.y, mirror).y} r={4} />
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
      <span className="is-wicket">Wicket</span>
    </div>
  );
}

// Insights: each innings' marked shots, for the whole side or one batter,
// plus where most of the runs went. Hidden when nothing was marked.
export function MatchShotMap({ match, nameOf }: { match: CricketMatch; nameOf: NameOf }) {
  const marked = match.innings.map((innings) =>
    innings.balls.flatMap((ball) =>
      ball.shotX != null && ball.shotY != null
        ? [
            {
              x: ball.shotX,
              y: ball.shotY,
              runs: ball.runs,
              wicket: isWicket(ball),
              zone: ball.shotZone ?? "",
              batterId: ball.batterId,
            },
          ]
        : [],
    ),
  );
  const [inningsIndex, setInningsIndex] = useState(() => Math.max(0, marked.findLastIndex((shots) => shots.length)));
  const [batter, setBatter] = useState("all");
  const { data: players } = useCricketPlayers();
  if (!marked.some((shots) => shots.length)) return null;

  const all = marked[inningsIndex] ?? [];
  const batterIds = [...new Set(all.map((shot) => shot.batterId))];
  const shots = batter === "all" ? all : all.filter((shot) => String(shot.batterId) === batter);
  // Mirrored for a left-hander, or when every batter shown is one; a mix of
  // hands is drawn the right-hander's way (off side still means off side).
  const leftHanded =
    shots.length > 0 &&
    shots.every((shot) => players?.find((p) => p.id === shot.batterId)?.battingStyle === "left-hand");
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
        <ShotGround shots={shots} leftHanded={leftHanded} label={`Shot map: ${shots.length} shots`} />
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
