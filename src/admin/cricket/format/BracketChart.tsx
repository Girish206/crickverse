import { Link } from "react-router-dom";
import type { CricketBracketSlot, CricketFormat, CricketMatch, CricketPhase } from "../../../api/types";
import { teamScore } from "../matches/matchUtils";
import { slotFixture, slotMatch, sourceLabel, type Resolver } from "./formatEngine";

const CARD_W = 196;
const CARD_H = 92;
const COL_GAP = 40;
const ROW_GAP = 18;
// Card rows (see .cricket-bracket-card): a 30px head, then two 28px teams.
const HOME_ROW = 48;
const AWAY_ROW = 76;
const ROW_SPLIT = 62;

const shortDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", hour12: true, minute: "2-digit" })
    : "Date TBD";

// Lays the bracket out left to right: a match sits one column after the
// matches it takes its teams from (Q2 after Q1 and the Eliminator, the
// Final after both), level with them where there's room.
function layout(phase: CricketPhase) {
  const codes = new Set(phase.slots.map((slot) => slot.code));
  const feeders = (slot: CricketBracketSlot) =>
    [slot.home, slot.away].flatMap((source) => (source.from !== "rank" && source.from !== "team" && codes.has(source.slot) ? [source] : []));
  const depth = new Map<string, number>();
  const depthOf = (slot: CricketBracketSlot): number => {
    if (!depth.has(slot.code)) {
      const refs = feeders(slot).map((source) => phase.slots.find((s) => s.code === source.slot)!);
      depth.set(slot.code, refs.length ? 1 + Math.max(...refs.map(depthOf)) : 0);
    }
    return depth.get(slot.code)!;
  };
  phase.slots.forEach(depthOf);

  const top = new Map<string, number>();
  const columns = Math.max(...phase.slots.map((slot) => depth.get(slot.code)!)) + 1;
  for (let column = 0; column < columns; column += 1) {
    const slots = phase.slots.filter((slot) => depth.get(slot.code) === column);
    const wanted = slots.map((slot, i) => {
      const refs = feeders(slot).map((source) => top.get(source.slot)!);
      return { slot, y: refs.length ? refs.reduce((a, b) => a + b, 0) / refs.length : i * (CARD_H + ROW_GAP) };
    });
    // Keep the column's cards from overlapping.
    let next = 0;
    for (const { slot, y } of wanted.sort((a, b) => a.y - b.y)) {
      const placed = Math.max(y, next);
      top.set(slot.code, placed);
      next = placed + CARD_H + ROW_GAP;
    }
  }
  const position = (slot: CricketBracketSlot) => ({ x: depth.get(slot.code)! * (CARD_W + COL_GAP), y: top.get(slot.code)! });
  const height = Math.max(...[...top.values()]) + CARD_H;
  const width = columns * (CARD_W + COL_GAP) - COL_GAP;
  return { position, feeders, width, height };
}

// A knockout phase as a bracket: each match's card shows its teams (or where
// they'll come from), the scores and the winner, joined to the match its
// winner (solid) or loser (dashed) goes on to.
export function BracketChart({
  format,
  phase,
  matches,
  resolve,
  teamName,
  onSchedule,
}: {
  format: CricketFormat;
  phase: CricketPhase;
  matches: CricketMatch[];
  resolve: Resolver;
  teamName: (index: number) => string;
  // Organisers: schedule a match whose teams are known.
  onSchedule?: (slot: CricketBracketSlot) => void;
}) {
  if (phase.slots.length === 0) return null;
  const { position, feeders, width, height } = layout(phase);

  const lines = phase.slots.flatMap((slot) =>
    feeders(slot).map((source) => {
      const from = position(phase.slots.find((s) => s.code === source.slot)!);
      const to = position(slot);
      const x1 = from.x + CARD_W;
      // Out from between the source's two teams, into the team's own row.
      const y1 = from.y + ROW_SPLIT;
      const x2 = to.x;
      const y2 = to.y + (source === slot.home ? HOME_ROW : AWAY_ROW);
      const mx = x2 - COL_GAP / 2;
      return { key: `${source.slot}-${slot.code}`, d: `M${x1} ${y1} H${mx} V${y2} H${x2}`, loser: source.from === "loser" };
    }),
  );

  return (
    <div className="cricket-bracket-scroll">
      <div className="cricket-bracket" style={{ width, height }}>
        <svg className="cricket-bracket-lines" width={width} height={height} aria-hidden="true">
          {lines.map((line) => (
            <path key={line.key} d={line.d} className={line.loser ? "is-loser" : undefined} />
          ))}
        </svg>
        {phase.slots.map((slot) => {
          const { x, y } = position(slot);
          const match = slotMatch(slot.code, matches);
          const ready = !match && slotFixture(phase, slot, resolve) !== null;
          const sides = match
            ? match.teams.map((team, index) => ({
                name: team.name,
                known: true,
                score: teamScore(match, index)?.runs ?? null,
                won: match.status === "completed" && match.winner === index,
                lost: match.status === "completed" && match.winner === 1 - index,
              }))
            : [slot.home, slot.away].map((source) => {
                const index = resolve(source);
                return {
                  name: index === null ? sourceLabel(format, source, teamName) : teamName(index),
                  known: index !== null,
                  score: null,
                  won: false,
                  lost: false,
                };
              });
          const status = !match
            ? ready
              ? onSchedule
                ? "Schedule ›"
                : "Teams set"
              : "Waiting"
            : match.status === "live"
              ? "Live"
              : match.status === "scheduled"
                ? shortDate(match.scheduledAt)
                : (match.resultText ?? "Result");
          const body = (
            <>
              <span className="cricket-bracket-head">
                <strong>{slot.label}</strong>
                <span className={match?.status === "live" ? "is-live" : undefined}>{status}</span>
              </span>
              {sides.map((side, index) => (
                <span
                  key={index}
                  className={`cricket-bracket-team ${side.known ? "" : "is-tbd"} ${side.won ? "is-won" : ""} ${side.lost ? "is-lost" : ""}`}
                >
                  <span className="cricket-bracket-name" title={side.name}>
                    {side.name}
                  </span>
                  {side.score && <span className="cricket-bracket-score">{side.score}</span>}
                  {side.won && <i className="fa-solid fa-caret-left" aria-label="Winner"></i>}
                </span>
              ))}
            </>
          );
          const style = { left: x, top: y, width: CARD_W, height: CARD_H };
          const className = `cricket-bracket-card ${slot.stage === "final" ? "is-final" : ""} ${match?.status === "live" ? "is-live" : ""}`;
          if (match) {
            return (
              <Link key={slot.code} to={`/matches/${match.id}`} className={className} style={style}>
                {body}
              </Link>
            );
          }
          if (ready && onSchedule) {
            return (
              <button key={slot.code} type="button" className={`${className} is-ready`} style={style} onClick={() => onSchedule(slot)}>
                {body}
              </button>
            );
          }
          return (
            <div key={slot.code} className={className} style={style}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
