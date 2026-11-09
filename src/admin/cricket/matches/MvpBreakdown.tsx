import { useState, type ReactNode } from "react";
import { BottomSheet } from "../BottomSheet";
import { PlayerAvatar } from "../players/PlayerAvatar";
import { points, type ImpactRow, type MvpSource, type playerImpactTotals } from "../stats";

const GROUPS = [
  { group: "batting", title: "Batting", tone: "is-batting", icon: "fa-baseball-bat-ball" },
  { group: "bowling", title: "Bowling", tone: "is-bowling", icon: "fa-baseball" },
  { group: "fielding", title: "Fielding", tone: "is-fielding", icon: "fa-hands" },
] as const;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const signed = (n: number) => `${n < 0 ? "−" : "+"}${Math.abs(n)}`;

// What a source is called, and in plain words where its points came from.
function describe(source: MvpSource): { label: string; icon: string; detail: string } {
  // Pressure is turned off for now, so a source earns just its normal value.
  // With it back on, add this to the end of each detail that has points from
  // a single ball: `, normally worth ${source.base}`.
  const runs = Math.abs(source.count);
  switch (source.kind) {
    case "runs":
      return { label: "Runs", icon: "fa-person-running", detail: plural(runs, "run") };
    case "fours":
      return { label: "Four bonus", icon: "fa-4", detail: plural(source.count, "four") };
    case "sixes":
      return { label: "Six bonus", icon: "fa-6", detail: plural(source.count, "six").replace("sixs", "sixes") };
    case "par":
      return source.group === "batting"
        ? { label: "Faster or slower than average", icon: "fa-gauge-high", detail: `${plural(runs, "run")} ${source.count < 0 ? "fewer" : "more"} than an average batter` }
        : { label: "Runs given away", icon: "fa-gauge-high", detail: `${plural(runs, "run")} ${source.count < 0 ? "more" : "fewer"} than an average bowler` };
    case "wickets":
      return { label: "Wickets", icon: "fa-crosshairs", detail: plural(source.count, "wicket") };
    case "hauls":
      return { label: "Wicket haul bonus", icon: "fa-layer-group", detail: "For 3, 5 or 10 wickets in an innings" };
    case "maidens":
      return { label: "Maidens", icon: "fa-circle", detail: plural(source.count, "maiden") };
    case "catches":
      return { label: "Catches", icon: "fa-hand", detail: plural(source.count, "catch").replace("catchs", "catches") };
    case "excellentCatches":
      return { label: "Excellent catch bonus", icon: "fa-hand-sparkles", detail: plural(source.count, "excellent catch").replace("catchs", "catches") };
    case "droppedCatches":
      return { label: "Dropped catches", icon: "fa-circle-xmark", detail: plural(source.count, "dropped catch").replace("catchs", "catches") };
    case "misfields":
      return { label: "Misfields", icon: "fa-triangle-exclamation", detail: plural(source.count, "misfield") };
    case "stumpings":
      return { label: "Stumpings", icon: "fa-bolt", detail: plural(source.count, "stumping") };
    case "runOuts":
      return { label: "Run-outs", icon: "fa-people-arrows", detail: plural(source.count, "run-out") };
    case "floor":
      return { label: "Minimum of 0", icon: "fa-shield-halved", detail: `${source.group === "batting" ? "Batting" : "Bowling"} points can't go below 0` };
  }
}

// Where a player's points came from, source by source: in a match, or added up
// across several (with a `totalNote` saying how many).
export function MvpSources({
  row,
  totalNote,
}: {
  row: Pick<ImpactRow, "sources" | "batting" | "bowling" | "fielding" | "total">;
  totalNote?: string;
}) {
  if (row.sources.length === 0) return <p className="cricket-mvp-guide-lead">No points yet.</p>;
  return (
    <div className="cricket-mvp-guide">
      {GROUPS.map(({ group, title, tone, icon }) => {
        const sources = row.sources.filter((source) => source.group === group);
        if (sources.length === 0) return null;
        return (
          <section key={group} className={`cricket-mvp-guide-group ${tone}`}>
            <h3>
              <i className={`fa-solid ${icon}`} aria-hidden="true"></i> {title}: {row[group]} pts
            </h3>
            <ul>
              {sources.map((source) => {
                const { label, icon: sourceIcon, detail } = describe(source);
                return (
                  <li key={source.kind}>
                    <span className="cricket-mvp-guide-icon" aria-hidden="true">
                      <i className={`fa-solid ${sourceIcon}`}></i>
                    </span>
                    <span className="cricket-mvp-guide-label">
                      {label}
                      <small>{detail}</small>
                    </span>
                    <strong>{signed(source.points)}</strong>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {/* With pressure back on:
      <p className="cricket-mvp-guide-intro">
        Points go up in a hard moment and down in an easy one, so what a player earned can differ from the normal value.
      </p>
      */}
      <p className="cricket-mvp-breakdown-total">
        <span>
          Total {totalNote && <small>{totalNote}</small>}
        </span>
        <strong>{row.total} pts</strong>
      </p>
    </div>
  );
}

// The order sources are listed in when players are set side by side, and which
// of them are a count worth showing under the points.
const SOURCE_ORDER: MvpSource["kind"][] = ["runs", "fours", "sixes", "wickets", "hauls", "maidens", "par", "catches", "excellentCatches", "stumpings", "runOuts", "droppedCatches", "misfields", "floor"];
const COUNTED = new Set<MvpSource["kind"]>(["runs", "fours", "sixes", "wickets", "maidens", "catches", "excellentCatches", "stumpings", "runOuts", "droppedCatches", "misfields"]);

// Marks the highest of a row and dims the rest, unless everyone is level.
const leadClass = (value: number, values: number[]) => {
  if (Math.max(...values) === Math.min(...values)) return undefined;
  return value === Math.max(...values) ? "is-lead" : "is-trail";
};

// Players' points side by side, source by source, the most in each row marked.
export function MvpCompare({
  players,
}: {
  players: { playerId: number; name: string; photoUrl?: string | null; totals: ReturnType<typeof playerImpactTotals> }[];
}) {
  const totals = players.map((p) => p.totals.total);
  // Rounded as shown, so two players showing the same figure are level.
  const perMatch = players.map((p) => (p.totals.matches ? Number((p.totals.total / p.totals.matches).toFixed(1)) : 0));
  return (
    <table className="cricket-mvp-compare">
      <thead>
        <tr>
          <th scope="col">
            <span className="visually-hidden">Points</span>
          </th>
          {players.map((p) => (
            <th key={p.playerId} scope="col">
              <PlayerAvatar name={p.name} photoUrl={p.photoUrl} className="cricket-board-avatar" viewable={false} />
              {/* A nickname wraps as a whole: "Anand" / "(Takki)". */}
              <span className="cricket-mvp-compare-name" title={p.name}>
                {p.name.replaceAll("(", "​(")}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr className="is-total">
          <th scope="row">Total points</th>
          {players.map((p, i) => (
            <td key={p.playerId} className={leadClass(totals[i], totals)}>
              {points(totals[i])}
            </td>
          ))}
        </tr>
        <tr>
          <th scope="row">Matches</th>
          {players.map((p) => (
            <td key={p.playerId}>{p.totals.matches}</td>
          ))}
        </tr>
        <tr>
          <th scope="row">Points a match</th>
          {players.map((p, i) => (
            <td key={p.playerId} className={leadClass(perMatch[i], perMatch)}>
              {p.totals.matches ? perMatch[i].toFixed(1) : "–"}
            </td>
          ))}
        </tr>
      </tbody>
      {GROUPS.map(({ group, title, tone, icon }) => {
        const inGroup = players.map((p) => p.totals.sources.filter((source) => source.group === group));
        const kinds = SOURCE_ORDER.filter((kind) => inGroup.some((sources) => sources.some((source) => source.kind === kind)));
        if (kinds.length === 0) return null;
        const groupTotals = players.map((p) => p.totals[group]);
        return (
          <tbody key={group} className={tone}>
            <tr className="is-group">
              <th scope="rowgroup">
                <i className={`fa-solid ${icon}`} aria-hidden="true"></i> {title}
              </th>
              {/* One colour across the band: the section's winner gets a crown instead. */}
              {players.map((p, i) => {
                const lead = leadClass(groupTotals[i], groupTotals);
                return (
                  <td key={p.playerId} className={lead === "is-trail" ? lead : undefined}>
                    {lead === "is-lead" && (
                      <i className="fa-solid fa-crown cricket-mvp-compare-crown" title={`Most ${title.toLowerCase()} points`} aria-label={`Most ${title.toLowerCase()} points`}></i>
                    )}
                    {points(groupTotals[i])}
                  </td>
                );
              })}
            </tr>
            {kinds.map((kind) => {
              const row = inGroup.map((sources) => sources.find((source) => source.kind === kind));
              const values = row.map((source) => source?.points ?? 0);
              const label = describe(row.find((source) => source)!).label;
              return (
                <tr key={kind} className="is-source">
                  <th scope="row">{label}</th>
                  {row.map((source, i) => (
                    <td key={players[i].playerId} className={leadClass(values[i], values)}>
                      {source ? signed(source.points) : "–"}
                      {source && COUNTED.has(kind) && <small>{describe(source).detail}</small>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        );
      })}
    </table>
  );
}

export function MvpBreakdownSheet({ row, name, onClose }: { row: ImpactRow; name: string; onClose: () => void }) {
  return (
    <BottomSheet title={`${name}'s points`} icon="fa-solid fa-star" onClose={onClose}>
      <MvpSources row={row} />
    </BottomSheet>
  );
}

// A player's points, tappable to see where they came from.
export function MvpPointsButton({ row, name, className = "", children }: { row: ImpactRow; name: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`cricket-mvp-points-btn ${className}`.trim()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`See where ${name}'s points came from`}
        title="See where these points came from"
      >
        {children}
      </button>
      {open && <MvpBreakdownSheet row={row} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}
